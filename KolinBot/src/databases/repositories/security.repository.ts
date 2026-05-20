import db from '../sqlite';

export interface SecurityAlert {
  id: number;
  type: string,
  count: number,
  author_id: string,
  reason: string,
  created_at: string
  updated_at: string,
  passport: string
}

export interface SecurityLog {
  id: number;
  username: string;
  suspected_action: string;
  checked_at: string;
  admin_id: string;
  check_results: string;
}

export const SecurityRepository = {
  exportSecurityAlertsMany: db.transaction((adminId: string, alerts: { suspect: string; action: string; data: string; originalDate?: string }[]) => {
    // TODO: export security alerts
  }),

  getSecurityAlerts(type?: string): SecurityAlert[] {
    if (type) {
      return db.prepare(`SELECT * FROM bot_cheat_reports WHERE type = ? ORDER BY created_at DESC`).all(type) as SecurityAlert[];
    }
    return db.prepare(`SELECT * FROM bot_cheat_reports ORDER BY created_at DESC`).all() as SecurityAlert[];
  },

  getSecurityAlertsBySuspect(suspect: string, type?: string): SecurityAlert[] {
    if (type) {
      return db.prepare(`SELECT * FROM bot_cheat_reports WHERE suspect = ? AND type = ? ORDER BY created_at DESC`)
          .all(suspect, type) as SecurityAlert[];
    }
    return db.prepare(`SELECT * FROM bot_cheat_reports WHERE suspect = ? ORDER BY created_at DESC`).all(suspect) as SecurityAlert[];
  },

  closeAlertsBySuspectIfExists(suspect: string): number {
    const result = db.prepare(`DELETE FROM bot_cheat_reports WHERE passport = ?`).run(suspect)
    return result.changes;
  },

  closeAlert(id: number): { changes: number } {
    const result = db.prepare(`
      DELETE FROM bot_cheat_reports WHERE id = ?
    `).run(id);
    return { changes: result.changes };
  },

  getSecurityLogs(limit: number = 100): SecurityLog[] {
    return db.prepare(`SELECT * FROM security_logs ORDER BY checked_at DESC LIMIT ?`).all(limit) as SecurityLog[];
  },

  addSecurityRequest(type: string, authorId: string, reason: string, passport: string): void {
    db.prepare(`INSERT INTO bot_cheat_reports (passport, type, count, author_id, reason)
                VALUES (?, ?, 1, ?, ?)
                ON CONFLICT(passport)
                  DO UPDATE SET type       = CASE
                                               WHEN type = excluded.type
                                                 THEN type
                                               ELSE 'Cheats'
                  END,
                                count      = count + 1,
                                author_id  = excluded.author_id,
                                reason     = excluded.reason,
                                updated_at = datetime('now', 'localtime')`).run(passport, type, authorId, reason)
  },
};