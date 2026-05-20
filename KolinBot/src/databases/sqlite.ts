import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(__dirname, "../data.sqlite"));

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

db.exec(`
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
  
  CREATE TABLE IF NOT EXISTS warehouse_drain_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    passport TEXT NOT NULL,
    adminId TEXT NOT NULL,
    punishment TEXT NOT NULL,
    report_data TEXT NOT NULL,
    duration TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_warehouse_pasport ON warehouse_drain(pasport);
  CREATE INDEX IF NOT EXISTS idx_warehouse_created ON warehouse_drain(created_at DESC);

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
  CREATE INDEX IF NOT EXISTS idx_inspection_created ON inspection_reports(created_at DESC);

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

  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id TEXT UNIQUE NOT NULL,
    role_name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    permission_key TEXT UNIQUE NOT NULL,
    permission_name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    granted_by TEXT,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_key),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_key) REFERENCES permissions(permission_key) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_permissions (
    user_id TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    is_granted BOOLEAN DEFAULT 1,
    granted_by TEXT,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    reason TEXT,
    PRIMARY KEY (user_id, permission_key),
    FOREIGN KEY (permission_key) REFERENCES permissions(permission_key) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_permissions_cache (
    user_id TEXT PRIMARY KEY,
    permissions TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    assigned_by TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
  CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
  CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_key);
  CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_permissions_perm ON user_permissions(permission_key);

  CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      current_rank INTEGER NOT NULL,
      current TEXT NOT NULL,
      destination TEXT NOT NULL,
      passport TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      current_approve TEXT NOT NULL,
      destination_approve TEXT NOT NULL,
      nickname TEXT NOT NULL,
      msg_id TEXT NOT NULL
  )
`);

export default db;
