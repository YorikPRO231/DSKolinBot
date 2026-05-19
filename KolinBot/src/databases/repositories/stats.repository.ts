import db from '../sqlite';

export const StatsRepository = {
  getStats(): {
    warehouse_count: number;
    alerts_open: number;
    alerts_closed: number;
    inspection_count: number;
  } {
    const warehouse = db.prepare("SELECT COUNT(*) as count FROM warehouse_drain").get() as { count: number };
    const alertsOpen = db.prepare("SELECT COUNT(*) as count FROM security_alerts WHERE status = 'OPEN'").get() as { count: number };
    const alertsClosed = db.prepare("SELECT COUNT(*) as count FROM security_alerts WHERE status = 'CLOSED'").get() as { count: number };
    const inspections = db.prepare("SELECT COUNT(*) as count FROM inspection_reports").get() as { count: number };

    return {
      warehouse_count: warehouse.count,
      alerts_open: alertsOpen.count,
      alerts_closed: alertsClosed.count,
      inspection_count: inspections.count
    };
  },

  vacuum(): void {
    db.exec("VACUUM");
  },
};