import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(__dirname, 'data.sqlite');
const db = new Database(dbPath);

try {
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
    console.log('📋 Существующие таблицы:', tables.map(t => t.name).join(', '));
    
    const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='infiltrations'`).get();
    
    if (!tableExists) {
        console.log('❌ Таблица infiltrations не существует.');
    } else {
        const countBefore = db.prepare(`SELECT COUNT(*) as count FROM infiltrations`).get();
        console.log(`📝 Количество записей в таблице: ${countBefore.count}`);
        
        db.prepare(`DROP TABLE infiltrations`).run();
        
        console.log('✅ Таблица infiltrations успешно удалена.');
    }
} catch (error) {
    console.error('❌ Ошибка:', error.message);
} finally {
    db.close();
}