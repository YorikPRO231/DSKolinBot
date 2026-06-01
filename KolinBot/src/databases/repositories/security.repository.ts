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

    let createdCount = 0;
    let updatedCount = 0;

    for (const alert of alerts) {
      const existing = await prisma.securityAlert.findFirst({
        where: {
          passport: alert.suspect,
          type: 'Bots'
        },
      });

      const reason = `${alert.action}: ${alert.data}`;

      if (existing) {
        await prisma.securityAlert.update({
          where: {id: existing.id},
          data: {
            count: {increment: 1},
            reason,
            authorId: adminId,
            updatedAt: new Date(),
          },
        });
        updatedCount++;
      } else {
        await prisma.securityAlert.create({
          data: {
            passport: alert.suspect,
            type: 'Bots',
            count: 1,
            authorId: adminId,
            reason,
          },
        });
        createdCount++;
      }
    }

    console.log(`Import completed: created ${createdCount}, updated ${updatedCount}`);
  },

  async getSecurityAlerts(type?: string): Promise<SecurityAlert[]> {
    const where = type ? { type } : {};
    const alerts = await prisma.securityAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return alerts.map((a: {
      id: any;
      passport: any;
      type: any;
      count: any;
      authorId: any;
      reason: any;
      createdAt: { toISOString: () => any; };
      updatedAt: { toISOString: () => any; };
    }) => ({
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

  async getSecurityAlertsBySuspect(suspect: string, type?: string): Promise<SecurityAlert[]> {
    const where: any = { passport: suspect };
    if (type) where.type = type;

    const alerts = await prisma.securityAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return alerts.map((a: {
      id: any;
      passport: any;
      type: any;
      count: any;
      authorId: any;
      reason: any;
      createdAt: { toISOString: () => any; };
      updatedAt: { toISOString: () => any; };
    }) => ({
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
    const deleted = await prisma.securityAlert.deleteMany({
      where: { passport: suspect },
    });
    return deleted.count;
  },

  async closeAlert(id: number): Promise<{ changes: number }> {
    try {
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

    return logs.map((l: {
      id: any;
      username: any;
      suspectedAction: any;
      checkedAt: { toISOString: () => any; };
      adminId: any;
      checkResults: any;
    }) => ({
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

      await prisma.securityAlert.update({
        where: { id: existing.id },
        data: {
          count: { increment: 1 },
          type: newType,
          reason,
          authorId,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.securityAlert.create({
        data: {
          passport,
          type,
          count: 1,
          authorId,
          reason,
        },
      });
    }
  },
};