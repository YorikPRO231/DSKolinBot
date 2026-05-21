import * as fs from 'fs';
import * as path from 'path';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { FileLogEntry, LogCategory } from '../config';
import { getDateForFilename, getMoscowTimeString } from './dates';
import { cleanMarkdown } from './formatters';

const ADMIN_LOGS_DIR = path.join(process.cwd(), 'admin-logs');

const writeQueue: Map<string, string[]> = new Map();
const FLUSH_INTERVAL = 5000;
const MAX_BUFFER_SIZE = 100;
let flushTimer: NodeJS.Timeout | null = null;

function ensureFlushTimer(): void {
  if (!flushTimer) {
    flushTimer = setInterval(flushAllBuffers, FLUSH_INTERVAL);
  }
}

function flushAllBuffers(): void {
  for (const [filePath, entries] of writeQueue.entries()) {
    if (entries.length === 0) continue;
    
    const content = entries.join('');
    writeQueue.set(filePath, []);
    
    try {
      ensureLogsDirectory();
      fs.appendFileSync(filePath, content, 'utf-8');
    } catch (error) {
      console.error(`Ошибка при записи в файл ${filePath}:`, error);
      const existing = writeQueue.get(filePath) || [];
      writeQueue.set(filePath, [...entries, ...existing]);
    }
  }
}

function ensureLogsDirectory(): void {
  if (!fs.existsSync(ADMIN_LOGS_DIR)) {
    fs.mkdirSync(ADMIN_LOGS_DIR, { recursive: true });
  }
}

function getAdminLogFilePath(category: LogCategory): string {
  const dateStr = getDateForFilename();
  return path.join(ADMIN_LOGS_DIR, `admin_${category}_${dateStr}.log`);
}

export async function saveLogToFile(
  category: LogCategory,
  entry: FileLogEntry,
): Promise<void> {
  try {
    ensureFlushTimer();
    
    const filePath = getAdminLogFilePath(category);
    const currentTime = getMoscowTimeString();
    const logLines: string[] = [];
    
    logLines.push(`[${currentTime}] ===== НАЧАЛО ЗАПИСИ =====`);
    
    if (entry.title) {
      logLines.push(`Событие: ${cleanMarkdown(entry.title)}`);
    }
    
    if (entry.description) {
      logLines.push(`Описание: ${cleanMarkdown(entry.description)}`);
    }
    
    if (entry.fields) {
      for (const field of entry.fields) {
        logLines.push(`${cleanMarkdown(field.name)}: ${cleanMarkdown(field.value)}`);
      }
    }
    
    if (entry.footer) {
      logLines.push(`Footer: ${cleanMarkdown(entry.footer)}`);
    }
    
    if (entry.eventTime) {
      logLines.push(`Время события: ${entry.eventTime}`);
    }
    
    if (entry.attachmentName) {
      logLines.push(`Вложение: ${entry.attachmentName}`);
      if (entry.attachmentContent) {
        logLines.push(`Содержимое вложения:\n${entry.attachmentContent}`);
      }
    }
    
    logLines.push(`[${currentTime}] ===== КОНЕЦ ЗАПИСИ =====`);
    logLines.push('');
    
    const buffer = writeQueue.get(filePath) || [];
    buffer.push(logLines.join('\n') + '\n');
    writeQueue.set(filePath, buffer);
    
    if (buffer.length >= MAX_BUFFER_SIZE) {
      const content = buffer.join('');
      writeQueue.set(filePath, []);
      ensureLogsDirectory();
      fs.appendFileSync(filePath, content, 'utf-8');
    }
    
  } catch (error) {
    console.error("Ошибка при сохранении лога в файл:", error);
  }
}

export function emergencyFlush(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushAllBuffers();
}

export function embedToFileEntry(
  embed: EmbedBuilder,
  attachment?: AttachmentBuilder,
): FileLogEntry {
  const embedData = embed.data;
  
  const entry: FileLogEntry = {
    timestamp: getMoscowTimeString(),
    category: 'general',
    title: embedData.title ?? undefined,
    description: embedData.description ?? undefined,
    footer: embedData.footer?.text ?? undefined,
    eventTime: embedData.timestamp ? getMoscowTimeString(new Date(embedData.timestamp)) : undefined,
  };
  
  if (embedData.fields) {
    entry.fields = embedData.fields.map((f: { name: string; value: string }) => ({
      name: f.name,
      value: f.value,
    }));
  }
  
  if (attachment) {
    entry.attachmentName = attachment.name ?? 'unknown';
    if (attachment.attachment) {
      try {
        entry.attachmentContent = attachment.attachment.toString('utf-8');
      } catch {
        entry.attachmentContent = '[Бинарные данные]';
      }
    }
  }
  
  return entry;
}