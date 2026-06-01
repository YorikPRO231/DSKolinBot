import prisma from '../prisma.service';

export interface SecurityAlert {
  id: number;
  type: string;
  count: number;
  author_id: string;
  reason: string;
  created_at: string;
  updated_at: string;
  passport: string;
}

export interface SecurityLog {
  id: number;
  username: string;
  suspected_action: string;
  checked_at: string;
  admin_id: string;
  check_results: string;
}

export const SecurityRepository = {
  async exportSecurityAlertsMany(
      adminId: string,
      alerts: {
        suspect: string;
        action: string;
        data: string;
        originalDate?: string;
      }[]
  ): Promise<void> {
    console.log('exportSecurityAlertsMany called', {adminId, alertsCount: alerts.length});

    let adminExists = await prisma.admin.findUnique({
      where: {discordId: adminId},
    });

    if (!adminExists) {
      await prisma.admin.create({
        data: {
          discordId: adminId,
          surname: 'Unknown',
          security: 'no',
        },
      });
    }

    for (const alert of alerts) {
      await this.addSecurityRequest(
        'Bots',
        adminId,
        `${alert.action}: ${alert.data}`,
        alert.suspect
      );
    }
  },

  async getSecurityAlerts(type?: string, page: number = 1, limit: number = 20, search?: string): Promise<{ alerts: SecurityAlert[], total: number, totalPages: number }> {
    const where: any = {};
    if (type && type !== 'ALL') where.type = type;
    if (search) where.passport = { contains: search, mode: 'insensitive' };
    
    const skip = (page - 1) * limit;
    
    const [alerts, total] = await Promise.all([
      prisma.securityAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.securityAlert.count({ where })
    ]);

    return {
      alerts: alerts.map((a) => ({
        id: a.id,
        passport: a.passport,
        type: a.type,
        count: a.count,
        author_id: a.authorId,
        reason: a.reason,
        created_at: a.createdAt.toISOString(),
        updated_at: a.updatedAt.toISOString(),
      })),
      total,
      totalPages: Math.ceil(total / limit)
    };
  },

  async getSecurityAlertsBySuspect(suspect: string, type?: string): Promise<SecurityAlert[]> {
    const where: any = { passport: suspect };
    if (type) where.type = type;

    const alerts = await prisma.securityAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return alerts.map((a) => ({
      id: a.id,
      passport: a.passport,
      type: a.type,
      count: a.count,
      author_id: a.authorId,
      reason: a.reason,
      created_at: a.createdAt.toISOString(),
      updated_at: a.updatedAt.toISOString(),
    }));
  },

  async getFullHistoryBySuspect(passport: string): Promise<{ alert: SecurityAlert | null, logs: any[] }> {
    const alert = await prisma.securityAlert.findFirst({
      where: { passport },
      include: {
        logs: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!alert) return { alert: null, logs: [] };

    return {
      alert: {
        id: alert.id,
        passport: alert.passport,
        type: alert.type,
        count: alert.count,
        author_id: alert.authorId,
        reason: alert.reason,
        created_at: alert.createdAt.toISOString(),
        updated_at: alert.updatedAt.toISOString(),
      },
      logs: alert.logs.map((log) => ({
        id: log.id,
        type: log.type,
        reason: log.reason,
        author_id: log.authorId,
        created_at: log.createdAt.toISOString(),
      }))
    };
  },

  async getAlertById(id: number): Promise<SecurityAlert | null> {
    const alert = await prisma.securityAlert.findUnique({
      where: { id },
    });

    if (!alert) return null;

    return {
      id: alert.id,
      passport: alert.passport,
      type: alert.type,
      count: alert.count,
      author_id: alert.authorId,
      reason: alert.reason,
      created_at: alert.createdAt.toISOString(),
      updated_at: alert.updatedAt.toISOString(),
    };
  },

  async closeAlertsBySuspectIfExists(suspect: string): Promise<number> {
    const alert = await prisma.securityAlert.findFirst({
      where: { passport: suspect },
      include: { logs: true }
    });
    
    if (alert) {
      await prisma.securityAlertLog.deleteMany({
        where: { alertId: alert.id }
      });
      await prisma.securityAlert.delete({
        where: { id: alert.id }
      });
      return 1;
    }
    return 0;
  },

  async closeAlert(id: number): Promise<{ changes: number }> {
    try {
      await prisma.securityAlertLog.deleteMany({
        where: { alertId: id }
      });
      await prisma.securityAlert.delete({
        where: { id },
      });
      return { changes: 1 };
    } catch {
      return { changes: 0 };
    }
  },

  async getSecurityLogs(limit: number = 100): Promise<SecurityLog[]> {
    const logs = await prisma.securityLog.findMany({
      orderBy: { checkedAt: 'desc' },
      take: limit,
    });

    return logs.map((l) => ({
      id: l.id,
      username: l.username,
      suspected_action: l.suspectedAction,
      checked_at: l.checkedAt.toISOString(),
      admin_id: l.adminId,
      check_results: l.checkResults,
    }));
  },

  async addSecurityRequest(
    type: string,
    authorId: string,
    reason: string,
    passport: string
  ): Promise<void> {
    const existing = await prisma.securityAlert.findFirst({
      where: { passport },
    });

    if (existing) {
      let newType = existing.type;
      if (existing.type !== type) {
        newType = 'Cheats';
      }

      const updated = await prisma.securityAlert.update({
        where: { id: existing.id },
        data: {
          count: { increment: 1 },
          type: newType,
          reason,
          authorId,
          updatedAt: new Date(),
        },
      });

      await prisma.securityAlertLog.create({
        data: {
          alertId: updated.id,
          type: type,
          reason: reason,
          authorId: authorId,
        },
      });
    } else {
      const created = await prisma.securityAlert.create({
        data: {
          passport,
          type,
          count: 1,
          authorId,
          reason,
        },
      });

      await prisma.securityAlertLog.create({
        data: {
          alertId: created.id,
          type: type,
          reason: reason,
          authorId: authorId,
        },
      });
    }
  },
};