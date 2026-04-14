const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.sqlite'));

console.log('🔄 Начинаю миграцию базы данных...');

try {
    // Проверяем и добавляем колонку security в таблицу admins
    try {
        db.exec("ALTER TABLE admins ADD COLUMN security TEXT DEFAULT 'no'");
        console.log("✅ Добавлена колонка security в таблицу admins");
    } catch (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("ℹ️ Колонка security уже существует");
        } else {
            console.log("⚠️ Ошибка при добавлении security:", err.message);
        }
    }

    // Проверяем и добавляем колонку created_at в warehouse_drain
    try {
        db.exec("ALTER TABLE warehouse_drain ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
        console.log("✅ Добавлена колонка created_at в таблицу warehouse_drain");
    } catch (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("ℹ️ Колонка created_at уже существует");
        } else {
            console.log("⚠️ Ошибка при добавлении created_at:", err.message);
        }
    }

    // Проверяем и добавляем колонку discord_id в inspection_reports
    try {
        db.exec("ALTER TABLE inspection_reports ADD COLUMN discord_id TEXT");
        console.log("✅ Добавлена колонка discord_id в таблицу inspection_reports");
    } catch (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("ℹ️ Колонка discord_id уже существует");
        } else if (err.message.includes("no such table")) {
            console.log("ℹ️ Таблица inspection_reports еще не создана");
        } else {
            console.log("⚠️ Ошибка при добавлении discord_id:", err.message);
        }
    }

    // Проверяем и добавляем колонку admin_name в inspection_reports
    try {
        db.exec("ALTER TABLE inspection_reports ADD COLUMN admin_name TEXT");
        console.log("✅ Добавлена колонка admin_name в таблицу inspection_reports");
    } catch (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("ℹ️ Колонка admin_name уже существует");
        } else if (err.message.includes("no such table")) {
            console.log("ℹ️ Таблица inspection_reports еще не создана");
        } else {
            console.log("⚠️ Ошибка при добавлении admin_name:", err.message);
        }
    }

    // Создаем недостающие таблицы
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS warnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        
        `CREATE TABLE IF NOT EXISTS warehouse_drain (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pasport TEXT NOT NULL,
            adm_id TEXT NOT NULL,
            punishment TEXT NOT NULL,
            items TEXT NOT NULL,
            log_file BLOB NOT NULL,
            duration TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS admins (
            discord_id TEXT PRIMARY KEY,
            surname TEXT NOT NULL,
            security TEXT DEFAULT 'no'
        )`,
        
        `CREATE TABLE IF NOT EXISTS security_alerts (
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
        )`,
        
        `CREATE TABLE IF NOT EXISTS security_logs (
            username TEXT PRIMARY KEY,
            suspected_action TEXT NOT NULL,
            checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            admin_id TEXT NOT NULL,
            check_results TEXT NOT NULL
        )`,
        
        `CREATE TABLE IF NOT EXISTS inspection_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            passport TEXT NOT NULL,
            discord_id TEXT,
            result TEXT NOT NULL,
            admin_id TEXT NOT NULL,
            admin_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    // Выполняем создание таблиц
    for (const tableSql of tables) {
        try {
            db.exec(tableSql);
            console.log("✅ Таблица создана/проверена");
        } catch (err) {
            console.log("⚠️ Ошибка при создании таблицы:", err.message);
        }
    }

    // Создаем индексы
    try {
        db.exec("CREATE INDEX IF NOT EXISTS idx_inspection_passport ON inspection_reports(passport)");
        console.log("✅ Создан индекс idx_inspection_passport");
    } catch (err) {
        console.log("⚠️ Ошибка при создании индекса:", err.message);
    }

    try {
        db.exec("CREATE INDEX IF NOT EXISTS idx_warnings_user_id ON warnings(user_id)");
        console.log("✅ Создан индекс idx_warnings_user_id");
    } catch (err) {
        console.log("⚠️ Ошибка при создании индекса:", err.message);
    }

    // Обновляем существующие записи admins, у которых нет security
    try {
        const result = db.prepare("UPDATE admins SET security = 'no' WHERE security IS NULL").run();
        if (result.changes > 0) {
            console.log(`✅ Обновлено ${result.changes} записей admins (добавлен security по умолчанию)`);
        }
    } catch (err) {
        console.log("⚠️ Ошибка при обновлении admins:", err.message);
    }

    console.log('\n✅ Миграция базы данных завершена успешно!');
    
    // Выводим информацию о текущей структуре
    console.log('\n📊 Текущая структура базы данных:');
    
    const tables_list = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    console.log('Таблицы:', tables_list.map(t => t.name).join(', '));
    
} catch (error) {
    console.error('❌ Критическая ошибка при миграции:', error.message);
} finally {
    db.close();
    console.log('🔒 Соединение с базой данных закрыто');
}