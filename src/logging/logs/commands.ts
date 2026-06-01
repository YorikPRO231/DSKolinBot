import {
  Client,
  EmbedBuilder,
  User,
} from "discord.js";
import { shouldCreateFile } from "../config";
import { formatDate } from "../helpers/dates";
import { createTextAttachment, createAttachmentBuilder } from "../helpers/formatters";
import { sendLogToGuild } from "../helpers/senders";

export async function logCommand(
  client: Client,
  user: User,
  commandName: string,
  options: any,
  channelId: string,
) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  const guild =
    channel && "guild" in channel ? channel.guild : null;

  if (!guild) return;

  const optionsString = JSON.stringify(options, null, 2);
  const needsFile = shouldCreateFile(optionsString);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("Использована команда")
    .setDescription(`**Пользователь:** ${user.tag}`)
    .addFields(
      { name: "Команда", value: `\`/${commandName}\``, inline: true },
      { name: "Канал", value: `<#${channelId}>`, inline: true },
      {
        name: "Параметры",
        value: needsFile
          ? "См. вложение"
          : optionsString.substring(0, 1024) || "Без параметров",
        inline: false,
      },
    )
    .setFooter({ text: `ID: ${user.id}` })
    .setTimestamp();

  if (needsFile) {
    const textAttachment = createTextAttachment(
      optionsString,
      `command_${commandName}_${Date.now()}.json`,
    );
    const attachment = createAttachmentBuilder(textAttachment);
    await sendLogToGuild(guild, embed, attachment);
  } else {
    await sendLogToGuild(guild, embed);
  }
}