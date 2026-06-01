import { PermissionsRepository } from '../../databases/index'
export class PermissionsService {
  static async getUserPermissions(userId: string): Promise<string[]> {
    return PermissionsRepository.getUserPermissions(userId);
  }
  
  static async hasPermission(userId: string, permissionKey: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permissionKey);
  }
  
  static async checkPermissions(userId: string, requiredPermissions: string[]): Promise<boolean> {
    const userPerms = await this.getUserPermissions(userId);
    return requiredPermissions.every(p => userPerms.includes(p));
  }
  
  static async grantUserPermission(userId: string, permissionKey: string, grantedBy: string, expiresAt?: Date, reason?: string) {
    return PermissionsRepository.grantUserPermission(userId, permissionKey, grantedBy, expiresAt, reason);
  }
  
  static async revokeUserPermission(userId: string, permissionKey: string) {
    return PermissionsRepository.revokeUserPermission(userId, permissionKey);
  }
  
  static async getAllRolesWithPermissions() {
    return PermissionsRepository.getAllRoles();
  }
  
  static async createRole(roleId: string, roleName: string, description?: string) {
    return PermissionsRepository.addRole(roleId, roleName, description);
  }
}