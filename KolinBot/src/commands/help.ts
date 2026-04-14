import { EmbedBuilder, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Список всех доступных команд бота");

export async function execute(interaction: ChatInputCommandInteraction) {
    
    const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle('📦 Blackberry Management System | Help')
        .setDescription('Полный список инструментов:')
        .setThumbnail(interaction.client.user?.displayAvatarURL() || null)
        .addFields(
            {
                name: '🧱 **Контроль Склада**',
                value: 
                    '• `/проверить-склад` — Анализ склада.\n' +
                    '• `/получить-лог` — Выгрузка готового .txt отчета по статику.\n' +
                    '• `/логи-игрока` — История нарушений конкретного игрока.',
                inline: false
            },
            {
                name: '🕵️ **Анализ Государственных структур**',
                value: 
                    '• `/проверить-аресты` — Проверка корректности комментариев при арестах.\n' +
                    '• `/проверить-штрафы` — Поиск нарушений в причинах выписки штрафов.',
                inline: false
            },
            {
                name: '🛡️ **Security**',
                value: 
                    '• `/бот-чит` — Загрузка списка на проверку.\n' +
                    '• `/лог-бот-чит` — Список игроков, попавших в реестр подозреваемых.',
                inline: false
            },
            {
                name: '⚙️ **Администрирование**',
                value: 
                    '• `/удалить-лог-id` — Удаление ошибочной записи из базы данных по ID.\n' +
                    '• `/admin-rename` — Смена системной фамилии администратора (Owner only).',
                inline: false
            },
            {
                name: '📡 **Статус**',
                value: '• `/ping` — Проверка задержки бота.',
                inline: true
            }
        )   
        .setFooter({ 
            text: `Запросил: ${interaction.user.username} | Blackberry Management`, 
            iconURL: interaction.user.displayAvatarURL() 
        })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}