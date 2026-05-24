import { Router, Request, Response } from "express";
import { ensureAuthenticatedAndAuthorized } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permissions.middleware";
import fs from "fs";
import path from "path";
import { z, ZodError } from "zod";

const router = Router();

const SETTINGS_PATH = path.join(__dirname, "../../../config/settings.json");

const FactionSchema = z.object({
  label: z.string().min(1),
  type: z.enum(["government", "criminal"]),
  discord_id: z.string().min(1),
  emoji_id: z.string(),
  roles: z.object({
    faction: z.string(),
    high: z.array(z.string()).default([]),
    chp: z.string().optional(),
    mp: z.string().optional(),
  }),
  channels: z.object({
    logs: z.string(),
    patch_log: z.string().optional(),
    transfer_log: z.string().optional(),
  }),
});

type Faction = z.infer<typeof FactionSchema>;

const SettingsSchema = z.object({
  factions: z.record(z.string(), FactionSchema),
  detectives: z.record(
    z.string(),
    z.object({
      discord_id: z.string(),
      high_role_id: z.string(),
      name_logs_id: z.string(),
      patch_log_channel: z.string(),
    }),
  ),
  servers: z.object({
    check: z.array(z.string()),
    admins: z.array(z.string()),
    chp: z.string(),
    mp: z.string(),
    test: z.string(),
  }),
  state_positions: z.record(
    z.string(),
    z.object({
      branches: z.array(z.string()),
      positions: z.array(z.string()),
    }),
  ),
  system_roles: z.record(z.string(), z.array(z.string())),
  system_channels: z.record(z.string(), z.string()),
});

declare global {
  var reloadSettings: (() => void) | undefined;
}

function copyFile(src: string, dest: string): void {
  fs.copyFileSync(src, dest, fs.constants.COPYFILE_FICLONE);
}

function writeFile(filePath: string, data: string): void {
  fs.writeFileSync(filePath, data, { encoding: "utf-8", mode: 0o666 });
}

router.get(
  "/",
  ensureAuthenticatedAndAuthorized,
  requirePermission("edit_settings"),
  async (req: Request, res: Response) => {
    try {
      const rawSettings = fs.readFileSync(SETTINGS_PATH, { encoding: "utf-8" });
      const settings = JSON.parse(rawSettings);
      const formattedJSON = JSON.stringify(settings, null, 2);

      const factions = settings.factions || {};
      const detectives = settings.detectives || {};

      const stats = {
        totalFactions: Object.keys(factions).length,
        governmentFactions: Object.values(factions).filter(
          (f: any) => f.type === "government",
        ).length,
        criminalFactions: Object.values(factions).filter(
          (f: any) => f.type === "criminal",
        ).length,
        totalDetectives: Object.keys(detectives).length,
      };

      res.render("admin/settings", {
        user: req.user,
        permissions: (req.user as any)?.permissions || [],
        currentPage: "settings",
        title: "Настройки бота",
        settingsJSON: formattedJSON,
        stats,
        lastModified: fs.statSync(SETTINGS_PATH).mtime.toISOString(),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      console.error("Error loading settings:", message);
      res.status(500).render("error", {
        user: req.user,
        currentPage: "error",
        title: "Ошибка",
        message: "Ошибка загрузки настроек",
        error: process.env.NODE_ENV === "development" ? message : {},
      });
    }
  },
);

router.get(
  "/api/settings",
  ensureAuthenticatedAndAuthorized,
  requirePermission("edit_settings"),
  async (req: Request, res: Response) => {
    try {
      const rawSettings = fs.readFileSync(SETTINGS_PATH, { encoding: "utf-8" });
      const settings = JSON.parse(rawSettings);
      res.json({ success: true, settings });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      res.status(500).json({ success: false, error: message });
    }
  },
);

router.put(
  "/api/settings",
  ensureAuthenticatedAndAuthorized,
  requirePermission("edit_settings"),
  async (req: Request, res: Response) => {
    try {
      const { settings } = req.body;

      if (!settings) {
        res
          .status(400)
          .json({ success: false, error: "Отсутствуют данные настроек" });
        return;
      }

      const validated = SettingsSchema.parse(settings);

      const backupPath = SETTINGS_PATH.replace(
        ".json",
        `.backup.${Date.now()}.json`,
      );
      copyFile(SETTINGS_PATH, backupPath);

      writeFile(SETTINGS_PATH, JSON.stringify(validated, null, 2));

      if (global.reloadSettings) {
        global.reloadSettings();
      }

      res.json({
        success: true,
        message: "Настройки сохранены и применены",
        backupPath: path.basename(backupPath),
      });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: "Ошибка валидации",
          details: error.issues,
        });
        return;
      }
      const message =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      console.error("Error saving settings:", message);
      res.status(500).json({ success: false, error: message });
    }
  },
);

router.get(
  "/api/settings/history",
  ensureAuthenticatedAndAuthorized,
  requirePermission("edit_settings"),
  async (req: Request, res: Response) => {
    try {
      const configDir = path.dirname(SETTINGS_PATH);
      const files = fs
        .readdirSync(configDir)
        .filter((f) => f.startsWith("settings.backup."))
        .map((f) => ({
          filename: f,
          timestamp: parseInt(f.split(".")[2]),
          date: new Date(parseInt(f.split(".")[2])).toISOString(),
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);

      res.json({ success: true, history: files });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      res.status(500).json({ success: false, error: message });
    }
  },
);

router.post(
  "/api/settings/rollback/:backupFile",
  ensureAuthenticatedAndAuthorized,
  requirePermission("edit_settings"),
  async (req: Request, res: Response) => {
    try {
      const backupFile = req.params.backupFile;
      const backupPath = path.join(path.dirname(SETTINGS_PATH), backupFile);

      if (!fs.existsSync(backupPath)) {
        res.status(404).json({ success: false, error: "Бэкап не найден" });
        return;
      }

      const currentBackup = SETTINGS_PATH.replace(
        ".json",
        `.before-rollback.${Date.now()}.json`,
      );
      copyFile(SETTINGS_PATH, currentBackup);

      copyFile(backupPath, SETTINGS_PATH);

      if (global.reloadSettings) {
        global.reloadSettings();
      }

      res.json({ success: true, message: "Настройки откачены" });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      res.status(500).json({ success: false, error: message });
    }
  },
);

export default router;
