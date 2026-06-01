export const TRANSFER_TABLE: Record<string, Record<string, { new: number; min: number; max: number }[]>> = {
    FIB: {
        ARMY: [{ new: 3, min: 6, max: 6 }, { new: 4, min: 7, max: 9 }, { new: 5, min: 10, max: 12 }, { new: 7, min: 13, max: 14 }],
        LSPD: [{ new: 3, min: 5, max: 5 }, { new: 4, min: 7, max: 8 }, { new: 5, min: 9, max: 11 }, { new: 7, min: 12, max: 14 }],
        LSSD: [{ new: 3, min: 4, max: 4 }, { new: 4, min: 5, max: 5 }, { new: 5, min: 7, max: 7 }, { new: 7, min: 8, max: 10 }],
        SASPA: [{ new: 3, min: 7, max: 8 }, { new: 4, min: 9, max: 12 }],
        GOV: [{ new: 3, min: 8, max: 8 }, { new: 4, min: 10, max: 12 }, { new: 7, min: 16, max: 18 }],
    },
    LSPD: {
        ARMY: [{ new: 2, min: 6, max: 6 }, { new: 3, min: 7, max: 7 }, { new: 4, min: 8, max: 8 }, { new: 5, min: 9, max: 10 }, { new: 7, min: 11, max: 12 }, { new: 8, min: 13, max: 13 }, { new: 9, min: 14, max: 15 }],
        FIB: [{ new: 4, min: 3, max: 3 }, { new: 7, min: 5, max: 5 }, { new: 9, min: 7, max: 10 }],
        LSSD: [{ new: 5, min: 3, max: 4 }, { new: 7, min: 5, max: 5 }, { new: 8, min: 7, max: 7 }, { new: 9, min: 8, max: 10 }],
        SASPA: [{ new: 4, min: 7, max: 8 }, { new: 5, min: 9, max: 12 }],
        GOV: [{ new: 2, min: 8, max: 8 }, { new: 3, min: 10, max: 12 }, { new: 4, min: 16, max: 18 }],
    },
    LSSD: {
        ARMY: [{ new: 2, min: 6, max: 6 }, { new: 3, min: 7, max: 7 }, { new: 4, min: 8, max: 9 }, { new: 5, min: 10, max: 10 }, { new: 7, min: 14, max: 15 }],
        LSPD: [{ new: 3, min: 4, max: 5 }, { new: 4, min: 7, max: 8 }, { new: 5, min: 9, max: 11 }, { new: 7, min: 12, max: 14 }],
        FIB: [{ new: 3, min: 4, max: 4 }, { new: 4, min: 5, max: 5 }, { new: 5, min: 7, max: 8 }, { new: 7, min: 9, max: 10 }],
        SASPA: [{ new: 3, min: 7, max: 9 }, { new: 4, min: 10, max: 12 }],
        GOV: [{ new: 2, min: 8, max: 8 }, { new: 3, min: 10, max: 12 }, { new: 4, min: 16, max: 18 }],
    },
    ARMY: {
        LSSD: [{ new: 3, min: 3, max: 3 }, { new: 4, min: 4, max: 4 }, { new: 6, min: 5, max: 5 }, { new: 9, min: 7, max: 7 }, { new: 11, min: 8, max: 9 }, { new: 12, min: 10, max: 10 }],
        LSPD: [{ new: 3, min: 4, max: 4 }, { new: 6, min: 7, max: 7 }, { new: 7, min: 8, max: 8 }, { new: 8, min: 9, max: 9 }, { new: 9, min: 10, max: 10 }, { new: 10, min: 11, max: 11 }, { new: 11, min: 12, max: 13 }, { new: 12, min: 14, max: 14 }],
        FIB: [{ new: 5, min: 4, max: 4 }, { new: 6, min: 5, max: 5 }, { new: 9, min: 7, max: 7 }, { new: 11, min: 8, max: 8 }, { new: 12, min: 9, max: 10 }],
        SASPA: [{ new: 3, min: 7, max: 9 }, { new: 4, min: 10, max: 12 }],
        GOV: [{ new: 2, min: 8, max: 8 }, { new: 3, min: 12, max: 18 }],
    },
    SASPA: {
        LSSD: [{ new: 4, min: 3, max: 3 }, { new: 5, min: 4, max: 4 }, { new: 6, min: 5, max: 5 }, { new: 7, min: 7, max: 7 }, { new: 9, min: 8, max: 10 }],
        LSPD: [{ new: 3, min: 3, max: 43 }, { new: 4, min: 4, max: 4 }, { new: 5, min: 5, max: 5 }, { new: 6, min: 7, max: 7 }, { new: 7, min: 8, max: 9 }, { new: 8, min: 10, max: 11 }, { new: 9, min: 12, max: 14 }],
        FIB: [{ new: 5, min: 3, max: 3 }, { new: 6, min: 4, max: 4 }, { new: 7, min: 5, max: 5 }, { new: 8, min: 7, max: 7 }, { new: 9, min: 8, max: 10 }],
        ARMY: [{ new: 3, min: 5, max: 6 }, { new: 4, min: 7, max: 7 }, { new: 5, min: 8, max: 8 }, { new: 6, min: 9, max: 9 }, { new: 7, min: 10, max: 10 }, { new: 8, min: 11, max: 12 }, { new: 9, min: 13, max: 15 }],
        GOV: [{ new: 4, min: 8, max: 8 }, { new: 5, min: 12, max: 12 }, { new: 6, min: 16, max: 16 }, { new: 7, min: 18, max: 18 }],
    },
    GOV: {
        ARMY: [{ new: 8, min: 6, max: 8 }, { new: 10, min: 9, max: 11 }, { new: 12, min: 12, max: 15 }],
        LSPD: [{ new: 8, min: 4, max: 5 }, { new: 10, min: 7, max: 9 }, { new: 12, min: 10, max: 13 }],
        FIB: [{ new: 8, min: 3, max: 4 }, { new: 10, min: 5, max: 5 }, { new: 12, min: 7, max: 10 }],
        SASPA: [{ new: 8, min: 4, max: 6 }, { new: 10, min: 7, max: 9 }, { new: 12, min: 10, max: 12 }],
        LSSD: [{ new: 8, min: 4, max: 4 }, { new: 10, min: 5, max: 5 }, { new: 12, min: 7, max: 10 }],
    },
};