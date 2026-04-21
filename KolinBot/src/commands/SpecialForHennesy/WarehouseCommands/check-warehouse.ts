import { 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    SlashCommandBuilder, 
    AttachmentBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ComponentType,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    ModalSubmitInteraction,
    ButtonInteraction
} from 'discord.js';
import axios from 'axios';
import { addLog, getAdminSurname } from '../../../databases/sqlite';
import { PUNISHMENT_TYPES, PunishmentType } from '../../../utils/constants/punishments';
import { FRACTION_TYPES, FRACTION_INFO, FractionType } from '../../../utils/constants/fractions';

const FRACTION_GROUPS = {
    MAFIA: [FRACTION_TYPES.MM, FRACTION_TYPES.RM, FRACTION_TYPES.LCN, FRACTION_TYPES.YAK, FRACTION_TYPES.AM] as FractionType[],
    GANG: [FRACTION_TYPES.FAM, FRACTION_TYPES.LSV, FRACTION_TYPES.ESB, FRACTION_TYPES.MG, FRACTION_TYPES.BSG] as FractionType[],
    STATE: [FRACTION_TYPES.LSPD, FRACTION_TYPES.LSSD, FRACTION_TYPES.FIB, FRACTION_TYPES.GOV, FRACTION_TYPES.ARMY, FRACTION_TYPES.SASPA] as FractionType[]
};

const WEBHOOK_URLS = {
    MAFIA: process.env.REPORT_WEBHOOK_MAFIA || process.env.REPORT_WEBHOOK_URL || "",
    GANG: process.env.REPORT_WEBHOOK_GANG || "",
    STATE: process.env.REPORT_WEBHOOK_STATE || "",
    DEFAULT: ""
};

const WEBHOOK_AVATARS = {
    MAFIA: "https://cdn.discordapp.com/avatars/939953853527392286/a_380cd7c3a53eecfea5a3e20d2267ae36.gif",
    GANG: "https://cdn.discordapp.com/avatars/939953853527392286/a_380cd7c3a53eecfea5a3e20d2267ae36.gif",
    STATE: "https://cdn.discordapp.com/avatars/939953853527392286/a_380cd7c3a53eecfea5a3e20d2267ae36.gif",
    DEFAULT: undefined
};

const LOCATION_NAMES: Record<string, string> = {
    houses: "Дома/квартиры",
    personalCars: "Личный транспорт",
    fractionCars: "Фракционный транспорт",
    familyWarehouse: "Склад офиса/особняка",
    camper: "Кемпер"
};

const GROUP_COLORS: Record<string, number> = {
    MAFIA: 0x8B0000,
    GANG: 0x800080,
    STATE: 0x00008B,
    DEFAULT: 0x2B2D31
};

interface LogEntry {
    datetime: Date;
    rawDate: string;
    rawTime: string;
    type: string;
    action: string;
    item: string;
    count: number;
    soldCount?: number;
    money?: number;
    operation: 'take' | 'put' | 'craft' | 'sell' | 'trade_in' | 'trade_out';
    location: string;
}

interface StorageBalance {
    [item: string]: number;
}

interface WeaponStorage {
    [weaponId: string]: { 
        count: number;
        baseName: string;   
    };
}

interface PersonalStorageDetailed {
    houses: WeaponStorage;
    personalCars: WeaponStorage;
    fractionCars: WeaponStorage;
    familyWarehouse: WeaponStorage;
    camper: WeaponStorage;
}

interface PersonalStorage {
    houses: StorageBalance;
    personalCars: StorageBalance;
    fractionCars: StorageBalance;
    familyWarehouse: StorageBalance;
    camper: StorageBalance;
}

interface SaleDetail {
    item: string;
    count: number;
    money: number;
}

interface AnalysisResult {
    takenFromFaction: StorageBalance;
    soldFromFaction: StorageBalance;
    soldFromFactionDetails: SaleDetail[];
    remainingInPersonal: StorageBalance;
    remainingByLocation: PersonalStorage;
    totalEarnings: number;
    hasViolation: boolean;
}

export const data = new SlashCommandBuilder()
    .setName("проверить-склад")
    .setDescription("Анализ логов и фиксация нарушения")
    .addAttachmentOption(option => option.setName("лог-файл").setDescription("Файл логов").setRequired(true))
    .addStringOption(option => option.setName("фракция").setDescription("Фракция игрока").setRequired(true)
        .addChoices(
            { name: "Мексиканская мафия", value: FRACTION_TYPES.MM },
            { name: "Русская мафия", value: FRACTION_TYPES.RM },
            { name: "Итальянская мафия", value: FRACTION_TYPES.LCN },
            { name: "Японская мафия", value: FRACTION_TYPES.YAK },
            { name: "Армянская мафия", value: FRACTION_TYPES.AM },
            { name: "LSPD", value: FRACTION_TYPES.LSPD },
            { name: "LSSD", value: FRACTION_TYPES.LSSD },
            { name: "FIB", value: FRACTION_TYPES.FIB },
            { name: "GOV", value: FRACTION_TYPES.GOV },
            { name: "ARMY", value: FRACTION_TYPES.ARMY },
            { name: "SASPA", value: FRACTION_TYPES.SASPA },
            { name: "The Families", value: FRACTION_TYPES.FAM },
            { name: "Los Santos Vagos", value: FRACTION_TYPES.LSV },
            { name: "East Side Ballas", value: FRACTION_TYPES.ESB },
            { name: "Marabunta Grande", value: FRACTION_TYPES.MG },
            { name: "Bloods Street Gang", value: FRACTION_TYPES.BSG }
        )
    );

