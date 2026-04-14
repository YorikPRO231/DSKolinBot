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
    TextInputStyle
} from 'discord.js';
import axios from 'axios';
import { addLog, getAdminSurname } from '../../databases/sqlite';
import { PUNISHMENT_TYPES, PunishmentType } from '../../utils/constants/punishments';
import { FRACTION_TYPES, FRACTION_INFO, FractionType } from '../../utils/constants/fractions';


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
    const adminSurname = getAdminSurname(inter.user.id);
    if (!adminSurname) return inter.reply({ content: "Вы не зарегистрированы!", ephemeral: true });

    await inter.deferReply();

    let statick = "";
    const fraction = inter.options.getString("фракция") as FractionType;
    const attachment = inter.options.getAttachment("лог-файл")!;

    try {
        const response = await axios.get(attachment.url, { responseType: 'text' });
        const fileContent = response.data;

        if (!statick) {
            const firstLine = fileContent.split('\n')[0];
            const staticMatch = firstLine.match(/\[(\d+)\]/);
            if (staticMatch) {
                statick = staticMatch[1];
            } else {
                return inter.editReply("❌ Не удалось найти статик в файле. Укажите его вручную в параметрах команды.");
            }
        }

        const { summary, groupedLogs } = analyzeLogs(fileContent);

        let report = `═══ ОТЧЕТ ПО СКЛАДУ (#${statick}) ═══\n`;
        report += `Фракция: ${FRACTION_INFO[fraction]?.label || fraction}\n\n`
        report += `-----------------------------------\n\n`;

        const format = (title: string, data: Record<string, number>, prefix = "•") => {
            const entries = Object.entries(data);
            if (entries.length === 0) return "";
            return `[${title}]\n` + entries.map(([name, count]) => {
                return `${prefix} ${name}: ${count.toLocaleString()} шт.`;
            }).join('\n') + "\n\n";
        };

        report += format("ВЗЯТО СО СКЛАДА / КРАФТ", (summary as any).takenWarehouse || {});
        report += format("ОСТАЛОСЬ В ДОМАХ/КВАРТИРАХ", summary.houses);
        report += format("ЛИЧНЫЙ / СЕМЕЙНЫЙ ТРАНСПОРТ", summary.personalCars);
        report += format("ФРАКЦИОННЫЙ ТРАНСПОРТ", summary.fractionCars);
        report += format("СКЛАД ОСОБНЯКА", summary.familyWarehouse);

        if (Object.keys(summary.soldItems).length > 0) {
            report += format("ПРОДАЖИ ЧЕРЕЗ DARKVITO", summary.soldItems);
            report += ` Общая выручка: $${summary.totalEarnings.toLocaleString()}\n\n`;
        }

        const isTooLong = report.length > 1800;
        const embed = new EmbedBuilder()
            .setTitle(`🔍 Результаты проверки: #${statick}`)
            .setColor(0x2B2D31)
            .setDescription(isTooLong ? "📄 Полный отчет прикреплен файлом ниже." : `\`\`\`\n${report}\n\`\`\``);

        const files: AttachmentBuilder[] = [];
        if (isTooLong) {
            files.push(new AttachmentBuilder(Buffer.from(report, 'utf-8'), { name: `report_${statick}.txt` }));
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('btn_violation').setLabel('Зафиксировать нарушение').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('btn_ok').setLabel('Нарушений нет').setStyle(ButtonStyle.Secondary)
        );

        const message = await inter.editReply({ embeds: [embed], components: [row], files });

        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 600000 });

        collector.on('collect', async (btnInter) => {
            if (btnInter.user.id !== inter.user.id) return btnInter.reply({ content: "Не ваш лог!", ephemeral: true });

            if (btnInter.customId === 'btn_ok') {
                return await btnInter.update({ content: "✅ Проверка завершена: Чисто.", embeds: [], components: [], files: [] });
            }

            const modal = new ModalBuilder()
                .setCustomId(`p_modal_${statick}`)
                .setTitle(`Наказание #${statick}`);

            const typeInput = new TextInputBuilder()
                .setCustomId('punish_type')
                .setLabel("Тип наказания")
                .setPlaceholder('Бан, IBAN, Варн, ВарнБан, Деморган, Изъятие')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const durationInput = new TextInputBuilder()
                .setCustomId('punish_duration')
                .setLabel("Срок (дней или минут)")
                .setPlaceholder('30 или 100')
                .setStyle(TextInputStyle.Short) 
                .setRequired(false);
            
            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(typeInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput)
            );

            await btnInter.showModal(modal);

            const submitted = await btnInter.awaitModalSubmit({ time: 60000 }).catch(() => null);

            if (submitted) {
                const rawType = submitted.fields.getTextInputValue('punish_type').toLowerCase();
                const pDuration = submitted.fields.getTextInputValue('punish_duration');
                const fractioshort = fraction

                let commandText = "";
                let durationText = pDuration || "—";
                let finalType: PunishmentType = PUNISHMENT_TYPES.BAN;

                if (rawType.includes("iban")) {
                    finalType = PUNISHMENT_TYPES.IBAN;
                    commandText = `offiban ${statick} Слив склада ${fractioshort} // by ${adminSurname}`;
                    durationText = `Перманентно`;
                } 
                else if (rawType.includes("варнбан") || rawType.includes("warnban")) {
                    finalType = PUNISHMENT_TYPES.WARN_BAN;
                    const days = pDuration || "30";
                    commandText = `offban ${statick} ${days} Слив склада ${fractioshort} // by ${adminSurname}\noffwarn ${statick} Слив склада ${fractioshort} // by ${adminSurname}`;
                    durationText = `${days} дн. + варн`;
                }
                else if (rawType.includes("бан") || rawType === "ban") {
                    finalType = PUNISHMENT_TYPES.BAN;
                    const days = pDuration || "30";
                    commandText = `offban ${statick} ${days} Слив склада ${fractioshort} // by ${adminSurname}`;
                    durationText = `${days} дн.`;
                }
                else if (rawType.includes("варн") || rawType === "warn") {
                    finalType = PUNISHMENT_TYPES.WARN;
                    commandText = `offwarn ${statick} Слив склада ${fractioshort} // by ${adminSurname}`;
                    durationText = "1 варн";
                }
                else if (rawType.includes("деморган") || rawType.includes("jail") || rawType.includes("prison")) {
                    finalType = PUNISHMENT_TYPES.AJAIL;
                    const mins = pDuration || "100";
                    commandText = `offprison ${statick} ${mins} Слив склада ${fractioshort} // by ${adminSurname}`;
                    durationText = `${mins} мин.`;
                }
                else if (rawType.includes("изъятие") || rawType.includes("clear")) {
                    finalType = PUNISHMENT_TYPES.CLEAR_ITEMS;
                    commandText = `Забери у него вещи, дубина!`;
                    durationText = "Изъятие";
                }

                const reportBuffer = Buffer.from(report, 'utf-8');

                await addLog(inter.user.id, statick, finalType, JSON.stringify(summary), reportBuffer, durationText);

                await inter.editReply({ 
                    content: `✅ Нарушение зарегистрировано: **${adminSurname}**`, 
                    embeds: [embed.setColor(0x2ECC71).setFooter({ text: `Тип: ${durationText}` })], 
                    components: [], 
                    files: [] 
                });

                await submitted.reply({ 
                    content: `**Команда для выдачи:**\n\`\`\`\n${commandText}\n\`\`\``, 
                    flags: [MessageFlags.Ephemeral] 
                });
            }
        });

    } catch (e) {
        console.error(e);
        await inter.editReply("❌ Ошибка при чтении файла.");
    }
}

