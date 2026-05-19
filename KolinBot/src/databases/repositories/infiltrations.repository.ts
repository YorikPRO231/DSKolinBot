import db from '../sqlite';

export interface Infiltration {
  id: number;
  rank: number;
  faction: string;
  detectivefaction: string;
  detectiveid: string;
  newnickname: string;
  oldnickname: string;
  passport: string;
}

export const InfiltrationsRepository = {
  pushInfiltration(rank: number, faction: string, detectivefaction: string, detectiveid: string, newnickname: string, oldnickname: string, passport: string) {
    db.prepare(`
      INSERT OR REPLACE INTO infiltrations (rank, faction, detectivefaction, detectiveid, newnickname, oldnickname, passport)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(rank, faction, detectivefaction, detectiveid, newnickname, oldnickname, passport);
  },

  retrieveInfiltration(detectiveid: string): Infiltration | undefined {
    return db.prepare('SELECT * FROM infiltrations WHERE detectiveid = ?').get(detectiveid) as Infiltration | undefined;
  },
};