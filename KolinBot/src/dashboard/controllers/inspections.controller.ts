import { Request, Response } from 'express';
import { InspectionsRepository, db } from '../../databases/index';
import { AppError } from '../middleware/errorHandler.middleware';

export class InspectionsController {
  static async getByPassport(req: Request, res: Response) {
    const passport = req.params.passport as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = InspectionsRepository.getInspectionReportsByPassportPaginated(passport, limit, offset);
    res.json({ success: true, ...result });
  }

  static async getByDiscord(req: Request, res: Response) {
    const discordId = req.params.discordId as string;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const total = db.prepare('SELECT COUNT(*) as count FROM inspection_reports WHERE discord_id = ?')
      .get(discordId) as { count: number };
    
    const reports = db.prepare(`
      SELECT * FROM inspection_reports
      WHERE discord_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(discordId, limit, offset);
    
    res.json({ success: true, reports, total: total.count });
  }

  static async getByAdmin(req: Request, res: Response) {
    const adminId = req.params.adminId as string;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const reports = InspectionsRepository.getInspectionReportsByAdmin(adminId, limit);
    res.json({ success: true, reports });
  }

  static async getRecent(req: Request, res: Response) {
    const reports = InspectionsRepository.getInspectionReportsByAdmin("", 10);
    res.json({ success: true, reports });
  }

  static async create(req: Request, res: Response) {
    const { passport, result, discordId } = req.body;
    const adminId = (req.user as any)?.id || "unknown";
    const adminName = (req.user as any)?.username;
    
    const id = InspectionsRepository.saveInspectionReport(passport, result, adminId, adminName, discordId);
    res.json({ success: true, id });
  }

  static async update(req: Request, res: Response) {
    const id = parseInt(req.params.id as string);
    const { discord_id, result } = req.body;
    
    if (isNaN(id)) {
      throw AppError.badRequest('Invalid ID');
    }
    
    const stmt = db.prepare(`
      UPDATE inspection_reports 
      SET discord_id = ?, result = ?
      WHERE id = ?
    `);
    
    const updateResult = stmt.run(discord_id || null, result, id);
    
    if (updateResult.changes === 0) {
      throw AppError.notFound('Report not found');
    }
    
    res.json({ success: true, message: 'Report updated' });
  }
}