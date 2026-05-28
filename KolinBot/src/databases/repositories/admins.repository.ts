import prisma from '../prisma.service';

export interface Admin {
  discord_id: string;
  surname: string;
  security?: string;
}

export const AdminsRepository = {
  async getAdminSurname(discordId: string): Promise<string | null> {
    const admin = await prisma.admin.findUnique({
      where: { discordId },
      select: { surname: true },
    });
    return admin?.surname || null;
  },

  async setAdminSurname(discordId: string, surname: string): Promise<void> {
    await prisma.admin.upsert({
      where: { discordId },
      update: { surname },
      create: { discordId, surname, security: 'no' },
    });
  },

  async setAdminSecurity(discordId: string, security: string): Promise<void> {
    await prisma.admin.upsert({
      where: { discordId },
      update: { security },
      create: { discordId, surname: '', security },
    });
  },

  async getSecurityAccess(discordId: string): Promise<string | null> {
    const admin = await prisma.admin.findUnique({
      where: { discordId },
      select: { security: true },
    });
    return admin?.security || null;
  },
};