export interface ParsedLogEntry {
  raw: string;
  file: string;
  timestamp: string | null;
  utcTimestamp: string | null;
  utcDate: string | null;
  event: string | null;
  description: string | null;
  userId: string | null;
  userName: string | null;
  channelId: string | null;
  channelName: string | null;
  oldContent: string | null;
  newContent: string | null;
  content: string | null;
  guildId: string | null;
  guildName: string | null;
  messageLink: string | null;
  messageId: string | null;
}

export class LogParserService {
  static parseEntry(rawEntry: string, filename: string): ParsedLogEntry {
    const lines = rawEntry.split('\n');
    const entry: ParsedLogEntry = {
      raw: rawEntry,
      file: filename,
      timestamp: null,
      utcTimestamp: null,
      utcDate: null,
      event: null,
      description: null,
      userId: null,
      userName: null,
      channelId: null,
      channelName: null,
      oldContent: null,
      newContent: null,
      content: null,
      guildId: null,
      guildName: null,
      messageLink: null,
      messageId: null,
    };

    let isCollectingOld = false;
    let isCollectingNew = false;
    let oldLines: string[] = [];
    let newLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine.includes('Время события:')) {
        const timeValue = trimmedLine.replace('Время события:', '').trim();
        const utcDate = new Date(timeValue);
        if (!isNaN(utcDate.getTime())) {
          entry.utcTimestamp = timeValue;
          entry.utcDate = timeValue.split('T')[0];
          const mskDate = new Date(utcDate);
          mskDate.setHours(mskDate.getHours() + 3);
          entry.timestamp = mskDate.toISOString().replace('Z', '');
        } else {
          entry.timestamp = timeValue;
        }
      }
      else if (trimmedLine.includes('Событие:')) {
        entry.event = trimmedLine.replace('Событие:', '').trim();
      }
      else if (trimmedLine.includes('Описание:')) {
        const desc = trimmedLine.replace('Описание:', '').trim();
        entry.description = desc;
        
        const authorMatch = desc.match(/Автор:\s*(.+?)(?:\n|$)/);
        if (authorMatch) {
          const author = authorMatch[1].trim();
          const idMatch = author.match(/(\d{17,20})/);
          if (idMatch) {
            entry.userId = idMatch[1];
            entry.userName = author.replace(/\s*\(\d{17,20}\)/, '').trim();
          } else {
            entry.userName = author;
          }
        }
        
        const userMatch = desc.match(/Пользователь:\s*(.+?)(?:\n|$)/);
        if (userMatch) {
          const user = userMatch[1].trim();
          const idMatch = user.match(/(\d{17,20})/);
          if (idMatch) {
            entry.userId = idMatch[1];
            entry.userName = user.replace(/\s*\(\d{17,20}\)/, '').trim();
          } else {
            entry.userName = user;
          }
        }
        
        const channelMatch = desc.match(/Канал:\s*<#(\d{17,20})>/);
        if (channelMatch) {
          entry.channelId = channelMatch[1];
        }
        
        const voiceChannelMatch = desc.match(/Голосовой канал:\s*(.+?)(?:\s*\(|$)/);
        if (voiceChannelMatch) {
          entry.channelName = voiceChannelMatch[1].trim();
        }
      }
      else if (trimmedLine.includes('ID автора:')) {
        const idMatch = trimmedLine.match(/\b(\d{17,20})\b/);
        if (idMatch) entry.userId = idMatch[1];
      }
      else if (trimmedLine.includes('Канал:')) {
        const channelMatch = trimmedLine.match(/<#(\d{17,20})>/);
        if (channelMatch) entry.channelId = channelMatch[1];
        
        const nameMatch = trimmedLine.match(/Канал:\s*#?(.+?)(?:\s|$)/);
        if (nameMatch && !nameMatch[1].match(/^\d+$/)) {
          entry.channelName = nameMatch[1].trim();
        }
      }
      else if (trimmedLine.includes('Голосовой канал:')) {
        const voiceMatch = trimmedLine.match(/Голосовой канал:\s*(.+?)(?:\s*\(|$)/);
        if (voiceMatch) entry.channelName = voiceMatch[1].trim();
        
        const idMatch = trimmedLine.match(/\((\d{17,20})\)/);
        if (idMatch) entry.channelId = idMatch[1];
      }
      else if (trimmedLine.includes('Сервер:')) {
        const guildMatch = trimmedLine.match(/Сервер:\s*(.+?)(?:\s*\(|$)/);
        if (guildMatch) entry.guildName = guildMatch[1].trim();
        
        const idMatch = trimmedLine.match(/\((\d{17,20})\)/);
        if (idMatch) entry.guildId = idMatch[1];
      }
      else if (trimmedLine.includes('Ссылка:')) {
        const linkMatch = trimmedLine.match(/Ссылка:\s*(.+)$/);
        if (linkMatch) entry.messageLink = linkMatch[1].trim();
      }
      else if (trimmedLine.includes('Содержание:') && !trimmedLine.includes('(')) {
        const contentValue = trimmedLine.replace('Содержание:', '').trim();
        if (contentValue) entry.content = contentValue;
      }
      else if (trimmedLine.includes('Старая версия:') && !trimmedLine.includes('Пусто')) {
        entry.oldContent = trimmedLine.replace('Старая версия:', '').trim();
      }
      else if (trimmedLine.includes('Новая версия:') && !trimmedLine.includes('Пусто')) {
        entry.newContent = trimmedLine.replace('Новая версия:', '').trim();
      }
      else if (trimmedLine === 'Старая версия') {
        isCollectingOld = true;
        isCollectingNew = false;
        oldLines = [];
      }
      else if (trimmedLine === 'Новая версия') {
        isCollectingNew = true;
        isCollectingOld = false;
        newLines = [];
      }
      else if (trimmedLine.includes('Footer:')) {
        isCollectingOld = false;
        isCollectingNew = false;
        
        const authorMatch = trimmedLine.match(/ID автора:\s*(\d{17,20})/);
        if (authorMatch) entry.userId = authorMatch[1];
        
        const messageMatch = trimmedLine.match(/ID сообщения:\s*(\d{17,20})/);
        if (messageMatch) entry.messageId = messageMatch[1];
      }
      else if (isCollectingOld && !trimmedLine.includes('===')) {
        if (!trimmedLine.includes('*Полный текст')) oldLines.push(trimmedLine);
      }
      else if (isCollectingNew && !trimmedLine.includes('===')) {
        if (!trimmedLine.includes('*Полный текст')) newLines.push(trimmedLine);
      }
    }

    if (oldLines.length > 0) entry.oldContent = oldLines.join('\n').trim();
    if (newLines.length > 0) entry.newContent = newLines.join('\n').trim();

    if (entry.messageId && entry.channelId) {
      entry.messageLink = `https://discord.com/channels/${entry.guildId || '@me'}/${entry.channelId}/${entry.messageId}`;
    }

    return entry;
  }

  static matchesQuery(entry: ParsedLogEntry, query: string): boolean {
    if (!query) return true;
    
    const fields = [
      entry.event, entry.description, entry.userId, entry.userName,
      entry.channelId, entry.channelName, entry.content, entry.oldContent,
      entry.newContent, entry.raw
    ];
    
    const lowerQuery = query.toLowerCase();
    for (const field of fields) {
      if (field && String(field).toLowerCase().includes(lowerQuery)) return true;
    }
    return false;
  }
}