export async function execute(inter: ChatInputCommandInteraction) {
    const adminDisplayName = getAdminDisplayName(inter);
    const adminSurname = getAdminSurname(inter.user.id);
    
    if (!adminSurname) {
        return inter.reply({ content: "Вы не зарегистрированы!", flags: [MessageFlags.Ephemeral] });
    }

    await inter.deferReply();

    const fraction = inter.options.getString("фракция") as FractionType;
    const attachment = inter.options.getAttachment("лог-файл")!;

    try {
        const response = await axios.get(attachment.url, { responseType: 'text' });
        const fileContent = response.data;

        const statick = extractStatick(fileContent);
        if (!statick) {
            return inter.editReply("❌ Не удалось найти статик в файле.");
        }

        const analysis = analyzeLogs(fileContent);
        const report = generateReport(statick, fraction, analysis);

        const embed = createReportEmbed(statick, fraction, analysis, report);
        const files = createReportFile(report, statick);
        const row = createActionRow(analysis.hasViolation);

        const message = await inter.editReply({ embeds: [embed], components: row ? [row] : [], files });

        if (!analysis.hasViolation) return;

        await handlePunishmentFlow(message, inter.user.id, statick, fraction, adminSurname, adminDisplayName, analysis, report, fileContent);

    } catch (e) {
        console.error(e);
        await inter.editReply("❌ Ошибка при чтении файла.");
    }
}

function getAdminDisplayName(inter: ChatInputCommandInteraction): string {
    const member = inter.guild?.members.cache.get(inter.user.id);
    return member?.nickname || inter.user.globalName || inter.user.displayName || inter.user.username;
}

function extractStatick(fileContent: string): string | null {
    const firstLine = fileContent.split('\n')[0];
    const staticMatch = firstLine.match(/\[(\d+)\]/);
    return staticMatch ? staticMatch[1] : null;
}

function createReportEmbed(statick: string, fraction: FractionType, analysis: AnalysisResult, report: string): EmbedBuilder {
    const isTooLong = report.length > 1800;
    return new EmbedBuilder()
        .setTitle(`🔍 Результаты проверки: #${statick}`)
        .setColor(analysis.hasViolation ? 0xFF4444 : 0x44FF44)
        .setDescription(isTooLong ? "📄 Полный отчет прикреплен файлом ниже." : `\`\`\`\n${report}\n\`\`\``)
        .setFooter({ text: analysis.hasViolation ? "⚠️ Обнаружено нарушение!" : "✅ Нарушений не обнаружено" });
}

function createReportFile(report: string, statick: string): AttachmentBuilder[] {
    if (report.length <= 1800) return [];
    return [new AttachmentBuilder(Buffer.from(report, 'utf-8'), { name: `report_${statick}.txt` })];
}

function createActionRow(hasViolation: boolean): ActionRowBuilder<ButtonBuilder> | null {
    if (!hasViolation) return null;
    
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_violation').setLabel('Зафиксировать нарушение').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('btn_ok').setLabel('Нарушений нет').setStyle(ButtonStyle.Secondary)
    );
}

async function handlePunishmentFlow(
    message: any,
    userId: string,
    statick: string,
    fraction: FractionType,
    adminSurname: string,
    adminDisplayName: string,
    analysis: AnalysisResult,
    report: string,
    fileContent: string
): Promise<void> {
    let isProcessed = false;
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 600000 });

    collector.on('collect', async (btnInter: ButtonInteraction) => {
        if (btnInter.user.id !== userId) {
            return btnInter.reply({ content: "Не ваш лог!", flags: [MessageFlags.Ephemeral] });
        }

        if (isProcessed) {
            return btnInter.reply({ content: "Нарушение уже обработано!", flags: [MessageFlags.Ephemeral] });
        }

        if (btnInter.customId === 'btn_ok') {
            isProcessed = true;
            collector.stop();
            await btnInter.update({ content: "✅ Проверка завершена: Чисто.", embeds: [], components: [], files: [] });
            return;
        }

        if (btnInter.customId === 'btn_violation') {
            isProcessed = true;
            collector.stop();
            await btnInter.update({ components: [] });
            await showPunishmentModal(btnInter, statick, fraction, adminSurname, adminDisplayName, analysis, report, fileContent);
        }
    });
}

function getFractionGroup(fraction: FractionType): keyof typeof FRACTION_GROUPS | 'DEFAULT' {
    for (const [group, fractions] of Object.entries(FRACTION_GROUPS)) {
        if (fractions.includes(fraction)) {
            return group as keyof typeof FRACTION_GROUPS;
        }
    }
    return 'DEFAULT';
}

function getWebhookConfig(fraction: FractionType) {
    const group = getFractionGroup(fraction);
    
    let webhookUrl = WEBHOOK_URLS[group] || WEBHOOK_URLS.DEFAULT;
    const avatarUrl = WEBHOOK_AVATARS[group] || WEBHOOK_AVATARS.DEFAULT;
    const color = GROUP_COLORS[group] || GROUP_COLORS.DEFAULT;
    
    if (!webhookUrl) {
        webhookUrl = "";
    }
    
    return { webhookUrl, avatarUrl, color, group };
}

