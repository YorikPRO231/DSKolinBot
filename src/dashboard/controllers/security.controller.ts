import { Request, Response } from "express";
import { SecurityRepository } from "../../databases/repositories/security.repository";
import prisma from "../../databases/prisma.service";

export const SecurityController = {
  getAlerts: async (req: Request, res: Response) => {
    try {
      const type =
        typeof req.query.type === "string" ? req.query.type : undefined;
      const search =
        typeof req.query.suspect === "string" ? req.query.suspect : undefined;
      const sortBy =
        typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
      const sortOrder =
        typeof req.query.sortOrder === "string" && req.query.sortOrder === "asc"
          ? "asc"
          : "desc";
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const skip = (page - 1) * limit;

      const where: any = {};
      if (type) where.type = type;
      if (search) where.passport = { contains: search, mode: "insensitive" };

      const allowedSortFields = [
        "passport",
        "type",
        "count",
        "createdAt",
        "updatedAt",
      ];
      const orderBy: any = {};
      if (allowedSortFields.includes(sortBy)) {
        orderBy[sortBy] = sortOrder;
      } else {
        orderBy.createdAt = "desc";
      }

      const [alerts, total] = await Promise.all([
        prisma.securityAlert.findMany({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.securityAlert.count({ where }),
      ]);

      res.json({
        success: true,
        alerts: alerts.map((a) => ({
          id: a.id,
          passport: a.passport,
          type: a.type,
          count: a.count,
          author_id: a.authorId,
          reason: a.reason,
          created_at: a.createdAt.toISOString(),
          updated_at: a.updatedAt.toISOString(),
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      });
    } catch (error) {
      console.error("Error getting alerts:", error);
      res.status(500).json({ success: false, error: "Failed to get alerts" });
    }
  },

  getAlertHistory: async (req: Request, res: Response) => {
    try {
      const { static: passport } = req.params;

      if (!passport) {
        return res
          .status(400)
          .json({ success: false, error: "Passport is required" });
      }

      const result = await SecurityRepository.getFullHistoryBySuspect(passport);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Error getting alert history:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to get alert history" });
    }
  },

  getAlertById: async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid ID format" });
      }

      const alert = await prisma.securityAlert.findUnique({
        where: { id },
      });

      if (!alert) {
        return res
          .status(404)
          .json({ success: false, error: "Alert not found" });
      }

      res.json({
        success: true,
        alert: {
          id: alert.id,
          passport: alert.passport,
          type: alert.type,
          count: alert.count,
          author_id: alert.authorId,
          reason: alert.reason,
          created_at: alert.createdAt.toISOString(),
          updated_at: alert.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      console.error("Error getting alert by id:", error);
      res.status(500).json({ success: false, error: "Failed to get alert" });
    }
  },

  addAlert: async (req: Request, res: Response) => {
    try {
      const { suspect, action, data, type } = req.body;
      const adminId = (req.user as any)?.id || "system";

      await SecurityRepository.addSecurityRequest(
        type,
        adminId,
        action,
        suspect,
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding alert:", error);
      res.status(500).json({ success: false, error: "Failed to add alert" });
    }
  },

  closeAlert: async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid ID format" });
      }

      const result = await SecurityRepository.closeAlert(id);
      res.json({ success: result.changes > 0 });
    } catch (error) {
      console.error("Error closing alert:", error);
      res.status(500).json({ success: false, error: "Failed to close alert" });
    }
  },

  getLogs: async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const logs = await prisma.securityLog.findMany({
        orderBy: { checkedAt: "desc" },
        take: limit,
      });

      res.json({
        success: true,
        logs: logs.map((l) => ({
          id: l.id,
          username: l.username,
          suspected_action: l.suspectedAction,
          checked_at: l.checkedAt.toISOString(),
          admin_id: l.adminId,
          check_results: l.checkResults,
        })),
      });
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

      await SecurityRepository.addSecurityRequest(
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
