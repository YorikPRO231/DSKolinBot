import { Router } from 'express';
import { ensureAuthenticatedAndAuthorized, ensureAdminLogsAccess } from '../middleware/auth.middleware';
import { AdminLogsController } from '../controllers/admin-logs.controller';
import { createRateLimiter } from '../middleware/rateLimit.middleware';

const router = Router();
const strictLimiter = createRateLimiter(60000, 30);

router.get('/search', 
  ensureAuthenticatedAndAuthorized, 
  ensureAdminLogsAccess, 
  strictLimiter, 
  AdminLogsController.search
);

router.get('/stats', 
  ensureAuthenticatedAndAuthorized, 
  ensureAdminLogsAccess, 
  AdminLogsController.getStats
);

router.get('/files', 
  ensureAuthenticatedAndAuthorized, 
  ensureAdminLogsAccess, 
  AdminLogsController.getFiles
);

router.get('/files/:filename', 
  ensureAuthenticatedAndAuthorized, 
  ensureAdminLogsAccess, 
  AdminLogsController.getFile
);

router.delete('/files/:filename', 
  ensureAuthenticatedAndAuthorized, 
  ensureAdminLogsAccess, 
  AdminLogsController.deleteFile
);

router.get('/', 
  ensureAuthenticatedAndAuthorized, 
  ensureAdminLogsAccess, 
  (req, res) => {
    res.render('admin-logs', {
      user: req.user || null,
      currentPage: 'admin-logs',
      title: 'Admin Logs',
    });
  }
);

export default router;