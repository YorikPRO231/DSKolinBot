// noinspection SqlResolve

import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../data.sqlite'));

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  -- ============================================
  -- СКЛАД / ОБЫСКИ
  -- ============================================
  CREATE TABLE IF NOT EXISTS warehouse_drain (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pasport TEXT NOT NULL,
    adm_id TEXT NOT NULL,
    punishment TEXT NOT NULL,
    items TEXT NOT NULL,
    log_file BLOB NOT NULL,
    duration TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_warehouse_pasport ON warehouse_drain(pasport);
  CREATE INDEX IF NOT EXISTS idx_warehouse_created ON warehouse_drain(created_at DESC);

  -- ============================================
  -- АДМИНИСТРАТОРЫ
  -- ============================================
  CREATE TABLE IF NOT EXISTS admins (
    discord_id TEXT PRIMARY KEY,
    surname TEXT NOT NULL,
    security TEXT DEFAULT 'no'
  );

  -- ============================================
  -- БОТ-ЧИТ
  -- ============================================
  CREATE TABLE IF NOT EXISTS security_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suspect TEXT NOT NULL,
    suspected_action TEXT NOT NULL,
    work_data TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    status TEXT DEFAULT 'OPEN',
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
    UNIQUE(suspect, suspected_action)
  );

  CREATE INDEX IF NOT EXISTS idx_security_suspect ON security_alerts(suspect);
  CREATE INDEX IF NOT EXISTS idx_security_status ON security_alerts(status);
  CREATE INDEX IF NOT EXISTS idx_security_created ON security_alerts(created_at DESC);

  CREATE TABLE IF NOT EXISTS security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    suspected_action TEXT NOT NULL,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    admin_id TEXT NOT NULL,
    check_results TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_security_logs_username ON security_logs(username);

  -- ============================================
  -- ОТЧЁТЫ О ПРОВЕРКЕ
  -- ============================================
  CREATE TABLE IF NOT EXISTS inspection_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    passport TEXT NOT NULL,
    discord_id TEXT,
    result TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    admin_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );


  -- ============================================
  -- Нашивки
  -- ============================================
  CREATE TABLE IF NOT EXISTS state_patches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    passport INTEGER UNIQUE,
    username TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    faction TEXT NOT NULL,
    patch TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    history TEXT DEFAULT '[]'
);
  
  -- ============================================
  -- Внедрения
  -- ============================================
  CREATE TABLE IF NOT EXISTS infiltrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rank INTEGER NOT NULL,
      faction TEXT NOT NULL,
      detectivefaction TEXT NOT NULL,
      detectiveid TEXT UNIQUE,
      newnickname TEXT NOT NULL,
      oldnickname TEXT NOT NULL,
      passport TEXT NOT NULL
  );


  CREATE INDEX IF NOT EXISTS idx_inspection_passport ON inspection_reports(passport);
  CREATE INDEX IF NOT EXISTS idx_inspection_created ON inspection_reports(created_at DESC);
`);

// ============================================
// ТИПЫ
// ============================================



export interface Warehouse {
  id: number;
  pasport: string;
  adm_id: string;
  punishment: string;
  items: string;
  log_file: Buffer;
  duration: string;
  created_at: string;
}

export interface Admins {
  discord_id: string;
  surname: string;
  security?: string;
}

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

export interface InspectionReport {
  id: number;
  passport: string;
  discord_id?: string;
  result: string;
  admin_id: string;
  admin_name?: string;
  created_at: string;
}

export interface StatePatch {
  id: number,
  passport: number,
  username : string,
  discord_id : string,
  faction : string,
  patch : string,
  created_at : string,
  history : string
}

export interface PatchHistory {
  faction: string,
  patch: string,
  created_at: string,
  updated_at: string
}

export interface Infiltration {
  id: number;
  rank: number;
  faction: string;
  detectivefaction: string;
  detectiveid: string;
  newnickname: string;
  oldnickname: string;
  passport: string;
}

// ============================================
// ВНЕДРЕНИЯ
// ============================================

export function pushInfiltration(rank: number, faction: string, detectivefaction: string, detectiveid: string, newnickname: string, oldnickname: string, passport: string) {
    // language=SQL format=false
    db.prepare(`INSERT OR REPLACE INTO infiltrations (rank, faction, detectivefaction, detectiveid, newnickname, oldnickname, passport)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(rank, faction, detectivefaction, detectiveid, newnickname, oldnickname, passport)
}

export function retrieveInfiltration(detectiveid: string) {
  return db.prepare('SELECT * FROM infiltrations WHERE detectiveid = ? ').get(detectiveid) as Infiltration | undefined
}

// ============================================
// АДМИНИСТРАТОРЫ
// ============================================

export function getAdminSurname(discordId: string): string | null {
  const row = db.prepare("SELECT surname FROM admins WHERE discord_id = ?").get(discordId) as { surname: string } | undefined;
  return row ? row.surname : null;
}

export function setAdminSurname(discordId: string, surname: string): void {
  db.prepare(`
    INSERT OR REPLACE INTO admins (discord_id, surname) 
    VALUES (?, ?)
  `).run(discordId, surname);
}

