import { EmbedBuilder, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { readConfig } from '../utils/config';

export const data = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Помощь по системе логирования склада");

export async function execute(interaction: ChatInputCommandInteraction) {
    const config = readConfig();
    const admins = config.admins || [];
    
    const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle('📦 Warehouse Management System | Help')
        .setDescription('Актуальный список команд для администраторов по контролю склада:')
        .setThumbnail(interaction.client.user?.displayAvatarURL() || null)
        .addFields(
            {
                name: '🚀 **Основные инструменты**',
                value: 
                    '• `/проверить-склад` — Анализ логов игрока. Бот сам найдет статик, подсчитает вынос и предложит выдать наказание через модальное окно.\n' +
                    '• `/получить-лог` — Выгрузка сформированного детального отчета (.txt) по конкретному статику из базы.',
                inline: false
            },
            {
                name: '📜 **История и поиск**',
                value: 
                    '• `/логи-игрока` — Быстрый просмотр последних 10 нарушений статика (краткая сводка количеств без файлов).',
                inline: false
            },
            {
                name: '⚙️ **Системная информация**',
                value: 
                    `**Администраторов:** \`${admins.length}\`\n`,
                inline: true
            },
            {
                name: '📡 **Связь**',
                value: '• `/ping` — Пинг бота',
                inline: true
            }
        )   
        .setFooter({ 
            text: `Запросил: ${interaction.user.username} | Blackberry Management`, 
            iconURL: interaction.user.displayAvatarURL() 
        })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}