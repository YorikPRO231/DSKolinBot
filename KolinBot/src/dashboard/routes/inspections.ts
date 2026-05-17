import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { 
  getInspectionReportsByPassportPaginated, 
  getInspectionReportsByAdmin 
} from '../../databases/sqlite';

const router = Router();

router.get('/passport/:passport', ensureAuthenticated, (req, res) => {
  try {
    const passport = req.params.passport as string;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 20;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset) : 0;
    
    const result = getInspectionReportsByPassportPaginated(passport, limit, offset);
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Ошибка получения отчетов' });
  }
});

router.get('/admin/:adminId', ensureAuthenticated, (req, res) => {
  try {
    const adminId = req.params.adminId as string;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 50;
    
    const reports = getInspectionReportsByAdmin(adminId, limit);
    res.json({ success: true, reports });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Ошибка получения отчетов' });
  }
});

export default router;