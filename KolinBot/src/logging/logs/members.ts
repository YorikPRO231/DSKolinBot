import {
  Client,
  EmbedBuilder,
  Guild,
  GuildMember,
  PartialGuildMember,
} from "discord.js";
import { formatDate } from "../helpers/dates";
import { formatMembersList, formatModerator } from "../helpers/formatters";
import { sendFullLog, sendLogToGuild } from "../helpers/senders";
import { getAuditExecutor, getNicknameChangeAudit } from "../helpers/audit";
import { getAdminLogServerIds, getStateServerIds } from "../../utils/config";
import { AuditLogEvent } from "discord.js";
import {
  syncFactionRolesOnJoin,
  checkAndKickIfNoRoles,
  handleFactionLeave,
  syncFactionRolesOnRoleChange,
} from "../faction-sync";

export async function logMemberJoin(client: Client, member: GuildMember) {
  const accountAge = Math.floor(
    (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24),
  );

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Участник присоединился")
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setDescription(
      [
        `**Пользователь:** ${member.user.tag}`,
        `**Упоминание:** <@${member.id}>`,
      ].join("\n"),
    )
    .addFields(
      {
        name: "Информация об аккаунте",
        value: [
          `ID: \`${member.id}\``,
          `Создан: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          `Возраст аккаунта: ${accountAge} дней`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Информация о сервере",
        value: [
          `Всего участников: ${member.guild.memberCount}`,
          `Присоединился: <t:${Math.floor(Date.now() / 1000)}:R>`,
        ].join("\n"),
        inline: true,
      },
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  const roleAdded = await syncFactionRolesOnJoin(client, member);
  await checkAndKickIfNoRoles(client, member, roleAdded);

  await sendLogToGuild(member.guild, embed);
}

export async function logMemberLeave(
  client: Client,
  member: GuildMember | PartialGuildMember,
) {
  if (!member.guild) return;

  if (member.partial) {
    try { await member.fetch(); } catch { return; }
  }

  const rolesList =
    member.roles?.cache
      .filter(role => role.name !== "@everyone")
      .map(role => role.name)
      .join(", ") || "Не удалось получить роли";

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Участник покинул сервер")
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setDescription(
      [
        `**Пользователь:** ${member.user.tag}`,
        `**Упоминание:** <@${member.id}>`,
      ].join("\n"),
    )
    .addFields(
      {
        name: "Информация",
        value: [
          `ID: \`${member.id}\``,
          `Присоединился: ${member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Неизвестно"}`,
          `Покинул: <t:${Math.floor(Date.now() / 1000)}:R>`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Статистика сервера",
        value: `Осталось участников: ${member.guild?.memberCount || "Неизвестно"}`,
        inline: true,
      },
      {
        name: "Роли на момент выхода",
        value: rolesList.substring(0, 1024) || "Нет ролей",
        inline: false,
      },
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  await sendLogToGuild(member.guild, embed);
  
  if (member.guild) {
    await handleFactionLeave(client, member.guild.id, member.id);
  }
}

export async function logMemberUpdate(
  client: Client,
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
) {
  if (!newMember.guild) return;

  await logNicknameChangeIfNeeded(oldMember, newMember);

  if (!oldMember.partial && "roles" in oldMember) {
    await logRolesChangeIfNeeded(client, oldMember, newMember);
  }
}

async function logNicknameChangeIfNeeded(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
): Promise<void> {
  if (oldMember.partial) return;
  
  const oldNick = (oldMember as GuildMember).nickname;
  const newNick = newMember.nickname;
  
  let nicknameChanged = oldNick !== newNick;
  let auditOldNick = oldNick;

  if (!nicknameChanged) {
    const auditResult = await getNicknameChangeAudit(newMember.guild, newMember.id);
    if (auditResult.oldNick !== undefined) {
      auditOldNick = auditResult.oldNick;
      nicknameChanged = true;
    }
  }

  if (!nicknameChanged) return;

  const { executor } = await getAuditExecutor(
    newMember.guild,
    AuditLogEvent.MemberUpdate,
    newMember.id,
  );

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Никнейм изменен")
    .setDescription(`**Пользователь:** <@${newMember.id}>`)
    .addFields(
      {
        name: "Предыдущий никнейм",
        value: auditOldNick === null ? "[Стандартное имя]" : auditOldNick || "[Не удалось определить]",
        inline: true,
      },
      {
        name: "Новый никнейм",
        value: newNick || "[Стандартное имя]",
        inline: true,
      },
      {
        name: "Кто изменил",
        value: formatModerator(executor),
        inline: false,
      },
      {
        name: "ID пользователя",
        value: `\`${newMember.id}\``,
        inline: false,
      },
    )
    .setFooter({ text: `Изменен: ${formatDate(Date.now())}` })
    .setTimestamp();

  await sendLogToGuild(newMember.guild, embed);
}

async function logRolesChangeIfNeeded(
  client: Client,
  oldMember: GuildMember,
  newMember: GuildMember,
): Promise<void> {
  const addedRoles = newMember.roles.cache.filter(
    role => !oldMember.roles.cache.has(role.id),
  );
  const removedRoles = oldMember.roles.cache.filter(
    role => !newMember.roles.cache.has(role.id),
  );

  if (addedRoles.size === 0 && removedRoles.size === 0) return;

  await syncFactionRolesOnRoleChange(
    client,
    newMember,
    Array.from(addedRoles.keys()),
    Array.from(removedRoles.keys()),
  );
  const { executor, reason } = await getAuditExecutor(
    newMember.guild,
    AuditLogEvent.MemberRoleUpdate,
    newMember.id,
  );

  if (addedRoles.size > 0) {
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("Роли добавлены")
      .setDescription(`**Пользователь:** <@${newMember.id}>`)
      .addFields(
        {
          name: `Добавлено ролей: ${addedRoles.size}`,
          value: addedRoles
            .map(r => `<@&${r.id}> (\`${r.name}\`)`)
            .join("\n")
            .substring(0, 1024),
          inline: false,
        },
        { name: "Кто изменил", value: formatModerator(executor), inline: true },
        { name: "Причина", value: reason || "Причина не указана", inline: true },
      )
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();

    await sendLogToGuild(newMember.guild, embed);
  }

  if (removedRoles.size > 0) {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("Роли удалены")
      .setDescription(`**Пользователь:** <@${newMember.id}>`)
      .addFields(
        {
          name: `Удалено ролей: ${removedRoles.size}`,
          value: removedRoles
            .map(r => `<@&${r.id}> (\`${r.name}\`)`)
            .join("\n")
            .substring(0, 1024),
          inline: false,
        },
        { name: "Кто изменил", value: formatModerator(executor), inline: true },
        { name: "Причина", value: reason || "Причина не указана", inline: true },
      )
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();

    await sendLogToGuild(newMember.guild, embed);
  }
}