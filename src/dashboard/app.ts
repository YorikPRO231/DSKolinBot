import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import passport from 'passport';
import { Client } from 'discord.js';
import path from 'path';
import { setDiscordClient } from './middleware/auth.middleware';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import { createRateLimiter } from './middleware/rateLimit.middleware';
import { setupPassport } from './config/passport';
import dashboardRoutes from './routes';
import { setDiscordClient as setDiscordServiceClient } from './services/discord.service';
import { bindingsManager } from '../utils/bindingsManager';

export function createDashboardApp(discordClient: Client) {
  setDiscordClient(discordClient);
  setDiscordServiceClient(discordClient);
  
  setupPassport();
  
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.set("trust proxy", 1);

  // CORS
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
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: "lax",
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
  };

  app.use(session(sessionConfig));

  app.use(passport.initialize() as any);
  app.use(passport.session() as any);

  // app.use('/api/', createRateLimiter(60000, 100));

  app.use(express.static(path.join(__dirname, '../public')));
  app.use("/dashboard/public", express.static(path.join(process.cwd(), "public")));
  app.use("/public", express.static(path.join(process.cwd(), "public")));

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  app.use('/', dashboardRoutes);

  app.get('/health', (req, res) => {
    const bindings = bindingsManager.getAllBindings();
    res.json({
      status: "ok",
      discordReady: discordClient?.isReady() || false,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      bindings: bindings.length
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}