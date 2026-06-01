import { EmbedBuilder, ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';

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
                name: '🏚️ **Контроль склада (мафии/банды/гос)**',
                value: 
                    '• `/проверить-склад` — Анализ логов склада, фиксация нарушений.\n' +
                    '• `/получить-лог` — Выгрузка отчета по статику из БД.\n' +
                    '• `/логи-игрока` — История нарушений игрока с выборкой по ID.\n' +
                    '• `/удалить-лог-id` — Удаление записи из БД (Senior Admin or Developer).',
                inline: false
            },
            {
                name: '🏛️ **Гос. структуры (LSPD/LSSD/FIB/GOV/ARMY/SASPA)**',
                value: 
                    '• `/проверить-аресты` — Проверка комментариев при арестах (п.3.24 ПГС).\n' +
                    '• `/проверить-штрафы` — Поиск некорректных причин штрафов.\n' +
                    '• `/проверить-повышения` — Анализ логов повышений (нарушение КД 12.7/12.8).',
                inline: false
            },
            {
                name: '🔫 **Мафии и Банды**',
                value: 
                    '• `/проверить-лорность-ников` — Проверка ников фракции на лорные окончания (мафии: русские/итальянские/армянские/мексиканские/японские окончания, гетто: запрет русских окончаний и имен).',
                inline: false
            },
            {
                name: '🛡️ **Security**',
                value: 
                    '• `/бот-чит` — Импорт логов подозрительных игроков (боты).\n' +
                    '• `/лог-бот-чит` — Список открытых подозрений.\n' +
                    '• `/отчет-проверки` — Создать отчет о проверке игрока (закрывает подозрения).\n' +
                    '• `/получить-отчет` — История отчетов по паспорту игрока.',
                inline: false
            },
            {
                name: '👑 **Администрирование**',
                value: 
                    '• `/настройка-администратора` — Смена системной фамилии администратора (Senior Admin or Curator) и выдача доступа к Security.',
                inline: false
            },
            {
                name: 'ℹ️ **Информация**',
                value: 
                    '• `/ping` — Проверка задержки бота.\n' +
                    '• `/help` — Это меню.',
                inline: true
            }
        )
        .setFooter({ 
            text: `Запросил: ${interaction.user.username} | Blackberry Management`, 
            iconURL: interaction.user.displayAvatarURL() 
        })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}