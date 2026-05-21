import {
  AttachmentBuilder,
  Client,
  EmbedBuilder,
  Message,
  PartialMessage,
} from "discord.js";
import { shouldCreateFile } from "../config";
import { formatDate } from "../helpers/dates";
import { createTextAttachment, formatSize, createAttachmentBuilder } from "../helpers/formatters";
import { sendFullLog } from "../helpers/senders";
import { getAdminLogServerIds } from "../../utils/config";

export async function logMessageDelete(
  client: Client,
  message: Message | PartialMessage,
) {
  if (message.partial) {
    try {
      await message.fetch();
    } catch {
      return;
    }
  }

  if (message.system) return;
  if (!message.content && message.attachments.size === 0) return;
  if (!message.author) return;
  if (!message.guild) return;

  const content = message.content || "";
  const needsFile = shouldCreateFile(content);

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Сообщение удалено")
    .setDescription(
      [
        `**Автор:** ${message.author.tag}`,
        `**Канал:** <#${message.channel.id}>`,
        `**Дата создания:** ${formatDate(message.createdTimestamp)}`,
        message.reference
          ? `**Ответ на:** [сообщение](https://discord.com/channels/${message.guildId}/${message.channel.id}/${message.reference.messageId})`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .setFooter({
      text: `ID сообщения: ${message.id} | ID автора: ${message.author.id}`,
    })
    .setTimestamp();

  let attachment: AttachmentBuilder | undefined;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (needsFile) {
    const preview = content.substring(0, 1000);
    fields.push({
      name: `Содержание (${content.length} символов)`,
      value: preview + "\n\n*Полный текст в прикрепленном файле*",
      inline: false,
    });

    const textAttachment = createTextAttachment(
      content,
      `deleted_message_${message.id}.txt`,
    );
    attachment = createAttachmentBuilder(textAttachment);

    if (message.attachments.size > 0) {
      const attachmentsList = message.attachments
        .map((a, i) => `${i + 1}. ${a.name} (${formatSize(a.size)})`)
        .join("\n");

      fields.push({
        name: `Вложения (${message.attachments.size})`,
        value: attachmentsList,
        inline: false,
      });
    }
  } else {
    fields.push({
      name: content ? "Содержание" : "Тип сообщения",
      value: content || "Сообщение без текста (только вложения)",
      inline: false,
    });

    if (message.attachments.size > 0) {
      const attachmentsList = message.attachments
        .map(
          (a, i) => `${i + 1}. [${a.name}](${a.url}) - ${formatSize(a.size)}`,
        )
        .join("\n");

      fields.push({
        name: `Вложения (${message.attachments.size})`,
        value: attachmentsList.substring(0, 1024),
        inline: false,
      });
    }
  }

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  await sendFullLog(
    client,
    message.guild,
    embed,
    attachment,
    getAdminLogServerIds(),
  );
}

export async function logMessageUpdate(
  client: Client,
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
) {
  if (oldMessage.partial) {
    try { await oldMessage.fetch(); } catch { return; }
  }
  if (newMessage.partial) {
    try { await newMessage.fetch(); } catch { return; }
  }

  if (oldMessage.content === newMessage.content) return;
  if (!oldMessage.author) return;
  if (!oldMessage.guild) return;

  const oldContent = oldMessage.content || "Пусто";
  const newContent = newMessage.content || "Пусто";
  const needsFile = shouldCreateFile(oldContent) || shouldCreateFile(newContent);

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("Сообщение отредактировано")
    .setDescription(
      [
        `**Автор:** ${oldMessage.author.tag}`,
        `**Канал:** <#${oldMessage.channel.id}>`,
        `**ID автора:** ${oldMessage.author.id}`,
        `**Ссылка:** [Перейти к сообщению](${newMessage.url})`,
      ].join("\n"),
    )
    .setFooter({
      text: `ID сообщения: ${oldMessage.id} | Отредактировано`,
    })
    .setTimestamp();

  let attachment: AttachmentBuilder | undefined;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (needsFile) {
    const oldPreview = oldContent.substring(0, 500);
    const newPreview = newContent.substring(0, 500);

    fields.push(
      {
        name: `Старая версия (${oldContent.length} символов)`,
        value: oldPreview + (oldContent.length > 500 ? "\n\n*Полный текст в файле*" : ""),
        inline: false,
      },
      {
        name: `Новая версия (${newContent.length} символов)`,
        value: newPreview + (newContent.length > 500 ? "\n\n*Полный текст в файле*" : ""),
        inline: false,
      },
    );

    const fullContent = [
      "=== СТАРАЯ ВЕРСИЯ ===",
      `Длина: ${oldContent.length} символов`,
      "",
      oldContent,
      "",
      "=== НОВАЯ ВЕРСИЯ ===",
      `Длина: ${newContent.length} символов`,
      "",
      newContent,
    ].join("\n");

    const textAttachment = createTextAttachment(
      fullContent,
      `edited_message_${oldMessage.id}.txt`,
    );
    attachment = createAttachmentBuilder(textAttachment);
  } else {
    fields.push(
      {
        name: "Старая версия",
        value: oldContent.substring(0, 1024) || "Пусто",
        inline: false,
      },
      {
        name: "Новая версия",
        value: newContent.substring(0, 1024) || "Пусто",
        inline: false,
      },
    );
  }

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  await sendFullLog(
    client,
    oldMessage.guild,
    embed,
    attachment,
    getAdminLogServerIds(),
  );
}