import { Request, Response, NextFunction } from 'express';
import { PermissionsRepository } from '../../databases';

export function requirePermission(permissionKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)?.id;
    
    if (!userId) {
      if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      return res.redirect('/login');
    }
    
    const permissions = await PermissionsRepository.getUserPermissions(userId);
    
    if (!permissions.includes(permissionKey)) {
      if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(403).json({ 
          success: false, 
          error: 'Forbidden',
          message: 'У вас нет прав для доступа к этому ресурсу'
        });
      }
      return res.status(403).render('error', {
        user: req.user,
        title: 'Access Denied',
        error: {
          code: 403,
          message: 'Доступ запрещён',
          description: `Требуется разрешение: ${permissionKey}`
        }
      });
    }
    
    next();
  };
}

export function requireAnyPermission(permissionKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)?.id;
    
    if (!userId) {
      if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      return res.redirect('/login');
    }
    
    const permissions = await PermissionsRepository.getUserPermissions(userId);
    const hasPermission = permissionKeys.some(key => permissions.includes(key));
    
    if (!hasPermission) {
      if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(403).json({ 
          success: false, 
          error: 'Forbidden',
          message: 'У вас нет прав для доступа к этому ресурсу'
        });
      }
      return res.status(403).render('error', {
        user: req.user,
        title: 'Access Denied',
        error: {
          code: 403,
          message: 'Доступ запрещён',
          description: `Требуется одно из разрешений: ${permissionKeys.join(', ')}`
        }
      });
    }
    
    next();
  };
}