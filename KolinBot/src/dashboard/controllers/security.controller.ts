import { Request, Response } from 'express';
import * as sqlite from '../../databases/sqlite';
import { AppError } from '../middleware/errorHandler.middleware';

export class SecurityController {
  static async getAlerts(req: Request, res: Response) {
    const status = req.query.status as string | undefined;
    const suspect = req.query.suspect as string | undefined;
    
    let alerts;
    if (suspect) {
      alerts = sqlite.getSecurityAlertsBySuspect(suspect);
    } else {
      alerts = sqlite.getSecurityAlerts(status as any);
    }
    
    res.json({ success: true, alerts });
  }

  static async addAlert(req: Request, res: Response) {
    const { suspect, action, data } = req.body;
    const adminId = (req.user as any)?.id || "unknown";
    
    const result = sqlite.exportSecurityAlertsMany(adminId, [{
      suspect: suspect,
      action: action,
      data: data || 'Ручное добавление'
    }]);
    
    res.json({ success: true, result });
  }

  static async closeAlert(req: Request, res: Response) {
    const id = req.params.id as string;
    const adminId = (req.user as any)?.id || "unknown";
    const result = sqlite.closeAlert(parseInt(id), adminId);
    
    if (result.changes === 0) {
      throw AppError.notFound('Alert not found');
    }
    
    res.json({ success: true });
  }

  static async reopenAlert(req: Request, res: Response) {
    const id = req.params.id as string;
    const adminId = (req.user as any)?.id || "unknown";
    const result = sqlite.reopenAlert(parseInt(id), adminId);
    
    if (result.changes === 0) {
      throw AppError.notFound('Alert not found');
    }
    
    res.json({ success: true });
  }

  static async getLogs(req: Request, res: Response) {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const logs = sqlite.getSecurityLogs(limit);
    res.json({ success: true, logs });
  }

  static async addSecurityRequest(req: Request, res: Response) {
    const { suspect, reason, video } = req.body;
    const adminId = (req.user as any)?.id || "unknown";
    
    sqlite.addSecurityRequest(suspect, adminId, reason, video);
    res.json({ success: true });
  }
}