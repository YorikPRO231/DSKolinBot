import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import path from "path";
import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { bindingsManager } from "./utils/bindingsManager";
import * as sqlite from "./databases/sqlite";
import dotenv from "dotenv";
import fs from "fs";
import { StatusCodes, ReasonPhrases } from "http-status-codes";
dotenv.config();
import { Profile as DiscordProfile } from "passport-discord";
import db from './databases/sqlite';

declare module "express-session" {
  interface SessionData {
    returnTo?: string;
    userRoles?: string[];
    userRoleNames?: string[];
  }
}

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      avatar: string | null;
      discriminator: string;
      guilds?: any[];
      accessToken?: string;
      [key: string]: any;
    }
  }
}

interface FormResponse {
  formId: string;
  formTitle: string;
  answers: Record<string, string>;
  timestamp: string;
  respondentEmail?: string;
}

class APIError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(statusCode: number, message: string, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'API_ERROR';
    this.details = details;
    this.name = 'APIError';
  }

  static badRequest(message: string, code?: string, details?: any) {
    return new APIError(StatusCodes.BAD_REQUEST, message, code, details);
  }

  static unauthorized(message: string = ReasonPhrases.UNAUTHORIZED, code?: string) {
    return new APIError(StatusCodes.UNAUTHORIZED, message, code);
  }

  static forbidden(message: string = ReasonPhrases.FORBIDDEN, code?: string) {
    return new APIError(StatusCodes.FORBIDDEN, message, code);
  }

  static notFound(message: string = ReasonPhrases.NOT_FOUND, code?: string) {
    return new APIError(StatusCodes.NOT_FOUND, message, code);
  }

  static conflict(message: string, code?: string) {
    return new APIError(StatusCodes.CONFLICT, message, code);
  }

  static tooManyRequests(message: string = ReasonPhrases.TOO_MANY_REQUESTS, code?: string) {
    return new APIError(StatusCodes.TOO_MANY_REQUESTS, message, code);
  }

  static internal(message: string = ReasonPhrases.INTERNAL_SERVER_ERROR, code?: string) {
    return new APIError(StatusCodes.INTERNAL_SERVER_ERROR, message, code);
  }

  static badGateway(message: string = ReasonPhrases.BAD_GATEWAY, code?: string) {
    return new APIError(StatusCodes.BAD_GATEWAY, message, code);
  }

  static serviceUnavailable(message: string = ReasonPhrases.SERVICE_UNAVAILABLE, code?: string) {
    return new APIError(StatusCodes.SERVICE_UNAVAILABLE, message, code);
  }
}

const app = express();
let discordClient: Client | null = null;
const ALLOWED_ROLES = (process.env.ALLOWED_ROLES || "")
  .split(",")
  .filter((r) => r.trim());
const GUILD_ID = process.env.GUILD_ID || "";
const REQUIRE_ROLE = process.env.REQUIRE_ROLE !== "false";
const ADMIN_LOGS_DIR = path.join(process.cwd(), 'admin-logs');
const ADMIN_LOGS_ACCESS_ROLES = (process.env.ADMIN_LOGS_ACCESS || "")
  .split(",")
  .map(r => r.trim())
  .filter(r => r);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.set("trust proxy", 1);

app.use((req, res, next) => {
  const allowedOrigins = [
    'https://gta5rp-blackberry-dash.ru',
    'http://gta5rp-blackberry-dash.ru'
  ];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

const sessionConfig: session.SessionOptions = {
  secret: process.env.DASHBOARD_SECRET || "default-secret-key",
  resave: true,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: "lax",
    domain: process.env.COOKIE_DOMAIN || ".gta5rp-blackberry-dash.ru",
  },
};

app.use(session(sessionConfig));


interface ExtendedDiscordProfile extends DiscordProfile {
  accessToken?: string;
}

app.use(passport.initialize() as any);
app.use(passport.session() as any);

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      callbackURL: `${process.env.DASHBOARD_URL}/auth/discord/callback`,
      scope: ["identify", "guilds", "guilds.members.read"],
    },
    (
      accessToken: string,
      refreshToken: string,
      profile: ExtendedDiscordProfile,
      done: (err: any, user?: any) => void,
    ) => {
      profile.accessToken = accessToken;
      return done(null, profile);
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj as any);
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "dashboard/views"));

app.use(
  "/dashboard/public",
  express.static(path.join(process.cwd(), "public")),
);
app.use("/public", express.static(path.join(process.cwd(), "public")));

async function checkUserRole(
  userId: string,
): Promise<{ hasRole: boolean; roles: string[]; roleNames: string[] }> {
  console.log(`[AUTH] Checking roles for user: ${userId}`);
  
  if (!REQUIRE_ROLE || ALLOWED_ROLES.length === 0) return { hasRole: true, roles: [], roleNames: [] };
  
  if (!discordClient?.isReady()) {
    console.error("[AUTH] Discord Client is NOT ready!");
    return { hasRole: false, roles: [], roleNames: [] };
  }

  try {
    const guild = await discordClient.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);

    const userRoles = member.roles.cache.map((role) => role.id);
    const userRoleNames = member.roles.cache.map((role) => role.name);

    const hasRequiredRole = ALLOWED_ROLES.some((roleId) =>
      userRoles.includes(roleId),
    );

    return {
      hasRole: hasRequiredRole,
      roles: userRoles,
      roleNames: userRoleNames,
    };
  } catch (error) {
    console.error("Error checking user role:", error);
    return { hasRole: false, roles: [], roleNames: [] };
  }
}

