import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType, MessageFlags
} from 'discord.js';
import { getInspectionReportsByPassportPaginated, getSecurityAccess } from '../../../databases/sqlite';

export const data = new SlashCommandBuilder()
    .setName('получить-отчет')
    .setDescription('[Security] Получить отчеты о проверках игрока по паспорту')
    .addStringOption(option =>
        option.setName('паспорт')
            .setDescription('Паспорт (статик) игрока')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('страница')
            .setDescription('Номер страницы (по умолчанию 1)')
            .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    const securityLevel = getSecurityAccess(interaction.user.id);
    if (securityLevel !== 'yes') {
        return interaction.reply({ 
            content: 'У вас нет доступа к этой команде!', 
            flags: MessageFlags.Ephemeral
        });
    }
    
    const passport = interaction.options.getString('паспорт', true);
    let page = interaction.options.getInteger('страница') || 1;
    const limit = 5;
    
    try {
        const { reports, total } = getInspectionReportsByPassportPaginated(passport, limit, (page - 1) * limit);
        
        if (reports.length === 0) {
            return interaction.reply({
                content: `Не найдено отчетов для паспорта: ${passport}`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        const totalPages = Math.ceil(total / limit);
        if (page > totalPages) page = totalPages;
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Отчеты о проверках игрока`)
            .setDescription(`Паспорт (статик): ${passport}`)
            .addFields(
                { name: 'Всего проверок', value: total.toString(), inline: true },
                { name: 'Страница', value: `${page} / ${totalPages}`, inline: true }
            )
            .setFooter({ 
                text: `Blackberry Management | Inspection Reports`,
                iconURL: interaction.client.user?.displayAvatarURL()
            })
            .setTimestamp();
        
        for (const report of reports) {
            let reportInfo = `Итог: ${report.result.substring(0, 100)}\nАдмин: ${report.admin_name || report.admin_id}`;
            if (report.discord_id) {
                reportInfo += `\nDiscord ID: ${report.discord_id}`;
            }
            
            embed.addFields({
                name: `Отчет #${report.id} (${new Date(report.created_at).toLocaleString('ru-RU')})`,
                value: reportInfo,
                inline: false
            });
        }
        
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_${passport}_${page}`)
                    .setLabel('Предыдущая')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId(`next_${passport}_${page}`)
                    .setLabel('Следующая')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages)
            );
        
        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        
        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });
        
        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.user.id !== interaction.user.id) {
                return buttonInteraction.reply({
                    content: 'Эти кнопки только для создателя запроса!',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            let newPage = page;
            if (buttonInteraction.customId.startsWith('prev')) {
                newPage = page - 1;
            } else if (buttonInteraction.customId.startsWith('next')) {
                newPage = page + 1;
            }
            
            const { reports: newReports } = getInspectionReportsByPassportPaginated(passport, limit, (newPage - 1) * limit);
            
            const newEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`Отчеты о проверках игрока`)
                .setDescription(`Паспорт (статик): ${passport}`)
                .addFields(
                    { name: 'Всего проверок', value: total.toString(), inline: true },
                    { name: 'Страница', value: `${newPage} / ${totalPages}`, inline: true }
                )
                .setFooter({ 
                    text: `Blackberry Management | Inspection Reports`,
                    iconURL: interaction.client.user?.displayAvatarURL()
                })
                .setTimestamp();
            
            for (const report of newReports) {
                let reportInfo = `Итог: ${report.result.substring(0, 100)}\nАдмин: ${report.admin_name} (${report.admin_id})`;
                if (report.discord_id) {
                    reportInfo += `\nDiscord ID: ${report.discord_id}`;
                }
                
                newEmbed.addFields({
                    name: `Отчет #${report.id} (${new Date(report.created_at).toLocaleString('ru-RU')})`,
                    value: reportInfo,
                    inline: false
                });
            }
            
            const newRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`prev_${passport}_${newPage}`)
                        .setLabel('Предыдущая')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(newPage === 1),
                    new ButtonBuilder()
                        .setCustomId(`next_${passport}_${newPage}`)
                        .setLabel('Следующая')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(newPage === totalPages)
                );
            
            await buttonInteraction.update({ embeds: [newEmbed], components: [newRow] });
            page = newPage;
        });
        
        collector.on('end', async () => {
            const disabledRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_disabled')
                        .setLabel('Предыдущая')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_disabled')
                        .setLabel('Следующая')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            await reply.edit({ components: [disabledRow] }).catch(() => {});
        });
        
    } catch (error) {
        console.error('Ошибка при получении отчета:', error);
        await interaction.reply({
            content: 'Произошла ошибка при получении отчетов!',
            flags: MessageFlags.Ephemeral
        });
    }
}