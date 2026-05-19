import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AppError } from '../middleware/errorHandler.middleware';

const ADMIN_LOGS_DIR = path.join(process.cwd(), 'admin-logs');

function parseLogEntry(rawEntry: string, filename: string): any {
  const lines = rawEntry.split('\n');
  const entry: any = {
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

function matchesSearchQuery(entry: any, query: string): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  const fields = [
    entry.event, entry.description, entry.userId, entry.userName,
    entry.channelId, entry.channelName, entry.content, entry.oldContent,
    entry.newContent, entry.raw
  ];
  for (const field of fields) {
    if (field && String(field).toLowerCase().includes(lowerQuery)) return true;
  }
  return false;
}

export class AdminLogsController {
  static async getFiles(req: Request, res: Response) {
    if (!fs.existsSync(ADMIN_LOGS_DIR)) {
      return res.json({ success: true, files: [] });
    }

    const files = await fs.promises.readdir(ADMIN_LOGS_DIR);
    const logFiles = await Promise.all(
      files
        .filter(file => file.endsWith('.log'))
        .map(async (file) => {
          const filePath = path.join(ADMIN_LOGS_DIR, file);
          const stats = await fs.promises.stat(filePath);
          const match = file.match(/admin_(.+?)_(\d{4}-\d{2}-\d{2})\.log/);
          
          return {
            name: file,
            category: match ? match[1] : 'general',
            date: match ? match[2] : 'unknown',
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        })
    );
    
    logFiles.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    res.json({ success: true, files: logFiles });
  }

  static async getFile(req: Request, res: Response) {
    const filename = req.params.filename as string;
    
    if (!filename || filename.includes('..') || !filename.endsWith('.log')) {
      throw AppError.badRequest('Invalid filename');
    }
    
    const filePath = path.join(ADMIN_LOGS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      throw AppError.notFound('File not found');
    }
    
    const content = await fs.promises.readFile(filePath, 'utf-8');
    res.json({ success: true, content, filename });
  }

  static async deleteFile(req: Request, res: Response) {
    const filename = req.params.filename as string;
    
    if (!filename || filename.includes('..') || !filename.endsWith('.log')) {
      throw AppError.badRequest('Invalid filename');
    }
    
    const filePath = path.join(ADMIN_LOGS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      throw AppError.notFound('File not found');
    }
    
    await fs.promises.unlink(filePath);
    res.json({ success: true });
  }

  static async getStats(req: Request, res: Response) {
    if (!fs.existsSync(ADMIN_LOGS_DIR)) {
      return res.json({ success: true, stats: { totalSize: 0, fileCount: 0, categories: {} } });
    }

    const files = await fs.promises.readdir(ADMIN_LOGS_DIR);
    const logFiles = files.filter(file => file.endsWith('.log'));
    
    let totalSize = 0;
    const categories: Record<string, { count: number; size: number }> = {};
    
    for (const file of logFiles) {
      const filePath = path.join(ADMIN_LOGS_DIR, file);
      const stats = await fs.promises.stat(filePath);
      totalSize += stats.size;
      
      const match = file.match(/admin_(.+?)_(\d{4}-\d{2}-\d{2})\.log/);
      const category = match ? match[1] : 'general';
      
      if (!categories[category]) {
        categories[category] = { count: 0, size: 0 };
      }
      categories[category].count++;
      categories[category].size += stats.size;
    }
    
    res.json({ 
      success: true, 
      stats: { totalSize, fileCount: logFiles.length, categories }
    });
  }

  static async search(req: Request, res: Response) {
    try {
      const query = (req.query.q as string || '').toLowerCase().trim();
      const category = req.query.category as string || 'all';
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const dateFrom = req.query.dateFrom as string || '';
      const dateTo = req.query.dateTo as string || '';

      if (!fs.existsSync(ADMIN_LOGS_DIR)) {
        return res.json({ success: true, entries: [], total: 0, hasMore: false });
      }

      let files = await fs.promises.readdir(ADMIN_LOGS_DIR);
      let logFiles = files.filter(f => f.endsWith('.log'));

      if (category !== 'all') {
        let categoryPattern = '';
        switch (category) {
          case 'message_delete': categoryPattern = 'admin_message_delete_'; break;
          case 'message_edit': categoryPattern = 'admin_message_edit_'; break;
          case 'voice': categoryPattern = 'admin_voice_'; break;
          default: categoryPattern = `admin_${category}_`;
        }
        logFiles = logFiles.filter(file => file.includes(categoryPattern));
      }

      logFiles.sort().reverse();

      const allEntries: any[] = [];

      for (const file of logFiles) {
        const filePath = path.join(ADMIN_LOGS_DIR, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        
        const rawEntries = content.split('===== НАЧАЛО ЗАПИСИ =====');
        
        for (const rawEntry of rawEntries) {
          if (!rawEntry.includes('===== КОНЕЦ ЗАПИСИ =====')) continue;
          
          const cleanEntry = rawEntry.split('===== КОНЕЦ ЗАПИСИ =====')[0].trim();
          if (!cleanEntry) continue;

          // Используем внешнюю функцию parseLogEntry
          const parsedEntry = parseLogEntry(cleanEntry, file);
          
          if (query && !matchesSearchQuery(parsedEntry, query)) continue;
          
          if (dateFrom || dateTo) {
            const entryUTCDate = parsedEntry.utcDate || parsedEntry.timestamp?.split('T')[0];
            if (entryUTCDate) {
              if (dateFrom && entryUTCDate < dateFrom) continue;
              if (dateTo && entryUTCDate > dateTo) continue;
            }
          }
          
          allEntries.push(parsedEntry);
        }
      }

      allEntries.sort((a, b) => {
        const aTime = a.utcTimestamp || a.timestamp;
        const bTime = b.utcTimestamp || b.timestamp;
        if (!aTime) return 1;
        if (!bTime) return -1;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      const totalFound = allEntries.length;
      const paginatedEntries = allEntries.slice(offset, offset + limit);

      res.json({ 
        success: true, 
        entries: paginatedEntries, 
        total: totalFound,
        hasMore: totalFound > offset + limit
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ success: false, error: 'Search failed', details: String(error) });
    }
  }
}