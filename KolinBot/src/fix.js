const Database = require('better-sqlite3');
const path = require('path');

// Путь к твоей БД (проверь, совпадает ли с путем в боте)
const db = new Database(path.join(__dirname, 'data.sqlite'));

try {
    db.exec("ALTER TABLE warehouse_drain ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;");
    console.log("✅ Столбец created_at успешно добавлен!");
} catch (err) {
    if (err.message.includes("duplicate column name")) {
        console.log("ℹ️ Столбец уже существует.");
    } else {
        console.error("❌ Ошибка:", err.message);
    }
} finally {
    db.close();
}