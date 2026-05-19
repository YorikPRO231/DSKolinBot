import { Router } from 'express';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { bindingsManager } from '../../utils/bindingsManager';
import { getDiscordClient } from '../services/discord.service';
import { webhookRateLimiter } from '../middleware/rateLimit.middleware';
import { AppError } from '../middleware/errorHandler.middleware';

interface FormResponse {
  formId: string;
  formTitle: string;
  answers: Record<string, string>;
  timestamp: string;
  respondentEmail?: string;
}

const router = Router();

function sanitizeText(text: string): string {
  if (!text || typeof text !== "string") return "No answer";
  return text
    .replace(/@everyone/gi, "@​everyone")
    .replace(/@here/gi, "@​here")
    .replace(/<@&\d+>/g, "[role]")
    .replace(/<@!?\d+>/g, "[user]")
    .trim();
}

function sanitizeQuestion(question: string): string {
  if (!question || typeof question !== "string") return "Question";
  return question
    .replace(/@everyone/gi, "everyone")
    .replace(/@here/gi, "here")
    .substring(0, 256)
    .trim();
}

function validateAnswers(answers: Record<string, string>): { valid: boolean; reason?: string } {
  const answerCount = Object.keys(answers).length;
  if (answerCount === 0) return { valid: false, reason: "Empty form" };
  
  for (const [question, answer] of Object.entries(answers)) {
    if (question.length > 500) return { valid: false, reason: "Question too long" };
    if (answer && answer.length > 5000) return { valid: false, reason: "Answer too long" };
    if (answer && /(.)\1{100,}/.test(answer)) return { valid: false, reason: "Spam pattern detected" };
  }
  return { valid: true };
}

router.post('/form-response', webhookRateLimiter, async (req, res) => {
  const response: FormResponse = req.body;
  
  const validation = validateAnswers(response.answers);
  if (!validation.valid) {
    throw AppError.badRequest('Invalid data', validation.reason);
  }
  
  const binding = bindingsManager.getBinding(response.formId);
  if (!binding) {
    throw AppError.notFound('No binding found for this form');
  }
  
  const discordClient = await getDiscordClient();
  const channel = await discordClient.channels.fetch(binding.channelId);
  
  if (!channel || !(channel instanceof TextChannel)) {
    throw AppError.notFound('Channel not found');
  }
  
  const answerEntries = Object.entries(response.answers).filter(
    ([_, answer]) => answer && answer.trim() !== ""
  ) as [string, string][];
  
  const chunks: Array<[string, string][]> = [];
  for (let i = 0; i < answerEntries.length; i += 25) {
    chunks.push(answerEntries.slice(i, i + 25));
  }
  
  if (chunks.length === 0) {
    return res.json({ success: true, skipped: "All answers empty" });
  }
  
  const embeds: EmbedBuilder[] = [];
  chunks.forEach((chunk, chunkIndex) => {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTimestamp(new Date(response.timestamp))
      .setFooter({
        text: `Google Forms | ${response.formId.slice(-12)}${chunks.length > 1 ? ` | Part ${chunkIndex + 1}/${chunks.length}` : ""}`,
      });
    
    if (chunkIndex === 0) {
      embed.setTitle(sanitizeText(response.formTitle));
    }
    
    chunk.forEach(([question, answer]) => {
      const cleanQuestion = sanitizeQuestion(question);
      const cleanAnswer = sanitizeText(answer);
      embed.addFields({
        name: cleanQuestion,
        value: cleanAnswer.length > 1024 ? cleanAnswer.substring(0, 1021) + "..." : cleanAnswer,
        inline: false,
      });
    });
    
    embeds.push(embed);
  });
  
  let content = "";
  const allowedMentions: any = { parse: [], roles: [] };
  const pingRoles = [];
  
  if (binding.pingRoleId) pingRoles.push(binding.pingRoleId);
  if (binding.pingRoleId2) pingRoles.push(binding.pingRoleId2);
  
  if (pingRoles.length > 0) {
    content = pingRoles.map((roleId) => `<@&${roleId}>`).join(" ");
    allowedMentions.roles = pingRoles;
  }
  
  await channel.send({
    content: content || undefined,
    embeds: embeds.slice(0, 10),
    allowedMentions,
  });
  
  if (embeds.length > 10) {
    for (let i = 10; i < embeds.length; i += 10) {
      await channel.send({ embeds: embeds.slice(i, i + 10) });
    }
  }
  
  res.json({ success: true, channelId: binding.channelId });
});

export default router;