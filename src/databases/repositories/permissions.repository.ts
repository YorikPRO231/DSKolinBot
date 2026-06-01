import prisma from '../prisma.service';

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
  async initDefaultPermissions(): Promise<void> {
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
      { key: 'edit_settings', name: 'Управление конфигом бота', desc: 'Настройки конфига JSON' },
    ];

    for (const p of defaultPermissions) {
      await prisma.permission.upsert({
        where: { permissionKey: p.key },
        update: {},
        create: {
          permissionKey: p.key,
          permissionName: p.name,
          description: p.desc,
        },
      });
    }
    console.log('Базовые разрешения инициализированы');
  },

  async getAllRoles(): Promise<Role[]> {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return roles.map(r => ({
      role_id: r.roleId,
      role_name: r.roleName,
      description: r.description,
      created_at: r.createdAt.toISOString(),
      permissions: r.permissions.map(rp => rp.permission.permissionKey).join(','),
    }));
  },

  async getAllPermissions(): Promise<Permission[]> {
    const permissions = await prisma.permission.findMany({
      orderBy: { permissionName: 'asc' },
    });

    return permissions.map(p => ({
      permission_key: p.permissionKey,
      permission_name: p.permissionName,
      description: p.description,
    }));
  },

  async addRole(roleId: string, roleName: string, description?: string) {
    return prisma.role.upsert({
      where: { roleId },
      update: { roleName, description: description || null },
      create: { roleId, roleName, description: description || null },
    });
  },

  async removeRole(roleId: string) {
    return prisma.role.delete({
      where: { roleId },
    });
  },

  async grantPermissionToRole(roleId: string, permissionKey: string, grantedBy: string) {
    return prisma.rolePermission.upsert({
      where: {
        roleId_permissionKey: {
          roleId,
          permissionKey,
        },
      },
      update: { grantedBy },
      create: { roleId, permissionKey, grantedBy },
    });
  },

  async revokePermissionFromRole(roleId: string, permissionKey: string) {
    return prisma.rolePermission.delete({
      where: {
        roleId_permissionKey: {
          roleId,
          permissionKey,
        },
      },
    });
  },

  async addUserToRole(userId: string, roleId: string, assignedBy?: string) {
    return prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
      update: { assignedBy: assignedBy || null },
      create: { userId, roleId, assignedBy: assignedBy || null },
    });
  },

  async removeUserFromRole(userId: string, roleId: string) {
    return prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });
  },

  async checkUserRole(userId: string, roleId: string): Promise<boolean> {
    const userRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });
    return !!userRole;
  },

  async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    return userRoles.map(ur => ur.roleId);
  },

  async getUserPermissions(userId: string): Promise<string[]> {
    // Check cache
    const cached = await prisma.userPermissionCache.findUnique({
      where: { userId },
    });

    if (cached && (Date.now() - new Date(cached.updatedAt).getTime()) < 300000) {
      return JSON.parse(cached.permissions);
    }

    // Get role permissions
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const rolePermissions = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        rolePermissions.add(rp.permission.permissionKey);
      }
    }

    // Get user-specific permissions
    const userPerms = await prisma.userPermission.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    const permissions = new Set(rolePermissions);
    for (const up of userPerms) {
      if (up.isGranted) {
        permissions.add(up.permissionKey);
      } else {
        permissions.delete(up.permissionKey);
      }
    }

    const result = Array.from(permissions);

    // Update cache
    await prisma.userPermissionCache.upsert({
      where: { userId },
      update: {
        permissions: JSON.stringify(result),
        updatedAt: new Date(),
      },
      create: {
        userId,
        permissions: JSON.stringify(result),
      },
    });

    return result;
  },

  async clearUserPermissionCache(userId: string) {
    await prisma.userPermissionCache.delete({
      where: { userId },
    }).catch(() => {});
  },

  async grantUserPermission(
    userId: string,
    permissionKey: string,
    grantedBy: string,
    expiresAt?: Date,
    reason?: string
  ) {
    await this.clearUserPermissionCache(userId);
    return prisma.userPermission.upsert({
      where: {
        userId_permissionKey: {
          userId,
          permissionKey,
        },
      },
      update: {
        isGranted: true,
        grantedBy,
        expiresAt: expiresAt || null,
        reason: reason || null,
      },
      create: {
        userId,
        permissionKey,
        isGranted: true,
        grantedBy,
        expiresAt: expiresAt || null,
        reason: reason || null,
      },
    });
  },

  async revokeUserPermission(userId: string, permissionKey: string) {
    await this.clearUserPermissionCache(userId);
    return prisma.userPermission.delete({
      where: {
        userId_permissionKey: {
          userId,
          permissionKey,
        },
      },
    });
  },
};