const ITEM_MAP: Record<string, string> = {
    '62mm': '7.62mm', 
    '56mm': '5.56mm', 
    '43mm': '11.43mm', 
    '11.43mm': '11.43mm', 
    '12mm': '12mm',
    '7.62': '7.62mm',
    '5.56': '5.56mm',
    'аптечка': 'Аптечка', 
    'аптечка пп': 'Аптечка ПП', 
    'аптечка ems': 'Аптечка EMS',
    'бинты': 'Бинты', 
    'анальгетик': 'Анальгетик',
    'боевой стимулятор': 'Боевой стимулятор', 
    'броня': 'Броня', 
    'бургер': 'Бургер', 
    'пицца': 'Пицца',
    'рагу': 'Рагу', 
    'овощной салат': 'Овощной салат', 
    'овощной смузи': 'Овощной смузи', 
    'кола': 'Кола',
    'спанк': 'SPANK', 
    'spank': 'SPANK', 
    'косяк': 'Косяк', 
    'стаб-пак': 'Стаб-пак', 
    'пак': 'Стаб-пак',
    'материалы': 'Материалы', 
    'ремонтный набор': 'Ремонтный набор', 
    'канистра с бензином': 'Канистра с бензином',
    'набор для костра': 'Набор для костра', 
    'палатка': 'Палатка', 
    'бумбокс': 'Бумбокс', 
    'записка': 'Записка',
    'фонарик': 'Фонарик', 
    'бита': 'Бита', 
    'резиновая дубинка': 'Резиновая дубинка',
    'пистолет': 'Пистолет', 
    'тяжелый пистолет': 'Тяжелый пистолет', 
    'кольт': 'Кольт', 
    'револьвер': 'Револьвер',
    'старинный пистолет': 'Старинный пистолет', 
    'ap пистолет': 'AP пистолет',
    'pump shotgun': 'Pump Shotgun', 
    'pump shothun': 'Pump Shotgun', 
    'pump shotgun mk2': 'Pump Shotgun MK2',
    'combat shotgun': 'Combat Shotgun', 
    'assault shotgun': 'Assault Shotgun', 
    'heavy shotgun': 'Heavy Shotgun',
    'tactical smg': 'Tactical SMG', 
    'assault smg': 'Assault SMG', 
    'micro smg': 'Micro SMG',
    'smg': 'SMG', 
    'smg-mk2': 'SMG-MK2', 
    'carbine rifle': 'Carbine Rifle', 
    'service carbine': 'Service Carbine',
    'battle rifle': 'Battle Rifle', 
    'military rifle': 'Military Rifle', 
    'compact rifle': 'Compact Rifle',
    'gusenberg sweeper': 'Gusenberg Sweeper', 
    'тазер': 'Тазер', 
    'сигнальная ракетница': 'Сигнальная ракетница',
    'дымовой гранатомет': 'Дымовой гранатомет', 
    'коктейль молотова': 'Коктейль Молотова',
    'обрез': 'Обрез', 
    'special rifle': 'Special Rifle', 
    'assault rifle': 'Assault Rifle',
    'специальная винтовка': 'Special Rifle',
    'штурмовая винтовка': 'Assault Rifle',
    'карабин': 'Carbine Rifle',
};

function parseDateTime(dateStr: string, timeStr: string): Date {
    const [day, month, year] = dateStr.split('.');
    const [hours, minutes, seconds] = timeStr.split(':');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
}

function extractItemAndCount(action: string, showWeaponNumbers: boolean = true): { item: string | null; count: number } {
    let count = 0;
    
    const xCountMatch = action.match(/\(x(\d+)\)/i);
    const shtCountMatch = action.match(/(\d+)\s*шт/i);
    const colonCountMatch = action.match(/:\s*.*?(\d+)\s*шт/i);
    
    if (xCountMatch) {
        count = parseInt(xCountMatch[1]);
    } else if (shtCountMatch) {
        count = parseInt(shtCountMatch[1]);
    } else if (colonCountMatch) {
        count = parseInt(colonCountMatch[1]);
    }
    
    if (count === 0) return { item: null, count: 0 };
    
    const colonMatch = action.match(/:\s*([А-Яа-яA-Za-z0-9.\s]+?)(?:\s*\(\d+%\))?\s+\d+\s*шт/i);
    if (colonMatch?.[1]) {
        let itemName = colonMatch[1].trim();
        itemName = itemName.replace(/\s*\(\d+%\)/g, '').replace(/\s*\(x\d+\)/gi, '').trim();
        return { item: normalizeItemName(itemName, showWeaponNumbers), count };
    }
    
    const weaponMatch = action.match(/([А-Яа-яA-Za-z\s]+)\s*\(([A-Z0-9]+)\)/i);
    if (weaponMatch) {
        const weaponName = weaponMatch[1].trim();
        const weaponNumber = weaponMatch[2];
        return { item: normalizeItemName(`${weaponName} (${weaponNumber})`, showWeaponNumbers), count };
    }
    
    const ammoMatch = action.match(/(\d+\.?\d*\s*mm)/i);
    if (ammoMatch?.[1]) {
        let ammo = ammoMatch[1].replace(/\s+/g, '');
        if (!ammo.includes('mm')) ammo += 'mm';
        return { item: normalizeItemName(ammo, showWeaponNumbers), count };
    }
    
    const afterVerbMatch = action.match(/(?:Кладет|Берет|Забрал|Положил|положил|забрал|кладет|берет)\s+(.+?)(?:\s*\(x\d+\)|\s+\d+\s*шт|$)/i);
    if (afterVerbMatch?.[1]) {
        let itemPart = afterVerbMatch[1].trim();
        
        itemPart = itemPart.replace(/\s*\(x\d+\)/gi, '').replace(/\s*\(\d+%\)/g, '').trim();
        itemPart = itemPart.split(/\s+(?:на|в|из|со|—)/i)[0].trim();
        
        const ammoInPart = itemPart.match(/(\d+\.?\d*\s*mm)/i);
        if (ammoInPart?.[1]) {
            let ammo = ammoInPart[1].replace(/\s+/g, '');
            if (!ammo.includes('mm')) ammo += 'mm';
            return { item: normalizeItemName(ammo, showWeaponNumbers), count };
        }
        
        itemPart = itemPart.replace(/\s*\([^)]*\)/g, '').trim();
        
        if (itemPart.length >= 2) {
            return { item: normalizeItemName(itemPart, showWeaponNumbers), count };
        }
    }
    
    return { item: null, count: 0 };
}

