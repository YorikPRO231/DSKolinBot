import { 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    AttachmentBuilder 
} from 'discord.js';
import { getLogsByStatic, getLogById } from '../../../databases/sqlite';

export const data = new SlashCommandBuilder()
    .setName("логи-игрока")
    .setDescription("Посмотреть историю сливов склада игрока")
    .addIntegerOption(option => 
        option.setName("статик")
            .setDescription("Статик игрока")
            .setRequired(true)
    );

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply();
    const statick = inter.options.getInteger("статик")!.toString();
    const logs = await getLogsByStatic(statick) as any[];

    if (!logs || logs.length === 0) {
        return await inter.editReply({ content: `🔍 Записи по статику **#${statick}** не найдены.` });
    }

    // Вспомогательная функция для парсинга предметов
    const formatItemsShort = (itemsRaw: any) => {
        try {
            let data = itemsRaw;
            while (typeof data === 'string') data = JSON.parse(data);
            
            const parts: string[] = [];
            const count = (obj: Record<string, number> | undefined): number => {
                if (!obj) return 0;
                return Object.values(obj).reduce((a: number, b: number) => a + b, 0);
            };

            const t = count(data.taken);
            const tr = count(data.inTrunk);
            const h = count(data.inHouse);

            if (t > 0) parts.push(`📥 Взято: **${t}**`);
            if (tr > 0) parts.push(`🚗 Авто: **${tr}**`);
            if (h > 0) parts.push(`🏠 Дома: **${h}**`);
            
            return parts.join(' | ') || 'Пустой лог';
        } catch (e) {
            return 'Ошибка данных';
        }
    };

    let page = 0;
    const itemsPerPage = 5;

    // Генерация эмбеда страницы
    const generateEmbed = (currentPage: number) => {
        const start = currentPage * itemsPerPage;
        const currentLogs = logs.slice(start, start + itemsPerPage);
        
        const embed = new EmbedBuilder()
            .setTitle(`📜 История: #${statick} (Стр. ${currentPage + 1}/${Math.ceil(logs.length / itemsPerPage)})`)
            .setColor(0x3498DB)
            .setFooter({ text: 'Выберите нарушение в меню, чтобы получить файл отчета' });

        currentLogs.forEach((log) => {
            const summary = formatItemsShort(log.items);
            const date = log.created_at ? new Date(log.created_at).toLocaleDateString('ru-RU') : "Не указана";

            embed.addFields({
                name: `📌 ID: ${log.id} — ${log.punishment.toUpperCase()}`,
                value: `**Срок:** ${log.duration}\n**Кратко:** ${summary}\n**Дата:** ${date}`,
                inline: false
            });
        });

        return embed;
    };

    // Создание кнопок и меню
    const createComponents = (currentPage: number) => {
        const start = currentPage * itemsPerPage;
        const currentLogs = logs.slice(start, start + itemsPerPage);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_log')
            .setPlaceholder('Выбрать конкретное нарушение для отчета')
            .addOptions(currentLogs.map(log => ({
                label: `Нарушение ID: ${log.id}`,
                description: `Тип: ${log.punishment} | Дата: ${log.created_at || '—'}`,
                value: log.id.toString()
            })));

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId('next')
                .setLabel('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled((currentPage + 1) * itemsPerPage >= logs.length)
        );

        return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu), buttons];
    };

    const msg = await inter.editReply({ 
        embeds: [generateEmbed(page)], 
        components: createComponents(page) 
    });

    const collector = msg.createMessageComponentCollector({ time: 600000 });

    collector.on('collect', async (i) => {
        if (i.user.id !== inter.user.id) return i.reply({ content: "Это не ваш поиск!", ephemeral: true });

        // Обработка переключения страниц
        if (i.isButton()) {
            if (i.customId === 'prev') page--;
            if (i.customId === 'next') page++;
            await i.update({ embeds: [generateEmbed(page)], components: createComponents(page) });
        }

        // Обработка выбора лога
        if (i.isStringSelectMenu()) {
            const selectedId = parseInt(i.values[0]);
            await i.deferReply({ ephemeral: true });

            const entry = await getLogById(selectedId);

            if (!entry) {
                return await i.editReply({ content: `❌ Запись с ID **#${selectedId}** не найдена.` });
            }

            try {
                const reportEmbed = new EmbedBuilder()
                    .setTitle(`🔍 Детали нарушения #${selectedId}`)
                    .setColor(0x3498DB)
                    .addFields(
                        { name: "Нарушитель", value: `**#${entry.pasport}**`, inline: true },
                        { name: "Администратор", value: `<@${entry.adm_id}>`, inline: true },
                        { name: "Наказание", value: `**${entry.punishment.toUpperCase()}**`, inline: false },
                        { name: "Срок", value: `**${entry.duration}**`, inline: true },
                        { name: "Дата", value: `**${entry.created_at || 'Не указана'}**`, inline: true }
                    )
                    .setTimestamp();

                const reportFile = new AttachmentBuilder(Buffer.from(entry.log_file), { 
                    name: `report_id${selectedId}_static${entry.pasport}.txt` 
                });

                await i.editReply({ embeds: [reportEmbed], files: [reportFile] });
            } catch (error) {
                console.error(error);
                await i.editReply({ content: "❌ Ошибка при выгрузке файла." });
            }
        }
    });
}