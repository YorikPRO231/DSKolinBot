import { AttachmentBuilder } from "discord.js";
import { AuditExecutor, TextAttachmentData } from "../config";
import { getMoscowTimeString } from "./dates";

export function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/<@&?(\d+)>/g, '$1')
    .replace(/<#(\d+)>/g, '#$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createTextAttachment(
  content: string,
  filename: string,
): TextAttachmentData {
  const mskTime = getMoscowTimeString();
  const fullContent = [
    "=== Discord Log ===",
    `Timestamp (МСК): ${mskTime}`,
    `Length: ${content.length} chars`,
    "",
    content,
  ].join("\n");

  return {
    buffer: Buffer.from(fullContent, "utf-8"),
    name: filename,
    description: "Полный текст",
  };
}

export function createAttachmentBuilder(data: TextAttachmentData): AttachmentBuilder {
  return new AttachmentBuilder(data.buffer, {
    name: data.name,
    description: data.description,
  });
}

export function formatModerator(executor?: AuditExecutor): string {
  if (!executor) return "Неизвестно";
  const name = executor.displayName || executor.tag;
  return `**${name}** (<@${executor.id}>)`;
}

export function formatMembersList(
  members: Array<{ displayName: string; id: string }>,
  maxLength = 1024,
): string {
  const list = members
    .map(m => `**${m.displayName}** (<@${m.id}>)`)
    .join("\n") || "Нет участников";
  
  return list.substring(0, maxLength);
}