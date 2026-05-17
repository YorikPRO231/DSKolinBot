import { Router } from 'express';
import { ensureAuthenticated, ensureAdmin } from '../middleware/auth';
import { 
  getSecurityAlerts, 
  getSecurityAlertsBySuspect,
  closeAlert, 
  reopenAlert,
  getSecurityLogs
} from '../../databases/sqlite';

const router = Router();

router.get('/alerts', ensureAuthenticated, (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const suspect = req.query.suspect as string | undefined;
    let alerts;
    
    if (suspect) {
      alerts = getSecurityAlertsBySuspect(suspect);
    } else {
      alerts = getSecurityAlerts(status as any);
    }
    
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ошибка получения данных' });
  }
});

router.post('/alerts/:id/close', ensureAdmin, (req, res) => {
  try {
    const id = req.params.id as string;
    const result = closeAlert(parseInt(id), (req.user as any)?.id);
    
    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Алерт не найден' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ошибка закрытия алерта' });
  }
});

router.post('/alerts/:id/reopen', ensureAdmin, (req, res) => {
  try {
    const id = req.params.id as string;
    const result = reopenAlert(parseInt(id), (req.user as any)?.id);
    
    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Алерт не найден' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ошибка открытия алерта' });
  }
});

router.get('/logs', ensureAuthenticated, (req, res) => {
  try {
    const limitParam = req.query.limit as string | undefined;
    const limit = limitParam ? parseInt(limitParam) : 100;
    const logs = getSecurityLogs(limit);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ошибка получения логов' });
  }
});

export default router;