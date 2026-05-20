import { Client, EmbedBuilder, VoiceState } from "discord.js";
import { formatMembersList, formatModerator } from "../helpers/formatters";
import { sendFullLog, sendLogToGuild } from "../helpers/senders";
import { getVoiceMoveAudit, getVoiceDisconnectAudit } from "../helpers/audit";
import { getAdminLogServerIds } from "../../utils/config";

export async function logVoiceStateUpdate(
  client: Client,
  oldState: VoiceState,
  newState: VoiceState,
) {
  if (
    oldState.channelId === newState.channelId &&
    oldState.serverMute === newState.serverMute &&
    oldState.serverDeaf === newState.serverDeaf
  ) {
    return;
  }

  const member = newState.member || oldState.member;
  if (!member?.guild) return;

  const adminServerIds = getAdminLogServerIds();
  if (!adminServerIds.includes(member.guild.id)) return;

  if (!oldState.channelId && newState.channelId) {
    await handleVoiceJoin(client, member, newState, adminServerIds);
  }
  else if (oldState.channelId && !newState.channelId) {
    await handleVoiceLeave(client, member, oldState, adminServerIds);
  }
  else if (
    oldState.channelId &&
    newState.channelId &&
    oldState.channelId !== newState.channelId
  ) {
    await handleVoiceMove(client, member, oldState, newState, adminServerIds);
  }
}

async function handleVoiceJoin(
  client: Client,
  member: NonNullable<VoiceState["member"]>,
  newState: VoiceState,
  adminServerIds: string[],
) {
  const channel = newState.channel;
  if (!channel) return;

  const { executor } = await getVoiceMoveAudit(
    member.guild,
    member.id,
    newState.channelId!,
  );

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Присоединился к голосовому каналу")
    .setDescription(`**Пользователь:** **${member.displayName}** (<@${member.id}>)`)
    .addFields(
      {
        name: "Голосовой канал",
        value: `${channel.name} (\`${channel.id}\`)`,
        inline: true,
      },
      { name: "Действие", value: "**Присоединился**", inline: true },
      { name: "Инициатор", value: formatModerator(executor), inline: true },
      {
        name: `Участники в канале (${channel.members.size})`,
        value: formatMembersList(
          channel.members
            .filter(m => !m.user.bot)
            .map(m => ({ displayName: m.displayName, id: m.id })),
        ),
        inline: false,
      },
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  await sendFullLog(client, member.guild, embed, undefined, adminServerIds);
}

async function handleVoiceLeave(
  client: Client,
  member: NonNullable<VoiceState["member"]>,
  oldState: VoiceState,
  adminServerIds: string[],
) {
  const channel = oldState.channel;
  if (!channel) return;

  const { executor } = await getVoiceDisconnectAudit(member.guild, member.id);

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Покинул голосовой канал")
    .setDescription(`**Пользователь:** **${member.displayName}** (<@${member.id}>)`)
    .addFields(
      {
        name: "Голосовой канал",
        value: `${channel.name} (\`${channel.id}\`)`,
        inline: true,
      },
      { name: "Действие", value: "**Вышел**", inline: true },
      { name: "Инициатор", value: formatModerator(executor), inline: true },
      {
        name: `Оставшиеся участники (${channel.members.size})`,
        value: formatMembersList(
          channel.members
            .filter(m => !m.user.bot)
            .map(m => ({ displayName: m.displayName, id: m.id })),
        ),
        inline: false,
      },
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  await sendFullLog(client, member.guild, embed, undefined, adminServerIds);
}

async function handleVoiceMove(
  client: Client,
  member: NonNullable<VoiceState["member"]>,
  oldState: VoiceState,
  newState: VoiceState,
  adminServerIds: string[],
) {
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  if (!oldChannel || !newChannel) return;

  const { executor } = await getVoiceMoveAudit(
    member.guild,
    member.id,
    newState.channelId!,
  );

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("Переместился в другой голосовой канал")
    .setDescription(`**Пользователь:** **${member.displayName}** (<@${member.id}>)`)
    .addFields(
      {
        name: "Предыдущий канал",
        value: `${oldChannel.name} (\`${oldChannel.id}\`)`,
        inline: true,
      },
      {
        name: "Новый канал",
        value: `${newChannel.name} (\`${newChannel.id}\`)`,
        inline: true,
      },
      { name: "Кто переместил", value: formatModerator(executor), inline: true },
      {
        name: `Оставшиеся в ${oldChannel.name} (${oldChannel.members.size})`,
        value: formatMembersList(
          oldChannel.members
            .filter(m => !m.user.bot)
            .map(m => ({ displayName: m.displayName, id: m.id })),
        ),
        inline: false,
      },
      {
        name: `Участники в ${newChannel.name} (${newChannel.members.size})`,
        value: formatMembersList(
          newChannel.members
            .filter(m => !m.user.bot)
            .map(m => ({ displayName: m.displayName, id: m.id })),
        ),
        inline: false,
      },
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  await sendFullLog(client, member.guild, embed, undefined, adminServerIds);
}