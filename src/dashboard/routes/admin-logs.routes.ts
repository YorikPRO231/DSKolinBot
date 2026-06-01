import { Router } from 'express';
import { ensureAuthenticatedAndAuthorized } from '../middleware/auth.middleware';
import { AdminLogsController } from '../controllers/admin-logs.controller';
import { createRateLimiter } from '../middleware/rateLimit.middleware';
import { requirePermission } from '../middleware/permissions.middleware';

const router = Router();
const strictLimiter = createRateLimiter(60000, 30);

router.get('/search', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('view_admin_logs'),
  strictLimiter, 
  AdminLogsController.search
);

router.get('/stats', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('view_admin_logs'),
  AdminLogsController.getStats
);

router.get('/files', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('view_admin_logs'),
  AdminLogsController.getFiles
);

router.get('/files/:filename', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('view_admin_logs'),
  AdminLogsController.getFile
);

router.delete('/files/:filename', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('view_admin_logs'),
  AdminLogsController.deleteFile
);

router.get('/', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('view_admin_logs'),
  (req, res) => {
    res.render('admin-logs', {
      user: req.user || null,
      currentPage: 'admin-logs',
      title: 'Admin Logs',
    });
  }
);

export default router;