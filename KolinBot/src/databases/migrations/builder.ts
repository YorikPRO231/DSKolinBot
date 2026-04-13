export class TableBuilder {
    private statements: string[] = [];
    private tableName: string;

    constructor(tableName: string) {
        this.tableName = tableName;
    }

    addColumn(name: string, type: string, options?: {
        nullable?: boolean;
        defaultValue?: any;
        unique?: boolean;
        references?: { table: string; column: string };
    }): this {
        let sql = `ALTER TABLE ${this.tableName} ADD COLUMN ${name} ${type}`;
        
        if (options?.nullable === false) sql += ' NOT NULL';
        if (options?.unique) sql += ' UNIQUE';
        if (options?.defaultValue !== undefined) {
            sql += ` DEFAULT ${this.formatDefault(options.defaultValue)}`;
        }
        if (options?.references) {
            sql += ` REFERENCES ${options.references.table}(${options.references.column})`;
        }
        
        this.statements.push(sql);
        return this;
    }

    dropColumn(name: string): this {
        this.statements.push(`-- Требуется пересоздание таблицы для удаления колонки ${name}`);
        return this;
    }

    renameColumn(oldName: string, newName: string): this {
        this.statements.push(`ALTER TABLE ${this.tableName} RENAME COLUMN ${oldName} TO ${newName}`);
        return this;
    }

    addIndex(name: string, columns: string[], unique: boolean = false): this {
        const uniqueStr = unique ? 'UNIQUE ' : '';
        this.statements.push(
            `CREATE ${uniqueStr}INDEX IF NOT EXISTS ${name} ON ${this.tableName}(${columns.join(', ')})`
        );
        return this;
    }

    dropIndex(name: string): this {
        this.statements.push(`DROP INDEX IF EXISTS ${name}`);
        return this;
    }

    private formatDefault(value: any): string {
        if (value === null) return 'NULL';
        if (typeof value === 'string') return `'${value}'`;
        if (value instanceof Date) return `'${value.toISOString()}'`;
        return String(value);
    }

    build(): string {
        return this.statements.join(';\n');
    }
}

export class MigrationBuilder {
    private upStatements: string[] = [];
    private downStatements: string[] = [];

    table(name: string, callback: (table: TableBuilder) => void): this {
        const builder = new TableBuilder(name);
        callback(builder);
        this.upStatements.push(builder.build());
        return this;
    }

    createTable(name: string, callback: (table: TableBuilder) => void): this {
        return this;
    }

    raw(sql: string, rollbackSql?: string): this {
        this.upStatements.push(sql);
        if (rollbackSql) {
            this.downStatements.push(rollbackSql);
        }
        return this;
    }

    build(): { up: string; down: string } {
        return {
            up: this.upStatements.join(';\n'),
            down: this.downStatements.reverse().join(';\n')
        };
    }
}