interface AnalysisResult {
    summary: {
        warehouse: Record<string, number>;
        fractionCars: Record<string, number>;
        familyWarehouse: Record<string, number>;
        houses: Record<string, number>;
        personalCars: Record<string, number>;
        soldItems: Record<string, number>;
        totalEarnings: number;
    };
    groupedLogs: string[];
}

function analyzeLogs(data: string): AnalysisResult {
    const lines = data.split('\n').map(l => l.trim()).filter(l => l.includes('","'));
    
    const totals = {
        warehouse: {} as Record<string, number>,
        fractionCars: {} as Record<string, number>,
        familyWarehouse: {} as Record<string, number>,
        houses: {} as Record<string, number>,
        personalCars: {} as Record<string, number>,
        soldItems: {} as Record<string, number>,
        totalEarnings: 0
    };
    
    const taken = {
        warehouse: {} as Record<string, number>,
        fractionCars: {} as Record<string, number>,
        familyWarehouse: {} as Record<string, number>,
        houses: {} as Record<string, number>,
        personalCars: {} as Record<string, number>
    };

    const groupedLogs: string[] = [];
    let lastLog: any = null;

    function extractItemName(action: string, type: string): string | null {
        const lowerType = type.toLowerCase();
        let rawName: string | null = null;
        
        if (lowerType.includes("darkvito")) {
            const match = action.match(/лот\s+#\d+:\s*([^—]+?)\s*—/i);
            if (match) rawName = match[1];
        }
        else {
            const patterns = [
                /:\s*([А-Яа-яA-Za-z0-9\s()%+]+?)\s*\d+\s*шт/i,
                /:\s*([^:]+?)\s*\d+\s*шт/i,
            ];
            for (const pattern of patterns) {
                const match = action.match(pattern);
                if (match && match[1]) {
                    rawName = match[1].trim();
                    break;
                }
            }
        }
        
        if (!rawName) return null;
        
        // Чистка: убираем ID в скобках и проценты, сохраняем пробелы и кириллицу
        let normalized = rawName
            .trim()
            .replace(/\s*\([^)]+\)/g, '')      // убираем (FIB12345)
            .replace(/\s*\(\d+%\)/g, '')       // убираем (99%)
            .replace(/\s+/g, ' ')              // нормализуем пробелы
            .trim();
        
        // Для патронов: добавляем mm если нужно
        if (normalized.match(/^\d+\.\d+$/) && !normalized.includes('mm')) {
            normalized = normalized + 'mm';
        }
        
        return normalized;
    }

    for (const line of lines) {
        const parts = line.split('","').map(s => s.replace(/"/g, ''));
        if (parts.length < 3) continue;

        const [rawDate, type, action] = parts;
        
        let count = 0;
        let soldCount = 0;
        
        if (type.toLowerCase().includes("darkvito")) {
            const soldMatch = action.match(/Продал\s+(\d+)\s+шт/i);
            if (soldMatch) {
                soldCount = parseInt(soldMatch[1]);
            }
            const totalMatch = action.match(/(\d+)\s*шт(?!.*Продал)/i);
            count = totalMatch ? parseInt(totalMatch[1]) : 0;
        } else {
            const countMatch = action.match(/(\d+)\s*шт/i);
            if (!countMatch) continue;
            count = parseInt(countMatch[1]);
        }
        
        if (count === 0 && soldCount === 0 && !type.toLowerCase().includes("darkvito")) continue;
        
        let item = extractItemName(action, type);
        if (!item) continue;
        
        // Приводим к нижнему регистру, но сохраняем пробелы
        item = item.toLowerCase();
        if (item.length < 2) continue;
        
        const lowerType = type.toLowerCase();
        const lowerAction = action.toLowerCase();
        
        const updateBalance = (target: Record<string, number>, key: string, delta: number) => {
            target[key] = (target[key] || 0) + delta;
        };
        
        // 1. Крафт
        if (lowerType.includes("крафт")) {
            updateBalance(totals.warehouse, item, count);
            updateBalance(taken.warehouse, item, count);
        }
        // 2. Фракционный склад
        else if (lowerType.includes("фракционный склад")) {
            if (/берет/i.test(action)) {
                updateBalance(totals.warehouse, item, -count);
                updateBalance(taken.warehouse, item, count);
            } else if (/кладет/i.test(action)) {
                updateBalance(totals.warehouse, item, count);
            }
        }
        // 2.5 Фракционный бот
        else if (lowerType.includes("фракционный бот")) {
            if (/берет/i.test(action)) {
                updateBalance(totals.warehouse, item, -count);
                updateBalance(taken.warehouse, item, count);
            }
        }
        // 2.6 Квартира
        else if (lowerType.includes("квартир") || lowerType === "квартира") {
            if (/забрал|берет/i.test(action)) {
                updateBalance(totals.houses, item, -count);
                updateBalance(taken.houses, item, count);
            } else if (/положил|кладет/i.test(action)) {
                updateBalance(totals.houses, item, count);
            }
        }
        // 3. Семья + склад особняка
        else if (lowerType === "семья" && lowerAction.includes("склад особняка")) {
            if (/берет/i.test(action)) {
                updateBalance(totals.familyWarehouse, item, -count);
                updateBalance(taken.familyWarehouse, item, count);
            } else if (/кладет/i.test(action)) {
                updateBalance(totals.familyWarehouse, item, count);
            }
        }
        // 4. Фракционный транспорт
        else if (lowerType.includes("фракционный транспорт")) {
            if (/забрал/i.test(action)) {
                updateBalance(totals.fractionCars, item, -count);
                updateBalance(taken.fractionCars, item, count);
            } else if (/положил/i.test(action)) {
                updateBalance(totals.fractionCars, item, count);
            }
        }
        // 5. Личный/семейный транспорт
        else if (lowerType === "транспорт" || (lowerType === "семья" && (lowerAction.includes("из транспорта") || lowerAction.includes("в транспорт")))) {
            if (/забрал|берет/i.test(action)) {
                updateBalance(totals.personalCars, item, -count);
                updateBalance(taken.personalCars, item, count);
            } else if (/положил|кладет/i.test(action)) {
                updateBalance(totals.personalCars, item, count);
            }
        }
        // 6. Недвижимость (дом)
        else if (lowerType.includes("дом") || (lowerType.includes("особняк") && !lowerAction.includes("склад"))) {
            if (/берет|забрал/i.test(action)) {
                updateBalance(totals.houses, item, -count);
                updateBalance(taken.houses, item, count);
            } else if (/кладет|положил/i.test(action)) {
                updateBalance(totals.houses, item, count);
            }
        }
        // 7. DarkVito
        else if (lowerType.includes("darkvito")) {
            if (soldCount > 0) {
                totals.soldItems[item] = (totals.soldItems[item] || 0) + soldCount;
                const moneyMatch = action.match(/\$([\d,]+)/);
                if (moneyMatch) {
                    const money = parseInt(moneyMatch[1].replace(/,/g, ''));
                    totals.totalEarnings += money;
                }
            }
        }

        // Группировка для лога
        const timeStr = rawDate.split(', ')[1];
        const isGettingAction = /берет|забрал|получил|продал/i.test(action);
        const effectiveCount = lowerType.includes("darkvito") ? soldCount : count;
        
        if (lastLog && lastLog.item === item && lastLog.isGetting === isGettingAction && lastLog.type === type) {
            lastLog.count += isGettingAction ? effectiveCount : -effectiveCount;
            lastLog.endTime = timeStr;
            lastLog.rows += 1;
        } else {
            if (lastLog) flushLog(lastLog, groupedLogs);
            lastLog = { 
                time: timeStr, 
                endTime: timeStr, 
                item, 
                count: isGettingAction ? effectiveCount : -effectiveCount,
                isGetting: isGettingAction, 
                type: type,
                rows: 1 
            };
        }
    }
    if (lastLog) flushLog(lastLog, groupedLogs);

    const cleanup = (obj: Record<string, number>) => {
        const result: Record<string, number> = {};
        for (const [key, val] of Object.entries(obj)) {
            if (val > 0) {
                result[key] = val;
            }
        }
        return Object.fromEntries(
            Object.entries(result).sort((a, b) => b[1] - a[1])
        );
    };

    return { 
        summary: {
            warehouse: cleanup(totals.warehouse),
            fractionCars: cleanup(totals.fractionCars),
            familyWarehouse: cleanup(totals.familyWarehouse),
            houses: cleanup(totals.houses),
            personalCars: cleanup(totals.personalCars),
            soldItems: cleanup(totals.soldItems),
            totalEarnings: totals.totalEarnings,
            takenWarehouse: cleanup(taken.warehouse),
            takenFractionCars: cleanup(taken.fractionCars),
            takenFamilyWarehouse: cleanup(taken.familyWarehouse),
            takenHouses: cleanup(taken.houses),
            takenPersonalCars: cleanup(taken.personalCars)
        } as any,
        groupedLogs 
    };
}

function flushLog(l: any, container: string[]) {
    const timeDisplay = l.time === l.endTime ? l.time : `${l.time}-${l.endTime}`;
    const actionText = l.isGetting ? "ВЗЯЛ" : "ПОЛОЖИЛ";
    const absCount = Math.abs(l.count);
    container.push(`[${timeDisplay}] ${actionText} ${l.item} | ${absCount} шт.${l.rows > 1 ? ` (x${l.rows})` : ""}`);
}