async function ensureAuthenticatedAndAuthorized(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    if (req.session) {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect("/login");
  }

  const userId = (req.user as any)?.id;
  
  if (!userId) {
    return res.redirect("/login");
  }

  const { hasRole, roles, roleNames } = await checkUserRole(userId);

  if (!hasRole && REQUIRE_ROLE && ALLOWED_ROLES.length > 0) {
    const rolesData = encodeURIComponent(
      JSON.stringify({ ids: roles, names: roleNames }),
    );
    return res.redirect(`/access-denied?data=${rolesData}`);
  }

  next();
}

async function ensureAdminLogsAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    if (req.session) {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect("/login");
  }

  const userId = (req.user as any)?.id;
  
  if (!userId) {
    return res.redirect("/login");
  }

  if (ADMIN_LOGS_ACCESS_ROLES.length === 0) {
    return res.status(403).render("access-denied-logs", {
      user: req.user || null,
      title: "Access Denied",
      message: "Админ логи не настроены"
    });
  }

  try {
    if (!discordClient?.isReady()) {
      return res.status(503).render("access-denied-logs", {
        user: req.user || null,
        title: "Service Unavailable",
        message: "Discord клиент не готов. Попробуйте позже"
      });
    }

    const guild = await discordClient.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);

    const userRoles = member.roles.cache.map((role) => role.id);
    const hasAccess = ADMIN_LOGS_ACCESS_ROLES.some((roleId) =>
      userRoles.includes(roleId)
    );

    if (!hasAccess) {
      return res.status(403).render("access-denied-logs", {
        user: req.user || null,
        title: "Access Denied",
        message: "У вас нет доступа к админ логам"
      });
    }

    next();
  } catch (error) {
    console.error("Error checking admin logs access:", error);
    return res.status(500).render("access-denied-logs", {
      user: req.user || null,
      title: "Error",
      message: "Error checking access permissions"
    });
  }
}

function sanitizeText(text: string): string {
  if (!text || typeof text !== "string") return "No answer";
  return text
    .replace(/@everyone/gi, "@​everyone")
    .replace(/@here/gi, "@​here")
    .replace(/<@&\d+>/g, "[role]")
    .replace(/<@!?\d+>/g, "[user]")
    .trim();
}

function sanitizeQuestion(question: string): string {
  if (!question || typeof question !== "string") return "Question";
  return question
    .replace(/@everyone/gi, "everyone")
    .replace(/@here/gi, "here")
    .substring(0, 256)
    .trim();
}

function validateAnswers(answers: Record<string, string>): {
  valid: boolean;
  reason?: string;
} {
  const answerCount = Object.keys(answers).length;
  if (answerCount === 0) {
    return { valid: false, reason: "Empty form" };
  }
  for (const [question, answer] of Object.entries(answers)) {
    if (question.length > 500) {
      return { valid: false, reason: "Question too long" };
    }
    if (answer && answer.length > 5000) {
      return { valid: false, reason: "Answer too long" };
    }
    if (answer && /(.)\1{100,}/.test(answer)) {
      return { valid: false, reason: "Spam pattern detected" };
    }
  }
  return { valid: true };
}

app.get("/", (req: Request, res: Response) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.redirect("/dashboard");
  } else {
    res.redirect("/login");
  }
});

app.get("/login", (req: Request, res: Response) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect("/dashboard");
  }
  res.render("login", {
    title: "Login - Admin Dashboard",
    error: req.query.error || null,
  });
});

app.get(
  "/dashboard",
  ensureAuthenticatedAndAuthorized,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = sqlite.getStats();
      const bindings = bindingsManager.getAllBindings();

      res.render("dashboard", {
        user: req.user || null,
        currentPage: "dashboard",
        title: "Dashboard",
        stats: {
          totalForms: bindings.length,
          activeAlerts: stats.alerts_open,
          closedAlerts: stats.alerts_closed,
          inspections: stats.inspection_count,
          warehouseItems: stats.warehouse_count,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

app.post("/logout", (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ success: false, error: "Logout failed" });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res
          .status(500)
          .json({ success: false, error: "Session destroy failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });
});

app.get("/logout", (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) console.error("Logout error:", err);
    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
      res.clearCookie("connect.sid");
      res.redirect("/login");
    });
  });
});

app.get(
  "/dashboard/forms",
  ensureAuthenticatedAndAuthorized,
  (req: Request, res: Response) => {
    res.render("forms", {
      user: req.user || null,
      currentPage: "forms",
      title: "Forms Management",
    });
  },
);

app.get(
  "/dashboard/security",
  ensureAuthenticatedAndAuthorized,
  (req: Request, res: Response) => {
    res.render("security", {
      user: req.user || null,
      currentPage: "security",
      title: "Security",
    });
  },
);

