// grant-permissions.js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.sqlite'));

const USER_ID = '1429367223373533285';
const ROLE_ID = '1486138193697964042';

console.log('?? Начинаем выдачу прав...');

const defaultPermissions = [
  { key: 'view_dashboard', name: 'Просмотр дашборда' },
  { key: 'manage_forms', name: 'Управление формами' },
  { key: 'view_security', name: 'Просмотр Security' },
  { key: 'manage_security', name: 'Управление Security' },
  { key: 'view_inspections', name: 'Просмотр проверок' },
  { key: 'manage_inspections', name: 'Управление проверками' },
  { key: 'view_admin_logs', name: 'Просмотр админ-логов' },
  { key: 'manage_roles', name: 'Управление ролями' },
  { key: 'manage_users', name: 'Управление пользователями' },
];

// Добавляем разрешения в таблицу
const insertPerm = db.prepare(`
  INSERT OR IGNORE INTO permissions (permission_key, permission_name, description)
  VALUES (?, ?, ?)
`);

for (const perm of defaultPermissions) {
  insertPerm.run(perm.key, perm.name, null);
}
console.log('? Базовые разрешения добавлены');

// Добавляем роль
db.prepare(`
  INSERT OR REPLACE INTO roles (role_id, role_name, description)
  VALUES (?, ?, ?)
`).run(ROLE_ID, 'Administrator', 'Полный доступ');
console.log('? Роль добавлена');

// Выдаём все права роли
const permissions = db.prepare(`SELECT permission_key FROM permissions`).all();

for (const perm of permissions) {
  db.prepare(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_key, granted_by)
    VALUES (?, ?, ?)
  `).run(ROLE_ID, perm.permission_key, 'system');
}
console.log(`? Выдано ${permissions.length} прав роли`);

// Добавляем пользователя в роль
db.prepare(`
  INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_by)
  VALUES (?, ?, ?)
`).run(USER_ID, ROLE_ID, 'system');
console.log('? Пользователь добавлен в роль');

// Очищаем кэш прав пользователя
db.prepare(`DELETE FROM user_permissions_cache WHERE user_id = ?`).run(USER_ID);
console.log('? Кэш прав очищен');

console.log(`\n?? Готово! Пользователь ${USER_ID} теперь имеет все права.`);
console.log('Перезапустите сервер и очистите кэш браузера.');

db.close();