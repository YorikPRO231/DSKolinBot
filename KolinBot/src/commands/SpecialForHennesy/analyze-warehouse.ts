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


        const summary = analyzeWarehouseInventory(fileContent);

        let fullReportText = `ОТЧЕТ ПО СКЛАДУ (#${statick})\n`;
        fullReportText += `Фракция: ${FRACTION_INFO[fraction].label}\n`;
        fullReportText += `-----------------------------------\n\n`;

        const formatSectionText = (title: string, data: Record<string, number>) => {
            const entries = Object.entries(data);
            if (entries.length === 0) return "";
            return `[${title}]\n` + entries.map(([n, c]) => `• ${n}: ${c} шт.`).join('\n') + "\n\n";
        };

        fullReportText += formatSectionText("ВЗЯТО СО СКЛАДА", summary.taken);
        fullReportText += formatSectionText("ОСТАЛОСЬ В ТРАНСПОРТЕ", summary.inTrunk);
        fullReportText += formatSectionText("ОСТАЛОСЬ В КВАРТИРАХ", summary.inHouse);

        fullReportText += `[ЛОГИ ИГРОКА]\n`;
        const logLines = fileContent.split('\n')
            .map((l: string) => l.trim())
            .filter((l: string) => {
                const lower = l.toLowerCase();
                return lower.includes("берет набор") || 
                       lower.includes("положил") || 
                       lower.includes("забрал");
            });

        fullReportText += logLines.length > 0 ? logLines.join('\n') : "Действия не найдены.";

        const embed = new EmbedBuilder()
            .setTitle(`🔍 Анализ склада: #${statick}`)
            .setColor(0x3498DB)
            .setDescription(fullReportText.length > 500 
                ? "📄 Список предметов слишком большой, он прикреплен отдельным файлом." 
                : `\`\`\`\n${fullReportText}\n\`\`\``);

        const files: AttachmentBuilder[] = [];
        // Если текст длинный — создаем файл
        if (fullReportText.length > 500) {
            const buffer = Buffer.from(fullReportText, 'utf-8');
            files.push(new AttachmentBuilder(buffer, { name: `report_${statick}.txt` }));
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('btn_violation').setLabel('Зафиксировать нарушение').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('btn_ok').setLabel('Нарушений нет').setStyle(ButtonStyle.Secondary)
        );

        const message = await inter.editReply({ embeds: [embed], components: [row], files });

        // Коллектор для кнопок
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

    // Умный парсинг того, что ты ввел в модалку
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

    const reportBuffer = Buffer.from(fullReportText, 'utf-8');

    // Сохранение в БД
    await addLog(inter.user.id, statick, finalType, JSON.stringify(summary), reportBuffer, durationText);

    await inter.editReply({ 
        content: `✅ Нарушение зарегистрировано: **${adminSurname}**`, 
        embeds: [embed.setColor(0x2ECC71).setFooter({ text: `Тип: ${durationText}` })], 
        components: [], 
        files: [] 
    });

    // Выдаем команду
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

// Функция анализа (та же самая, что считала баланс Положил/Забрал)
function analyzeWarehouseInventory(data: string) {
    const totals = { taken: new Map(), inHouse: new Map(), inTrunk: new Map() };
    const lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 5);

    lines.forEach(line => {
        const lower = line.toLowerCase();
        if (lower.includes("транспорт") || lower.includes("квартиру") || lower.includes("дом")) {
            const isPut = lower.includes("положил");
            const m = line.match(/(?:Забрал из|Положил в) .*?:\s*(.*)/i);
            if (m) {
                const raw = m[1].trim();
                const itemM = raw.match(/(.*?)\s*(\d+)\s*шт/i);
                const name = itemM ? itemM[1].trim() : raw;
                const count = itemM ? parseInt(itemM[2]) : 1;
                const target = lower.includes("транспорт") ? totals.inTrunk : totals.inHouse;
                target.set(name, (target.get(name) || 0) + (isPut ? count : -count));
            }
        } else if (lower.includes("берет набор")) {
            const parts = line.split(/набор\s*.*?:/i);
            if (parts[1]) parts[1].split(',').forEach(s => {
                const itemM = s.match(/(.*?)\s*(\d+)\s*шт/i);
                if (itemM) totals.taken.set(itemM[1].trim(), (totals.taken.get(itemM[1].trim()) || 0) + parseInt(itemM[2]));
            });
        }
    });

    const clean = (m: Map<string, number>) => Object.fromEntries([...m].filter(([_, v]) => v > 0));
    return { taken: clean(totals.taken), inHouse: clean(totals.inHouse), inTrunk: clean(totals.inTrunk) };
}