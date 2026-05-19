import { Router } from 'express';
import { ensureAuthenticatedAndAuthorized } from '../middleware/auth.middleware';
import { getStats } from '../../databases/sqlite';
import { bindingsManager } from '../../utils/bindingsManager';

const router = Router();

router.get('/', ensureAuthenticatedAndAuthorized, async (req, res) => {
  try {
    const stats = getStats();
    const bindings = bindingsManager.getAllBindings();
    
    res.render('dashboard', {
      user: req.user,
      currentPage: 'dashboard',
      title: 'Dashboard',
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
      currentPage: 'dashboard',
      title: 'Dashboard',
      stats: { totalForms: 0, activeAlerts: 0, closedAlerts: 0, inspections: 0, warehouseItems: 0 } 
    });
  }
});

router.get('/forms', ensureAuthenticatedAndAuthorized, (req, res) => {
  res.render('forms', {
    user: req.user || null,
    currentPage: 'forms',
    title: 'Forms Management',
  });
});

router.get('/security', ensureAuthenticatedAndAuthorized, (req, res) => {
  res.render('security', {
    user: req.user || null,
    currentPage: 'security',
    title: 'Security',
  });
});

router.get('/inspections', ensureAuthenticatedAndAuthorized, (req, res) => {
  res.render('inspections', {
    user: req.user || null,
    currentPage: 'inspections',
    title: 'Inspection Reports',
  });
});

router.get('/admin-logs', ensureAuthenticatedAndAuthorized, (req, res) => {
  res.render('admin-logs', {
    user: req.user || null,
    currentPage: 'admin-logs',
    title: 'Admin Logs',
  });
});

export default router;