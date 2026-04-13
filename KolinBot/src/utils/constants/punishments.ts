export const PUNISHMENT_TYPES = {
    IBAN: 'iban',
    BAN: 'ban',
    WARN: 'warn',
    WARN_BAN: 'warn_ban',
    AJAIL: 'ajail',
    CLEAR_ITEMS: 'clear_items'
} as const;

export type PunishmentType = typeof PUNISHMENT_TYPES[keyof typeof PUNISHMENT_TYPES];

interface PunishmentInfo {
    label: string;           // Для отображения в обычном тексте
    shortLabel: string;      // Для компактного отображения
    upperLabel: string;      // Для заглавных букв
    color: number;
    emoji: string;
}

export const PUNISHMENT_INFO: Record<PunishmentType, PunishmentInfo> = {
    [PUNISHMENT_TYPES.IBAN]: {
        label: "Вечная блокировка",
        shortLabel: "IБан",
        upperLabel: "IБАН",
        color: 0xed4245,
        emoji: "🚫"
    },
    [PUNISHMENT_TYPES.BAN]: {
        label: "Блокировка",
        shortLabel: "Бан",
        upperLabel: "БАН",
        color: 0xed4245,
        emoji: "🚫"
    },
    [PUNISHMENT_TYPES.WARN]: {
        label: "Предупреждение",
        shortLabel: "Варн",
        upperLabel: "ВАРН",
        color: 0xfee75c,
        emoji: "⚠️"
    },
    [PUNISHMENT_TYPES.WARN_BAN]: {
        label: "Предупреждение + Блокировка",
        shortLabel: "Варн + Бан",
        upperLabel: "ВАРН + БАН",
        color: 0xe67e22,
        emoji: " "
    },
    [PUNISHMENT_TYPES.AJAIL]: {
        label: "Деморган",
        shortLabel: "Деморган",
        upperLabel: "ДЕМОРГАН",
        color: 0x5865f2,
        emoji: " "
    },
    [PUNISHMENT_TYPES.CLEAR_ITEMS]: {
        label: "Изъятие предметов",
        shortLabel: "Изъятие",
        upperLabel: "ИЗЪЯТИЕ",
        color: 0x95a5a6,
        emoji: " "
    }
};

export function formatPunishment(type: PunishmentType, format: 'label' | 'shortLabel' | 'upperLabel' = 'label'): string {
    return PUNISHMENT_INFO[type]?.[format] || type;
}