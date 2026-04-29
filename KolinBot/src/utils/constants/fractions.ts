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
    WN: 'WN',
    EMS: `EMS`,
    TEST_SERVER: 'TEST SERVER'
} as const;

export type FractionType = keyof typeof FRACTION_TYPES;
export const FRACTION_INFO: Record<FractionType, { label: string, discord_id: string, state: boolean }> = {
    MM: { label: "Мексиканская мафия", discord_id: `673456343696408587`, state: false },
    RM: { label: "Русская мафия", discord_id: `673463621711429632`, state: false },
    LCN: { label: "Итальянская мафия", discord_id: `673456231083409409`, state: false },
    YAK: { label: "Японская мафия", discord_id: `751047567705505872`, state: false },
    AM: { label: "Армянская мафия", discord_id: `673456264327594014`, state: false },
    LSPD: { label: "LSPD", discord_id: `673455997846814739 `, state: true  },
    LSSD: { label: "LSSD", discord_id: `673456494213070868`, state: true },
    FIB: { label: "FIB", discord_id: `673455860407730186`, state: true  },
    GOV: { label: "Government", discord_id: `673455835481112599`, state: true  },
    ARMY: { label: "SANG", discord_id: `673456035930832916`, state: true  },
    SASPA: { label: "SASPA", discord_id: `802190616221581332`, state: true  },
    WN: { label: `WN`, discord_id: `673456072995897354`, state:true },
    FAM: { label: "The Families", discord_id: `673456449761837070`, state: false  },
    MG: { label: "Marabunta Grande", discord_id: `673456195264053258`, state: false },
    LSV: { label: "Los Santos Vagos", discord_id: `673456382149918722`, state: false },
    ESB: { label: "East Side Ballas", discord_id: `673456418107686912`, state: false },
    BSG: { label: "Bloods Street Gang", discord_id: `673456143367929878`, state: false },
    EMS: { label: `Emergency Medical Services`, discord_id: `673456105309077525`, state:true},
    TEST_SERVER: { label: 'Test Server', discord_id: '1467227742037741846', state: true}
};

export function factionByDiscordID(discord_id: string | undefined): [FractionType, { label: string, discord_id: string, state: boolean }] {
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

export const DETECTIVES_INFO = {
    DD: {discord_id: `956232563733692436`},
    DB: {discord_id: `956223490388807710`},
    CID: {discord_id: `934137298000416798`}
}