function normalizeItemName(rawName: string, showWeaponNumbers: boolean = true): string {
    let normalized = rawName.trim().replace(/\s+/g, ' ').trim();
    
    normalized = normalized.replace(/\s*\(x\d+\)/gi, '').trim();
    
    if (normalized.toLowerCase() === 'mm') {
        return '7.62mm';
    }
    
    const ammoPattern = /^(\d+\.?\d*)\s*mm$/i;
    const ammoMatch = normalized.match(ammoPattern);
    if (ammoMatch) {
        return `${ammoMatch[1]}mm`;
    }
    
    const weaponWithNumberMatch = normalized.match(/^([А-Яа-яA-Za-z\s]+)\s*\(([A-Z0-9]+)\)$/i);
    if (weaponWithNumberMatch) {
        const weaponName = weaponWithNumberMatch[1].trim();
        const weaponNumber = weaponWithNumberMatch[2];
        const lowerWeapon = weaponName.toLowerCase();
        
        for (const [key, value] of Object.entries(ITEM_MAP)) {
            if (lowerWeapon.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerWeapon)) {
                return showWeaponNumbers ? `${value} (${weaponNumber})` : value;
            }
        }
        
        const normalizedWeapon = weaponName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        return showWeaponNumbers ? `${normalizedWeapon} (${weaponNumber})` : normalizedWeapon;
    }
    
    const lowerRaw = normalized.toLowerCase();
    for (const [key, value] of Object.entries(ITEM_MAP)) {
        if (lowerRaw === key.toLowerCase() || lowerRaw.includes(key.toLowerCase())) {
            return value;
        }
    }
    
    if (lowerRaw.includes('аптечка')) {
        if (lowerRaw.includes('пп')) return 'Аптечка ПП';
        if (lowerRaw.includes('ems')) return 'Аптечка EMS';
        return 'Аптечка';
    }
    
    if (lowerRaw.includes('стаб')) {
        return 'Стаб-пак';
    }
    
    if (!showWeaponNumbers) {
        normalized = normalized.replace(/\s*\([A-Z0-9]+\)/gi, '');
    }
    
    return normalized;
}

function isFactionSource(location: string, type: string): boolean {
    const lowerType = type.toLowerCase();
    if (location === 'faction_storage') return true;
    if (location === 'fraction_car') return true;
    if (lowerType.includes("фракционный бот") ||
        lowerType.includes("фракционный склад") ||
        lowerType.includes("фракционный транспорт")) {
        return true;
    }
    return false;
}

