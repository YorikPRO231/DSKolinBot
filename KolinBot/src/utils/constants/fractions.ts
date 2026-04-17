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
    BSG: "BSG"
} as const;

export type FractionType = keyof typeof FRACTION_TYPES;

export const FRACTION_INFO: Record<FractionType, { label: string }> = {
    MM: { label: "Мексиканская мафия" },
    RM: { label: "Русская мафия" },
    LCN: { label: "Итальянская мафия" },
    YAK: { label: "Японская мафия" },
    AM: { label: "Армянская мафия" },
    LSPD: { label: "LSPD" },
    LSSD: { label: "LSSD" },
    FIB: { label: "FIB" },
    GOV: { label: "Government" },
    ARMY: { label: "SANG" },
    SASPA: { label: "SASPA" },
    FAM: { label: "The Families" },
    MG: { label: "Marabunta Grande" },
    LSV: { label: "Los Santos Vagos" },
    ESB: { label: "East Side Ballas" },
    BSG: { label: "Bloods Street Gang" }
};