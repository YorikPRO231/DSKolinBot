export const FRACTION_TYPES = {
  MM: "MM",
  RM: "RM",
  LCN: "LCN",
  YAK: "YAK",
  AM: "AM",
  LSPD: "LSPD",
  LSSD: "LSSD",
  FIB: "FIB",
  GOV: "GOV",
  ARMY: "ARMY",
  SASPA: "SASPA",
  FAM: "FAM",
  MG: "MG-13",
  LSV: "LSV",
  ESB: "ESB",
  BSG: "BSG",
  WN: "WN",
  EMS: `EMS`,
  TEST_SERVER: "TEST SERVER",
  CHP_SERVER: "CHP SERVER",
} as const;

export type FractionType = keyof typeof FRACTION_TYPES;
export type FractionInfo = {
  label: string;
  discord_id: string;
  state: boolean;
  emoji_id: string;
  chp_role_id: string;
  faction_role_id: string;
  state_high_role_id: string[];
  patch_log_channel: string;
}
export const FRACTION_INFO: Record<
    FractionType, FractionInfo
> = {
  MM: {
    label: "Мексиканская мафия",
    discord_id: `673456343696408587`,
    state: false,
    emoji_id: "<:MM:1499074966442872992>",
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  RM: {
    label: "Русская мафия",
    discord_id: `673463621711429632`,
    state: false,
    emoji_id: "<:RM:1499074949497880590>",
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  LCN: {
    label: "Итальянская мафия",
    discord_id: `673456231083409409`,
    state: false,
    emoji_id: "<:LCN:1499074895160807524>",
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  YAK: {
    label: "Японская мафия",
    discord_id: `751047567705505872`,
    state: false,
    emoji_id: "<:YAK:1499074987116462180>",
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  AM: {
    label: "Армянская мафия",
    discord_id: `673456264327594014`,
    state: false,
    emoji_id: "<:AM:1499074924784910366>",
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  LSPD: {
    label: "LSPD",
    discord_id: `673455997846814739`,
    state: true,
    emoji_id: "<:LSPD:1499073872291696640>",
    chp_role_id: "673463211026284573",
    faction_role_id: "673463361983217665",
    state_high_role_id: ["829041631545655306"],
    patch_log_channel: `1470898370364313630`,
  },
  LSSD: {
    label: "LSSD",
    discord_id: `673456494213070868`,
    state: true,
    emoji_id: "<:LSSD:1499073860497313892>",
    chp_role_id: "673463211651104778",
    faction_role_id: "673464024473534465",
    state_high_role_id: ["673464013837041664"],
    patch_log_channel: `1395107667478843536`,
  },
  FIB: {
    label: "FIB",
    discord_id: `673455860407730186`,
    state: true,
    emoji_id: "<:FIB:1499074107671838810>",
    chp_role_id: "673463209713205277",
    faction_role_id: "673463335294861331",
    state_high_role_id: ["895382852462600272"],
    patch_log_channel: `1500511818773172415`,
  },
  GOV: {
    label: "Government",
    discord_id: `673455835481112599`, 
    state: true,
    emoji_id: "<:GOV:1499073847318544394>",
    chp_role_id: "673463209050505247",
    faction_role_id: "674572465791303699",
    state_high_role_id: ["894157975286087721"],
    patch_log_channel: `1380143712503332925`,
  },
  ARMY: {
    label: "ARMY",
    discord_id: `673456035930832916`,
    state: true,
    emoji_id: "<:ARMY:1499074135563829269>",
    chp_role_id: "673463210384556044",
    faction_role_id: "933431913207718019",
    state_high_role_id: ["933436258296938536"],
    patch_log_channel: `1395108469413122199`,
  },
  SASPA: {
    label: "SASPA",
    discord_id: `802190616221581332`,
    state: true,
    emoji_id: "<:SASPA:1499073833959817330>",
    chp_role_id: "801479250761875487",
    faction_role_id: "802190616221581335",
    state_high_role_id: ["839242470234521692"],
    patch_log_channel: `1395106916656742480`,
  },
  WN: {
    label: `WN`,
    discord_id: `673456072995897354`,
    state: true,
    emoji_id: "<:WN:1499076514438844457>",
    chp_role_id: "758658040781602896",
    faction_role_id: "673463412495220736",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  FAM: {
    label: "The Families",
    discord_id: `673456449761837070`,
    state: false,
    emoji_id: "<:FAM:1499075519310725170>",
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  MG: {
    label: "Marabunta Grande",
    discord_id: `673456195264053258`,
    state: false,
    emoji_id: "<:MG13:1499075435009675426>",
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  LSV: {
    label: "Los Santos Vagos",
    discord_id: `673456382149918722`,
    state: false,
    emoji_id: "<:LSV:1499075458124480664>",
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  ESB: {
    label: "East Side Ballas",
    discord_id: `673456418107686912`,
    state: false,
    emoji_id: "<:ESB:1499075481566449694>",
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  BSG: {
    label: "Bloods Street Gang",
    discord_id: `673456143367929878`,
    state: false,
    emoji_id: "<:BSG:1499075500365320232>",
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  EMS: {
    label: `Emergency Medical Services`,
    discord_id: `673456105309077525`,
    state: true,
    emoji_id: "<:EMS:1499073504396443728>",
    chp_role_id: "673463212355878943",
    faction_role_id: "673463454190796810",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  TEST_SERVER: {
    label: "Test Server",
    discord_id: "1467227742037741846",
    state: false,
    emoji_id: "TEST_SERVER",
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
  CHP_SERVER: {
    label: "Emergency State Server",
    discord_id: "673456522294198282",
    state: true,
    emoji_id: `CHP`,
    chp_role_id: "",
    faction_role_id: "",
    state_high_role_id: [""],
    patch_log_channel: ``,
  },
};

export const TRANSFER_LOGS: Record<string, [string, string]> = {
  MM: [FRACTION_INFO["MM"].discord_id, ""],
  RM: [FRACTION_INFO["MM"].discord_id, ""],
  LCN: [FRACTION_INFO["MM"].discord_id, ""],
  YAK: [FRACTION_INFO["MM"].discord_id, ""],
  AM: [FRACTION_INFO["MM"].discord_id, ""],
  LSPD: [FRACTION_INFO["LSPD"].discord_id, "1499476976358920222"],
  LSSD: [FRACTION_INFO["LSSD"].discord_id, "754925129590636570"],
  FIB: [FRACTION_INFO["FIB"].discord_id, "1040674435348316250"],
  GOV: [FRACTION_INFO["GOV"].discord_id, "1023979907367313518"],
  ARMY: [FRACTION_INFO["ARMY"].discord_id, "1499478887757910298"],
  SASPA: [FRACTION_INFO["SASPA"].discord_id, "1499478625219641515"],
  FAM: [FRACTION_INFO["MM"].discord_id, ""],
  MG: [FRACTION_INFO["MM"].discord_id, ""],
  LSV: [FRACTION_INFO["MM"].discord_id, ""],
  ESB: [FRACTION_INFO["MM"].discord_id, ""],
  BSG: [FRACTION_INFO["MM"].discord_id, ""],
  WN: [FRACTION_INFO["WN"].discord_id, ""],
  EMS: [FRACTION_INFO["EMS"].discord_id, ""],
  TEST_SERVER: [FRACTION_INFO["MM"].discord_id, ""],
  CHP_SERVER: [FRACTION_INFO["MM"].discord_id, ""],
};

export function factionByDiscordID(discord_id: string | undefined): [
  FractionType,
  FractionInfo,
] {
  if (!discord_id) {
    return ["TEST_SERVER", FRACTION_INFO["TEST_SERVER"]];
  }

  for (const [key, value] of Object.entries(FRACTION_INFO)) {
    if (value.discord_id === discord_id) {
      return [key as FractionType, value];
    }
  }

  return ["TEST_SERVER", FRACTION_INFO["TEST_SERVER"]];
}

export const EMERGENCY_SERVER_ID = FRACTION_INFO.CHP_SERVER.discord_id;

export const DETECTIVES_INFO = {
  DD: {
    discord_id: `956232563733692436`,
    high_role_id: "956232563771465821",
    name_logs_id: "1503070013723115540",
    patch_log_channel: "1409907963832827995"
  },
  DB: {
    discord_id: `956223490388807710`,
    high_role_id: "956223490439122967",
    name_logs_id: "1503069180277293056",
    patch_log_channel: "1470923173716557978"
  },
  CID: {
    discord_id: `934137298000416798`,
    high_role_id: "934191153077702716",
    name_logs_id: "1503068304250765484",
    patch_log_channel: "934197973003436074"
  },
};