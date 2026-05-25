import db from '../sqlite';

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
  pushPlayerId(passport: number, username: string, discord_id: string, faction: string, patch: string): void {
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT * FROM state_patches WHERE passport = ?').get(passport) as StatePatch | undefined;

    let history: PatchHistory[] = [];

    if (existing) {
      try {
        history = JSON.parse(existing.history) as PatchHistory[];
      } catch (e) {
        console.warn(`Ошибка парсинга истории для паспорта ${passport}: ${existing.history}`);
      }

      history.push({
        created_at: existing.created_at,
        faction: existing.faction,
        patch: existing.patch,
        updated_at: now
      });
      
      if (history.length > 15) {
        history = history.slice(-15);
      }
    }

    db.prepare(`
      INSERT INTO state_patches (passport, username, discord_id, faction, patch, history, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(passport) DO UPDATE SET
        username = excluded.username,
        discord_id = excluded.discord_id,
        faction = excluded.faction,
        patch = excluded.patch,
        history = excluded.history,
        created_at = excluded.created_at
    `).run(passport, username, discord_id, faction, patch, JSON.stringify(history), now);
  },

  retrievePlayerPatch(passport: number): StatePatch | undefined {
    return db.prepare('SELECT * FROM state_patches WHERE passport = ?').get(passport) as StatePatch | undefined;
  },

  findPlayerPatch(patch: string): StatePatch[] {
    return db.prepare(`SELECT * FROM state_patches WHERE patch LIKE ? OR history LIKE ?`)
      .all(`%${patch}%`, `%${patch}%`) as StatePatch[];
  },

  getPatchByDiscord(discordId: string): StatePatch[] {
    const results = db.prepare('SELECT * FROM state_patches WHERE discord_id = ?').all(discordId) as StatePatch[] | undefined;
    return results || [];
  },

  getSelfPatches(discord_id: string): StatePatch[] | undefined {
    return db.prepare(`SELECT * from state_patches WHERE discord_id = ?`).all(discord_id) as StatePatch[] | undefined;
  },

  generateUniqueDigits(passport: number, faction: string): string {
    let digits: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      digits = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
      attempts++;

      const existing = db.prepare(
        'SELECT patch FROM state_patches WHERE faction = ? AND patch LIKE ? AND passport != ?'
      ).get(faction, `%${digits}]`, passport) as { patch: string } | undefined;

      if (!existing) break;
    } while (attempts < maxAttempts);

    return digits;
  },

  deletePatch(id: number, adminTag: string) {
    const existing = db.prepare(`SELECT * FROM state_patches WHERE id = ?`).get(id) as StatePatch | undefined;
    const now = new Date().toISOString();
    if (!existing) {
      return false;
    }
    let history: PatchHistory[] = [];

    if (existing) {
      try {
        history = JSON.parse(existing.history) as PatchHistory[];
      } catch (e) {
        console.warn(`Ошибка парсинга истории для паспорта ${existing.passport}: ${existing.history}`);
      }

      history.push({
        created_at: existing.created_at,
        faction: existing.faction,
        patch: existing.patch,
        updated_at: now
      });

      if (history.length > 15) {
        history = history.slice(-15);
      }
    }

    db.prepare(`
      INSERT INTO state_patches (passport, username, discord_id, faction, patch, history, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(passport) DO UPDATE SET username   = excluded.username,
                                          discord_id = excluded.discord_id,
                                          faction    = excluded.faction,
                                          patch      = excluded.patch,
                                          history    = excluded.history,
                                          created_at = excluded.created_at
    `).run(existing.passport, existing.username, existing.discord_id, existing.faction, `! Последняя нашивка удалена администрацией ! // by ${adminTag}`, JSON.stringify(history), now);
    return true;
  }
};