export function setAdminSecurity(discordId: string, security: string): void {
  db.prepare(`
    INSERT OR REPLACE INTO admins (discord_id, surname, security) 
    VALUES (?, COALESCE((SELECT surname FROM admins WHERE discord_id = ?), ''), ?)
  `).run(discordId, discordId, security);
}

export function getSecurityAccess(discordId: string): string | null {
  const row = db.prepare("SELECT security FROM admins WHERE discord_id = ?").get(discordId) as { security: string } | undefined;
  return row ? row.security : null;
}

// ============================================
// СКЛАД 
// ============================================

export function addLog(
    adm_id: string,
    pasport: string,
    punishment: string,
    items: any,
    log_file: Buffer,
    durationText: string
): void {
  const serializedItems = typeof items === 'string' ? items : JSON.stringify(items);

  db.prepare(`
    INSERT INTO warehouse_drain (adm_id, pasport, punishment, items, log_file, duration, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(adm_id, pasport, punishment, serializedItems, log_file, durationText);
}

export function getLogById(id: number): Warehouse | undefined {
  return db.prepare(`
    SELECT * FROM warehouse_drain WHERE id = ?
  `).get(id) as Warehouse | undefined;
}

export function getLog(pasport: string): Warehouse | undefined {
  return db.prepare(`
    SELECT * FROM warehouse_drain
    WHERE pasport = ?
    ORDER BY id DESC
      LIMIT 1
  `).get(pasport) as Warehouse | undefined;
}

export function getLogsByStatic(pasport: string): Warehouse[] {
  return db.prepare(`
    SELECT * FROM warehouse_drain
    WHERE pasport = ?
    ORDER BY id DESC
  `).all(pasport) as Warehouse[];
}

export function removeLogById(id: number): { changes: number } {
  const result = db.prepare(`DELETE FROM warehouse_drain WHERE id = ?`).run(id);
  return { changes: result.changes };
}

// ============================================
// БОТ-ЧИТ
// ============================================

export const exportSecurityAlertsMany = db.transaction((adminId: string, alerts: { suspect: string; action: string; data: string; originalDate?: string }[]) => {
  const stmt = db.prepare(`
    INSERT INTO security_alerts (suspect, suspected_action, work_data, admin_id, count, created_at)
    VALUES (@suspect, @action, @data, @adminId, 1, COALESCE(@originalDate, datetime('now', 'localtime')))
      ON CONFLICT(suspect, suspected_action) DO UPDATE SET
                                                  count = count + 1,
                                                  work_data = @data,
                                                  updated_at = datetime('now', 'localtime'),
                                                  admin_id = @adminId,
                                                  created_at = CASE
                                                  WHEN @originalDate IS NOT NULL AND @originalDate != '' THEN @originalDate
                                                  ELSE created_at
    END
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
});

export function getSecurityAlerts(status?: 'OPEN' | 'CLOSED'): SecurityAlert[] {
  let query = "SELECT * FROM security_alerts ORDER BY created_at DESC";
  if (status) {
    query = `SELECT * FROM security_alerts WHERE status = '${status}' ORDER BY created_at DESC`;
  }
  return db.prepare(query).all() as SecurityAlert[];
}

export function getSecurityAlertsBySuspect(suspect: string, status?: 'OPEN' | 'CLOSED'): SecurityAlert[] {
  let query = "SELECT * FROM security_alerts WHERE suspect = ? ORDER BY created_at DESC";
  if (status) {
    query = `SELECT * FROM security_alerts WHERE suspect = ? AND status = '${status}' ORDER BY created_at DESC`;
  }
  return db.prepare(query).all(suspect) as SecurityAlert[];
}

export function closeAlertsBySuspectIfExists(suspect: string, adminId: string): number {
  const result = db.prepare(`
    UPDATE security_alerts
    SET status = 'CLOSED',
        admin_id = ?,
        updated_at = datetime('now', 'localtime')
    WHERE suspect = ? AND status = 'OPEN'
  `).run(adminId, suspect);
  return result.changes;
}

export function closeAlert(id: number, adminId: string): { changes: number } {
  const result = db.prepare(`
    UPDATE security_alerts
    SET status = 'CLOSED',
        admin_id = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ? AND status = 'OPEN'
  `).run(adminId, id);
  return { changes: result.changes };
}

export function reopenAlert(id: number, adminId: string): { changes: number } {
  const result = db.prepare(`
    UPDATE security_alerts
    SET status = 'OPEN',
        admin_id = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ? AND status = 'CLOSED'
  `).run(adminId, id);
  return { changes: result.changes };
}

