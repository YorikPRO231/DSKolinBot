import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(path.join(__dirname, 'data.sqlite'));

try {
    // Показываем примеры до замены
    const before = db.prepare(`SELECT passport, faction, patch FROM state_patches WHERE faction LIKE '%Government%' LIMIT 3`).all();
    console.log('📝 Примеры ДО замены:');
    before.forEach(row => {
        console.log(`  faction: ${row.faction}, patch: ${row.patch}`);
    });
    
    // Заменяем Government на USSS в поле faction
    const result = db.prepare(`UPDATE state_patches SET faction = REPLACE(faction, 'Government', 'USSS') WHERE faction LIKE '%Government%'`).run();
    
    // Заменяем Government на USSS в поле patch
    const patchResult = db.prepare(`UPDATE state_patches SET patch = REPLACE(patch, 'Government', 'USSS') WHERE patch LIKE '%Government%'`).run();
    
    // Заменяем в истории
    const historyResult = db.prepare(`UPDATE state_patches SET history = REPLACE(history, 'Government', 'USSS') WHERE history LIKE '%Government%'`).run();
    
    console.log(`\n✅ Обновлено:`);
    console.log(`   faction: ${result.changes}`);
    console.log(`   patch: ${patchResult.changes}`);
    console.log(`   history: ${historyResult.changes}`);
    
    // Показываем примеры после замены
    const after = db.prepare(`SELECT passport, faction, patch FROM state_patches WHERE faction LIKE '%USSS%' LIMIT 3`).all();
    console.log('\n📝 Примеры ПОСЛЕ замены:');
    after.forEach(row => {
        console.log(`  faction: ${row.faction}, patch: ${row.patch}`);
    });
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
} finally {
    db.close();
}