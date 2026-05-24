import {AttachmentBuilder, Client, EmbedBuilder, Guild, TextChannel,} from "discord.js";
import {classifyLogCategory, DEFAULT_RETRY_COUNT, RetryOptions} from "../config";
import {embedToFileEntry, saveLogToFile} from "./files";
import { getFactionByDiscordId } from "../../config/settings-loader";

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_RETRY_COUNT,
    baseDelay = 1000,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (error.code !== 429 && error.status !== 429) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const waitTime = (error.retryAfter || baseDelay) + 100;
        onRetry?.(error, attempt + 1);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }

  throw lastError;
}

export async function getLogChannelInGuild(guild: Guild): Promise<TextChannel | null> {
  const factionInfo = getFactionByDiscordId(guild.id);
  if (!factionInfo || factionInfo[0] === "TEST_SERVER") {
    return null;
  }

  const logsChannelId = factionInfo[1].channels.logs;

  let logChannel = guild.channels.cache.find(
    (channel): channel is TextChannel =>
        channel.id === logsChannelId && channel.isTextBased() && !channel.isThread(),
  ) ?? null;

  if (!logChannel) {
    try {
      await guild.channels.fetch();
      logChannel = guild.channels.cache.find(
        (channel): channel is TextChannel =>
            channel.id === logsChannelId && channel.isTextBased() && !channel.isThread(),
      ) ?? null;
    } catch (error) {
      console.error(`Ошибка fetch каналов на ${guild.name}:`, error);
    }
  }

  return logChannel;
}

export async function sendLogToGuild(
  guild: Guild,
  embed: EmbedBuilder,
  attachment?: AttachmentBuilder,
): Promise<void> {
  try {
    const logChannel = await getLogChannelInGuild(guild);
    if (!logChannel) return;

    const permissions = logChannel.permissionsFor(guild.members.me!);
    if (!permissions?.has("SendMessages") || !permissions?.has("EmbedLinks")) {
      console.warn(
        `Недостаточно прав для отправки логов в #${logChannel.name} на ${guild.name}`,
      );
      return;
    }

    const messagePayload: { embeds: EmbedBuilder[]; files?: AttachmentBuilder[] } = { 
      embeds: [embed] 
    };
    
    if (attachment) {
      messagePayload.files = [attachment];
    }

    await withRetry(
      () => logChannel.send(messagePayload),
      { maxRetries: DEFAULT_RETRY_COUNT },
    );
  } catch (error) {
    console.error("Ошибка отправки лога в гильдию:", error);
  }
}

export async function sendLogToAdminChannel(
  client: Client,
  guild: Guild,
  embed: EmbedBuilder,
  attachment?: AttachmentBuilder,
  adminServerIds?: string[],
): Promise<void> {
  if (adminServerIds && !adminServerIds.includes(guild.id)) return;

  const category = classifyLogCategory(embed.data.title || '');
  
  embed.addFields({
    name: 'Сервер',
    value: `${guild.name} (\`${guild.id}\`)`,
    inline: false,
  });
  
  const fileEntry = embedToFileEntry(embed, attachment);
  fileEntry.category = category;
  await saveLogToFile(category, fileEntry);
}

export async function sendFullLog(
  client: Client,
  guild: Guild,
  embed: EmbedBuilder,
  attachment?: AttachmentBuilder,
  adminServerIds?: string[],
): Promise<void> {
  await Promise.all([
    sendLogToGuild(guild, embed, attachment),
    sendLogToAdminChannel(client, guild, embed, attachment, adminServerIds),
  ]);
}