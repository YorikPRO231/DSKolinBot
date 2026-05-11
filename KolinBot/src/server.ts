import express from "express";
import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { bindingsManager } from "./utils/bindingsManager";

const app = express();
app.use(express.json());

let discordClient: Client | null = null;

export function initializeGoogleFormsServer(client: Client) {
  discordClient = client;
}

interface FormResponse {
  formId: string;
  formTitle: string;
  answers: Record<string, string>;
  timestamp: string;
  respondentEmail?: string;
}

function sanitizeText(text: string): string {
  if (!text) return "*Нет ответа*";

  return text
    .replace(/@everyone/gi, "@​everyone")
    .replace(/@here/gi, "@​here")
    .replace(/<@&\d+>/g, "[роль]")
    .replace(/<@!?\d+>/g, "[пользователь]")
    .trim();
}

function sanitizeQuestion(question: string): string {
  if (!question) return "Вопрос";

  return question
    .replace(/@everyone/gi, "everyone")
    .replace(/@here/gi, "here")
    .substring(0, 256)
    .trim();
}

function validateAnswers(answers: Record<string, string>): {
  valid: boolean;
  reason?: string;
} {
  const answerCount = Object.keys(answers).length;

  if (answerCount === 0) {
    return { valid: false, reason: "Пустая форма" };
  }

  for (const [question, answer] of Object.entries(answers)) {
    if (question.length > 500) {
      return { valid: false, reason: "Слишком длинный вопрос" };
    }

    if (answer && answer.length > 5000) {
      return { valid: false, reason: "Слишком длинный ответ" };
    }

    if (answer && /(.)\1{100,}/.test(answer)) {
      return { valid: false, reason: "Обнаружен спам-паттерн" };
    }
  }

  return { valid: true };
}

app.post("/api/bindings", (req, res) => {
  try {
     const { formId, channelId, guildId, formName, pingRoleId, pingRoleId2 } = req.body;

    if (!formId || !channelId || !guildId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const binding = bindingsManager.addBinding(
    formId, channelId, guildId, formName, pingRoleId, pingRoleId2
  );
    res.json({ success: true, binding });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/bindings", (req, res) => {
  const { guildId } = req.query;

  if (guildId) {
    res.json(bindingsManager.getGuildBindings(guildId as string));
  } else {
    res.json(bindingsManager.getAllBindings());
  }
});

app.delete("/api/bindings/:formId", (req, res) => {
  const deleted = bindingsManager.removeBinding(req.params.formId);

  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Binding not found" });
  }
});

app.post("/webhook/form-response", async (req, res) => {
  try {
    const response: FormResponse = req.body;

    const validation = validateAnswers(response.answers);
    if (!validation.valid) {
      console.warn(`⚠️ Валидация не пройдена: ${validation.reason}`);
      return res.status(400).json({
        error: "Invalid data",
        reason: validation.reason,
      });
    }

    const binding = bindingsManager.getBinding(response.formId);

    if (!binding) {
      return res.status(404).json({ error: "No binding found for this form" });
    }

    if (!discordClient) {
      return res.status(500).json({ error: "Discord client not ready" });
    }

    const channel = await discordClient.channels.fetch(binding.channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const answerEntries = Object.entries(response.answers).filter(
      ([_, answer]) => answer && answer.trim() !== "",
    );
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
          text: `Google Forms | ${response.formId.slice(-12)}${chunks.length > 1 ? ` | Часть ${chunkIndex + 1}/${chunks.length}` : ""}`,
        });

      if (chunkIndex === 0) {
        embed.setTitle(`${sanitizeText(response.formTitle)}`);
      }

      chunk.forEach(([question, answer]) => {
        const cleanQuestion = sanitizeQuestion(question);
        const cleanAnswer = sanitizeText(answer);

        embed.addFields({
          name: `${cleanQuestion}`,
          value:
            cleanAnswer.length > 1024
              ? cleanAnswer.substring(0, 1021) + "..."
              : cleanAnswer,
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
      allowedMentions: allowedMentions,
    });

    if (embeds.length > 10) {
      for (let i = 10; i < embeds.length; i += 10) {
        await channel.send({
          embeds: embeds.slice(i, i + 10),
        });
      }
    }

    res.json({ success: true, channelId: binding.channelId });
  } catch (error) {
    console.error("Error processing form response:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    bindings: bindingsManager.getAllBindings().length,
    discordReady: discordClient?.isReady() || false,
    uptime: process.uptime(),
  });
});

const PORT = 8080;

export function startGoogleFormsServer() {
  app.listen(PORT, () => {
    console.log(`🌐 Сервер запущен на порту ${PORT}`);

    const bindings = bindingsManager.getAllBindings();
    if (bindings.length > 0) {
      console.log("📋 Активные привязки:");
      bindings.forEach((b) => {
        console.log(
          `  • ${b.formName} → ${b.channelId}${b.pingRoleId ? " 🔔" : ""}`,
        );
      });
    }
  });
}

export default app;
