import db from '../sqlite';
import { WarehouseData } from '../../utils/warehouseUtils';

export interface Warehouse {
  id: number;
  pasport: string;
  adm_id: string;
  punishment: string;
  items: string;
  log_file: Buffer;
  duration: string;
  created_at: string;
}

export interface WarehouseLine {
  adminId: string;
  passport: string;
  punishment: string;
  report_data: string;
  duration: string;
  created_at: string;
}

export const WarehouseRepository = {
  addLog(adm_id: string, pasport: string, punishment: string, items: any, log_file: Buffer, durationText: string): void {
    const serializedItems = typeof items === 'string' ? items : JSON.stringify(items);
    db.prepare(`
      INSERT INTO warehouse_drain (adm_id, pasport, punishment, items, log_file, duration, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(adm_id, pasport, punishment, serializedItems, log_file, durationText);
  },

  getLogById(id: number): Warehouse | undefined {
    return db.prepare(`SELECT * FROM warehouse_drain WHERE id = ?`).get(id) as Warehouse | undefined;
  },

  getLog(pasport: string): Warehouse | undefined {
    return db.prepare(`
      SELECT * FROM warehouse_drain
      WHERE pasport = ?
      ORDER BY id DESC LIMIT 1
    `).get(pasport) as Warehouse | undefined;
  },

  getLogsByStatic(pasport: string): Warehouse[] {
    return db.prepare(`
      SELECT * FROM warehouse_drain
      WHERE pasport = ?
      ORDER BY id DESC
    `).all(pasport) as Warehouse[];
  },

  removeLogById(id: number): { changes: number } {
    const result = db.prepare(`DELETE FROM warehouse_drain WHERE id = ?`).run(id);
    return { changes: result.changes };
  },

  registerDrain(adminId: string, passport: string, punishment: string, report: WarehouseData, durationText: string) {
    const data = JSON.stringify(report);
    db.prepare(`
      INSERT INTO warehouse_drain_v2 (adminId, passport, punishment, report_data, duration, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(adminId, passport, punishment, data, durationText);
  },

  retrieveDrain(passport: string): WarehouseLine | undefined {
    return db.prepare(`
      SELECT * FROM warehouse_drain_v2
      WHERE passport = ?
      ORDER BY id DESC LIMIT 1
    `).get(passport) as WarehouseLine | undefined;
  },
};