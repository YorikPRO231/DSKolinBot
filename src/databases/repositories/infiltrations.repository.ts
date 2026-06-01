import prisma from '../prisma.service';

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
  async pushInfiltration(
    rank: number,
    faction: string,
    detectivefaction: string,
    detectiveid: string,
    newnickname: string,
    oldnickname: string,
    passport: string
  ): Promise<void> {
    await prisma.infiltration.upsert({
      where: { detectiveId: detectiveid },
      update: {
        rank,
        faction,
        detectiveFaction: detectivefaction,
        newNickname: newnickname,
        oldNickname: oldnickname,
        passport,
      },
      create: {
        rank,
        faction,
        detectiveFaction: detectivefaction,
        detectiveId: detectiveid,
        newNickname: newnickname,
        oldNickname: oldnickname,
        passport,
      },
    });
  },

  async retrieveInfiltration(detectiveid: string): Promise<Infiltration | undefined> {
    const infiltration = await prisma.infiltration.findUnique({
      where: { detectiveId: detectiveid },
    });
    
    if (!infiltration) return undefined;
    
    return {
      id: infiltration.id,
      rank: infiltration.rank,
      faction: infiltration.faction,
      detectivefaction: infiltration.detectiveFaction,
      detectiveid: infiltration.detectiveId,
      newnickname: infiltration.newNickname,
      oldnickname: infiltration.oldNickname,
      passport: infiltration.passport,
    };
  },
};