app.post(
  "/api/security/alerts/add",
  ensureAuthenticatedAndAuthorized,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { suspect, action, data } = req.body;
      const adminId = (req.user as any)?.id || "unknown";
      
      if (!suspect || !action) {
        throw APIError.badRequest('Missing required fields: suspect and action');
      }
      
      if (!/^\d+$/.test(suspect)) {
        throw APIError.badRequest('Suspect must contain only numbers');
      }
      
      const result = sqlite.exportSecurityAlertsMany(adminId, [{
        suspect: suspect,
        action: action,
        data: data || 'Ручное добавление'
      }]);
      
      res.json({ success: true, result });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/dashboard/inspections",
  ensureAuthenticatedAndAuthorized,
  (req: Request, res: Response) => {
    res.render("inspections", {
      user: req.user || null,
      currentPage: "inspections",
      title: "Inspection Reports",
    });
  },
);

app.get(
  "/dashboard/admin-logs",
  ensureAuthenticatedAndAuthorized,
  ensureAdminLogsAccess,
  (req: Request, res: Response) => {
    res.render("admin-logs", {
      user: req.user || null,
      currentPage: "admin-logs",
      title: "Admin Logs",
    });
  },
);

app.get("/auth/discord", passport.authenticate("discord"));

app.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { 
    failureRedirect: "/login?error=auth_failed", 
    keepSessionInfo: true
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any)?.id;
      
      if (REQUIRE_ROLE && ALLOWED_ROLES.length > 0) {
        const { hasRole, roles, roleNames } = await checkUserRole(userId);
        
        if (!hasRole) {
          const rolesData = encodeURIComponent(
            JSON.stringify({ ids: roles, names: roleNames }),
          );
          
          return req.logout((err) => {
            if (err) console.error("Logout error:", err);
            res.redirect(`/access-denied?data=${rolesData}`);
          });
        }
      }

      const returnTo = req.session?.returnTo || "/dashboard";
      if (req.session) {
        delete req.session.returnTo;
      }

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect("/dashboard");
        }
        res.redirect(returnTo);
      });

    } catch (error) {
      next(error);
    }
  },
);

app.get("/access-denied", (req: Request, res: Response) => {
  let userRoleIds: string[] = [];
  let userRoleNames: string[] = [];

  const dataParam = req.query.data as string;

  if (dataParam) {
    try {
      const data = JSON.parse(decodeURIComponent(dataParam));
      userRoleIds = data.ids || [];
      userRoleNames = data.names || [];
    } catch (e) {
      console.error("Error parsing roles data:", e);
    }
  }

  res.render("access-denied", {
    requiredRoles: ALLOWED_ROLES,
    userRoleIds: userRoleIds,
    userRoleNames: userRoleNames,
  });
});

app.get(
  "/api/admin-logs/files",
  ensureAuthenticatedAndAuthorized,
  ensureAdminLogsAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!fs.existsSync(ADMIN_LOGS_DIR)) {
        return res.json({ success: true, files: [] });
      }

      const files: string[] = await fs.promises.readdir(ADMIN_LOGS_DIR);
      
      const logFiles = await Promise.all(
        files
          .filter((file: string) => file.endsWith('.log'))
          .map(async (file: string) => {
            const filePath = path.join(ADMIN_LOGS_DIR, file);
            const stats = await fs.promises.stat(filePath);
            
            const match = file.match(/admin_(.+?)_(\d{4}-\d{2}-\d{2})\.log/);
            const category = match ? match[1] : 'general';
            const date = match ? match[2] : 'unknown';
            
            return {
              name: file,
              category,
              date,
              size: stats.size,
              modified: stats.mtime.toISOString(),
            };
          })
      );
      
      logFiles.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
      
      res.json({ success: true, files: logFiles });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/admin-logs/files/:filename",
  ensureAuthenticatedAndAuthorized,
  ensureAdminLogsAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filename = req.params.filename as string;
      
      if (!filename || filename.includes('..') || !filename.endsWith('.log')) {
        throw APIError.badRequest('Invalid filename');
      }
      
      const filePath = path.join(ADMIN_LOGS_DIR, filename);
      
      if (!fs.existsSync(filePath)) {
        throw APIError.notFound('File not found');
      }
      
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      res.json({ success: true, content, filename });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/api/admin-logs/files/:filename",
  ensureAuthenticatedAndAuthorized,
  ensureAdminLogsAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filename = req.params.filename as string;
      
      if (!filename || filename.includes('..') || !filename.endsWith('.log')) {
        throw APIError.badRequest('Invalid filename');
      }
      
      const filePath = path.join(ADMIN_LOGS_DIR, filename);
      
      if (!fs.existsSync(filePath)) {
        throw APIError.notFound('File not found');
      }
      
      await fs.promises.unlink(filePath);
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/admin-logs/stats",
  ensureAuthenticatedAndAuthorized,
  ensureAdminLogsAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!fs.existsSync(ADMIN_LOGS_DIR)) {
        return res.json({ success: true, stats: { totalSize: 0, fileCount: 0, categories: {} } });
      }

      const files: string[] = await fs.promises.readdir(ADMIN_LOGS_DIR);
      const logFiles = files.filter((file: string) => file.endsWith('.log'));
      
      let totalSize = 0;
      const categories: Record<string, { count: number; size: number }> = {};
      
      for (const file of logFiles) {
        const filePath = path.join(ADMIN_LOGS_DIR, file);
        const stats = await fs.promises.stat(filePath);
        totalSize += stats.size;
        
        const match = file.match(/admin_(.+?)_(\d{4}-\d{2}-\d{2})\.log/);
        const category = match ? match[1] : 'general';
        
        if (!categories[category]) {
          categories[category] = { count: 0, size: 0 };
        }
        categories[category].count++;
        categories[category].size += stats.size;
      }
      
      res.json({ 
        success: true, 
        stats: {
          totalSize,
          fileCount: logFiles.length,
          categories
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/forms",
  ensureAuthenticatedAndAuthorized,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const bindings = bindingsManager.getAllBindings();
      res.json({ success: true, bindings });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/forms",
  ensureAuthenticatedAndAuthorized,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { formId, channelId, guildId, formName, pingRoleId, pingRoleId2 } =
        req.body;
      if (!formId || !channelId || !guildId) {
        throw APIError.badRequest('Missing required fields');
      }
      const binding = bindingsManager.addBinding(
        formId,
        channelId,
        guildId,
        formName,
        pingRoleId,
        pingRoleId2,
      );
      res.json({ success: true, binding });
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  "/api/forms/:formId",
  ensureAuthenticatedAndAuthorized,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const formId = req.params.formId as string;
      const deleted = bindingsManager.removeBinding(formId);
      if (deleted) {
        res.json({ success: true });
      } else {
        throw APIError.notFound('Binding not found');
      }
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/api/security/alerts",
  ensureAuthenticatedAndAuthorized,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as string | undefined;
      const suspect = req.query.suspect as string | undefined;
      let alerts;
      if (suspect) {
        alerts = sqlite.getSecurityAlertsBySuspect(suspect);
      } else {
        alerts = sqlite.getSecurityAlerts(status as any);
      }
      res.json({ success: true, alerts });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/security/alerts/:id/close",
  ensureAuthenticatedAndAuthorized,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const adminId = (req.user as any)?.id || "unknown";
      const result = sqlite.closeAlert(parseInt(id), adminId);
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        throw APIError.notFound('Alert not found');
      }
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/security/alerts/:id/reopen",
  ensureAuthenticatedAndAuthorized,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const adminId = (req.user as any)?.id || "unknown";
      const result = sqlite.reopenAlert(parseInt(id), adminId);
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        throw APIError.notFound('Alert not found');
      }
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/api/security/logs",
  ensureAuthenticatedAndAuthorized,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const limitParam = req.query.limit as string | undefined;
      const limit = limitParam ? parseInt(limitParam) : 100;
      const logs = sqlite.getSecurityLogs(limit);
      res.json({ success: true, logs });
    } catch (error) {
      next(error);
    }
  },
);

