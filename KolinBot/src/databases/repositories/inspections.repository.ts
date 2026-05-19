import db from '../sqlite';

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
  saveInspectionReport(passport: string, result: string, adminId: string, adminName?: string, discordId?: string): number {
    const info = db.prepare(`
      INSERT INTO inspection_reports (passport, discord_id, result, admin_id, admin_name, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(passport, discordId || null, result, adminId, adminName || null);
    return info.lastInsertRowid as number;
  },

  getInspectionReportsByPassportPaginated(passport: string, limit: number, offset: number): { reports: InspectionReport[]; total: number } {
    const total = db.prepare('SELECT COUNT(*) as count FROM inspection_reports WHERE passport = ?').get(passport) as { count: number };
    const reports = db.prepare(`
      SELECT * FROM inspection_reports
      WHERE passport = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(passport, limit, offset) as InspectionReport[];
    return { reports, total: total.count };
  },

  getInspectionReportsByAdmin(adminId: string, limit: number = 50): InspectionReport[] {
    return db.prepare(`
      SELECT * FROM inspection_reports
      WHERE admin_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(adminId, limit) as InspectionReport[];
  },

  getInspectionReportsByDiscord(discordId: string, limit: number, offset: number): { reports: InspectionReport[]; total: number } {
    const total = db.prepare('SELECT COUNT(*) as count FROM inspection_reports WHERE discord_id = ?').get(discordId) as { count: number };
    const reports = db.prepare(`
      SELECT * FROM inspection_reports
      WHERE discord_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(discordId, limit, offset) as InspectionReport[];
    return { reports, total: total.count };
  },

  updateInspectionReport(id: number, discordId: string | null, result: string): { changes: number } {
    const stmt = db.prepare(`UPDATE inspection_reports SET discord_id = ?, result = ? WHERE id = ?`);
    const resultUpdate = stmt.run(discordId || null, result, id);
    return { changes: resultUpdate.changes };
  },
};