import { Router } from 'express';
import authRoutes from './auth.routes';
import dashboardRoutes from './dashboard.routes';
import adminLogsRoutes from './admin-logs.routes';
import formsRoutes from './api/forms.routes';
import securityRoutes from './api/security.routes';
import inspectionsRoutes from './api/inspections.routes';
import discordRoutes from './api/discord.routes';
import webhookRoutes from './webhook.routes';
import permissionsRoutes from './admin/permissions.routes';
import uploadRoutes from '../routes/upload.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin-logs', adminLogsRoutes);

router.use('/api/forms', formsRoutes);
router.use('/api/security', securityRoutes);
router.use('/api/inspections', inspectionsRoutes);
router.use('/api/discord', discordRoutes);

router.use('/admin/permissions', permissionsRoutes);
router.use('/upload', uploadRoutes)
router.use('/webhook', webhookRoutes);

router.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

router.get('/login', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('login', {
    title: 'Login - Admin Dashboard',
    error: req.query.error || null,
  });
});

router.get('/access-denied', (req, res) => {
  let userRoleIds: string[] = [];
  let userRoleNames: string[] = [];

  const dataParam = req.query.data as string;
  if (dataParam) {
    try {
      const data = JSON.parse(decodeURIComponent(dataParam));
      userRoleIds = data.ids || [];
      userRoleNames = data.names || [];
    } catch (e) {
      console.error('Error parsing roles data:', e);
    }
  }

  res.render('access-denied', {
    requiredRoles: (process.env.ALLOWED_ROLES || "").split(",").filter(r => r.trim()),
    userRoleIds,
    userRoleNames,
  });
});

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) console.error('Logout error:', err);
    req.session.destroy((err) => {
      if (err) console.error('Session destroy error:', err);
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
});

export default router;