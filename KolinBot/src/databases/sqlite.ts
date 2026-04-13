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
    duration TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admins (
    discord_id TEXT PRIMARY KEY,
    surname TEXT NOT NULL
  );

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
  surname: string
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

// Сохранить админа
export function setAdminSurname(discordId: string, surname: string) {
    db.prepare("INSERT OR REPLACE INTO admins (discord_id, surname) VALUES (?, ?)").run(discordId, surname);
}

export default db;