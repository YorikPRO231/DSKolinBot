import { Request, Response } from "express";
import { db } from "../../databases/index";
import { AppError } from "../middleware/errorHandler.middleware";

export class InspectionsController {
  static async search(req: Request, res: Response) {
    const query = req.query.query as string;
    const searchType = req.query.type as string;
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = page * limit;

    if (!query || !query.trim()) {
      throw AppError.badRequest("Query parameter is required");
    }

    let whereClause = "";
    let params: any[] = [];

    if (searchType === "passport") {
      whereClause = "passport LIKE ?";
      params.push(`%${query}%`);
    } else {
      whereClause = "discord_id LIKE ?";
      params.push(`%${query}%`);
    }

    const countStmt = db.prepare(`
      SELECT COUNT(*) as count FROM inspection_reports
      WHERE ${whereClause}
    `);
    const { count: total } = countStmt.get(...params) as { count: number };

    const recordsStmt = db.prepare(`
      SELECT * FROM inspection_reports
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const records = recordsStmt.all(...params, limit, offset);

    res.json({
      success: true,
      records,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      limit,
    });
  }

  static async create(req: Request, res: Response) {
    const { passport, result, discordId } = req.body;
    const adminId = (req.user as any)?.id || "unknown";
    const adminName = (req.user as any)?.username;

    if (!passport || !result) {
      throw AppError.badRequest("Passport and result are required");
    }

    const stmt = db.prepare(`
      INSERT INTO inspection_reports (passport, result, admin_id, admin_name, discord_id, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

    const info = stmt.run(
      passport,
      result,
      adminId,
      adminName,
      discordId || null,
    );

    res.json({ success: true, id: info.lastInsertRowid });
  }

  static async update(req: Request, res: Response) {
    const id = parseInt(req.params.id as string);
    const { discord_id, result } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid ID",
      });
    }

    if (!result) {
      return res.status(400).json({
        success: false,
        error: "Result is required",
      });
    }

    try {
      const stmt = db.prepare(`
      UPDATE inspection_reports 
      SET discord_id = ?, result = ?
      WHERE id = ?
    `);

      const updateResult = stmt.run(discord_id || null, result, id);

      if (updateResult.changes === 0) {
        return res.status(404).json({
          success: false,
          error: "Report not found",
        });
      }

      const updatedRecord = db
        .prepare("SELECT * FROM inspection_reports WHERE id = ?")
        .get(id);

      res.json({
        success: true,
        message: "Report updated",
        record: updatedRecord,
      });
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({
        success: false,
        error: "Database error during update",
      });
    }
  }
}
