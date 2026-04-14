import Database from 'better-sqlite3';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const db = new Database(path.join(__dirname, '../data.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

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

  CREATE TABLE IF NOT EXISTS admins (
    discord_id TEXT PRIMARY KEY,
    surname TEXT NOT NULL,
    security TEXT DEFAULT 'no'
  );

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
  

  CREATE TABLE IF NOT EXISTS security_logs (
    username TEXT PRIMARY KEY,
    suspected_action TEXT NOT NULL,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    admin_id TEXT NOT NULL,
    check_results TEXT NOT NULL
  );

CREATE TABLE IF NOT EXISTS inspection_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    passport TEXT NOT NULL,
    discord_id TEXT,
    result TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    admin_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspection_passport ON inspection_reports(passport);
`);

export interface User {
  id: string;
  username: string;
}

export interface Warning {
  id: number;
  user_id: string;
  moderator_id: string;
  reason: string;
  created_at: string;  
}

export interface Warehouse {
  id: number;
  pasport: string;
  adm_id: string;
  punishment: string;
  items: any;
  log_file: Buffer;   
  duration: string;
  created_at: Date;
}

export interface Admins {
  discord_id: string,
  surname: string,
  security?: string
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

export interface InspectionReport {
    id: number;
    passport: string;
    discord_id?: string;
    result: string;
    admin_id: string;
    admin_name?: string;
    created_at: string;
}


export function addUser(userId: string, username: string): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO users (id, username) 
    VALUES (?, ?)
  `);
  stmt.run(userId, username);
}


export function getUser(userId: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
}

export function addWarning(userId: string, moderatorId: string, reason: string): void {
  const user = getUser(userId);
  
  if (!user) {
    addUser(userId, 'Unknown User');
  }
  
  const stmt = db.prepare(`
    INSERT INTO warnings (user_id, moderator_id, reason) 
    VALUES (?, ?, ?)
  `);
  stmt.run(userId, moderatorId, reason);
}

// Получение всех предупреждений пользователя
export function getWarnings(userId: string): Warning[] {
  return db.prepare(`
    SELECT * FROM warnings 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).all(userId) as Warning[];
}

// Получение количества предупреждений
export function getWarningsCount(userId: string): number {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM warnings 
    WHERE user_id = ?
  `).get(userId) as { count: number };
  return result.count;
}

// Удаление предупреждения
export function removeWarning(warningId: number): void {
  const stmt = db.prepare('DELETE FROM warnings WHERE id = ?');
  stmt.run(warningId);
}

// Добавить лог файл для слива склада
export function addLog(adm_id: string, pasport: string, punishment: string, items: any, log_file: Buffer, durationText: string): void {
  const serializedItems = typeof items === 'string' ? items : JSON.stringify(items, (key, value) => {
    if (value instanceof Map) return Object.fromEntries(value);
    return value;
  });
  
  
  const stmt = db.prepare(`
    INSERT INTO warehouse_drain 
    (adm_id, pasport, punishment, items, log_file, duration, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);
  stmt.run(adm_id, pasport, punishment, serializedItems, log_file, durationText);
}

/**
 * Получение конкретного лога по его уникальному ID
 */
export function getLogById(id: number): Warehouse | undefined {
    const stmt = db.prepare(`
        SELECT id, pasport, adm_id, punishment, items, log_file, duration, created_at
        FROM warehouse_drain 
        WHERE id = ?
    `);
    return stmt.get(id) as Warehouse | undefined;
}


// Получение лог файла слива склада
export function getLog(pasport: string): Warehouse | undefined {
  const stmt = db.prepare(`
    SELECT id, pasport, adm_id, punishment, items, log_file, duration
    FROM warehouse_drain 
    WHERE pasport = ? 
    ORDER BY id DESC 
    LIMIT 1
  `);
  return stmt.get(pasport) as Warehouse | undefined;
}

/**
 * Удаляет лог по его первичному ключу (ID)
 */
export function removeLogById(id: number) {
    const stmt = db.prepare(`DELETE FROM warehouse_drain WHERE id = ?`);
    const result = stmt.run(id); 
    return result;
}

export function getLogsByStatic(statick: string) {
    const stmt = db.prepare(`SELECT * FROM warehouse_drain WHERE pasport = ? ORDER BY id DESC`);
    return stmt.all(statick); 
}

// Получить фамилию админа
export function getAdminSurname(discordId: string): string | null {
    const row = db.prepare("SELECT surname FROM admins WHERE discord_id = ?").get(discordId) as { surname: string } | undefined;
    return row ? row.surname : null;
}

// 
export function setAdminSecurity(discordId: string, security: string) {
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO admins (discord_id, surname, security) 
        VALUES (?, COALESCE((SELECT surname FROM admins WHERE discord_id = ?), ''), ?)
    `);
    stmt.run(discordId, discordId, security);
}

export function getSecurityAcsess(discordId: string): string | null {
    const row = db.prepare("SELECT security FROM admins WHERE discord_id = ?").get(discordId) as { security: string } | undefined;
    return row ? row.security : null;
}

// Сохранить админа
export function setAdminSurname(discordId: string, surname: string) {
    db.prepare("INSERT OR REPLACE INTO admins (discord_id, surname) VALUES (?, ?)").run(discordId, surname);
}

/**
 * Вставка
 */
export const exportSecurityAlertsMany = db.transaction((adminId: string, alerts: { suspect: string, action: string, data: string }[]) => {
    const stmt = db.prepare(`
        INSERT INTO security_alerts (suspect, suspected_action, work_data, admin_id, count)
        VALUES (@suspect, @action, @data, @adminId, 1)
        ON CONFLICT(suspect, suspected_action) DO UPDATE SET
            count = count + 1,
            work_data = @data,
            updated_at = datetime('now', 'localtime'),
            admin_id = @adminId
    `);

    for (const alert of alerts) {
        stmt.run({
            suspect: alert.suspect,
            action: alert.action,
            data: alert.data,
            adminId: adminId
        });
    }
});



export function closeAlert(id: number, adminId: string) {
    const stmt = db.prepare(`
        UPDATE security_alerts 
        SET status = 'CLOSED', admin_id = ? 
        WHERE id = ?
    `);
    return stmt.run(adminId, id);
}

export function getSecurityAlerts(): SecurityAlert[] {
    return db.prepare("SELECT * FROM security_alerts ORDER BY created_at DESC").all() as SecurityAlert[];
}

// Сохранить отчет о проверке
export function saveInspectionReport(
    passport: string, 
    result: string, 
    adminId: string,
    adminName?: string,
    discordId?: string
): number {
    const stmt = db.prepare(`
        INSERT INTO inspection_reports (passport, discord_id, result, admin_id, admin_name, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    const info = stmt.run(passport, discordId || null, result, adminId, adminName || null);
    return info.lastInsertRowid as number;
}

// Получить все отчеты по паспорту с пагинацией
export function getInspectionReportsByPassportPaginated(
    passport: string, 
    limit: number, 
    offset: number
): { reports: InspectionReport[], total: number } {
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


export default db;