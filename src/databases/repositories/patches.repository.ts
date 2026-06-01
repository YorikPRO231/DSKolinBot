import prisma from '../prisma.service';

export interface StatePatch {
  id: number;
  passport: number;
  username: string;
  discord_id: string;
  faction: string;
  patch: string;
  created_at: string;
  history: string;
}

export interface PatchHistory {
  faction: string;
  patch: string;
  created_at: string;
  updated_at: string;
}

export const PatchesRepository = {
  async pushPlayerId(
    passport: number,
    username: string,
    discord_id: string,
    faction: string,
    patch: string
  ): Promise<boolean> {
    const now = new Date();
    const existing = await prisma.statePatch.findUnique({
      where: { passport },
    });

    let history: PatchHistory[] = [];

    if (existing) {
      if (existing.discordId !== discord_id) {
        return false;
      }

      try {
        history = JSON.parse(existing.history) as PatchHistory[];
      } catch (e) {
        console.warn(`Ошибка парсинга истории для паспорта ${passport}: ${existing.history}`);
      }

      history.push({
        created_at: existing.createdAt.toISOString(),
        faction: existing.faction,
        patch: existing.patch,
        updated_at: now.toISOString(),
      });

      if (history.length > 15) {
        history = history.slice(-15);
      }
    }

    await prisma.statePatch.upsert({
      where: { passport },
      update: {
        username,
        discordId: discord_id,
        faction,
        patch,
        history: JSON.stringify(history),
      },
      create: {
        passport,
        username,
        discordId: discord_id,
        faction,
        patch,
        history: JSON.stringify(history),
        createdAt: now,
      },
    });
    return true;
  },

  async retrievePlayerPatch(passport: number): Promise<StatePatch | undefined> {
    const patch = await prisma.statePatch.findUnique({
      where: { passport },
    });
    if (!patch) return undefined;

    return {
      id: patch.id,
      passport: patch.passport,
      username: patch.username,
      discord_id: patch.discordId,
      faction: patch.faction,
      patch: patch.patch,
      created_at: patch.createdAt.toISOString(),
      history: patch.history,
    };
  },

  async findPlayerPatch(patch: string): Promise<StatePatch[]> {
    const patches = await prisma.statePatch.findMany({
      where: {
        OR: [
          { patch: { contains: patch } },
          { history: { contains: patch } },
        ],
      },
    });

    return patches.map((p: {
      id: any;
      passport: any;
      username: any;
      discordId: any;
      faction: any;
      patch: any;
      createdAt: { toISOString: () => any; };
      history: any;
    }) => ({
      id: p.id,
      passport: p.passport,
      username: p.username,
      discord_id: p.discordId,
      faction: p.faction,
      patch: p.patch,
      created_at: p.createdAt.toISOString(),
      history: p.history,
    }));
  },

  async getPatchByDiscord(discordId: string): Promise<StatePatch[]> {
    const patches = await prisma.statePatch.findMany({
      where: { discordId },
    });

    return patches.map((p: {
      id: any;
      passport: any;
      username: any;
      discordId: any;
      faction: any;
      patch: any;
      createdAt: { toISOString: () => any; };
      history: any;
    }) => ({
      id: p.id,
      passport: p.passport,
      username: p.username,
      discord_id: p.discordId,
      faction: p.faction,
      patch: p.patch,
      created_at: p.createdAt.toISOString(),
      history: p.history,
    }));
  },

  async getSelfPatches(discord_id: string): Promise<StatePatch[] | undefined> {
    const patches = await prisma.statePatch.findMany({
      where: { discordId: discord_id },
    });

    return patches.map((p: {
      id: any;
      passport: any;
      username: any;
      discordId: any;
      faction: any;
      patch: any;
      createdAt: { toISOString: () => any; };
      history: any;
    }) => ({
      id: p.id,
      passport: p.passport,
      username: p.username,
      discord_id: p.discordId,
      faction: p.faction,
      patch: p.patch,
      created_at: p.createdAt.toISOString(),
      history: p.history,
    }));
  },

  async generateUniqueDigits(passport: number, faction: string): Promise<string> {
    let digits: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      digits = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
      attempts++;

      const existing = await prisma.statePatch.findFirst({
        where: {
          faction,
          patch: { contains: `${digits}]` },
          NOT: { passport },
        },
      });

      if (!existing) break;
    } while (attempts < maxAttempts);

    return digits;
  },

  async deletePatch(id: number, adminTag: string): Promise<boolean> {
    const existing = await prisma.statePatch.findUnique({
      where: { id },
    });

    if (!existing) {
      return false;
    }

    const now = new Date();
    let history: PatchHistory[] = [];

    try {
      history = JSON.parse(existing.history) as PatchHistory[];
    } catch (e) {
      console.warn(`Ошибка парсинга истории для паспорта ${existing.passport}: ${existing.history}`);
    }

    history.push({
      created_at: existing.createdAt.toISOString(),
      faction: existing.faction,
      patch: existing.patch,
      updated_at: now.toISOString(),
    });

    if (history.length > 15) {
      history = history.slice(-15);
    }

    await prisma.statePatch.upsert({
      where: { passport: existing.passport },
      update: {
        patch: `! Последняя нашивка удалена администрацией ! // by ${adminTag}`,
        history: JSON.stringify(history),
      },
      create: {
        passport: existing.passport,
        username: existing.username,
        discordId: existing.discordId,
        faction: existing.faction,
        patch: `! Последняя нашивка удалена администрацией ! // by ${adminTag}`,
        history: JSON.stringify(history),
        createdAt: now,
      },
    });

    return true;
  },
};