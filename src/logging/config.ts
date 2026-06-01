import { AttachmentBuilder, EmbedBuilder } from "discord.js";

// ========== КОНСТАНТЫ ==========
export const MSK_OFFSET = 3 * 60 * 60 * 1000;
export const FILE_SIZE_THRESHOLD = 3000;
export const DEFAULT_RETRY_COUNT = 2;
export const AUDIT_FETCH_LIMIT = 5;
export const AUDIT_TIME_THRESHOLD = 5000;
export const FACTION_SYNC_DELAY = 2000;

// ========== ТИПЫ ==========
export type LogCategory =
  | "voice"
  | "message_delete"
  | "message_edit"
  | "member"
  | "channel"
  | "moderation"
  | "commands"
  | "general";

export interface LogPayload {
  guildId: string;
  embed: EmbedBuilder;
  attachment?: AttachmentBuilder;
  category?: LogCategory;
  retries?: number;
}

export interface AuditExecutor {
  id: string;
  tag: string; 
  displayName?: string; 
}

export interface AuditResult {
  executor?: AuditExecutor;
  reason?: string;
}

export interface FileLogEntry {
  timestamp: string;
  category: LogCategory;
  title?: string;
  description?: string;
  fields?: Array<{ name: string; value: string }>;
  footer?: string;
  eventTime?: string;
  attachmentName?: string;
  attachmentContent?: string;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export interface TextAttachmentData {
  buffer: Buffer;
  name: string; 
  description: string;
}

export function shouldCreateFile(content: string): boolean {
  return content.length > FILE_SIZE_THRESHOLD;
}

export function classifyLogCategory(title: string): LogCategory {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('голосов')) return 'voice';
  if (lowerTitle.includes('сообщение удалено')) return 'message_delete';
  if (lowerTitle.includes('сообщение отредактировано')) return 'message_edit';
  if (lowerTitle.includes('участник')) return 'member';
  if (lowerTitle.includes('канал')) return 'channel';
  if (lowerTitle.includes('бан') || lowerTitle.includes('кик')) return 'moderation';
  if (lowerTitle.includes('команд')) return 'commands';
  
  return 'general';
}