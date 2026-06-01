import { Request, Response } from "express";
import { InspectionsRepository } from "../../databases/index";
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

    let records: any[] = [];
    let total = 0;

    if (searchType === "passport") {
      const result = await InspectionsRepository.getInspectionReportsByPassportPaginated(
        query,
        limit,
        offset
      );
      records = result.reports;
      total = result.total;
    } else {
      const result = await InspectionsRepository.getInspectionReportsByDiscord(
        query,
        limit,
        offset
      );
      records = result.reports;
      total = result.total;
    }

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

    const id = await InspectionsRepository.saveInspectionReport(
      passport,
      result,
      adminId,
      adminName,
      discordId
    );

    res.json({ success: true, id });
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
      const updateResult = await InspectionsRepository.updateInspectionReport(
        id,
        discord_id || null,
        result
      );

      if (updateResult.changes === 0) {
        return res.status(404).json({
          success: false,
          error: "Report not found",
        });
      }

      const reports = await InspectionsRepository.getInspectionReportsByPassportPaginated("", 1, 0);
      const updatedRecord = reports.reports.find(r => r.id === id);

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