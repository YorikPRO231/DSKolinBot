import { ActivityType, AuditLogEvent, Client, Events, GuildChannel, User } from "discord.js";
import * as logger from "../logging";
import { emergencyFlush } from "../logging/helpers/files";
import { punishChecker } from "../utils/punishChecker";

export const name = "ready";
export const once = true;

export function execute(client: Client) {
  // ========== СТАТУС БОТА ==========
  const tags = ['склад', 'переводы', 'персонал', 'GTA5RP'];
  let step = 0;

  const tick = () => {
    const isWorkingHours = [6, 7, 8, 9, 10, 18, 19, 20, 21].includes(new Date().getHours());
    
    client.user?.setPresence({
      activities: [{ name: tags[step % tags.length], type: ActivityType.Watching }],
      status: isWorkingHours ? 'dnd' : 'online',
    });
    
    step++;
  };

  tick();
  setInterval(tick, 1800000);

  // ========== СИСТЕМА ЛОГИРОВАНИЯ ==========
  console.log('📝 Система логирования подключена');

  client.on(Events.MessageDelete, async (message) => {
    try {
      await logger.logMessageDelete(client, message);
    } catch (error) {
      console.error("Ошибка в MessageDelete:", error);
      await logger.logError(client, error as Error, "MessageDelete");
    }
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
      await punishChecker(client, newMessage);
      await logger.logMessageUpdate(client, oldMessage, newMessage);
    } catch (error) {
      console.error("Ошибка в MessageUpdate:", error);
      await logger.logError(client, error as Error, "MessageUpdate");
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      await logger.logMemberJoin(client, member);
    } catch (error) {
      console.error("Ошибка в GuildMemberAdd:", error);
      await logger.logError(client, error as Error, "GuildMemberAdd");
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      await logger.logMemberLeave(client, member);
      
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
      console.error("Ошибка в GuildMemberRemove:", error);
      await logger.logError(client, error as Error, "GuildMemberRemove");
    }
  });

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      await logger.logMemberUpdate(client, oldMember, newMember);
    } catch (error) {
      console.error("Ошибка в GuildMemberUpdate:", error);
      await logger.logError(client, error as Error, "GuildMemberUpdate");
    }
  });

  client.on(Events.ChannelCreate, async (channel) => {
    try {
      if ("guild" in channel && channel.guild) {
        await logger.logChannelCreate(client, channel as GuildChannel);
      }
    } catch (error) {
      console.error("Ошибка в ChannelCreate:", error);
      await logger.logError(client, error as Error, "ChannelCreate");
    }
  });

  client.on(Events.ChannelDelete, async (channel) => {
    try {
      if ("guild" in channel && channel.guild) {
        await logger.logChannelDelete(client, channel as GuildChannel);
      }
    } catch (error) {
      console.error("Ошибка в ChannelDelete:", error);
      await logger.logError(client, error as Error, "ChannelDelete");
    }
  });

  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    try {
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
    } catch (error) {
      console.error("Ошибка в ChannelUpdate:", error);
      await logger.logError(client, error as Error, "ChannelUpdate");
    }
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    try {
      await logger.logMemberBan(client, ban.user, ban.guild.id, ban.reason);
    } catch (error) {
      console.error("Ошибка в GuildBanAdd:", error);
      await logger.logError(client, error as Error, "GuildBanAdd");
    }
  });

  client.on(Events.GuildBanRemove, async (ban) => {
    try {
      await logger.logMemberUnban(client, ban.user, ban.guild.id);
    } catch (error) {
      console.error("Ошибка в GuildBanRemove:", error);
      await logger.logError(client, error as Error, "GuildBanRemove");
    }
  });

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
      await logger.logVoiceStateUpdate(client, oldState, newState);
    } catch (error) {
      console.error("Ошибка в VoiceStateUpdate:", error);
      await logger.logError(client, error as Error, "VoiceStateUpdate");
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.partial) {
        await message.fetch();
      }
      await punishChecker(client, message);
    } catch (error) {
      console.error("Ошибка в MessageCreate:", error);
      await logger.logError(client, error as Error, "MessageCreate");
    }
  });

  process.on("SIGINT", () => {
    console.log("Сброс буферов логов перед выходом...");
    emergencyFlush();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("Сброс буферов логов перед выходом...");
    emergencyFlush();
    process.exit(0);
  });

  console.log(' Все обработчики успешно подключены');
}