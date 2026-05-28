import prisma from '../prisma.service';

export const StatsRepository = {
  async getStats(): Promise<{
    warehouse_count: number;
    alerts_open: number;
    inspection_count: number;
    total_patches: number;
  }> {
    const [warehouseCount, alertsOpen, inspectionCount, totalPatches] = await Promise.all([
      prisma.warehouseDrainV2.count(),
      prisma.securityAlert.count(),
      prisma.inspectionReport.count(),
      prisma.statePatch.count(),
    ]);

    return {
      warehouse_count: warehouseCount,
      alerts_open: alertsOpen,
      inspection_count: inspectionCount,
      total_patches: totalPatches,
    };
  },

};