import { loadSettings, getFactionByDiscordId } from "../config/settings-loader";
import { PatchesRepository } from "../databases/index";

export function generatePatch(
  faction: string,
  position: string,
  name: string,
  surname: string,
  passport: number,
  level: string,
): string {
  const randomDigits = PatchesRepository.generateUniqueDigits(passport, faction);

  const detectiveDepartmentToFaction: Record<string, string> = {
    CID: "FIB",
    DB: "LSPD",
    DD: "LSSD",
  };

  if (level === "detective") {
    return `[${detectiveDepartmentToFaction[faction]} | ${faction} | ${randomDigits}].`;
  }

  return `[${faction} | ${position} | ${name[0].toUpperCase()}${surname[0].toUpperCase()}${randomDigits}].`;
}

export function getFaction(
  guildId: string | undefined,
  guildName: string | undefined,
): { abbreviation: string; fullName: string; logChannel: string } | undefined {
  if (!guildId) return undefined;

  const config = loadSettings();

  for (const [abbr, info] of Object.entries(config.detectives)) {
    if (info.discord_id === guildId) {
      return {
        abbreviation: abbr,
        fullName: `${abbr} | Blackberry`,
        logChannel: info.patch_log_channel,
      };
    }
  }

  if (guildName) {
    let factionAbbr = guildName.replace(/^GTA 5 RP\s*\|\s*/, "").trim();
    const info = getFactionByDiscordId(guildId);
    if (!info || info[0] === "TEST_SERVER") {
      return undefined;
    }
    const factionMapping: Record<string, string> = {
      Government: "USSS",
    };

    if (factionMapping[factionAbbr]) {
      factionAbbr = factionMapping[factionAbbr];
    }

    if (factionAbbr) {
      return {
        abbreviation: factionAbbr,
        fullName: `GTA 5 RP | ${factionAbbr}`,
        logChannel: info[1].channels.patch_log || "",
      };
    }
  }

  return undefined;
}