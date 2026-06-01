import { Client, Guild, GuildMember, Role, TextChannel, VoiceChannel } from 'discord.js';

let discordClient: Client | null = null;

export function setDiscordClient(client: Client) {
  discordClient = client;
}

export async function getDiscordClient(): Promise<Client> {
  if (!discordClient || !discordClient.isReady()) {
    throw new Error('Discord client is not ready');
  }
  return discordClient;
}

export async function fetchGuild(guildId: string): Promise<Guild> {
  const client = await getDiscordClient();
  return await client.guilds.fetch(guildId);
}

export async function fetchMember(userId: string, guildId: string): Promise<GuildMember> {
  const guild = await fetchGuild(guildId);
  return await guild.members.fetch(userId);
}

export async function fetchRole(guildId: string, roleId: string): Promise<Role | null> {
  try {
    const guild = await fetchGuild(guildId);
    return await guild.roles.fetch(roleId);
  } catch {
    return null;
  }
}

export async function fetchChannel(channelId: string): Promise<TextChannel | VoiceChannel | null> {
  try {
    const client = await getDiscordClient();
    const channel = await client.channels.fetch(channelId);
    return (channel as TextChannel | VoiceChannel) || null;
  } catch {
    return null;
  }
}

export async function getUserDisplayName(userId: string, guildId: string): Promise<string> {
  try {
    const member = await fetchMember(userId, guildId);
    return member.nickname || member.user.displayName;
  } catch {
    try {
      const client = await getDiscordClient();
      const user = await client.users.fetch(userId);
      return user.displayName;
    } catch {
      return userId;
    }
  }
}

export async function getChannelName(channelId: string): Promise<string> {
  try {
    const channel = await fetchChannel(channelId);
    if (!channel) return channelId;
    
    const channelAny = channel as any;
    
    if (channelAny.name && typeof channelAny.name === 'string') {
      return channelAny.name;
    }
    
    if (channelAny.recipient && channelAny.recipient.username) {
      return `DM: ${channelAny.recipient.username}`;
    }
    
    return channelId;
  } catch {
    return channelId;
  }
}