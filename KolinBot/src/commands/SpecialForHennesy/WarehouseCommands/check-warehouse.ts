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

// ============================================
// КОНСТАНТЫ
// ============================================

const CRIME_FACTIONS: FractionType[] = [FRACTION_TYPES.MM, FRACTION_TYPES.RM, FRACTION_TYPES.LCN, FRACTION_TYPES.YAK, FRACTION_TYPES.AM];
const WEBHOOK_URL = process.env.REPORT_WEBHOOK_URL || "";

const LOCATION_NAMES: Record<string, string> = {
    houses: "Дома/квартиры",
    personalCars: "Личный транспорт",
    fractionCars: "Фракционный транспорт",
    familyWarehouse: "Склад особняка",
    camper: "Кемпер"
};

// ============================================
// ТИПЫ ДАННЫХ
// ============================================

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

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================

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
            { name: "SASPA", value: FRACTION_TYPES.SASPA }
        )
    );

export async function execute(inter: ChatInputCommandInteraction) {
    let adminDisplayName = inter.user.displayName;
    
    if (!adminDisplayName || adminDisplayName === inter.user.username) {
        adminDisplayName = inter.user.globalName || inter.user.username;
    }
    
    const member = await inter.guild?.members.fetch(inter.user.id).catch(() => null);
    if (member && member.nickname) {
        adminDisplayName = member.nickname;
    }
    
    const adminSurname = getAdminSurname(inter.user.id);
    if (!adminSurname) {
        return inter.reply({ content: "Вы не зарегистрированы!", flags: [MessageFlags.Ephemeral] });
    }

    await inter.deferReply();

    let statick = "";
    const fraction = inter.options.getString("фракция") as FractionType;
    const attachment = inter.options.getAttachment("лог-файл")!;

    try {
        const response = await axios.get(attachment.url, { responseType: 'text' });
        const fileContent = response.data;

        const firstLine = fileContent.split('\n')[0];
        const staticMatch = firstLine.match(/\[(\d+)\]/);
        if (staticMatch) {
            statick = staticMatch[1];
        } else {
            return inter.editReply("❌ Не удалось найти статик в файле.");
        }

        const analysis = analyzeLogs(fileContent);
        const report = generateReport(statick, fraction, analysis);

        const hasViolation = analysis.hasViolation;
        
        const isTooLong = report.length > 1800;
        const embed = new EmbedBuilder()
            .setTitle(`🔍 Результаты проверки: #${statick}`)
            .setColor(hasViolation ? 0xFF4444 : 0x44FF44)
            .setDescription(isTooLong ? "📄 Полный отчет прикреплен файлом ниже." : `\`\`\`\n${report}\n\`\`\``)
            .setFooter({ text: hasViolation ? "⚠️ Обнаружено нарушение!" : "✅ Нарушений не обнаружено" });

        const files: AttachmentBuilder[] = [];
        if (isTooLong) {
            files.push(new AttachmentBuilder(Buffer.from(report, 'utf-8'), { name: `report_${statick}.txt` }));
        }

        const row = hasViolation ? new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('btn_violation').setLabel('Зафиксировать нарушение').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('btn_ok').setLabel('Нарушений нет').setStyle(ButtonStyle.Secondary)
        ) : null;

        const message = await inter.editReply({ embeds: [embed], components: row ? [row] : [], files });

        if (!hasViolation) return;

        let isProcessed = false;

        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 600000 });

        collector.on('collect', async (btnInter: ButtonInteraction) => {
            if (btnInter.user.id !== inter.user.id) {
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

    } catch (e) {
        console.error(e);
        await inter.editReply("❌ Ошибка при чтении файла.");
    }
}

// ============================================
// ПАРСИНГ ЛОГОВ
// ============================================

function parseDateTime(dateStr: string, timeStr: string): Date {
    const [day, month, year] = dateStr.split('.');
    const [hours, minutes, seconds] = timeStr.split(':');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds));
}

