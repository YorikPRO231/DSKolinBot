import prisma from '../prisma.service';

export interface WarehouseData {
  [key: string]: any;
}

export interface Warehouse {
  id: number;
  pasport: string;
  adm_id: string;
  punishment: string;
  items: string;
  log_file: Uint8Array;
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
  async addLog(
    adm_id: string,
    pasport: string,
    punishment: string,
    items: any,
    log_file: Buffer,
    durationText: string
  ): Promise<void> {
    const serializedItems = typeof items === 'string' ? items : JSON.stringify(items);
    await prisma.warehouseDrain.create({
      data: {
        admId: adm_id,
        pasport,
        punishment,
        items: serializedItems,
        logFile: log_file, 
        duration: durationText,
      },
    });
  },

  async getLogById(id: number): Promise<Warehouse | undefined> {
    const log = await prisma.warehouseDrain.findUnique({
      where: { id },
    });
    if (!log) return undefined;

    return {
      id: log.id,
      pasport: log.pasport,
      adm_id: log.admId,
      punishment: log.punishment,
      items: log.items,
      log_file: log.logFile, 
      duration: log.duration,
      created_at: log.createdAt.toISOString(),
    };
  },

  async getLog(pasport: string): Promise<Warehouse | undefined> {
    const log = await prisma.warehouseDrain.findFirst({
      where: { pasport },
      orderBy: { id: 'desc' },
    });
    if (!log) return undefined;

    return {
      id: log.id,
      pasport: log.pasport,
      adm_id: log.admId,
      punishment: log.punishment,
      items: log.items,
      log_file: log.logFile,
      duration: log.duration,
      created_at: log.createdAt.toISOString(),
    };
  },

  async getLogsByStatic(pasport: string): Promise<Warehouse[]> {
    const logs = await prisma.warehouseDrain.findMany({
      where: { pasport },
      orderBy: { id: 'desc' },
    });

    return logs.map(log => ({
      id: log.id,
      pasport: log.pasport,
      adm_id: log.admId,
      punishment: log.punishment,
      items: log.items,
      log_file: log.logFile,
      duration: log.duration,
      created_at: log.createdAt.toISOString(),
    }));
  },

  async removeLogById(id: number): Promise<{ changes: number }> {
    try {
      await prisma.warehouseDrain.delete({
        where: { id },
      });
      return { changes: 1 };
    } catch {
      return { changes: 0 };
    }
  },

  async registerDrain(
    adminId: string,
    passport: string,
    punishment: string,
    report: WarehouseData,
    durationText: string
  ): Promise<void> {
    const data = JSON.stringify(report);
    await prisma.warehouseDrainV2.create({
      data: {
        adminId,
        passport,
        punishment,
        reportData: data,
        duration: durationText,
      },
    });
  },

  async retrieveDrain(passport: string): Promise<WarehouseLine | undefined> {
    const drain = await prisma.warehouseDrainV2.findFirst({
      where: { passport },
      orderBy: { id: 'desc' },
    });
    if (!drain) return undefined;

    return {
      adminId: drain.adminId,
      passport: drain.passport,
      punishment: drain.punishment,
      report_data: drain.reportData,
      duration: drain.duration,
      created_at: drain.createdAt.toISOString(),
    };
  },
};