app.get('/api/inspections/passport/:passport', (req, res) => {
    const passport = req.params.passport as string;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM inspection_reports WHERE passport = ?')
            .get(passport) as { count: number };
        
        const reports = db.prepare(`
            SELECT * FROM inspection_reports
            WHERE passport = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(passport, limit, offset);
        
        res.json({
            success: true,
            reports: reports,
            total: total.count
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get(
  "/api/inspections/recent",
  ensureAuthenticatedAndAuthorized,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const reports = sqlite.getInspectionReportsByAdmin("", 10);
      res.json({ success: true, reports });
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/api/user/nickname/:userId",
  ensureAuthenticatedAndAuthorized,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string;
      
      if (!discordClient?.isReady()) {
        return res.json({ success: true, nickname: userId });
      }

      try {
        const guild = await discordClient.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        const nickname = member.nickname || member.user.displayName;
        
        res.json({ success: true, nickname });
      } catch {
        try {
          const user = await discordClient.users.fetch(userId);
          res.json({ success: true, nickname: user.displayName });
        } catch {
          res.json({ success: true, nickname: userId });
        }
      }
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/channel/:channelId/info",
  ensureAuthenticatedAndAuthorized,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channelId = req.params.channelId as string;
      
      if (!discordClient?.isReady()) {
        return res.json({ success: false, error: "Discord client not ready" });
      }

      try {
        const channel = await discordClient.channels.fetch(channelId);
        
        if (!channel) {
          return res.json({ success: false, error: "Channel not found" });
        }

        let guildId = null;
        let guildName = null;
        let channelName = channelId;
        
        if ('name' in channel && channel.name) {
          channelName = channel.name;
        } else if ('recipient' in channel && channel.recipient) {
          channelName = `DM: ${channel.recipient.username}`;
        }
        
        if ('guild' in channel && channel.guild) {
          guildId = channel.guild.id;
          guildName = channel.guild.name;
        }

        res.json({ 
          success: true, 
          channel: {
            id: channel.id,
            name: channelName,
            type: channel.type
          },
          guild: {
            id: guildId,
            name: guildName
          }
        });
      } catch (error) {
        next(error);
      }
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/role/:guildId/:roleId/name",
  ensureAuthenticatedAndAuthorized,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const roleId = req.params.roleId as string;
      
      if (!discordClient?.isReady()) {
        return res.json({ success: true, name: roleId });
      }

      try {
        const guild = await discordClient.guilds.fetch(guildId);
        const role = await guild.roles.fetch(roleId);
        res.json({ success: true, name: role?.name || roleId });
      } catch {
        res.json({ success: true, name: roleId });
      }
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/guild/:guildId/name",
  ensureAuthenticatedAndAuthorized,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      
      if (!discordClient?.isReady()) {
        return res.json({ success: true, name: guildId });
      }

      try {
        const guild = await discordClient.guilds.fetch(guildId);
        res.json({ success: true, name: guild.name });
      } catch {
        res.json({ success: true, name: guildId });
      }
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/admin-logs/search",
  ensureAuthenticatedAndAuthorized,
  ensureAdminLogsAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.query.q as string || '').toLowerCase().trim();
      const category = req.query.category as string || 'all';
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const dateFrom = req.query.dateFrom as string || '';
      const dateTo = req.query.dateTo as string || '';

      if (!fs.existsSync(ADMIN_LOGS_DIR)) {
        return res.json({ success: true, entries: [], total: 0, hasMore: false });
      }

      let files = await fs.promises.readdir(ADMIN_LOGS_DIR);
      let logFiles = files.filter(f => f.endsWith('.log'));

      if (category !== 'all') {
        let categoryPattern = '';
        switch (category) {
          case 'message_delete':
            categoryPattern = 'admin_message_delete_';
            break;
          case 'message_edit':
            categoryPattern = 'admin_message_edit_';
            break;
          case 'voice':
            categoryPattern = 'admin_voice_';
            break;
          default:
            categoryPattern = `admin_${category}_`;
        }
        logFiles = logFiles.filter(file => file.includes(categoryPattern));
      }

      logFiles.sort().reverse();

      const allEntries: any[] = [];

      for (const file of logFiles) {
        const filePath = path.join(ADMIN_LOGS_DIR, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        
        const rawEntries = content.split('===== НАЧАЛО ЗАПИСИ =====');
        
        for (const rawEntry of rawEntries) {
          if (!rawEntry.includes('===== КОНЕЦ ЗАПИСИ =====')) continue;
          
          const cleanEntry = rawEntry.split('===== КОНЕЦ ЗАПИСИ =====')[0].trim();
          if (!cleanEntry) continue;

          const parsedEntry = parseLogEntry(cleanEntry, file);
          
          if (query && !matchesSearchQuery(parsedEntry, query)) continue;
          
          if (dateFrom || dateTo) {
            const entryUTCDate = parsedEntry.utcDate || parsedEntry.timestamp?.split('T')[0];
            if (entryUTCDate) {
              if (dateFrom && entryUTCDate < dateFrom) continue;
              if (dateTo && entryUTCDate > dateTo) continue;
            }
          }
          
          allEntries.push(parsedEntry);
        }
      }

      allEntries.sort((a, b) => {
        const aTime = a.utcTimestamp || a.timestamp;
        const bTime = b.utcTimestamp || b.timestamp;
        if (!aTime) return 1;
        if (!bTime) return -1;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      const totalFound = allEntries.length;
      const paginatedEntries = allEntries.slice(offset, offset + limit);

      res.json({ 
        success: true, 
        entries: paginatedEntries, 
        total: totalFound,
        hasMore: totalFound > offset + limit
      });
      
    } catch (error) {
      next(error);
    }
  }
);

app.get('/api/inspections/discord/:discordId', (req, res) => {
    const discordId = req.params.discordId as string;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM inspection_reports WHERE discord_id = ?')
            .get(discordId) as { count: number };
        
        const reports = db.prepare(`
            SELECT * FROM inspection_reports
            WHERE discord_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(discordId, limit, offset);
        
        res.json({
            success: true,
            reports: reports,
            total: total.count
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/inspections/update/:id', (req, res) => {
    const id = parseInt(req.params.id as string);
    const { discord_id, result } = req.body;
    
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        const stmt = db.prepare(`
            UPDATE inspection_reports 
            SET discord_id = ?, result = ?
            WHERE id = ?
        `);
        
        const updateResult = stmt.run(discord_id || null, result, id);
        
        if (updateResult.changes > 0) {
            res.json({ success: true, message: 'Запись обновлена' });
        } else {
            res.json({ success: false, error: 'Запись не найдена' });
        }
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});


app.get(
  "/api/admin-logs/user/:userId",
  ensureAuthenticatedAndAuthorized,
  ensureAdminLogsAccess,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string;
      const limit = parseInt(req.query.limit as string) || 100;
      
      if (!userId || !userId.match(/^\d{17,20}$/)) {
        return res.json({ success: true, entries: [], total: 0 });
      }
      
      const response = await fetch(
        `${process.env.DASHBOARD_URL}/api/admin-logs/search?q=${userId}&limit=${limit}`,
        { headers: { Cookie: req.headers.cookie || '' } }
      );
      const data = await response.json();
      
      res.json({ 
        success: true, 
        entries: data.entries, 
        total: data.total,
        userId: userId
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/channel/:channelId/name",
  ensureAuthenticatedAndAuthorized,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const channelId = req.params.channelId as string;
      
      if (!discordClient?.isReady()) {
        return res.json({ success: true, name: channelId });
      }

      try {
        const channel = await discordClient.channels.fetch(channelId);
        
        if (!channel) {
          return res.json({ success: true, name: channelId });
        }
        
        let channelName = channelId;
        if ('name' in channel && channel.name) {
          channelName = channel.name;
        } else if ('recipient' in channel && channel.recipient) {
          channelName = channel.recipient.username;
        }
        
        res.json({ success: true, name: channelName });
      } catch {
        res.json({ success: true, name: channelId });
      }
    } catch (error) {
      next(error);
    }
  }
);

app.post("/webhook/form-response", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response: FormResponse = req.body;
    const validation = validateAnswers(response.answers);
    if (!validation.valid) {
      console.warn(`Validation failed: ${validation.reason}`);
      throw APIError.badRequest('Invalid data', validation.reason);
    }
    const binding = bindingsManager.getBinding(response.formId);
    if (!binding) {
      throw APIError.notFound('No binding found for this form');
    }
    if (!discordClient) {
      throw APIError.serviceUnavailable('Discord client not ready');
    }
    const channel = await discordClient.channels.fetch(binding.channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw APIError.notFound('Channel not found');
    }
    const answerEntries = Object.entries(response.answers).filter(
      ([_, answer]) => answer && answer.trim() !== "",
    ) as [string, string][];
    const chunks: Array<[string, string][]> = [];
    for (let i = 0; i < answerEntries.length; i += 25) {
      chunks.push(answerEntries.slice(i, i + 25));
    }
    if (chunks.length === 0) {
      return res.json({ success: true, skipped: "All answers empty" });
    }
    const embeds: EmbedBuilder[] = [];
    chunks.forEach((chunk, chunkIndex) => {
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTimestamp(new Date(response.timestamp))
        .setFooter({
          text: `Google Forms | ${response.formId.slice(-12)}${chunks.length > 1 ? ` | Part ${chunkIndex + 1}/${chunks.length}` : ""}`,
        });
      if (chunkIndex === 0) {
        embed.setTitle(`${sanitizeText(response.formTitle)}`);
      }
      chunk.forEach(([question, answer]) => {
        const cleanQuestion = sanitizeQuestion(question);
        const cleanAnswer = sanitizeText(answer);
        embed.addFields({
          name: `${cleanQuestion}`,
          value:
            cleanAnswer.length > 1024
              ? cleanAnswer.substring(0, 1021) + "..."
              : cleanAnswer,
          inline: false,
        });
      });
      embeds.push(embed);
    });
    let content = "";
    const allowedMentions: any = { parse: [], roles: [] };
    const pingRoles = [];
    if (binding.pingRoleId) pingRoles.push(binding.pingRoleId);
    if (binding.pingRoleId2) pingRoles.push(binding.pingRoleId2);
    if (pingRoles.length > 0) {
      content = pingRoles.map((roleId) => `<@&${roleId}>`).join(" ");
      allowedMentions.roles = pingRoles;
    }
    await channel.send({
      content: content || undefined,
      embeds: embeds.slice(0, 10),
      allowedMentions: allowedMentions,
    });
    if (embeds.length > 10) {
      for (let i = 10; i < embeds.length; i += 10) {
        await channel.send({ embeds: embeds.slice(i, i + 10) });
      }
    }
    res.json({ success: true, channelId: binding.channelId });
  } catch (error) {
    next(error);
  }
});

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    bindings: bindingsManager.getAllBindings().length,
    discordReady: discordClient?.isReady() || false,
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const isApiRequest = req.path.startsWith('/api/') || 
                       req.path.startsWith('/webhook/') ||
                       req.xhr ||
                       req.accepts('json') === 'json';
  
  const isDashboardPage = req.path.startsWith('/dashboard/') && 
                          !req.path.includes('.') &&
                          !req.path.endsWith('/api/');
  
  if (isApiRequest && !isDashboardPage) {
    res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
        statusCode: StatusCodes.NOT_FOUND,
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  } else {
    const user = (req as any).user || null;
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    
    let errorPage = 'error';
    let errorData = {
      code: 404,
      message: 'Page Not Found',
      description: 'The requested page does not exist or has been moved'
    };
    
    if (!isAuthenticated && req.path.startsWith('/dashboard/')) {
      if (req.session) {
        req.session.returnTo = req.originalUrl;
      }
      return res.redirect('/login');
    }
    
    res.status(StatusCodes.NOT_FOUND).render(errorPage, {
      user: user,
      title: '404 - Page Not Found',
      error: errorData
    });
  }
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR HANDLER]', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    user: (req as any).user?.id || 'anonymous',
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      code: err.code,
      statusCode: err.statusCode
    }
  });

  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  
  if (err.name === 'ValidationError') {
    statusCode = StatusCodes.BAD_REQUEST;
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    statusCode = StatusCodes.UNAUTHORIZED;
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = StatusCodes.BAD_GATEWAY;
  } else if (err.code === 'ETIMEDOUT') {
    statusCode = StatusCodes.GATEWAY_TIMEOUT;
  }

  const isApiRequest = req.path.startsWith('/api/');
  const acceptsJson = req.accepts('json');

  const errorResponse = {
    success: false,
    error: {
      code: err.code || getErrorCodeFromStatus(statusCode),
      message: err.message || getErrorMessageFromStatus(statusCode),
      statusCode: statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      ...(err.details && { details: err.details })
    }
  };

  if (isApiRequest || acceptsJson) {
    return res.status(statusCode).json(errorResponse);
  }

  res.status(statusCode).render('error', {
    user: (req as any).user || null,
    title: `${statusCode} - ${getErrorMessageFromStatus(statusCode)}`,
    error: {
      code: statusCode,
      message: err.message || getErrorMessageFromStatus(statusCode),
      description: getErrorDescription(statusCode, err),
      stack: process.env.NODE_ENV === 'development' ? err.stack : null
    }
  });
});

