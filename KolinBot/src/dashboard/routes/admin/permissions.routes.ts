import { Router } from 'express';
import { ensureAuthenticatedAndAuthorized } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permissions.middleware';
import { PermissionsRepository } from '../../../databases/index';
import db from '../../../databases/sqlite';

const router = Router();

function getParam(param: string | string[] | undefined): string {
  if (!param) return '';
  return Array.isArray(param) ? param[0] : param;
}

interface UserRoleRow {
  user_id: string;
  roles: string;
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
    const roles = PermissionsRepository.getAllRoles();
    const permissions = PermissionsRepository.getAllPermissions();
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
    PermissionsRepository.addRole(roleIdStr, roleName, description);
    res.json({ success: true });
  }
);

router.delete('/api/roles/:roleId', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const roleId = getParam(req.params.roleId);
    PermissionsRepository.removeRole(roleId);
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
    PermissionsRepository.grantPermissionToRole(roleId, permissionKey, grantedBy);
    res.json({ success: true });
  }
);

router.delete('/api/roles/:roleId/permissions/:permissionKey', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const roleId = getParam(req.params.roleId);
    const permissionKey = getParam(req.params.permissionKey);
    PermissionsRepository.revokePermissionFromRole(roleId, permissionKey);
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
    PermissionsRepository.grantUserPermission(userId, permissionKey, grantedBy, expiresDate, reason);
    
    PermissionsRepository.clearUserPermissionCache(userId);
    
    res.json({ success: true });
  }
);

router.delete('/api/users/:userId/permissions/:permissionKey', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_users'),
  async (req, res) => {
    const userId = getParam(req.params.userId);
    const permissionKey = getParam(req.params.permissionKey);
    PermissionsRepository.revokeUserPermission(userId, permissionKey);
    PermissionsRepository.clearUserPermissionCache(userId);
    res.json({ success: true });
  }
);

router.get('/api/users', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const usersWithRoles = db.prepare(`
      SELECT 
        u.user_id,
        GROUP_CONCAT(json_object('role_id', r.role_id, 'role_name', r.role_name)) as roles
      FROM user_roles u
      JOIN roles r ON u.role_id = r.role_id
      GROUP BY u.user_id
    `).all() as UserRoleRow[];
    
    const users: UserWithRoles[] = usersWithRoles.map((row: UserRoleRow) => {
      let roles: ParsedRole[] = [];
      try {
        if (row.roles) {
          roles = JSON.parse(`[${row.roles}]`);
        }
      } catch (error) {
        console.error('Error parsing roles JSON:', error);
      }
      
      return {
        user_id: row.user_id,
        roles: roles
      };
    });
    
    res.json({ success: true, users });
  }
);

router.post('/api/users/add', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const { userId, roleId } = req.body;
    const assignedBy = (req.user as any)?.id || 'system';
    
    PermissionsRepository.addUserToRole(userId, roleId, assignedBy);
    PermissionsRepository.clearUserPermissionCache(userId);
    
    res.json({ success: true });
  }
);

router.delete('/api/users/:userId/roles/:roleId', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_roles'),
  async (req, res) => {
    const userId = getParam(req.params.userId);
    const roleId = getParam(req.params.roleId);
    
    PermissionsRepository.removeUserFromRole(userId, roleId);
    PermissionsRepository.clearUserPermissionCache(userId);
    
    res.json({ success: true });
  }
);

export default router;