import {
  Client,
  EmbedBuilder,
} from "discord.js";
import { shouldCreateFile } from "./config";
import { formatDate } from "./helpers/dates";
import { createTextAttachment, createAttachmentBuilder } from "./helpers/formatters";

export async function logError(client: Client, error: Error, context?: string) {
  const recipients = [
    "1429367223373533285",
    "565973511957381161",
  ];

  try {
    const errorMessage = error.stack || error.message;
    const needsFile = shouldCreateFile(errorMessage);

    const embed = new EmbedBuilder()
      .setColor(0xc0392b)
      .setTitle("Критическая ошибка")
      .addFields(
        { name: "Контекст", value: context || "Не указан", inline: false },
        {
          name: "Сообщение ошибки",
          value: error.message.substring(0, 1024),
          inline: false,
        },
      )
      .setFooter({ text: `Произошла: ${formatDate(Date.now())}` })
      .setTimestamp();

    let attachment;

    if (needsFile) {
      embed.addFields({
        name: "Дополнительно",
        value: "Полный стек ошибки прикреплен в виде файла",
        inline: false,
      });

      const textAttachment = createTextAttachment(
        errorMessage,
        `error_${Date.now()}.txt`,
      );
      attachment = createAttachmentBuilder(textAttachment);
    } else {
      if (error.stack) {
        embed.addFields({
          name: "Стек вызовов",
          value: error.stack.substring(0, 1024),
          inline: false,
        });
      }
    }

    for (const userId of recipients) {
      try {
        const user = await client.users.fetch(userId).catch(() => null);

        if (!user) {
          console.warn(`Не удалось найти пользователя с ID ${userId}`);
          continue;
        }

        const messagePayload: any = { embeds: [embed] };
        if (attachment) {
          messagePayload.files = [attachment];
        }

        await user.send(messagePayload);
        console.log(`✅ Ошибка отправлена пользователю ${user.tag} (${userId})`);
      } catch (sendError) {
        console.error(`Не удалось отправить ошибку пользователю ${userId}:`, sendError);
      }
    }

    console.error(`[ERROR] ${context || "No context"}:`, error);
  } catch (err) {
    console.error("Не удалось отправить ошибку в личку:", err);
    console.error("Исходная ошибка:", error);
  }
}