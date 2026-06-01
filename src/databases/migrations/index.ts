import Database from 'better-sqlite3';
import path from 'path';
import { readFileSync } from 'fs';

interface Migration {
    version: number;
    name: string;
    up: string;
    down?: string;
}

export class MigrationManager {
    private db: Database.Database;
    private migrations: Migration[] = [];

    constructor(db: Database.Database) {
        this.db = db;
        this.initMigrationTable();
    }

    private initMigrationTable(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version INTEGER NOT NULL UNIQUE,
                name TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    register(version: number, name: string, up: string, down?: string): void {
        this.migrations.push({ version, name, up, down });
        this.migrations.sort((a, b) => a.version - b.version);
    }

    // Получение текущей версии
    getCurrentVersion(): number {
        const result = this.db.prepare('SELECT MAX(version) as version FROM migrations').get() as { version: number | null };
        return result.version || 0;
    }

    // Применение миграций
    migrate(targetVersion?: number): void {
        const currentVersion = this.getCurrentVersion();
        const target = targetVersion || Math.max(...this.migrations.map(m => m.version));
        
        const migrationsToApply = this.migrations.filter(m => 
            m.version > currentVersion && m.version <= target
        );

        if (migrationsToApply.length === 0) {
            console.log(`База данных актуальна (версия ${currentVersion})`);
            return;
        }

        console.log(`Применяем миграции с ${currentVersion} до ${target}...`);

        const transaction = this.db.transaction(() => {
            for (const migration of migrationsToApply) {
                console.log(`  → Применяем миграцию v${migration.version}: ${migration.name}`);
                
                this.db.exec(migration.up);
                
                this.db.prepare(`
                    INSERT INTO migrations (version, name) 
                    VALUES (?, ?)
                `).run(migration.version, migration.name);
            }
        });

        transaction();
        console.log(`✓ Миграции успешно применены. Текущая версия: ${target}`);
    }

    // Откат миграций
    rollback(steps: number = 1): void {
        const currentVersion = this.getCurrentVersion();
        const appliedMigrations = this.db.prepare(`
            SELECT * FROM migrations 
            WHERE version > ? 
            ORDER BY version DESC 
            LIMIT ?
        `).all(currentVersion - steps, steps) as Array<{ version: number; name: string }>;

        if (appliedMigrations.length === 0) {
            console.log('Нет миграций для отката');
            return;
        }

        const transaction = this.db.transaction(() => {
            for (const migration of appliedMigrations.reverse()) {
                const migrationDef = this.migrations.find(m => m.version === migration.version);
                
                if (!migrationDef?.down) {
                    throw new Error(`Миграция v${migration.version} не поддерживает откат`);
                }

                console.log(`  ← Откатываем миграцию v${migration.version}: ${migration.name}`);
                
                this.db.exec(migrationDef.down);
                
                this.db.prepare('DELETE FROM migrations WHERE version = ?').run(migration.version);
            }
        });

        transaction();
        console.log(`✓ Откат выполнен успешно`);
    }

    // Просмотр статуса
    status(): void {
        const currentVersion = this.getCurrentVersion();
        const applied = this.db.prepare('SELECT * FROM migrations ORDER BY version').all();
        const pending = this.migrations.filter(m => m.version > currentVersion);

        console.log('\n📊 Статус миграций:');
        console.log(`Текущая версия: ${currentVersion}`);
        console.log(`\nПрименённые миграции (${applied.length}):`);
        applied.forEach((m: any) => {
            console.log(`  ✓ v${m.version} - ${m.name} (${m.applied_at})`);
        });

        if (pending.length > 0) {
            console.log(`\nОжидающие миграции (${pending.length}):`);
            pending.forEach(m => {
                console.log(`  ⏳ v${m.version} - ${m.name}`);
            });
        } else {
            console.log('\n✓ Все миграции применены');
        }
    }
}