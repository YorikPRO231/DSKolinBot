import {
  Client,
  EmbedBuilder,
  GuildChannel,
  AuditLogEvent,
} from "discord.js";
import { formatDate } from "../helpers/dates";
import { formatModerator } from "../helpers/formatters";
import { sendLogToGuild } from "../helpers/senders";
import { getAuditExecutor } from "../helpers/audit";

export async function logChannelCreate(client: Client, channel: GuildChannel) {
  if (!channel.guild) return;

  const { executor } = await getAuditExecutor(
    channel.guild,
    AuditLogEvent.ChannelCreate,
    channel.id,
  );

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Канал создан")
    .addFields(
      { name: "Название", value: `\`${channel.name}\``, inline: true },
      { name: "Тип", value: `\`${channel.type}\``, inline: true },
      { name: "ID", value: `\`${channel.id}\``, inline: true },
      { name: "Кто создал", value: formatModerator(executor), inline: true },
    )
    .setFooter({ text: `Создан: ${formatDate(channel.createdTimestamp)}` })
    .setTimestamp();

  await sendLogToGuild(channel.guild, embed);
}

export async function logChannelDelete(client: Client, channel: GuildChannel) {
  if (!channel.guild) return;

  const { executor, reason } = await getAuditExecutor(
    channel.guild,
    AuditLogEvent.ChannelDelete,
    channel.id,
  );

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Канал удален")
    .addFields(
      { name: "Название", value: `\`${channel.name}\``, inline: true },
      { name: "ID канала", value: `\`${channel.id}\``, inline: true },
      { name: "Тип", value: `\`${channel.type}\``, inline: true },
      { name: "Кто удалил", value: formatModerator(executor), inline: true },
      { name: "Причина", value: reason || "Причина не указана", inline: true },
    )
    .setFooter({ text: `Удален: ${formatDate(Date.now())}` })
    .setTimestamp();

  await sendLogToGuild(channel.guild, embed);
}

export async function logChannelUpdate(
  client: Client,
  oldChannel: GuildChannel,
  newChannel: GuildChannel,
) {
  if (!newChannel.guild) return;

  if (oldChannel.name !== newChannel.name) {
    const { executor, reason } = await getAuditExecutor(
      newChannel.guild,
      AuditLogEvent.ChannelUpdate,
      newChannel.id,
    );

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("Канал переименован")
      .addFields(
        {
          name: "Старое название",
          value: `\`${oldChannel.name}\``,
          inline: true,
        },
        {
          name: "Новое название",
          value: `\`${newChannel.name}\``,
          inline: true,
        },
        { name: "Кто изменил", value: formatModerator(executor), inline: true },
        { name: "Причина", value: reason || "Причина не указана", inline: true },
        { name: "ID канала", value: `\`${newChannel.id}\``, inline: false },
      )
      .setTimestamp();

    await sendLogToGuild(newChannel.guild, embed);
  }

  if (
    "topic" in oldChannel &&
    "topic" in newChannel &&
    (oldChannel as any).topic !== (newChannel as any).topic
  ) {
    const oldTopic = (oldChannel as any).topic || "[Отсутствовала]";
    const newTopic = (newChannel as any).topic || "[Убрана]";
    const needsFile = oldTopic.length > 3000 || newTopic.length > 3000;

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("Тема канала изменена")
      .setDescription(`**Канал:** \`${newChannel.name}\``)
      .setTimestamp();

    if (needsFile) {
      const { createTextAttachment, createAttachmentBuilder } = await import("../helpers/formatters");
      
      embed.addFields(
        {
          name: "Предыдущая тема",
          value: oldTopic.substring(0, 512) + "\n\n*Полный текст в файле*",
          inline: false,
        },
        {
          name: "Новая тема",
          value: newTopic.substring(0, 512) + "\n\n*Полный текст в файле*",
          inline: false,
        },
      );

      const fullContent = `Предыдущая тема:\n${oldTopic}\n\nНовая тема:\n${newTopic}`;
      const textAttachment = createTextAttachment(
        fullContent,
        `channel_topic_${newChannel.id}.txt`,
      );
      const attachment = createAttachmentBuilder(textAttachment);
      await sendLogToGuild(newChannel.guild, embed, attachment);
    } else {
      embed.addFields(
        { name: "Предыдущая тема", value: oldTopic, inline: false },
        { name: "Новая тема", value: newTopic, inline: false },
      );
      await sendLogToGuild(newChannel.guild, embed);
    }
  }
}