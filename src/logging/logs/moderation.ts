import {
  Client,
  EmbedBuilder,
  Guild,
  User,
  AuditLogEvent,
} from "discord.js";
import { formatDate } from "../helpers/dates";
import { formatModerator } from "../helpers/formatters";
import { sendLogToGuild } from "../helpers/senders";
import { getAuditExecutor } from "../helpers/audit";

export async function logMemberBan(
  client: Client,
  user: User,
  guildId: string,
  reason?: string | null,
) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const { executor } = await getAuditExecutor(
    guild,
    AuditLogEvent.MemberBanAdd,
    user.id,
  );

  const embed = new EmbedBuilder()
    .setColor(0xc0392b)
    .setTitle("Участник заблокирован")
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(`**Пользователь:** ${user.tag}`)
    .addFields(
      { name: "ID пользователя", value: `\`${user.id}\``, inline: true },
      {
        name: "Кто забанил",
        value: formatModerator(executor),
        inline: true,
      },
      { name: "Причина", value: reason || "Не указана", inline: true },
      { name: "Дата", value: formatDate(Date.now()), inline: true },
    )
    .setTimestamp();

  await sendLogToGuild(guild, embed);
}

export async function logMemberUnban(
  client: Client,
  user: User,
  guildId: string,
) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const { executor } = await getAuditExecutor(
    guild,
    AuditLogEvent.MemberBanRemove,
    user.id,
  );

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Участник разблокирован")
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(`**Пользователь:** ${user.tag}`)
    .addFields(
      { name: "ID пользователя", value: `\`${user.id}\``, inline: true },
      {
        name: "Кто разбанил",
        value: formatModerator(executor),
        inline: true,
      },
      { name: "Дата", value: formatDate(Date.now()), inline: true },
    )
    .setTimestamp();

  await sendLogToGuild(guild, embed);
}

export async function logMemberKick(
  client: Client,
  guild: Guild,
  target: User,
  executor?: User,
  reason?: string | null,
) {
  if (!guild) return;

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Участник кикнут")
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setDescription(
      [
        `**Кикнут:** ${target.tag}`,
        `**ID:** \`${target.id}\``,
        executor
          ? `**Кто кикнул:** ${executor.tag} (<@${executor.id}>)`
          : "**Кто кикнул:** Неизвестно",
        reason ? `**Причина:** ${reason}` : "**Причина:** Не указана",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .setFooter({ text: `ID кикнутого: ${target.id}` })
    .setTimestamp();

  await sendLogToGuild(guild, embed);
}