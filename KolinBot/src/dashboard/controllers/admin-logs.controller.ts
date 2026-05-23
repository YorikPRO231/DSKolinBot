import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AppError } from '../middleware/errorHandler.middleware';
import { LogParserService, ParsedLogEntry } from '../services/logParser.service';

const ADMIN_LOGS_DIR = path.join(process.cwd(), 'admin-logs');


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

      const allEntries: ParsedLogEntry[] = [];

      for (const file of logFiles) {
        const filePath = path.join(ADMIN_LOGS_DIR, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        
        const rawEntries = content.split('===== НАЧАЛО ЗАПИСИ =====');
        
        for (const rawEntry of rawEntries) {
          if (!rawEntry.includes('===== КОНЕЦ ЗАПИСИ =====')) continue;
          
          const cleanEntry = rawEntry.split('===== КОНЕЦ ЗАПИСИ =====')[0].trim();
          if (!cleanEntry) continue;

          const parsedEntry = LogParserService.parseEntry(cleanEntry, file);
          
          if (query && !LogParserService.matchesQuery(parsedEntry, query)) continue;
          
          if (dateFrom || dateTo) {
            const entryUTCDate = parsedEntry.utcDate;
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