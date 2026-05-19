import db from '../sqlite';

export interface SecurityAlert {
  id: number;
  suspect: string;
  suspected_action: string;
  work_data: string;
  admin_id: string;
  status: string;
  count: number;
  created_at: string;
  updated_at?: string;
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
    const stmt = db.prepare(`
      INSERT INTO security_alerts (suspect, suspected_action, work_data, admin_id, count, created_at)
      VALUES (@suspect, @action, @data, @adminId, 1, COALESCE(@originalDate, datetime('now', 'localtime')))
      ON CONFLICT(suspect, suspected_action) DO UPDATE SET
        count = count + 1,
        work_data = @data,
        updated_at = datetime('now', 'localtime'),
        admin_id = @adminId,
        created_at = CASE WHEN @originalDate IS NOT NULL AND @originalDate != '' THEN @originalDate ELSE created_at END
    `);

    for (const alert of alerts) {
      stmt.run({
        suspect: alert.suspect,
        action: alert.action,
        data: alert.data,
        adminId: adminId,
        originalDate: alert.originalDate || null
      });
    }
  }),

  getSecurityAlerts(status?: 'OPEN' | 'CLOSED'): SecurityAlert[] {
    if (status) {
      return db.prepare(`SELECT * FROM security_alerts WHERE status = ? ORDER BY created_at DESC`).all(status) as SecurityAlert[];
    }
    return db.prepare(`SELECT * FROM security_alerts ORDER BY created_at DESC`).all() as SecurityAlert[];
  },

  getSecurityAlertsBySuspect(suspect: string, status?: 'OPEN' | 'CLOSED'): SecurityAlert[] {
    if (status) {
      return db.prepare(`SELECT * FROM security_alerts WHERE suspect = ? AND status = ? ORDER BY created_at DESC`)
        .all(suspect, status) as SecurityAlert[];
    }
    return db.prepare(`SELECT * FROM security_alerts WHERE suspect = ? ORDER BY created_at DESC`).all(suspect) as SecurityAlert[];
  },

  closeAlertsBySuspectIfExists(suspect: string, adminId: string): number {
    const result = db.prepare(`
      UPDATE security_alerts
      SET status = 'CLOSED', admin_id = ?, updated_at = datetime('now', 'localtime')
      WHERE suspect = ? AND status = 'OPEN'
    `).run(adminId, suspect);
    return result.changes;
  },

  closeAlert(id: number, adminId: string): { changes: number } {
    const result = db.prepare(`
      UPDATE security_alerts
      SET status = 'CLOSED', admin_id = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ? AND status = 'OPEN'
    `).run(adminId, id);
    return { changes: result.changes };
  },

  reopenAlert(id: number, adminId: string): { changes: number } {
    const result = db.prepare(`
      UPDATE security_alerts
      SET status = 'OPEN', admin_id = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ? AND status = 'CLOSED'
    `).run(adminId, id);
    return { changes: result.changes };
  },

  addSecurityLog(username: string, suspected_action: string, admin_id: string, check_results: string): void {
    db.prepare(`
      INSERT INTO security_logs (username, suspected_action, admin_id, check_results, checked_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(username, suspected_action, admin_id, check_results);
  },

  getSecurityLogs(limit: number = 100): SecurityLog[] {
    return db.prepare(`SELECT * FROM security_logs ORDER BY checked_at DESC LIMIT ?`).all(limit) as SecurityLog[];
  },

  addSecurityRequest(suspect: string, adminId: string, reason: string, video: string): void {
    const workData = `Причина: ${reason} | Видео: ${video}`;
    db.prepare(`
      INSERT INTO security_alerts (suspect, suspected_action, work_data, admin_id, count, status)
      VALUES (?, ?, ?, ?, 1, 'OPEN')
      ON CONFLICT(suspect, suspected_action) DO UPDATE SET
        count = count + 1,
        work_data = ?,
        admin_id = ?,
        updated_at = datetime('now', 'localtime'),
        status = 'OPEN'
    `).run(suspect, 'Запрос проверки от админа', workData, adminId, workData, adminId);
  },
};