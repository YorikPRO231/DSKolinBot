import { Request, Response, NextFunction } from 'express';
import { Client } from 'discord.js';
import { PermissionsService } from '../services/permissions.service';
import { PermissionsRepository } from '../../databases/index';

let discordClient: Client | null = null;

export function setDiscordClient(client: Client) {
  discordClient = client;
}

interface DbRole {
  role_id: string;
  role_name: string;
  description: string | null;
  created_at: string;
  permissions?: string;
}

async function syncDiscordRoles(userId: string): Promise<void> {
  if (!discordClient?.isReady()) return;
  
  try {
    const guild = await discordClient.guilds.fetch(process.env.GUILD_ID || "");
    const member = await guild.members.fetch(userId);
    const userRoles = member.roles.cache.map((role) => role.id);
    
    const dbRoles = await PermissionsRepository.getAllRoles() as DbRole[];
    
    for (const dbRole of dbRoles) {
      const hasRole = userRoles.includes(dbRole.role_id);
      const userRoleCheck = await PermissionsRepository.checkUserRole(userId, dbRole.role_id);
      
      if (hasRole && !userRoleCheck) {
        await PermissionsRepository.addUserToRole(userId, dbRole.role_id);
      } else if (!hasRole && userRoleCheck) {
        await PermissionsRepository.removeUserFromRole(userId, dbRole.role_id);
      }
    }
    
    if (PermissionsRepository.clearUserPermissionCache) {
      await PermissionsRepository.clearUserPermissionCache(userId);
    }
  } catch (error) {
    console.error('Error syncing Discord roles:', error);
  }
}

export async function ensureAuthenticatedAndAuthorized(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    if (req.session) {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect('/login');
  }

  const userId = (req.user as any)?.id;
  
  await syncDiscordRoles(userId);
  
  next();
}