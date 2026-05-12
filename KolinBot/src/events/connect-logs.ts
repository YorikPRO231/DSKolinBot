import {AuditLogEvent, Client, Events, GuildChannel, User} from "discord.js";
import * as logger from "../logger";
import {punishChecker} from "./messages";

export const name = "ready";
export const once = true;

export function execute(client: Client) {
  console.log('📝 Логи подключены, канал "logs" отслеживается');

  client.on(Events.MessageDelete, async (message) => {
    if (message.partial) return;
    await logger.logMessageDelete(client, message);
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (oldMessage.partial || newMessage.partial) return;
    await punishChecker(client, newMessage);
    await logger.logMessageUpdate(client, oldMessage as any, newMessage as any);
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    await logger.logMemberJoin(client, member);
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    await logger.logMemberLeave(client, member);
  });

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    await logger.logMemberUpdate(client, oldMember, newMember);
  });

  client.on(Events.ChannelCreate, async (channel) => {
    if ("guild" in channel && channel.guild) {
      await logger.logChannelCreate(client, channel as GuildChannel);
    }
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if ("guild" in channel && channel.guild) {
      await logger.logChannelDelete(client, channel as GuildChannel);
    }
  });

  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (
      "guild" in oldChannel &&
      oldChannel.guild &&
      "guild" in newChannel &&
      newChannel.guild
    ) {
      await logger.logChannelUpdate(
        client,
        oldChannel as GuildChannel,
        newChannel as GuildChannel,
      );
    }
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    await logger.logMemberBan(client, ban.user, ban.guild.id, ban.reason);
  });

  client.on(Events.GuildBanRemove, async (ban) => {
    await logger.logMemberUnban(client, ban.user, ban.guild.id);
  });

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    await logger.logVoiceStateUpdate(client, oldState, newState);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.partial) {
      await message.fetch();
    }
    await punishChecker(client, message);
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      if (!member.guild) return;

      const auditLogs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberKick,
        limit: 1,
      });

      const kickEntry = auditLogs.entries.first();

      if (kickEntry && kickEntry.target?.id === member.id) {
        const timeDiff = Date.now() - kickEntry.createdTimestamp;
        if (timeDiff < 5000) {
          let executor: User | undefined;
          if (kickEntry.executor) {
            try {
              executor = await client.users.fetch(kickEntry.executor.id);
            } catch {
              if ("tag" in kickEntry.executor) {
                executor = kickEntry.executor as User;
              }
            }
          }

          await logger.logMemberKick(
            client,
            member.guild,
            member.user,
            executor,
            kickEntry.reason,
          );
        }
      }
    } catch (error) {
      console.error("Ошибка при отслеживании кика:", error);
      await logger.logError(
        client,
        error as Error,
        "GuildMemberRemove (kick check)",
      );
    }
  });
}
