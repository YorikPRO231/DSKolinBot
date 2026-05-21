import db from '../sqlite';

export const StatsRepository = {
  getStats(): {
    warehouse_count: number;
    alerts_open: number;
    inspection_count: number;
    total_patches: number;
  } {
    const warehouse = db.prepare("SELECT COUNT(*) as count FROM warehouse_drain_v2").get() as { count: number };
    const alertsOpen = db.prepare("SELECT COUNT(*) as count FROM bot_cheat_reports").get() as { count: number };
    const inspections = db.prepare("SELECT COUNT(*) as count FROM inspection_reports").get() as { count: number };
    const totalPatches = db.prepare("SELECT COUNT(*) as count FROM state_patches").get() as { count: number };
    
    return {
      warehouse_count: warehouse.count,
      alerts_open: alertsOpen.count,
      inspection_count: inspections.count,
      total_patches: totalPatches.count
    };
  },

  vacuum(): void {
    db.exec("VACUUM");
  },
};