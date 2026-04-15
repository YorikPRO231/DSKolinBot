const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.sqlite'));

// Включаем WAL режим для производительности
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

console.log('🔄 Начинаю миграцию базы данных...');

try {
    // ============================================
    // СОЗДАНИЕ ТАБЛИЦ (IF NOT EXISTS)
    // ============================================

    // 1. Таблица администраторов
    db.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            discord_id TEXT PRIMARY KEY,
            surname TEXT NOT NULL,
            security TEXT DEFAULT 'no'
        )
    `);
    console.log("✅ Таблица admins создана/проверена");

    // 2. Таблица склада
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
        )
    `);
    console.log("✅ Таблица warehouse_drain создана/проверена");

    // 3. Таблица алертов безопасности
    db.exec(`
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
        )
    `);
    console.log("✅ Таблица security_alerts создана/проверена");

    // 4. Таблица логов безопасности
    db.exec(`
        CREATE TABLE IF NOT EXISTS security_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            suspected_action TEXT NOT NULL,
            checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            admin_id TEXT NOT NULL,
            check_results TEXT NOT NULL
        )
    `);
    console.log("✅ Таблица security_logs создана/проверена");

    // 5. Таблица отчётов о проверке
    db.exec(`
        CREATE TABLE IF NOT EXISTS inspection_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            passport TEXT NOT NULL,
            discord_id TEXT,
            result TEXT NOT NULL,
            admin_id TEXT NOT NULL,
            admin_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log("✅ Таблица inspection_reports создана/проверена");

    // ============================================
    // СОЗДАНИЕ ИНДЕКСОВ
    // ============================================

    // Индексы для warehouse_drain
    db.exec(`CREATE INDEX IF NOT EXISTS idx_warehouse_pasport ON warehouse_drain(pasport)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_warehouse_created ON warehouse_drain(created_at DESC)`);
    console.log("✅ Индексы для warehouse_drain созданы");

    // Индексы для security_alerts
    db.exec(`CREATE INDEX IF NOT EXISTS idx_security_suspect ON security_alerts(suspect)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_security_status ON security_alerts(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_security_created ON security_alerts(created_at DESC)`);
    console.log("✅ Индексы для security_alerts созданы");

    // Индексы для security_logs
    db.exec(`CREATE INDEX IF NOT EXISTS idx_security_logs_username ON security_logs(username)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_security_logs_checked ON security_logs(checked_at DESC)`);
    console.log("✅ Индексы для security_logs созданы");

    // Индексы для inspection_reports
    db.exec(`CREATE INDEX IF NOT EXISTS idx_inspection_passport ON inspection_reports(passport)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_inspection_created ON inspection_reports(created_at DESC)`);
    console.log("✅ Индексы для inspection_reports созданы");

    // ============================================
    // ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ ДАННЫХ
    // ============================================

    // Обновляем записи admins, у которых нет security
    const updateResult = db.prepare("UPDATE admins SET security = 'no' WHERE security IS NULL").run();
    if (updateResult.changes > 0) {
        console.log(`✅ Обновлено ${updateResult.changes} записей admins (добавлен security по умолчанию)`);
    }

    // ============================================
    // УДАЛЕНИЕ УСТАРЕВШИХ ТАБЛИЦ (опционально)
    // ============================================
    
    // Если таблицы users или warnings остались от старой версии, их можно удалить
    const oldTables = ['users', 'warnings'];
    for (const table of oldTables) {
        try {
            const checkTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`).get();
            if (checkTable) {
                db.exec(`DROP TABLE IF EXISTS ${table}`);
                console.log(`🗑️ Удалена устаревшая таблица: ${table}`);
            }
        } catch (err) {
            console.log(`ℹ️ Таблица ${table} не найдена или уже удалена`);
        }
    }

    // ============================================
    // ОПТИМИЗАЦИЯ
    // ============================================

    // Запускаем анализ для оптимизации запросов
    db.exec("ANALYZE");
    console.log("✅ Анализ базы данных выполнен");

    console.log('\n✅ Миграция базы данных завершена успешно!');
    
    // ============================================
    // ВЫВОД СТАТИСТИКИ
    // ============================================
    
    console.log('\n📊 Текущая структура базы данных:');
    
    const tablesList = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    console.log('📋 Таблицы:', tablesList.map(t => t.name).join(', '));
    
    // Считаем записи в каждой таблице
    console.log('\n📈 Количество записей:');
    
    const stats = [
        { name: 'admins', query: 'SELECT COUNT(*) as count FROM admins' },
        { name: 'warehouse_drain', query: 'SELECT COUNT(*) as count FROM warehouse_drain' },
        { name: 'security_alerts', query: 'SELECT COUNT(*) as count FROM security_alerts' },
        { name: 'security_logs', query: 'SELECT COUNT(*) as count FROM security_logs' },
        { name: 'inspection_reports', query: 'SELECT COUNT(*) as count FROM inspection_reports' }
    ];
    
    for (const stat of stats) {
        try {
            const result = db.prepare(stat.query).get();
            console.log(`   • ${stat.name}: ${result.count} зап.`);
        } catch (err) {
            console.log(`   • ${stat.name}: ошибка подсчёта`);
        }
    }
    
    try {
        const openAlerts = db.prepare("SELECT COUNT(*) as count FROM security_alerts WHERE status = 'OPEN'").get();
        const closedAlerts = db.prepare("SELECT COUNT(*) as count FROM security_alerts WHERE status = 'CLOSED'").get();
        console.log(`\n🚨 Алерты безопасности: ${openAlerts.count} открыто, ${closedAlerts.count} закрыто`);
    } catch (err) {
        // Игнорируем ошибку
    }
    
} catch (error) {
    console.error('❌ Критическая ошибка при миграции:', error.message);
} finally {
    db.close();
    console.log('\n🔒 Соединение с базой данных закрыто');
}