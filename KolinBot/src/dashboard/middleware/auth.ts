import { Request, Response, NextFunction } from 'express';

export function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/');
}

export function ensureAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/');
  }

  const allowedRoles = (process.env.ALLOWED_ROLES || "").split(',');
  const userRoles = (req.user as any)?.guilds?.map((g: any) => g.permissions) || [];
  
  const hasAdminRole = allowedRoles.some(role => 
    userRoles.some((userRole: any) => userRole === role)
  );

  if (hasAdminRole) { 
    return next();
  }

  res.status(403).render('error', { 
    user: req.user,
    error: 'Доступ запрещен. Требуются права администратора.' 
  });
}