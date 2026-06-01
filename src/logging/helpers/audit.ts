import {
  AuditLogEvent,
  Guild,
  GuildAuditLogsEntry,
  User,
} from "discord.js";
import { AUDIT_FETCH_LIMIT, AUDIT_TIME_THRESHOLD, AuditResult, AuditExecutor } from "../config";


function safeGetTag(user: User | { tag?: string | null; username?: string | null }): string {
  if ('tag' in user && user.tag) return user.tag;
  if ('username' in user && user.username) return user.username;
  return "Unknown";
}


function createAuditExecutor(user: User | any): AuditExecutor {
  return {
    id: user.id,
    tag: safeGetTag(user),
    displayName: 'displayName' in user ? user.displayName || undefined : undefined,
  };
}


function isAuditEntryValid(
  entry: GuildAuditLogsEntry,
  targetId: string,
  extraCheck?: (entry: GuildAuditLogsEntry) => boolean,
): boolean {
  if (!entry.target) return false;
  if (typeof entry.target === 'object' && 'id' in entry.target) {
    if (entry.target.id !== targetId) return false;
  } else {
    return false;
  }
  
  const timeDiff = Date.now() - entry.createdTimestamp;
  if (timeDiff > AUDIT_TIME_THRESHOLD) return false;
  
  if (extraCheck && !extraCheck(entry)) return false;
  
  return true;
}

export async function getAuditExecutor(
  guild: Guild,
  eventType: AuditLogEvent,
  targetId: string,
  extraCheck?: (entry: GuildAuditLogsEntry) => boolean,
): Promise<AuditResult> {
  try {
    const auditLogs = await guild.fetchAuditLogs({
      type: eventType,
      limit: AUDIT_FETCH_LIMIT,
    });

    const auditEntry = auditLogs.entries.find(entry => 
      isAuditEntryValid(entry, targetId, extraCheck)
    );

    if (auditEntry?.executor) {
      return {
        executor: createAuditExecutor(auditEntry.executor),
        reason: auditEntry.reason || undefined,
      };
    }

    return {};
  } catch (error) {
    console.debug("Не удалось получить аудит-логи:", error);
    return {};
  }
}


function getExtraChannelId(entry: GuildAuditLogsEntry): string | null {
  try {
    const extra = entry.extra as any;
    if (extra?.channel && typeof extra.channel === 'object' && 'id' in extra.channel) {
      return extra.channel.id;
    }
  } catch {
  }
  return null;
}


export async function getNicknameChangeAudit(
  guild: Guild,
  targetId: string,
): Promise<{ oldNick?: string | null; newNick?: string | null; executor?: AuditExecutor; reason?: string }> {
  try {
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MemberUpdate,
      limit: 10,
    });

    const auditEntry = auditLogs.entries.find(entry => {
      if (!entry.target || typeof entry.target !== 'object' || !('id' in entry.target)) return false;
      if (entry.target.id !== targetId) return false;
      
      const timeDiff = Date.now() - entry.createdTimestamp;
      if (timeDiff > AUDIT_TIME_THRESHOLD * 2) return false;
      
      return entry.changes?.some(change => change.key === "nick");
    });

    if (auditEntry) {
      const nickChange = auditEntry.changes?.find(c => c.key === "nick");
      return {
        oldNick: (nickChange?.old as string) || null,
        newNick: (nickChange?.new as string) || null,
        executor: auditEntry.executor ? createAuditExecutor(auditEntry.executor) : undefined,
        reason: auditEntry.reason || undefined,
      };
    }

    return {};
  } catch (error) {
    console.debug("Не удалось получить аудит изменения ника:", error);
    return {};
  }
}


export async function getVoiceMoveAudit(
  guild: Guild,
  memberId: string,
  channelId: string,
): Promise<AuditResult> {
  return getAuditExecutor(
    guild,
    AuditLogEvent.MemberMove,
    memberId,
    (entry) => {
      const extraChannelId = getExtraChannelId(entry);
      return extraChannelId === channelId;
    },
  );
}


export async function getVoiceDisconnectAudit(
  guild: Guild,
  memberId: string,
): Promise<AuditResult> {
  return getAuditExecutor(
    guild,
    AuditLogEvent.MemberDisconnect,
    memberId,
  );
}

export function getChannelIdSafe(channel: any): string | null {
  if (!channel) return null;
  if (typeof channel === 'object' && 'id' in channel) {
    return channel.id;
  }
  return null;
}