function normalizeItemName(rawName: string, showWeaponNumbers: boolean = true): string {
    let normalized = rawName
        .trim()
        .replace(/\s*\(\d+%\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    const itemMap: Record<string, string> = {
        '62mm': '7.62mm',
        '56mm': '5.56mm',
        '43mm': '11.43mm',
        '11.43mm': '11.43mm',
        '12mm': '12mm',
        'аптечка': 'Аптечка',
        'аптечка пп': 'Аптечка ПП',
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
    };
    
    const weaponWithNumberMatch = normalized.match(/^(assault rifle|special rifle|carbine rifle|service carbine|battle rifle|military rifle|compact rifle|gusenberg sweeper)\s*\(([A-Z0-9]+)\)$/i);
    if (weaponWithNumberMatch) {
        const weaponName = weaponWithNumberMatch[1].toLowerCase();
        const weaponNumber = weaponWithNumberMatch[2];
        
        let normalizedWeapon = '';
        for (const [key, value] of Object.entries(itemMap)) {
            if (key.toLowerCase() === weaponName) {
                normalizedWeapon = value;
                break;
            }
        }
        if (!normalizedWeapon) {
            normalizedWeapon = weaponName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
        
        return showWeaponNumbers ? `${normalizedWeapon} (${weaponNumber})` : normalizedWeapon;
    }
    
    const lowerRaw = normalized.toLowerCase();
    for (const [key, value] of Object.entries(itemMap)) {
        if (lowerRaw === key.toLowerCase() || lowerRaw.includes(key.toLowerCase())) {
            return value;
        }
    }
    
    if (!showWeaponNumbers) {
        normalized = normalized.replace(/\s*\([A-Z0-9]+\)/gi, '');
    }
    
    if (normalized.match(/^\d+\.\d+$/) && !normalized.includes('mm')) {
        normalized = normalized + 'mm';
    }
    
    return normalized;
}

function extractItemAndCount(action: string, showWeaponNumbers: boolean = true): { item: string | null; count: number } {
    const countMatch = action.match(/(\d+)\s*шт/i);
    if (!countMatch) return { item: null, count: 0 };
    
    const count = parseInt(countMatch[1]);
    
    const weaponWithNumberMatch = action.match(/:\s*([А-Яа-яA-Za-z\s]+\([A-Z0-9]+\))\s*\d+\s*шт/i);
    if (weaponWithNumberMatch) {
        return { item: normalizeItemName(weaponWithNumberMatch[1], showWeaponNumbers), count };
    }
    
    const patterns = [
        /:\s*([А-Яа-яA-Za-z0-9\s()%+]+?)\s*\d+\s*шт/i,
        /([А-Яа-яA-Za-z0-9\s()%+]+?)\s*\d+\s*шт/i,
    ];
    
    for (const pattern of patterns) {
        const match = action.match(pattern);
        if (match && match[1]) {
            const item = normalizeItemName(match[1], showWeaponNumbers);
            if (item.length >= 2) {
                return { item, count };
            }
        }
    }
    
    return { item: null, count: 0 };
}

function isFactionSource(location: string, type: string): boolean {
    return location === 'faction_storage' || 
           location === 'fraction_car' ||
           type.toLowerCase().includes("фракционный бот") ||
           type.toLowerCase().includes("фракционный склад");
}

function parseLogEntry(line: string, showWeaponNumbers: boolean = true): LogEntry | null {
    const parts = line.split('","').map(s => s.replace(/"/g, ''));
    if (parts.length < 3) return null;

    const [rawDateTime, type, action] = parts;
    const [rawDate, rawTime] = rawDateTime.split(', ');
    
    let count = 0;
    let soldCount = 0;
    let money = 0;
    let operation: 'take' | 'put' | 'craft' | 'sell' | 'trade_in' | 'trade_out' = 'take';
    let location = 'unknown';
    
    const lowerType = type.toLowerCase();
    const lowerAction = action.toLowerCase();
    
    // Крафт
    if (lowerType.includes("крафт")) {
        operation = 'craft';
        location = 'craft';
        const { item, count: c } = extractItemAndCount(action, showWeaponNumbers);
        if (!item) return null;
        return {
            datetime: parseDateTime(rawDate, rawTime),
            rawDate, rawTime, type, action,
            item, count: c,
            operation, location
        };
    }
    
    // Продажа через DarkVito
    if (lowerType.includes("darkvito")) {
        operation = 'sell';
        location = 'darkvito';
        
        let itemName = '';
        const itemMatch = action.match(/: ([0-9.]+mm|[А-Яа-яA-Za-z\s]+)/i);
        if (itemMatch) {
            itemName = normalizeItemName(itemMatch[1], showWeaponNumbers);
        }
        
        if (!itemName) return null;
        
        const soldMatch = action.match(/Продал\s+(\d+)\s+шт/i);
        soldCount = soldMatch ? parseInt(soldMatch[1]) : 0;
        
        if (soldCount === 0) {
            const countInLotMatch = action.match(/: [0-9.]+mm — (\d+)\s+шт/i);
            if (countInLotMatch) {
                soldCount = parseInt(countInLotMatch[1]);
            }
        }
        
        const moneyMatch = action.match(/\$([\d,]+)/);
        money = moneyMatch ? parseInt(moneyMatch[1].replace(/,/g, '')) : 0;
        
        return {
            datetime: parseDateTime(rawDate, rawTime),
            rawDate, rawTime, type, action,
            item: itemName,
            count: soldCount,
            soldCount,
            money,
            operation,
            location
        };
    }
    
    // Трейды игнорируем
    if (lowerType.includes("трейд")) {
        return null;
    }
    
    // Определяем локацию
    if (lowerType.includes("фракционный склад") || lowerType.includes("фракционный бот")) {
        location = 'faction_storage';
    } else if (lowerType.includes("квартир") || lowerType === "квартира" || 
               (lowerType.includes("дом") && !lowerAction.includes("особняк"))) {
        location = 'house';
    } else if (lowerType === "семья" && lowerAction.includes("склад особняка")) {
        location = 'family_warehouse';
    } else if (lowerType === "транспорт" || 
               (lowerType === "семья" && (lowerAction.includes("из транспорта") || lowerAction.includes("в транспорт")))) {
        location = 'personal_car';
    } else if (lowerType.includes("фракционный транспорт")) {
        location = 'fraction_car';
    } else if (lowerType.includes("кемпер") || lowerType.includes("camper") || 
               (lowerType.includes("транспорт") && lowerAction.includes("кемпер"))) {
        location = 'camper';
    } else if (lowerType.includes("особняк") && !lowerAction.includes("склад")) {
        location = 'house';
    } else {
        return null;
    }
    
    // Определяем операцию
    if (/забрал|берет|получил/i.test(action)) {
        operation = 'take';
    } else if (/положил|кладет/i.test(action)) {
        operation = 'put';
    } else {
        return null;
    }
    
    const { item, count: c } = extractItemAndCount(action, showWeaponNumbers);
    if (!item || c === 0) return null;
    
    return {
        datetime: parseDateTime(rawDate, rawTime),
        rawDate, rawTime, type, action,
        item, count: c,
        operation, location
    };
}

// ============================================
// ОСНОВНОЙ АНАЛИЗ
// ============================================

function analyzeLogs(data: string, showWeaponNumbers: boolean = true): AnalysisResult {
    const lines = data.split('\n').map(l => l.trim()).filter(l => l.includes('","'));
    
    const entries: LogEntry[] = [];
    for (const line of lines) {
        const entry = parseLogEntry(line, showWeaponNumbers);
        if (entry) {
            entries.push(entry);
        }
    }
    
    entries.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
    
    // Фракционный инвентарь игрока
    const factionInventory: StorageBalance = {};
    
    // Взято со склада (брутто)
    const totalTakenFromFaction: StorageBalance = {};
    
    // Возвращено на склад
    const totalReturnedToFaction: StorageBalance = {};
    
    // Продано из фракционного
    const soldFromFaction: StorageBalance = {};
    const soldFromFactionDetails: SaleDetail[] = [];
    
    // Остатки по местам
    const remainingByLocation: PersonalStorage = {
        houses: {},
        personalCars: {},
        fractionCars: {},
        familyWarehouse: {},
        camper: {}
    };
    
    let totalEarnings = 0;
    
    function updateBalance(balance: StorageBalance, item: string, delta: number): void {
        const current = balance[item] || 0;
        const newVal = current + delta;
        if (Math.abs(newVal) < 0.1) {
            delete balance[item];
        } else {
            balance[item] = newVal;
        }
    }
    
    for (const entry of entries) {
        const { item, count, operation, location, money, type } = entry;
        
        // Продажи
        if (operation === 'sell') {
            totalEarnings += money || 0;
            
            const available = factionInventory[item] || 0;
            if (available > 0) {
                const soldAmount = Math.min(count, available);
                updateBalance(factionInventory, item, -soldAmount);
                updateBalance(soldFromFaction, item, soldAmount);
                soldFromFactionDetails.push({
                    item,
                    count: soldAmount,
                    money: money || 0
                });
            }
            continue;
        }
        
        const isFromFaction = operation === 'take' && isFactionSource(location, type);
        const isToFaction = operation === 'put' && isFactionSource(location, type);
        
        // Взятие со склада
        if (isFromFaction) {
            updateBalance(factionInventory, item, count);
            updateBalance(totalTakenFromFaction, item, count);
        }
        
        // Возврат на склад
        if (isToFaction) {
            const available = factionInventory[item] || 0;
            const returned = Math.min(count, available);
            updateBalance(factionInventory, item, -returned);
            updateBalance(totalReturnedToFaction, item, returned);
        }
        
        // Перемещение в личное имущество
        if (operation === 'put' && !isToFaction && location !== 'craft') {
            const available = factionInventory[item] || 0;
            if (available > 0) {
                const movedAmount = Math.min(count, available);
                updateBalance(factionInventory, item, -movedAmount);
                
                if (location === 'house') {
                    updateBalance(remainingByLocation.houses, item, movedAmount);
                } else if (location === 'personal_car') {
                    updateBalance(remainingByLocation.personalCars, item, movedAmount);
                } else if (location === 'camper') {
                    updateBalance(remainingByLocation.camper, item, movedAmount);
                } else if (location === 'family_warehouse') {
                    updateBalance(remainingByLocation.familyWarehouse, item, movedAmount);
                }
            }
        }
        
        // Забор из личного имущества
        if (operation === 'take' && !isFromFaction && location !== 'craft') {
            let takenAmount = 0;
            
            if (location === 'house') {
                const available = remainingByLocation.houses[item] || 0;
                takenAmount = Math.min(count, available);
                updateBalance(remainingByLocation.houses, item, -takenAmount);
            } else if (location === 'personal_car') {
                const available = remainingByLocation.personalCars[item] || 0;
                takenAmount = Math.min(count, available);
                updateBalance(remainingByLocation.personalCars, item, -takenAmount);
            } else if (location === 'camper') {
                const available = remainingByLocation.camper[item] || 0;
                takenAmount = Math.min(count, available);
                updateBalance(remainingByLocation.camper, item, -takenAmount);
            } else if (location === 'family_warehouse') {
                const available = remainingByLocation.familyWarehouse[item] || 0;
                takenAmount = Math.min(count, available);
                updateBalance(remainingByLocation.familyWarehouse, item, -takenAmount);
            }
            
            if (takenAmount > 0) {
                updateBalance(factionInventory, item, takenAmount);
            }
        }
    }
    
    // Суммарные остатки в личном имуществе
    const remainingInPersonal: StorageBalance = {};
    for (const balance of Object.values(remainingByLocation)) {
        for (const [item, count] of Object.entries(balance) as [string, number][]) {
            if (count > 0) {
                updateBalance(remainingInPersonal, item, count);
            }
        }
    }
    
    // Чистое взятое (нетто)
    const netTaken: StorageBalance = {};
    for (const [item, taken] of Object.entries(totalTakenFromFaction)) {
        const returned = totalReturnedToFaction[item] || 0;
        if (taken - returned > 0) {
            netTaken[item] = taken - returned;
        }
    }
    
    const hasViolation = Object.keys(remainingInPersonal).length > 0 || Object.keys(soldFromFaction).length > 0;
    
    return {
        takenFromFaction: netTaken,
        soldFromFaction,
        soldFromFactionDetails,
        remainingInPersonal,
        remainingByLocation,
        totalEarnings,
        hasViolation
    };
}

// ============================================
// ФОРМИРОВАНИЕ ОТЧЕТА
// ============================================

function formatBalance(title: string, balance: StorageBalance, indent: string = "  "): string {
    const entries = Object.entries(balance) as [string, number][];
    if (entries.length === 0) return "";
    
    entries.sort((a, b) => b[1] - a[1]);
    
    let result = `[${title}]\n`;
    for (const [name, count] of entries) {
        if (count > 0) {
            result += `${indent}${name}: ${count.toLocaleString()} шт.\n`;
        }
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
        let totalMoney = 0;
        const soldSummary: StorageBalance = {};
        
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
    for (const [location, balance] of Object.entries(analysis.remainingByLocation)) {
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

// ============================================
// ОТПРАВКА В ВЕБХУК
// ============================================

async function sendReportToWebhook(
    adminName: string,
    statick: string,
    fraction: string,
    punishmentType: string,
    punishmentDuration: string,
    analysis: AnalysisResult,
    avatarUrl?: string,
    showWeaponNumbers: boolean = true
): Promise<void> {
    if (!WEBHOOK_URL) {
        console.log("Webhook URL не настроен");
        return;
    }

    const totalLeaked: StorageBalance = { ...analysis.remainingInPersonal };
    for (const [item, count] of Object.entries(analysis.soldFromFaction)) {
        totalLeaked[item] = (totalLeaked[item] || 0) + count;
    }
    
    const stolenLines: string[] = [];
    for (const [item, count] of Object.entries(totalLeaked)) {
        stolenLines.push(`  ${item}: ${count.toLocaleString()} шт.`);
    }
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
        const soldLines: string[] = [];
        for (const [item, count] of Object.entries(analysis.soldFromFaction)) {
            soldLines.push(`  ${item}: ${count.toLocaleString()} шт.`);
        }
        soldText = `\n\nПродано через DarkVito:\n${soldLines.join("\n")}`;
        soldText += `\n\nВыручка: $${analysis.totalEarnings.toLocaleString()}`;
        soldText += `\n\n<@478169919783960577>\nОбнулить ${statick} на  ${analysis.totalEarnings}\nПричина: Слив склада фракции ${FRACTION_INFO[fraction as FractionType]?.label}`;
    }
    
    let codeContent = `Админ: ${adminName}\n`;
    codeContent += `Статк: ${statick}\n`;
    codeContent += `Фракция: ${FRACTION_INFO[fraction as FractionType]?.label || fraction}\n`;
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
    
    const colors: Record<string, number> = {
        "Бан": 0xFF0000,
        "IBAN": 0x8B0000,
        "Бан + Варн": 0xFF4500,
        "Варн": 0xFFA500,
        "Деморган": 0xFF8C00
    };
    
    const embed = {
        title: "Слив склада",
        color: colors[punishmentType] || 0x2B2D31,
        description: `\`\`\`\n${codeContent}\n\`\`\``,
        footer: { text: `Зафиксировано: ${new Date().toLocaleString()}` }
    };
    
    try {
        await axios.post(WEBHOOK_URL, {
            embeds: [embed],
            username: "Складской Контроль",
            ...(avatarUrl && { avatar_url: avatarUrl })
        });
    } catch (error) {
        console.error("Ошибка отправки в вебхук:", error);
    }
}

// ============================================
// НАКАЗАНИЯ
// ============================================

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
    const punishmentSelect = new StringSelectMenuBuilder()
        .setCustomId('punish_type_select')
        .setPlaceholder('Выберите тип наказания')
        .addOptions([
            { label: 'Бан', description: 'Обычный бан аккаунта', value: 'ban' },
            { label: 'IBAN', description: 'Перманентный бан', value: 'iban' },
            { label: 'Варн', description: 'Предупреждение', value: 'warn' },
            { label: 'Бан + Варн', description: 'Бан и предупреждение одновременно', value: 'warnban' },
            { label: 'Деморган', description: 'Деморган', value: 'jail' }
        ]);

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
        const needsDuration = ['ban', 'warnban', 'jail'].includes(punishmentType);
        
        if (!needsDuration) {
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
    const fractionShort = fraction;
    let commandText = "";
    let durationText = "";
    let finalType: PunishmentType;
    let punishmentName = "";

    switch (punishmentType) {
        case 'iban':
            finalType = PUNISHMENT_TYPES.IBAN;
            commandText = `offiban ${statick} Слив склада ${fractionShort} // by ${adminSurname}`;
            durationText = `Перманентно`;
            punishmentName = "IBAN";
            break;
        case 'warnban':
            finalType = PUNISHMENT_TYPES.WARN_BAN;
            const days = duration || "30";
            commandText = `offban ${statick} ${days} Слив склада ${fractionShort} // by ${adminSurname}\noffwarn ${statick} Слив склада ${fractionShort} // by ${adminSurname}`;
            durationText = `${days} дн. + варн`;
            punishmentName = "Бан + Варн";
            break;
        case 'ban':
            finalType = PUNISHMENT_TYPES.BAN;
            const banDays = duration || "30";
            commandText = `offban ${statick} ${banDays} Слив склада ${fractionShort} // by ${adminSurname}`;
            durationText = `${banDays} дн.`;
            punishmentName = "Бан";
            break;
        case 'warn':
            finalType = PUNISHMENT_TYPES.WARN;
            commandText = `offwarn ${statick} Слив склада ${fractionShort} // by ${adminSurname}`;
            durationText = "1 варн";
            punishmentName = "Варн";
            break;
        case 'jail':
            finalType = PUNISHMENT_TYPES.AJAIL;
            const mins = duration || "100";
            commandText = `offprison ${statick} ${mins} Слив склада ${fractionShort} // by ${adminSurname}`;
            durationText = `${mins} мин.`;
            punishmentName = "Деморган";
            break;
        default:
            finalType = PUNISHMENT_TYPES.BAN;
            commandText = `offban ${statick} 30 Слив склада ${fractionShort} // by ${adminSurname}`;
            durationText = `30 дн.`;
            punishmentName = "Бан";
    }

    const reportBuffer = Buffer.from(report, 'utf-8');
    await addLog(inter.user.id, statick, finalType, JSON.stringify({}), reportBuffer, durationText);

    const isCrimeFaction = CRIME_FACTIONS.includes(fraction);
    if (isCrimeFaction) {
        await sendReportToWebhook(adminDisplayName, statick, fraction, punishmentName, durationText, analysis, "https://cdn.discordapp.com/avatars/939953853527392286/a_380cd7c3a53eecfea5a3e20d2267ae36.gif", showWeaponNumbers);
    }

    // Проверяем тип interaction для правильного ответа
    if ('editReply' in inter && typeof inter.editReply === 'function') {
        await inter.editReply({ 
            content: `✅ Нарушение зарегистрировано: **${adminSurname}**\nНаказание: ${punishmentName} ${durationText}\n\n**Команда:**\n\`${commandText}\``,
        });
    } else {
        await inter.followUp({ 
            content: `✅ Нарушение зарегистрировано: **${adminSurname}**\nНаказание: ${punishmentName} ${durationText}\n\n**Команда:**\n\`${commandText}\``,
            flags: [MessageFlags.Ephemeral]
        });
    }
}