import { Request, Response, NextFunction } from 'express';
import { Client } from 'discord.js';

declare module 'express-session' {
  interface SessionData {
    returnTo?: string;
  }
}

let discordClient: Client | null = null;

export function setDiscordClient(client: Client) {
  discordClient = client;
}

export function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  if (req.session) {
    req.session.returnTo = req.originalUrl;
  }
  res.redirect('/login');
}

export function ensureApiAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ 
    success: false, 
    error: 'Unauthorized. Please login first.' 
  });
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
  const ALLOWED_ROLES = (process.env.ALLOWED_ROLES || "").split(",").filter(r => r.trim());
  const GUILD_ID = process.env.GUILD_ID || "";
  const REQUIRE_ROLE = process.env.REQUIRE_ROLE !== "false";

  if (!REQUIRE_ROLE || ALLOWED_ROLES.length === 0) {
    return next();
  }

  if (!discordClient?.isReady()) {
    console.error("[AUTH] Discord Client is NOT ready!");
    return res.status(503).render('error', { 
      user: req.user, 
      title: 'Service Unavailable',
      error: { code: 503, message: 'Сервис временно недоступен. Попробуйте позже.' }
    });
  }

  try {
    const guild = await discordClient.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    const userRoles = member.roles.cache.map((role) => role.id);
    const hasRequiredRole = ALLOWED_ROLES.some((roleId) => userRoles.includes(roleId));

    if (!hasRequiredRole) {
      const rolesData = encodeURIComponent(
        JSON.stringify({ ids: userRoles, names: member.roles.cache.map(r => r.name) })
      );
      return res.redirect(`/access-denied?data=${rolesData}`);
    }

    next();
  } catch (error) {
    console.error("Error checking user role:", error);
    res.status(500).render('error', { 
      user: req.user,
      title: 'Error',
      error: { code: 500, message: 'Ошибка проверки прав доступа' }
    });
  }
}

export async function ensureAdminLogsAccess(
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
  const ADMIN_LOGS_ACCESS_ROLES = (process.env.ADMIN_LOGS_ACCESS || "")
    .split(",")
    .map(r => r.trim())
    .filter(r => r);

  if (ADMIN_LOGS_ACCESS_ROLES.length === 0) {
    return res.status(403).render('error', { 
      user: req.user,
      title: 'Access Denied',
      error: { code: 403, message: 'Админ логи не настроены' }
    });
  }

  try {
    if (!discordClient?.isReady()) {
      return res.status(503).render('error', { 
        user: req.user,
        title: 'Service Unavailable',
        error: { code: 503, message: 'Discord клиент не готов' }
      });
    }

    const guild = await discordClient.guilds.fetch(process.env.GUILD_ID || "");
    const member = await guild.members.fetch(userId);
    const userRoles = member.roles.cache.map((role) => role.id);
    const hasAccess = ADMIN_LOGS_ACCESS_ROLES.some((roleId) => userRoles.includes(roleId));

    if (!hasAccess) {
      return res.status(403).render('error', { 
        user: req.user,
        title: 'Access Denied',
        error: { code: 403, message: 'У вас нет доступа к админ логам' }
      });
    }

    next();
  } catch (error) {
    console.error("Error checking admin logs access:", error);
    res.status(500).render('error', { 
      user: req.user,
      title: 'Error',
      error: { code: 500, message: 'Ошибка проверки доступа' }
    });
  }
}