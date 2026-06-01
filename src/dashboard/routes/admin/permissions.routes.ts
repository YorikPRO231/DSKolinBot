import { Router } from 'express';
import { ensureAuthenticatedAndAuthorized } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permissions.middleware';
import { PermissionsRepository } from '../../../databases/index';
import prisma from '../../../databases/prisma.service';

const router = Router();

function getParam(param: string | string[] | undefined): string {
  if (!param) return '';
  return Array.isArray(param) ? param[0] : param;
}

interface ParsedRole {
  role_id: string;
  role_name: string;
}

interface UserWithRoles {
  user_id: string;
  roles: ParsedRole[];
}

router.get('/', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const roles = await PermissionsRepository.getAllRoles();
    const permissions = await PermissionsRepository.getAllPermissions();
    const users: any[] = [];
    
    res.render('admin/permissions', {
      user: req.user,
      currentPage: 'permissions',
      title: 'Управление правами',
      roles,
      permissions,
      users
    });
  }
);

router.post('/api/roles', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const { roleId, roleName, description } = req.body;
    const roleIdStr = String(roleId);
    await PermissionsRepository.addRole(roleIdStr, roleName, description);
    res.json({ success: true });
  }
);

router.delete('/api/roles/:roleId', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const roleId = getParam(req.params.roleId);
    await PermissionsRepository.removeRole(roleId);
    res.json({ success: true });
  }
);

router.post('/api/roles/:roleId/permissions/:permissionKey', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const roleId = getParam(req.params.roleId);
    const permissionKey = getParam(req.params.permissionKey);
    const grantedBy = (req.user as any)?.id || 'system';
    await PermissionsRepository.grantPermissionToRole(roleId, permissionKey, grantedBy);
    res.json({ success: true });
  }
);

router.delete('/api/roles/:roleId/permissions/:permissionKey', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const roleId = getParam(req.params.roleId);
    const permissionKey = getParam(req.params.permissionKey);
    await PermissionsRepository.revokePermissionFromRole(roleId, permissionKey);
    res.json({ success: true });
  }
);

router.post('/api/users/:userId/permissions/:permissionKey', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_users'),
  async (req, res) => {
    const userId = getParam(req.params.userId);
    const permissionKey = getParam(req.params.permissionKey);
    const grantedBy = (req.user as any)?.id || 'system';
    const { expiresAt, reason } = req.body;
    
    const expiresDate = expiresAt ? new Date(expiresAt) : undefined;
    await PermissionsRepository.grantUserPermission(userId, permissionKey, grantedBy, expiresDate, reason);
    await PermissionsRepository.clearUserPermissionCache(userId);
    
    res.json({ success: true });
  }
);

router.delete('/api/users/:userId/permissions/:permissionKey', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_users'),
  async (req, res) => {
    const userId = getParam(req.params.userId);
    const permissionKey = getParam(req.params.permissionKey);
    await PermissionsRepository.revokeUserPermission(userId, permissionKey);
    await PermissionsRepository.clearUserPermissionCache(userId);
    res.json({ success: true });
  }
);

router.get('/api/users', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const userRoles = await prisma.userRole.findMany({
      include: {
        role: true
      }
    });
    
    const usersMap = new Map<string, ParsedRole[]>();
    
    for (const ur of userRoles) {
      if (!usersMap.has(ur.userId)) {
        usersMap.set(ur.userId, []);
      }
      usersMap.get(ur.userId)!.push({
        role_id: ur.role.roleId,
        role_name: ur.role.roleName
      });
    }
    
    const users: UserWithRoles[] = Array.from(usersMap.entries()).map(([user_id, roles]) => ({
      user_id,
      roles
    }));
    
    res.json({ success: true, users });
  }
);

router.post('/api/users/add', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const { userId, roleId } = req.body;
    const assignedBy = (req.user as any)?.id || 'system';
    
    await PermissionsRepository.addUserToRole(userId, roleId, assignedBy);
    await PermissionsRepository.clearUserPermissionCache(userId);
    
    res.json({ success: true });
  }
);

router.delete('/api/users/:userId/roles/:roleId', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const userId = getParam(req.params.userId);
    const roleId = getParam(req.params.roleId);
    
    await PermissionsRepository.removeUserFromRole(userId, roleId);
    await PermissionsRepository.clearUserPermissionCache(userId);
    
    res.json({ success: true });
  }
);

export default router;