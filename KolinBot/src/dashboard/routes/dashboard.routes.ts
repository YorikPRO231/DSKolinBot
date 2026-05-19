// src/dashboard/routes/dashboard.routes.ts
import { Router } from 'express';
import { ensureAuthenticatedAndAuthorized } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import { PermissionsRepository } from '../../databases';
import { StatsRepository } from '../../databases/index';
import { bindingsManager } from '../../utils/bindingsManager';

const router = Router();

async function getUserPermissions(req: any): Promise<string[]> {
  const userId = req.user?.id;
  if (!userId) return [];
  return PermissionsRepository.getUserPermissions(userId);
}

router.get('/', ensureAuthenticatedAndAuthorized, async (req, res) => {
  try {
    const stats = StatsRepository.getStats();
    const bindings = bindingsManager.getAllBindings();
    const permissions = await getUserPermissions(req);
    
    res.render('dashboard', {
      user: req.user,
      currentPage: 'dashboard',
      title: 'Dashboard',
      permissions,
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
      permissions: [],
      stats: { totalForms: 0, activeAlerts: 0, closedAlerts: 0, inspections: 0, warehouseItems: 0 } 
    });
  }
});

router.get('/forms', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_forms'),
  async (req, res) => {
    const permissions = await getUserPermissions(req);
    res.render('forms', {
      user: req.user || null,
      currentPage: 'forms',
      title: 'Forms Management',
      permissions,
    });
  }
);

router.get('/security', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('view_security'),
  async (req, res) => {
    const permissions = await getUserPermissions(req);
    res.render('security', {
      user: req.user || null,
      currentPage: 'security',
      title: 'Security',
      permissions,
    });
  }
);

router.get('/inspections', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('view_inspections'),
  async (req, res) => {
    const permissions = await getUserPermissions(req);
    res.render('inspections', {
      user: req.user || null,
      currentPage: 'inspections',
      title: 'Inspection Reports',
      permissions,
    });
  }
);

router.get('/admin-logs', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('view_admin_logs'),
  async (req, res) => {
    const permissions = await getUserPermissions(req);
    res.render('admin-logs', {
      user: req.user || null,
      currentPage: 'admin-logs',
      title: 'Admin Logs',
      permissions,
    });
  }
);

export default router;