import db from '../sqlite';

export interface Admin {
  discord_id: string;
  surname: string;
  security?: string;
}

export const AdminsRepository = {
  getAdminSurname(discordId: string): string | null {
    const row = db.prepare("SELECT surname FROM admins WHERE discord_id = ?").get(discordId) as { surname: string } | undefined;
    return row ? row.surname : null;
  },

  setAdminSurname(discordId: string, surname: string): void {
    db.prepare(`INSERT OR REPLACE INTO admins (discord_id, surname) VALUES (?, ?)`).run(discordId, surname);
  },

  setAdminSecurity(discordId: string, security: string): void {
    db.prepare(`
      INSERT OR REPLACE INTO admins (discord_id, surname, security) 
      VALUES (?, COALESCE((SELECT surname FROM admins WHERE discord_id = ?), ''), ?)
    `).run(discordId, discordId, security);
  },

  getSecurityAccess(discordId: string): string | null {
    const row = db.prepare("SELECT security FROM admins WHERE discord_id = ?").get(discordId) as { security: string } | undefined;
    return row ? row.security : null;
  },
};