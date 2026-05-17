import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { getStats } from '../../databases/sqlite';
import { bindingsManager } from '../../utils/bindingsManager';

const router = Router();

router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const stats = getStats();
    const bindings = bindingsManager.getAllBindings();
    
    res.render('dashboard', {
      user: req.user,
      stats: {
        totalForms: bindings.length,
        activeAlerts: stats.alerts_open,
        closedAlerts: stats.alerts_closed,
        inspections: stats.inspection_count,
        warehouseItems: stats.warehouse_count
      }
    });
  } catch (error) {
    console.error(error);
    res.render('dashboard', { 
      user: req.user, 
      stats: { totalForms: 0, activeAlerts: 0, closedAlerts: 0, inspections: 0, warehouseItems: 0 } 
    });
  }
});

export default router;