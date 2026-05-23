import { Request, Response } from "express";
import { SecurityRepository } from "../../databases/repositories/security.repository";

export const SecurityController = {
  getAlerts: async (req: Request, res: Response) => {
    try {
      const type =
        typeof req.query.type === "string" ? req.query.type : undefined;
      const search =
        typeof req.query.suspect === "string" ? req.query.suspect : undefined;

      let alerts = SecurityRepository.getSecurityAlerts(type);

      if (search) {
        alerts = alerts.filter((alert) => alert.passport.includes(search));
      }

      res.json({ success: true, alerts });
    } catch (error) {
      console.error("Error getting alerts:", error);
      res.status(500).json({ success: false, error: "Failed to get alerts" });
    }
  },

  getAlertById: async (req: Request, res: Response) => {
    try {
      const id =
        typeof req.params.id === "string" ? parseInt(req.params.id) : 0;

      if (isNaN(id) || id <= 0) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid ID format" });
      }

      const alert = SecurityRepository.getAlertById(id);

      if (!alert) {
        return res
          .status(404)
          .json({ success: false, error: "Alert not found" });
      }

      res.json({ success: true, alert });
    } catch (error) {
      console.error("Error getting alert by id:", error);
      res.status(500).json({ success: false, error: "Failed to get alert" });
    }
  },

  addAlert: async (req: Request, res: Response) => {
    try {
      const { suspect, action, data, type } = req.body;
      const adminId = (req.user as any)?.id || "system";

      SecurityRepository.addSecurityRequest(type, adminId, action, suspect);

      res.json({ success: true });
    } catch (error) {
      console.error("Error adding alert:", error);
      res.status(500).json({ success: false, error: "Failed to add alert" });
    }
  },

  closeAlert: async (req: Request, res: Response) => {
    try {
      const id =
        typeof req.params.id === "string" ? parseInt(req.params.id) : 0;

      if (isNaN(id) || id <= 0) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid ID format" });
      }

      const result = SecurityRepository.closeAlert(id);

      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: "Alert not found" });
      }
    } catch (error) {
      console.error("Error closing alert:", error);
      res.status(500).json({ success: false, error: "Failed to close alert" });
    }
  },

  getLogs: async (req: Request, res: Response) => {
    try {
      const limit =
        typeof req.query.limit === "string" ? parseInt(req.query.limit) : 100;
      const validLimit =
        isNaN(limit) || limit <= 0 ? 100 : Math.min(limit, 500);

      const logs = SecurityRepository.getSecurityLogs(validLimit);
      res.json({ success: true, logs });
    } catch (error) {
      console.error("Error getting logs:", error);
      res.status(500).json({ success: false, error: "Failed to get logs" });
    }
  },

  addSecurityRequest: async (req: Request, res: Response) => {
    try {
      const { type, passport, reason } = req.body;
      const authorId = (req.user as any)?.id || "system";

      if (!type || !passport) {
        return res
          .status(400)
          .json({ success: false, error: "Missing required fields" });
      }

      SecurityRepository.addSecurityRequest(
        type,
        authorId,
        reason || "Не указана",
        passport,
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Error adding security request:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to add security request" });
    }
  },
};