function parseLogEntry(line: string, showWeaponNumbers: boolean = true): LogEntry | null {
    const parts = line.split('","').map(s => s.replace(/"/g, ''));
    if (parts.length < 3) return null;

    const [rawDateTime, type, action] = parts;
    const [rawDate, rawTime] = rawDateTime.split(', ');
    
    const lowerType = type.toLowerCase();
    const lowerAction = action.toLowerCase();
    
    if (lowerType.includes("крафт")) {
        const { item, count } = extractItemAndCount(action, showWeaponNumbers);
        if (!item) return null;
        return {
            datetime: parseDateTime(rawDate, rawTime),
            rawDate, rawTime, type, action,
            item, count,
            operation: 'craft',
            location: 'craft'
        };
    }
    
    if (lowerType.includes("darkvito")) {
        const itemMatch = action.match(/: ([0-9.]+mm|[А-Яа-яA-Za-z\s]+)/i);
        if (!itemMatch) return null;
        
        const itemName = normalizeItemName(itemMatch[1], showWeaponNumbers);
        const soldMatch = action.match(/Продал\s+(\d+)\s+шт/i);
        let soldCount = soldMatch ? parseInt(soldMatch[1]) : 0;
        
        if (soldCount === 0) {
            const countInLotMatch = action.match(/: [0-9.]+mm — (\d+)\s+шт/i);
            if (countInLotMatch) soldCount = parseInt(countInLotMatch[1]);
        }
        
        const moneyMatch = action.match(/\$([\d,]+)/);
        const money = moneyMatch ? parseInt(moneyMatch[1].replace(/,/g, '')) : 0;
        
        return {
            datetime: parseDateTime(rawDate, rawTime),
            rawDate, rawTime, type, action,
            item: itemName,
            count: soldCount,
            soldCount,
            money,
            operation: 'sell',
            location: 'darkvito'
        };
    }
    
    if (lowerType.includes("трейд")) return null;
    
    let location = 'unknown';
    if (lowerType === "фракционный транспорт") {
        location = 'fraction_car';
    }
    else if (lowerType.includes("фракционный склад") || lowerType.includes("фракционный бот")) {
        location = 'faction_storage';
    }
    else if (lowerType === "семья" && /склад\s+(офиса|особняка)/i.test(lowerAction)) {
        location = 'family_warehouse';
    }
    else if (lowerType === "транспорт" && !lowerAction.includes("кемпер")) {
        location = 'personal_car';
    }
    else if (lowerType.includes("кемпер") || lowerType.includes("camper") || (lowerType === "транспорт" && lowerAction.includes("кемпер"))) {
        location = 'camper';
    }
    else if (lowerType.includes("квартир") || lowerType === "квартира" || (lowerType.includes("дом") && !lowerAction.includes("особняк"))) {
        location = 'house';
    }
    else {
        return null;
    }
    
    let operation: 'take' | 'put' = 'take';
    if (/забрал|берет|получил/i.test(action)) {
        operation = 'take';
    } else if (/положил|кладет/i.test(action)) {
        operation = 'put';
    } else {
        return null;
    }
    
    const { item, count } = extractItemAndCount(action, showWeaponNumbers);
    if (!item || count === 0) return null;
    
    return {
        datetime: parseDateTime(rawDate, rawTime),
        rawDate, rawTime, type, action,
        item, count,
        operation, location
    };
}

function analyzeLogs(data: string, showWeaponNumbers: boolean = true): AnalysisResult {
    const lines = data.split('\n').map(l => l.trim()).filter(l => l.includes('","'));
    
    const entries: LogEntry[] = [];
    for (const line of lines) {
        const entry = parseLogEntry(line, showWeaponNumbers);
        if (entry) entries.push(entry);
    }
    
    entries.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
    
    const factionInventory: Map<string, number> = new Map();
    const totalTakenFromFaction: Map<string, number> = new Map();
    const totalReturnedToFaction: Map<string, number> = new Map();
    const soldFromFaction: Map<string, number> = new Map();
    
    const remainingByLocation: PersonalStorage = {
        houses: {},
        personalCars: {},
        fractionCars: {},
        familyWarehouse: {},
        camper: {}
    };
    
    const soldFromFactionDetails: SaleDetail[] = [];
    let totalEarnings = 0;
    
    const updateBalance = (balance: Map<string, number> | StorageBalance, item: string, delta: number): void => {
        if (balance instanceof Map) {
            const newVal = (balance.get(item) || 0) + delta;
            if (Math.abs(newVal) < 0.1) {
                balance.delete(item);
            } else {
                balance.set(item, newVal);
            }
        } else {
            const newVal = (balance[item] || 0) + delta;
            if (Math.abs(newVal) < 0.1) {
                delete balance[item];
            } else {
                balance[item] = newVal;
            }
        }
    };
    
    const getBalance = (balance: Map<string, number> | StorageBalance, item: string): number => {
        if (balance instanceof Map) {
            return balance.get(item) || 0;
        }
        return balance[item] || 0;
    };
    
    for (const entry of entries) {
        const { item, count, operation, location, money, type } = entry;
        
        if (operation === 'sell') {
            totalEarnings += money || 0;
            const available = getBalance(factionInventory, item);
            if (available > 0) {
                const soldAmount = Math.min(count, available);
                updateBalance(factionInventory, item, -soldAmount);
                updateBalance(soldFromFaction, item, soldAmount);
                soldFromFactionDetails.push({ item, count: soldAmount, money: money || 0 });
            }
            continue;
        }
        
        const isFromFaction = operation === 'take' && isFactionSource(location, type);
        const isToFaction = operation === 'put' && isFactionSource(location, type);
        
        if (isFromFaction) {
            updateBalance(factionInventory, item, count);
            updateBalance(totalTakenFromFaction, item, count);
        }
        
        if (isToFaction) {
            const available = getBalance(factionInventory, item);
            const returned = Math.min(count, available);
            updateBalance(factionInventory, item, -returned);
            updateBalance(totalReturnedToFaction, item, returned);
        }
        
        if (operation === 'put' && !isToFaction && location !== 'craft') {
    const locationMap: Record<string, keyof PersonalStorage> = {
        'house': 'houses',
        'personal_car': 'personalCars',
        'camper': 'camper',
        'family_warehouse': 'familyWarehouse'
    };
    
    const targetLocation = locationMap[location];
    if (targetLocation) {
        const available = getBalance(factionInventory, item);
        if (available > 0) {
            const movedAmount = Math.min(count, available);
            updateBalance(remainingByLocation[targetLocation], item, movedAmount);
            updateBalance(factionInventory, item, -movedAmount);
        }
    }
}
        
        if (operation === 'take' && !isFromFaction && location !== 'craft') {
            const locationMap: Record<string, keyof PersonalStorage> = {
                'house': 'houses',
                'personal_car': 'personalCars',
                'camper': 'camper',
                'family_warehouse': 'familyWarehouse'
            };
            
            const sourceLocation = locationMap[location];
            if (sourceLocation) {
                const available = getBalance(remainingByLocation[sourceLocation], item);
                const takenAmount = Math.min(count, available);
                if (takenAmount > 0) {
                    updateBalance(remainingByLocation[sourceLocation], item, -takenAmount);
                }
            }
        }
    }
    
    const remainingInPersonal: StorageBalance = {};
    for (const balance of Object.values(remainingByLocation)) {
        for (const [item, count] of Object.entries(balance)) {
            if ((count as number) > 0) {
                remainingInPersonal[item] = (remainingInPersonal[item] || 0) + (count as number);
            }
        }
    }
    
    const takenFromFactionObj: StorageBalance = {};
    for (const [item, count] of totalTakenFromFaction.entries()) {
        const returned = totalReturnedToFaction.get(item) || 0;
        if (count - returned > 0) {
            takenFromFactionObj[item] = count - returned;
        }
    }
    
    const soldFromFactionObj: StorageBalance = {};
    for (const [item, count] of soldFromFaction.entries()) {
        soldFromFactionObj[item] = count;
    }
    
    const hasViolation = Object.keys(remainingInPersonal).length > 0 || Object.keys(soldFromFactionObj).length > 0;
    
    return {
        takenFromFaction: takenFromFactionObj,
        soldFromFaction: soldFromFactionObj,
        soldFromFactionDetails,
        remainingInPersonal,
        remainingByLocation,
        totalEarnings,
        hasViolation
    };
}

function formatBalance(title: string, balance: StorageBalance, indent: string = "  "): string {
    const entries = Object.entries(balance).filter(([, count]) => count > 0);
    if (entries.length === 0) return "";
    
    entries.sort((a, b) => b[1] - a[1]);
    
    let result = `[${title}]\n`;
    for (const [name, count] of entries) {
        result += `${indent}${name}: ${count.toLocaleString()} шт.\n`;
    }
    return result + "\n";
}

function generateReport(statick: string, fraction: FractionType, analysis: AnalysisResult): string {
    let report = `═══ ОТЧЕТ ПО СКЛАДУ (#${statick}) ═══\n`;
    report += `Фракция: ${FRACTION_INFO[fraction]?.label || fraction}\n\n`;
    report += `Период: ${new Date().toLocaleDateString()}\n`;
    report += `${"─".repeat(50)}\n\n`;
    
    if (Object.keys(analysis.takenFromFaction).length > 0) {
        report += formatBalance("ВЗЯТО СО СКЛАДА", analysis.takenFromFaction);
    } else {
        report += `[ВЗЯТО СО СКЛАДА]\n  Нет данных\n\n`;
    }
    
    if (analysis.soldFromFactionDetails.length > 0) {
        report += `[ПРОДАНО ЧЕРЕЗ DARKVITO]\n`;
        const soldSummary: StorageBalance = {};
        let totalMoney = 0;
        
        for (const sale of analysis.soldFromFactionDetails) {
            soldSummary[sale.item] = (soldSummary[sale.item] || 0) + sale.count;
            totalMoney += sale.money;
        }
        
        for (const [item, count] of Object.entries(soldSummary)) {
            report += `  ${item}: ${count.toLocaleString()} шт.\n`;
        }
        report += `\n  Выручка: $${totalMoney.toLocaleString()}\n`;
    }
    
    let hasRemaining = false;
    const familyWarehouseItems = Object.entries(analysis.remainingByLocation.familyWarehouse)
        .filter(([, count]) => count > 0);

    if (familyWarehouseItems.length > 0) {
        if (!hasRemaining) {
            report += `[ОСТАТКИ В ЛИЧНОМ ИМУЩЕСТВЕ]\n`;
            hasRemaining = true;
        }
        report += `\n  ${LOCATION_NAMES.familyWarehouse}:\n`;
        familyWarehouseItems.sort((a, b) => b[1] - a[1]);
        for (const [item, count] of familyWarehouseItems) {
            report += `    ${item}: ${count.toLocaleString()} шт.\n`;
        }
    }

    for (const [location, balance] of Object.entries(analysis.remainingByLocation)) {
        if (location === 'familyWarehouse') continue;
        
        const positiveEntries = (Object.entries(balance) as [string, number][]).filter(([, count]) => count > 0);
        if (positiveEntries.length > 0) {
            if (!hasRemaining) {
                report += `[ОСТАТКИ В ЛИЧНОМ ИМУЩЕСТВЕ]\n`;
                hasRemaining = true;
            }
            report += `\n  ${LOCATION_NAMES[location] || location}:\n`;
            positiveEntries.sort((a, b) => b[1] - a[1]);
            for (const [item, count] of positiveEntries) {
                report += `    ${item}: ${count.toLocaleString()} шт.\n`;
            }
        }
    }
    
    if (!hasRemaining && Object.keys(analysis.soldFromFaction).length === 0) {
        report += `[ОСТАТКИ В ЛИЧНОМ ИМУЩЕСТВЕ]\n  Нет данных\n\n`;
    } else if (!hasRemaining) {
        report += `\n`;
    }
    
    report += `\n${"─".repeat(50)}\n`;
    report += `[ИТОГО СЛИТО]\n`;
    
    const totalLeaked: StorageBalance = { ...analysis.remainingInPersonal };
    for (const [item, count] of Object.entries(analysis.soldFromFaction)) {
        totalLeaked[item] = (totalLeaked[item] || 0) + count;
    }
    
    if (Object.keys(totalLeaked).length > 0) {
        for (const [item, count] of Object.entries(totalLeaked)) {
            report += `  ${item}: ${count.toLocaleString()} шт.\n`;
        }
    } else {
        report += `  Нет нарушений\n`;
    }
    
    report += `\n${"─".repeat(50)}\n`;
    return report;
}

async function sendReportToWebhook(
    adminName: string,
    statick: string,
    fraction: FractionType,
    punishmentType: string,
    punishmentDuration: string,
    analysis: AnalysisResult,
    showWeaponNumbers: boolean = true
): Promise<void> {
    const { webhookUrl, avatarUrl, color, group } = getWebhookConfig(fraction);
    
    if (!webhookUrl) {
        return;
    }

    const totalLeaked: StorageBalance = { ...analysis.remainingInPersonal };
    for (const [item, count] of Object.entries(analysis.soldFromFaction)) {
        totalLeaked[item] = (totalLeaked[item] || 0) + count;
    }
    
    const stolenLines = Object.entries(totalLeaked)
        .map(([item, count]) => `  ${item}: ${count.toLocaleString()} шт.`);
    const stolenText = stolenLines.join("\n") || "  нет";
    
    let remainingText = "";
    for (const [place, data] of Object.entries(analysis.remainingByLocation)) {
        const positiveEntries = (Object.entries(data) as [string, number][]).filter(([, count]) => count > 0);
        if (positiveEntries.length > 0) {
            remainingText += `\n${LOCATION_NAMES[place] || place}:\n`;
            for (const [item, count] of positiveEntries) {
                remainingText += `  ${item}: ${count.toLocaleString()} шт.\n`;
            }
        }
    }
    
    const hasSales = Object.keys(analysis.soldFromFaction).length > 0;
    let soldText = "";
    if (hasSales) {
        const soldLines = Object.entries(analysis.soldFromFaction)
            .map(([item, count]) => `  ${item}: ${count.toLocaleString()} шт.`);
        soldText = `\n\nПродано через DarkVito:\n${soldLines.join("\n")}`;
        soldText += `\n\nВыручка: $${analysis.totalEarnings.toLocaleString()}`;
        soldText += `\n\n<@478169919783960577>\nОбнулить ${statick} на ${analysis.totalEarnings}\nПричина: Слив склада фракции ${FRACTION_INFO[fraction]?.label}`;
    }
    
    let codeContent = `Админ: ${adminName}\n`;
    codeContent += `Статик: ${statick}\n`;
    codeContent += `Фракция: ${FRACTION_INFO[fraction]?.label || fraction}\n`;
    codeContent += `Группа: ${group}\n`;
    codeContent += `Наказание: ${punishmentType}${punishmentDuration ? ` (${punishmentDuration})` : ""}\n`;
    codeContent += `\n${"─".repeat(50)}\n\n`;
    codeContent += `Слито (не возвращено на склад):\n${stolenText}\n`;
    
    if (remainingText) {
        codeContent += `\n${"─".repeat(50)}\n`;
        codeContent += `ДЕТАЛИЗАЦИЯ ПО МЕСТАМ:${remainingText}\n`;
    }
    
    if (soldText) {
        codeContent += `\n${"─".repeat(50)}${soldText}\n`;
    }
    
    codeContent += `\n${"─".repeat(50)}\n`;
    codeContent += `ID: ${statick}`;
    
    const embed = {
        title: `Слив склада [${group}]`,
        color,
        description: `\`\`\`\n${codeContent}\n\`\`\``,
        footer: { text: `Зафиксировано: ${new Date().toLocaleString()}` }
    };
    
    try {
        await axios.post(webhookUrl, {
            embeds: [embed],
            username: `Складской Контроль - ${group}`,
            ...(avatarUrl && { avatar_url: avatarUrl })
        });
    } catch (error) {
        console.error(`Ошибка отправки в вебхук для группы ${group}:`, error);
    }
}

const PUNISHMENT_CONFIG = {
    iban: { type: PUNISHMENT_TYPES.IBAN, name: "IBAN", needsDuration: false },
    warnban: { type: PUNISHMENT_TYPES.WARN_BAN, name: "Бан + Варн", needsDuration: true, durationUnit: "дн." },
    ban: { type: PUNISHMENT_TYPES.BAN, name: "Бан", needsDuration: true, durationUnit: "дн." },
    warn: { type: PUNISHMENT_TYPES.WARN, name: "Варн", needsDuration: false },
    jail: { type: PUNISHMENT_TYPES.AJAIL, name: "Деморган", needsDuration: true, durationUnit: "мин." },
    curator: { type: PUNISHMENT_TYPES.WARN, name: "Выговор от куратора", needsDuration: false, isCuratorReprimand: true }
};

async function showPunishmentModal(
    btnInter: ButtonInteraction,
    statick: string,
    fraction: FractionType,
    adminSurname: string,
    adminDisplayName: string,
    analysis: AnalysisResult,
    report: string,
    fileContent: string
): Promise<void> {
    const isStateFraction = FRACTION_GROUPS.STATE.includes(fraction);

    const selectOptions = [
        { label: 'Бан', description: 'Обычный бан аккаунта', value: 'ban' },
        { label: 'IBAN', description: 'Перманентный бан', value: 'iban' },
        { label: 'Варн', description: 'Предупреждение', value: 'warn' },
        { label: 'Бан + Варн', description: 'Бан и предупреждение одновременно', value: 'warnban' },
        { label: 'Деморган', description: 'Деморган', value: 'jail' }
    ];

    if (isStateFraction) {
        selectOptions.push({ 
            label: 'Выговор от куратора', 
            description: 'Предупреждение с требованием вернуть имущество', 
            value: 'curator' 
        });
    }

    const punishmentSelect = new StringSelectMenuBuilder()
        .setCustomId('punish_type_select')
        .setPlaceholder('Выберите тип наказания')
        .addOptions(selectOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(punishmentSelect);

    const selectMsg = await btnInter.followUp({
        content: `**Выберите тип наказания для #${statick}**\nФракция: ${FRACTION_INFO[fraction]?.label || fraction}`,
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    const collector = selectMsg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000
    });

    collector.on('collect', async (selectInter: StringSelectMenuInteraction) => {
        if (selectInter.user.id !== btnInter.user.id) {
            return selectInter.reply({ content: "Не ваше меню!", flags: [MessageFlags.Ephemeral] });
        }

        const punishmentType = selectInter.values[0];
        const config = PUNISHMENT_CONFIG[punishmentType as keyof typeof PUNISHMENT_CONFIG];
        
        if (!config.needsDuration) {
            await selectInter.update({ components: [] });
            await processPunishment(selectInter, statick, fraction, adminSurname, adminDisplayName, punishmentType, null, analysis, report, true);
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`duration_modal_${statick}_${punishmentType}`)
            .setTitle(`Срок наказания`);

        const durationInput = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel(punishmentType === 'jail' ? 'Срок в минутах' : 'Срок в днях')
            .setPlaceholder(punishmentType === 'jail' ? '100' : '30')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(3);

        const showNumbersInput = new TextInputBuilder()
            .setCustomId('show_numbers')
            .setLabel("Показывать номера оружия?")
            .setPlaceholder('да / нет (по умолчанию: да)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(showNumbersInput)
        );

        await selectInter.showModal(modal);

        const submitted = await selectInter.awaitModalSubmit({ time: 60000 }).catch(() => null);

        if (submitted) {
            const duration = submitted.fields.getTextInputValue('duration');
            const showNumbersRaw = submitted.fields.getTextInputValue('show_numbers').toLowerCase();
            const showWeaponNumbers = !showNumbersRaw.includes('нет');

            const newAnalysis = analyzeLogs(fileContent, showWeaponNumbers);
            const newReport = generateReport(statick, fraction, newAnalysis);
            
            await submitted.reply({ content: "⏳ Обработка...", flags: [MessageFlags.Ephemeral] });
            await processPunishment(submitted, statick, fraction, adminSurname, adminDisplayName, punishmentType, duration, newAnalysis, newReport, showWeaponNumbers);
            await selectMsg.delete().catch(() => {});
        }
    });
}

async function processPunishment(
    inter: StringSelectMenuInteraction | ModalSubmitInteraction,
    statick: string,
    fraction: FractionType,
    adminSurname: string,
    adminDisplayName: string,
    punishmentType: string,
    duration: string | null,
    analysis: AnalysisResult,
    report: string,
    showWeaponNumbers: boolean = true
): Promise<void> {
    const config = PUNISHMENT_CONFIG[punishmentType as keyof typeof PUNISHMENT_CONFIG];
    const fractionShort = fraction;
    
    let commandText = "";
    let durationText = "";
    let responseContent = "";

    if (punishmentType === 'curator') {
        const storageLocations: string[] = [];
        
        for (const [location, balance] of Object.entries(analysis.remainingByLocation) as [string, StorageBalance][]) {
            const items = (Object.entries(balance) as [string, number][]).filter(([, count]) => count > 0);
            if (items.length > 0) {
                storageLocations.push(LOCATION_NAMES[location] || location);
            }
        }
        
        const locationsText = storageLocations.length > 0 
            ? storageLocations.join(', ') 
            : 'неизвестном месте';
        
        let itemsToReturn = '';
        for (const [location, balance] of Object.entries(analysis.remainingByLocation) as [string, StorageBalance][]) {
            const items = (Object.entries(balance) as [string, number][]).filter(([, count]) => count > 0);
            if (items.length > 0) {
                itemsToReturn += `\n**${LOCATION_NAMES[location] || location}:**\n`;
                for (const [item, count] of items.sort((a, b) => b[1] - a[1])) {
                    itemsToReturn += `• ${item}: ${count.toLocaleString()} шт.\n`;
                }
            }
        }
        
        durationText = "Выговор";

        const curatorEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setDescription(
                `**УКАЖИТЕ ТУТ ДС ${statick}**\n` +
                `Хранение гос. имущества в: ${locationsText.toLocaleLowerCase()}\n\n` +
                `**Список того, что необходимо вернуть:**\n` +
                `${itemsToReturn}\n` +
                `**24 часа на то, чтобы сдать на склад фракции.**\n` +
                `**1/1 - NEXT BAN**`
            );

        if ('editReply' in inter && typeof inter.editReply === 'function') {
            await inter.editReply({ embeds: [curatorEmbed] });
        } else {
            await inter.reply({ embeds: [curatorEmbed] });
        }
        return;
    } else {
        switch (punishmentType) {
            case 'iban':
                commandText = `offiban ${statick} Слив склада ${fractionShort} // by ${adminSurname}`;
                durationText = `Перманентно`;
                break;
            case 'warnban':
                const days = duration || "30";
                commandText = `offban ${statick} ${days} Слив склада ${fractionShort} // by ${adminSurname}\noffwarn ${statick} Слив склада ${fractionShort} // by ${adminSurname}`;
                durationText = `${days} дн. + варн`;
                break;
            case 'ban':
                const banDays = duration || "30";
                commandText = `offban ${statick} ${banDays} Слив склада ${fractionShort} // by ${adminSurname}`;
                durationText = `${banDays} дн.`;
                break;
            case 'warn':
                commandText = `offwarn ${statick} Слив склада ${fractionShort} // by ${adminSurname}`;
                durationText = "1 варн";
                break;
            case 'jail':
                const mins = duration || "100";
                commandText = `offprison ${statick} ${mins} Слив склада ${fractionShort} // by ${adminSurname}`;
                durationText = `${mins} мин.`;
                break;
            default:
                commandText = `offban ${statick} 30 Слив склада ${fractionShort} // by ${adminSurname}`;
                durationText = `30 дн.`;
        }
        
        responseContent = `✅ Нарушение зарегистрировано: **${adminSurname}**\nНаказание: ${config.name} ${durationText}\n\n**Команда:**\n\`${commandText}\``;
    }

    if (punishmentType !== 'curator') {
        const reportBuffer = Buffer.from(report, 'utf-8');
        await addLog(inter.user.id, statick, config.type, JSON.stringify({}), reportBuffer, durationText);
        await sendReportToWebhook(adminDisplayName, statick, fraction, config.name, durationText, analysis, showWeaponNumbers);
    }

    if ('editReply' in inter && typeof inter.editReply === 'function') {
        await inter.editReply({ content: responseContent });
    } else {
        await inter.followUp({ content: responseContent, flags: [MessageFlags.Ephemeral] });
    }
}