export function addSecurityLog(
    username: string,
    suspected_action: string,
    admin_id: string,
    check_results: string
): void {
  db.prepare(`
    INSERT INTO security_logs (username, suspected_action, admin_id, check_results, checked_at)
    VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(username, suspected_action, admin_id, check_results);
}

export function getSecurityLogs(limit: number = 100): SecurityLog[] {
  return db.prepare(`
    SELECT * FROM security_logs
    ORDER BY checked_at DESC
      LIMIT ?
  `).all(limit) as SecurityLog[];
}

export function addSecurityRequest(
    suspect: string,
    adminId: string,
    reason: string,
    video: string
): void {
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
}

// ============================================
// ОТЧЁТЫ О ПРОВЕРКЕ
// ============================================

export function saveInspectionReport(
    passport: string,
    result: string,
    adminId: string,
    adminName?: string,
    discordId?: string
): number {
  const info = db.prepare(`
    INSERT INTO inspection_reports (passport, discord_id, result, admin_id, admin_name, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(passport, discordId || null, result, adminId, adminName || null);
  return info.lastInsertRowid as number;
}

export function getInspectionReportsByPassportPaginated(
    passport: string,
    limit: number,
    offset: number
): { reports: InspectionReport[]; total: number } {
  const total = db.prepare('SELECT COUNT(*) as count FROM inspection_reports WHERE passport = ?')
      .get(passport) as { count: number };

  const reports = db.prepare(`
    SELECT * FROM inspection_reports
    WHERE passport = ?
    ORDER BY created_at DESC
      LIMIT ? OFFSET ?
  `).all(passport, limit, offset) as InspectionReport[];

  return { reports, total: total.count };
}

export function getInspectionReportsByAdmin(adminId: string, limit: number = 50): InspectionReport[] {
  return db.prepare(`
    SELECT * FROM inspection_reports
    WHERE admin_id = ?
    ORDER BY created_at DESC
      LIMIT ?
  `).all(adminId, limit) as InspectionReport[];
}


// ============================================
// Нашивки
// ============================================

export function pushPlayerId(passport : number, username : string, discord_id : string, faction : string, patch : string): void {
  const now = new Date().toISOString()
  const existing = db.prepare('SELECT * FROM state_patches WHERE passport = ?').get(passport) as StatePatch | undefined

  let history: PatchHistory[] = []

  if (existing) {
    try {
      history = JSON.parse(existing.history) as PatchHistory[]
    } catch (e) {
      console.warn(`Ошибка парсинга истории для паспорта ${passport}: ${existing.history}`)
    }

    history.push({
      created_at: existing.created_at,
      faction: existing.faction,
      patch: existing.patch,
      updated_at: now
    })
    if (history.length > 15) {
      history = history.slice(-15)
    }
  }

  db.prepare(
      `INSERT INTO state_patches (passport, username, discord_id, faction, patch, history, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(passport) DO UPDATE SET
        username = excluded.username,
                                    discord_id = excluded.discord_id,
                                    faction = excluded.faction,
                                    patch = excluded.patch,
                                    history = excluded.history,
                                    created_at = excluded.created_at`
  ).run(passport, username, discord_id, faction, patch, JSON.stringify(history), now)
}

export function retrievePlayerPatch(passport: number) {
  return db.prepare('SELECT * FROM state_patches WHERE passport = ?').get(passport) as StatePatch | undefined;
}

export function findPlayerPatch(patch: string): StatePatch[] {
  return db.prepare(`
    SELECT * FROM state_patches
    WHERE patch LIKE ? OR history LIKE ?
  `).all(`%${patch}%`, `%${patch}%`) as StatePatch[];
}

export function getPatchByDiscord(discordId: string) {
  const results = db.prepare('SELECT * FROM state_patches WHERE discord_id = ?').all(discordId) as StatePatch[] | undefined
  return results || []
}

export function generateUniqueDigits(passport: number, faction: string): string {
  let digits: string;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    digits = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    attempts++;

    const existing = db.prepare(
        'SELECT patch FROM state_patches WHERE faction = ? AND patch LIKE ? AND passport != ?'
    ).get(faction, `%${digits}]`, passport) as { patch: string } | undefined;

    if (!existing) break;

  } while (attempts < maxAttempts);

  return digits;
}

export function getSelfPatches(discord_id: string) {
  return db.prepare(`SELECT * from state_patches WHERE discord_id = ?`).all(discord_id) as StatePatch[] | undefined
}

// ============================================
// ОБЩИЕ УТИЛИТЫ
// ============================================

export function getStats(): {
  warehouse_count: number;
  alerts_open: number;
  alerts_closed: number;
  inspection_count: number;
} {
  const warehouse = db.prepare("SELECT COUNT(*) as count FROM warehouse_drain").get() as { count: number };
  const alertsOpen = db.prepare("SELECT COUNT(*) as count FROM security_alerts WHERE status = 'OPEN'").get() as { count: number };
  const alertsClosed = db.prepare("SELECT COUNT(*) as count FROM security_alerts WHERE status = 'CLOSED'").get() as { count: number };
  const inspections = db.prepare("SELECT COUNT(*) as count FROM inspection_reports").get() as { count: number };

  return {
    warehouse_count: warehouse.count,
    alerts_open: alertsOpen.count,
    alerts_closed: alertsClosed.count,
    inspection_count: inspections.count
  };
}

export function vacuum(): void {
  db.exec("VACUUM");
}

export default db;