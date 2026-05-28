import prisma from '../prisma.service';

export interface InspectionReport {
  id: number;
  passport: string;
  discord_id?: string;
  result: string;
  admin_id: string;
  admin_name?: string;
  created_at: string;
}

export const InspectionsRepository = {
  async saveInspectionReport(
    passport: string,
    result: string,
    adminId: string,
    adminName?: string,
    discordId?: string
  ): Promise<number> {
    const report = await prisma.inspectionReport.create({
      data: {
        passport,
        discordId: discordId || null,
        result,
        adminId,
        adminName: adminName || null,
      },
    });
    return report.id;
  },

  async getInspectionReportsByPassportPaginated(
    passport: string,
    limit: number,
    offset: number
  ): Promise<{ reports: InspectionReport[]; total: number }> {
    const [reports, total] = await Promise.all([
      prisma.inspectionReport.findMany({
        where: { passport },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.inspectionReport.count({
        where: { passport },
      }),
    ]);

    return {
      reports: reports.map(r => ({
        id: r.id,
        passport: r.passport,
        discord_id: r.discordId || undefined,
        result: r.result,
        admin_id: r.adminId,
        admin_name: r.adminName || undefined,
        created_at: r.createdAt.toISOString(),
      })),
      total,
    };
  },

  async getInspectionReportsByAdmin(
    adminId: string,
    limit: number = 50
  ): Promise<InspectionReport[]> {
    const reports = await prisma.inspectionReport.findMany({
      where: { adminId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return reports.map(r => ({
      id: r.id,
      passport: r.passport,
      discord_id: r.discordId || undefined,
      result: r.result,
      admin_id: r.adminId,
      admin_name: r.adminName || undefined,
      created_at: r.createdAt.toISOString(),
    }));
  },

  async getInspectionReportsByDiscord(
    discordId: string,
    limit: number,
    offset: number
  ): Promise<{ reports: InspectionReport[]; total: number }> {
    const [reports, total] = await Promise.all([
      prisma.inspectionReport.findMany({
        where: { discordId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.inspectionReport.count({
        where: { discordId },
      }),
    ]);

    return {
      reports: reports.map(r => ({
        id: r.id,
        passport: r.passport,
        discord_id: r.discordId || undefined,
        result: r.result,
        admin_id: r.adminId,
        admin_name: r.adminName || undefined,
        created_at: r.createdAt.toISOString(),
      })),
      total,
    };
  },

  async updateInspectionReport(
    id: number,
    discordId: string | null,
    result: string
  ): Promise<{ changes: number }> {
    const updated = await prisma.inspectionReport.update({
      where: { id },
      data: {
        discordId: discordId || null,
        result,
      },
    });
    return { changes: updated ? 1 : 0 };
  },
};