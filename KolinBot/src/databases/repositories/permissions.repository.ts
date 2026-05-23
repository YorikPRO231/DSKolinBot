import db from '../sqlite';

export interface Role {
  role_id: string;
  role_name: string;
  description: string | null;
  created_at: string;
  permissions?: string;
}

export interface Permission {
  permission_key: string;
  permission_name: string;
  description: string | null;
}

export const PermissionsRepository = {
  initDefaultPermissions() {
    const defaultPermissions = [
      { key: 'view_dashboard', name: 'Просмотр дашборда', desc: 'Доступ к главной странице' },
      { key: 'manage_forms', name: 'Управление формами', desc: 'Создание и редактирование форм' },
      { key: 'view_security', name: 'Просмотр Security', desc: 'Доступ к разделу безопасности' },
      { key: 'manage_security', name: 'Управление Security', desc: 'Закрытие/открытие алертов' },
      { key: 'view_inspections', name: 'Просмотр проверок', desc: 'Доступ к отчётам' },
      { key: 'manage_inspections', name: 'Управление проверками', desc: 'Создание отчётов' },
      { key: 'view_admin_logs', name: 'Просмотр админ-логов', desc: 'Доступ к логам' },
      { key: 'manage_roles', name: 'Управление ролями', desc: 'Настройка прав доступа' },
      { key: 'manage_users', name: 'Управление пользователями', desc: 'Выдача прав пользователям' },
      { key: 'view_logs_systeminformer', name: 'Выгрузка System Informer', desc: 'Выгрузка логов System Infromer' },
    ];
    
    const stmt = db.prepare(`INSERT OR IGNORE INTO permissions (permission_key, permission_name, description) VALUES (?, ?, ?)`);
    for (const p of defaultPermissions) {
      stmt.run(p.key, p.name, p.desc);
    }
    console.log('Базовые разрешения инициализированы');
  },

  getAllRoles(): Role[] {
    return db.prepare(`
      SELECT r.*, GROUP_CONCAT(rp.permission_key) as permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
      GROUP BY r.role_id
    `).all() as Role[];
  },

  getAllPermissions(): Permission[] {
    return db.prepare(`SELECT * FROM permissions ORDER BY permission_name`).all() as Permission[];
  },

  addRole(roleId: string, roleName: string, description?: string) {
    return db.prepare(`INSERT OR REPLACE INTO roles (role_id, role_name, description) VALUES (?, ?, ?)`)
      .run(roleId, roleName, description || null);
  },

  removeRole(roleId: string) {
    return db.prepare(`DELETE FROM roles WHERE role_id = ?`).run(roleId);
  },

  grantPermissionToRole(roleId: string, permissionKey: string, grantedBy: string) {
    return db.prepare(`INSERT OR REPLACE INTO role_permissions (role_id, permission_key, granted_by) VALUES (?, ?, ?)`)
      .run(roleId, permissionKey, grantedBy);
  },

  revokePermissionFromRole(roleId: string, permissionKey: string) {
    return db.prepare(`DELETE FROM role_permissions WHERE role_id = ? AND permission_key = ?`)
      .run(roleId, permissionKey);
  },

  addUserToRole(userId: string, roleId: string, assignedBy?: string) {
    return db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)`)
      .run(userId, roleId, assignedBy || null);
  },

  removeUserFromRole(userId: string, roleId: string) {
    return db.prepare(`DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`).run(userId, roleId);
  },

  checkUserRole(userId: string, roleId: string): boolean {
    return !!db.prepare(`SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ?`).get(userId, roleId);
  },

  getUserRoles(userId: string): string[] {
    const roles = db.prepare(`SELECT role_id FROM user_roles WHERE user_id = ?`).all(userId) as { role_id: string }[];
    return roles.map(r => r.role_id);
  },

  getUserPermissions(userId: string): string[] {
    const cached = db.prepare(`SELECT permissions, updated_at FROM user_permissions_cache WHERE user_id = ?`)
      .get(userId) as { permissions: string; updated_at: string } | undefined;
    
    if (cached && (Date.now() - new Date(cached.updated_at).getTime()) < 300000) {
      return JSON.parse(cached.permissions);
    }
    
    const rolePerms = db.prepare(`
      SELECT DISTINCT rp.permission_key
      FROM role_permissions rp
      WHERE rp.role_id IN (SELECT role_id FROM user_roles WHERE user_id = ?)
    `).all(userId) as { permission_key: string }[];
    
    const userPerms = db.prepare(`
      SELECT permission_key, is_granted
      FROM user_permissions 
      WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
    `).all(userId) as { permission_key: string; is_granted: number }[];
    
    const permissions = new Set(rolePerms.map(rp => rp.permission_key));
    
    for (const up of userPerms) {
      up.is_granted ? permissions.add(up.permission_key) : permissions.delete(up.permission_key);
    }
    
    const result = Array.from(permissions);
    
    db.prepare(`INSERT OR REPLACE INTO user_permissions_cache (user_id, permissions, updated_at) VALUES (?, ?, datetime('now'))`)
      .run(userId, JSON.stringify(result));
    
    return result;
  },

  clearUserPermissionCache(userId: string) {
    db.prepare(`DELETE FROM user_permissions_cache WHERE user_id = ?`).run(userId);
  },

  grantUserPermission(userId: string, permissionKey: string, grantedBy: string, expiresAt?: Date, reason?: string) {
    return db.prepare(`
      INSERT OR REPLACE INTO user_permissions (user_id, permission_key, is_granted, granted_by, expires_at, reason)
      VALUES (?, ?, 1, ?, ?, ?)
    `).run(userId, permissionKey, grantedBy, expiresAt?.toISOString() || null, reason || null);
  },

  revokeUserPermission(userId: string, permissionKey: string) {
    return db.prepare(`DELETE FROM user_permissions WHERE user_id = ? AND permission_key = ?`).run(userId, permissionKey);
  },
};