function getErrorCodeFromStatus(statusCode: number): string {
  const codes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT'
  };
  return codes[statusCode] || 'UNKNOWN_ERROR';
}

function parseLogEntry(rawEntry: string, filename: string): any {
  const lines = rawEntry.split('\n');
  const entry: any = {
    raw: rawEntry,
    file: filename,
    timestamp: null,
    utcTimestamp: null,
    utcDate: null,
    event: null,
    description: null,
    userId: null,
    userName: null,
    channelId: null,
    channelName: null,
    oldContent: null,
    newContent: null,
    content: null,
    guildId: null,
    guildName: null,
    messageLink: null,
    messageId: null,
  };

  let isCollectingOld = false;
  let isCollectingNew = false;
  let oldLines: string[] = [];
  let newLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (trimmedLine.includes('Время события:')) {
      let timeValue = trimmedLine.replace('Время события:', '').trim();
      
      const utcDate = new Date(timeValue);
      if (!isNaN(utcDate.getTime())) {
        entry.utcTimestamp = timeValue;
        entry.utcDate = timeValue.split('T')[0];
        
        const mskDate = new Date(utcDate);
        mskDate.setHours(mskDate.getHours() + 3);
        entry.timestamp = mskDate.toISOString().replace('Z', '');
      } else {
        entry.timestamp = timeValue;
      }
    }
    else if (trimmedLine.includes('Событие:')) {
      entry.event = trimmedLine.replace('Событие:', '').trim();
    }
    else if (trimmedLine.includes('Описание:')) {
      let desc = trimmedLine.replace('Описание:', '').trim();
      entry.description = desc;
      
      const authorMatch = desc.match(/Автор:\s*(.+?)(?:\n|$)/);
      if (authorMatch) {
        let author = authorMatch[1].trim();
        const idMatch = author.match(/(\d{17,20})/);
        if (idMatch) {
          entry.userId = idMatch[1];
          entry.userName = author.replace(/\s*\(\d{17,20}\)/, '').trim();
        } else {
          entry.userName = author;
        }
      }
      
      const userMatch = desc.match(/Пользователь:\s*(.+?)(?:\n|$)/);
      if (userMatch) {
        let user = userMatch[1].trim();
        const idMatch = user.match(/(\d{17,20})/);
        if (idMatch) {
          entry.userId = idMatch[1];
          entry.userName = user.replace(/\s*\(\d{17,20}\)/, '').trim();
        } else {
          entry.userName = user;
        }
      }
      
      const channelMatch = desc.match(/Канал:\s*<#(\d{17,20})>/);
      if (channelMatch) {
        entry.channelId = channelMatch[1];
      }
      
      const voiceChannelMatch = desc.match(/Голосовой канал:\s*(.+?)(?:\s*\(|$)/);
      if (voiceChannelMatch) {
        entry.channelName = voiceChannelMatch[1].trim();
      }
    }
    else if (trimmedLine.includes('ID автора:')) {
      const idMatch = trimmedLine.match(/\b(\d{17,20})\b/);
      if (idMatch) {
        entry.userId = idMatch[1];
      }
    }
    else if (trimmedLine.includes('Канал:')) {
      const channelMatch = trimmedLine.match(/<#(\d{17,20})>/);
      if (channelMatch) {
        entry.channelId = channelMatch[1];
      }
      const nameMatch = trimmedLine.match(/Канал:\s*#?(.+?)(?:\s|$)/);
      if (nameMatch && !nameMatch[1].match(/^\d+$/)) {
        entry.channelName = nameMatch[1].trim();
      }
    }
    else if (trimmedLine.includes('Голосовой канал:')) {
      const voiceMatch = trimmedLine.match(/Голосовой канал:\s*(.+?)(?:\s*\(|$)/);
      if (voiceMatch) {
        entry.channelName = voiceMatch[1].trim();
      }
      const idMatch = trimmedLine.match(/\((\d{17,20})\)/);
      if (idMatch) {
        entry.channelId = idMatch[1];
      }
    }
    else if (trimmedLine.includes('Сервер:')) {
      const guildMatch = trimmedLine.match(/Сервер:\s*(.+?)(?:\s*\(|$)/);
      if (guildMatch) {
        entry.guildName = guildMatch[1].trim();
      }
      const idMatch = trimmedLine.match(/\((\d{17,20})\)/);
      if (idMatch) {
        entry.guildId = idMatch[1];
      }
    }
    else if (trimmedLine.includes('Ссылка:')) {
      const linkMatch = trimmedLine.match(/Ссылка:\s*(.+)$/);
      if (linkMatch) {
        entry.messageLink = linkMatch[1].trim();
      }
    }
    else if (trimmedLine.includes('Содержание:') && !trimmedLine.includes('(')) {
      let contentValue = trimmedLine.replace('Содержание:', '').trim();
      if (contentValue) {
        entry.content = contentValue;
      }
    }
    else if (trimmedLine.includes('Старая версия:')) {
      let oldValue = trimmedLine.replace('Старая версия:', '').trim();
      if (oldValue && oldValue !== 'Пусто') {
        entry.oldContent = oldValue;
      } else {
        isCollectingOld = true;
        isCollectingNew = false;
        oldLines = [];
      }
    }
    else if (trimmedLine.includes('Новая версия:')) {
      let newValue = trimmedLine.replace('Новая версия:', '').trim();
      if (newValue && newValue !== 'Пусто') {
        entry.newContent = newValue;
      } else {
        isCollectingNew = true;
        isCollectingOld = false;
        newLines = [];
      }
    }
    else if (trimmedLine === 'Старая версия') {
      isCollectingOld = true;
      isCollectingNew = false;
      oldLines = [];
    }
    else if (trimmedLine === 'Новая версия') {
      isCollectingNew = true;
      isCollectingOld = false;
      newLines = [];
    }
    else if (trimmedLine.includes('Footer:')) {
      isCollectingOld = false;
      isCollectingNew = false;
      
      const authorMatch = trimmedLine.match(/ID автора:\s*(\d{17,20})/);
      if (authorMatch) {
        entry.userId = authorMatch[1];
      }
      const messageMatch = trimmedLine.match(/ID сообщения:\s*(\d{17,20})/);
      if (messageMatch) {
        entry.messageId = messageMatch[1];
      }
    }
    else if (trimmedLine.includes('ID:')) {
      const idMatch = trimmedLine.match(/ID:\s*(\d{17,20})/);
      if (idMatch && !entry.userId) {
        entry.userId = idMatch[1];
      }
    }
    else if (isCollectingOld && !trimmedLine.includes('===') && !trimmedLine.includes('Footer:') && !trimmedLine.includes('Новая версия')) {
      if (!trimmedLine.includes('*Полный текст')) {
        oldLines.push(trimmedLine);
      }
    }
    else if (isCollectingNew && !trimmedLine.includes('===') && !trimmedLine.includes('Footer:') && !trimmedLine.includes('Старая версия')) {
      if (!trimmedLine.includes('*Полный текст')) {
        newLines.push(trimmedLine);
      }
    }
  }

  if (oldLines.length > 0) {
    entry.oldContent = oldLines.join('\n').trim();
  }
  if (newLines.length > 0) {
    entry.newContent = newLines.join('\n').trim();
  }

  if (entry.messageId && entry.channelId) {
    entry.messageLink = `https://discord.com/channels/${entry.guildId || '@me'}/${entry.channelId}/${entry.messageId}`;
  }

  if (entry.event === 'Сообщение удалено') {
    const preview = entry.content ? entry.content.substring(0, 100).replace(/\n/g, ' ') : '';
    entry.description = `${entry.userName || 'Пользователь'} удалил сообщение`;
    if (preview) entry.description += `: "${preview}"`;
  } 
  else if (entry.event === 'Сообщение отредактировано') {
    entry.description = `${entry.userName || 'Пользователь'} отредактировал сообщение`;
  }
  else if (entry.event === 'Присоединился к голосовому каналу') {
    entry.description = `${entry.userName || 'Пользователь'} присоединился к ${entry.channelName || 'каналу'}`;
  }
  else if (entry.event === 'Покинул голосовой канал') {
    entry.description = `${entry.userName || 'Пользователь'} покинул ${entry.channelName || 'канал'}`;
  }
  else if (entry.event === 'Переместился в другой голосовой канал') {
    entry.description = `${entry.userName || 'Пользователь'} переместился`;
  }

  return entry;
}

function matchesSearchQuery(entry: any, query: string): boolean {
  if (!query) return true;
  const fields = [
    entry.event, entry.description, entry.userId, entry.userName,
    entry.channelId, entry.channelName, entry.content, entry.oldContent,
    entry.newContent, entry.raw
  ];
  for (const field of fields) {
    if (field && String(field).toLowerCase().includes(query)) return true;
  }
  return false;
}

function getErrorMessageFromStatus(statusCode: number): string {
  const messages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Validation Error',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  };
  return messages[statusCode] || 'An error occurred';
}

function getErrorDescription(statusCode: number, err: any): string {
  const descriptions: Record<number, string> = {
    400: 'Please check your input data and try again.',
    401: 'Please log in to access this resource.',
    403: 'You do not have permission to perform this action.',
    404: 'Please check the URL or return to the homepage.',
    409: 'The data you are trying to modify already exists or conflicts with other data.',
    422: 'Please check all form fields for errors.',
    429: 'Please wait a few seconds before trying again.',
    500: 'Technical difficulties or internal error. Please try again later.',
    502: 'Issue with an external service. Please try again later.',
    503: 'Server is temporarily unavailable. Please try again later.',
    504: 'Server is not responding. Please try again later.'
  };
  
  if (statusCode === 404 && err?.message?.includes('EJS')) {
    return 'The requested page was not found. Please check the URL.';
  }
  
  return descriptions[statusCode] || 'Please try again later or contact the administrator.';
}

export function initializeGoogleFormsServer(client: Client) {
  discordClient = client;
}

const PORT = parseInt(process.env.PORT || '8080', 10);

export function startGoogleFormsServer() {
  app.listen(PORT, '0.0.0.0', () => {
    if (REQUIRE_ROLE && ALLOWED_ROLES.length > 0) {
      console.log(`Role protection enabled: ${ALLOWED_ROLES.join(", ")}`);
    }

    if (ADMIN_LOGS_ACCESS_ROLES.length > 0) {
      console.log(`Admin logs access roles: ${ADMIN_LOGS_ACCESS_ROLES.join(", ")}`);
    }

    const bindings = bindingsManager.getAllBindings();
    if (bindings.length > 0) {
      console.log("Active bindings:");
      bindings.forEach((b) => {
        console.log(`  - ${b.formName || b.formId} -> ${b.channelId}`);
      });
    }
  });
}

export default app;