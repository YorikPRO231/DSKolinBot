import {Router} from 'express';
import {EmbedBuilder} from 'discord.js';
import {bindingsManager} from '../../utils/bindingsManager';
import {getDiscordClient} from '../services/discord.service';
import {webhookRateLimiter} from '../middleware/rateLimit.middleware';
import {AppError} from '../middleware/errorHandler.middleware';

interface FormResponse {
  formId: string;
  formTitle: string;
  answers: Record<string, string>;
  timestamp: string;
  respondentEmail?: string;
}

const router = Router();

function sanitizeText(text: string): string {
  if (!text) return "Без ответа";
  return text
    .replace(/@everyone/gi, "@​everyone")
    .replace(/@here/gi, "@​here")
    .replace(/<@&\d+>/g, "[role]")
    .replace(/<@!?\d+>/g, "[user]")
    .trim();
}

function sanitizeQuestion(question: string): string {
  if (!question) return "Без вопроса";
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

  if (!channel || !channel.isSendable()) {
    throw AppError.notFound('Channel not found');
  }

  const timestamp = new Date(response.timestamp);

  if (isNaN(timestamp.getTime())) {
    throw AppError.badRequest('Invalid timestamp');
  }

  const MAX_FIELD_VALUE = 1024;
  const MAX_FIELDS = 25;
  const MAX_EMBED_LENGTH = 6000;

  const embeds: EmbedBuilder[] = [];

  const createEmbed = (index?: number, total?: number) => {
    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTimestamp(timestamp)
        .setFooter({
          text:
              `Google Forms | ${response.formId.slice(-12)}` +
              (index && total
                  ? ` | Часть ${index}/${total}`
                  : ''),
        });

    if (!index || index === 1) {
      embed.setTitle(
          sanitizeText(response.formTitle).slice(0, 256)
      );
    }

    return embed;
  };

  let currentEmbed = createEmbed();

  let currentFieldCount = 0;
  let currentEmbedLength =
      sanitizeText(response.formTitle).slice(0, 256).length;

  const pushEmbed = () => {
    embeds.push(currentEmbed);

    currentEmbed = createEmbed();

    currentFieldCount = 0;
    currentEmbedLength = 0;
  };

  for (const [questionRaw, answerRaw] of Object.entries(response.answers)) {
    if (
        answerRaw.trim() === ''
    ) {
      continue;
    }

    const question = sanitizeQuestion(questionRaw)
        .slice(0, 256);

    const answer = sanitizeText(answerRaw);

    const parts: string[] = [];

    for (
        let i = 0;
        i < answer.length;
        i += MAX_FIELD_VALUE
    ) {
      parts.push(
          answer.slice(i, i + MAX_FIELD_VALUE)
      );
    }

    for (
        let partIndex = 0;
        partIndex < parts.length;
        partIndex++
    ) {
      const part = parts[partIndex];

      const fieldName =
          parts.length > 1
              ? `${question} (${partIndex + 1}/${parts.length})`
              : question;

      const fieldLength =
          fieldName.length + part.length;

      const wouldOverflowFields =
          currentFieldCount >= MAX_FIELDS;

      const wouldOverflowEmbed =
          currentEmbedLength + fieldLength >=
          MAX_EMBED_LENGTH;

      if (
          wouldOverflowFields ||
          wouldOverflowEmbed
      ) {
        pushEmbed();
      }

      currentEmbed.addFields({
        name: fieldName,
        value: part,
        inline: false,
      });

      currentFieldCount++;
      currentEmbedLength += fieldLength;
    }
  }

  if (currentFieldCount > 0) {
    embeds.push(currentEmbed);
  }

  if (embeds.length === 0) {
    return res.json({
      success: true,
      skipped: 'All answers empty',
    });
  }

  embeds.forEach((embed, index) => {
    embed.setFooter({
      text:
          `Google Forms | ${response.formId.slice(-12)}` +
          (embeds.length > 1
              ? ` | Часть ${index + 1}/${embeds.length}`
              : ''),
    });
  });

  let content = '';

  const allowedMentions = {
    parse: [] as const,
    roles: [] as string[],
  };

  const pingRoles: string[] = [];

  if (binding.pingRoleId) {
    pingRoles.push(binding.pingRoleId);
  }

  if (binding.pingRoleId2) {
    pingRoles.push(binding.pingRoleId2);
  }

  if (pingRoles.length > 0) {
    content = pingRoles
        .map((roleId) => `<@&${roleId}>`)
        .join(' ');

    allowedMentions.roles = pingRoles;
  }

  await channel.send({
    content: content || undefined,
    embeds: embeds.slice(0, 10),
    allowedMentions,
  });

  if (embeds.length > 10) {
    for (let i = 10; i < embeds.length; i += 10) {
      await channel.send({
        embeds: embeds.slice(i, i + 10),
      });
    }
  }

  res.json({
    success: true,
    channelId: binding.channelId,
  });
});

export default router;