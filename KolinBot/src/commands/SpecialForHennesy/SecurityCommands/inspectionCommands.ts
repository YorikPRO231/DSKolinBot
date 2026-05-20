import {
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';
import {AdminsRepository, InspectionsRepository, SecurityRepository} from '../../../databases';

export const data = new SlashCommandBuilder()
    .setName('отчет-проверки')
    .setDescription('[Security] Создать отчет о проверке игрока и закрыть его подозрения')
    .addStringOption(option =>
        option.setName('паспорт')
            .setDescription('Паспорт (статик) проверяемого игрока')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('итог')
            .setDescription('Итог проверки')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('discord-id')
            .setDescription('Discord ID проверяемого игрока (необязательно)')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('комментарий')
            .setDescription('Дополнительный комментарий к проверке')
            .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    const securityLevel = AdminsRepository.getSecurityAccess(interaction.user.id);
    if (securityLevel !== 'yes') {
        return interaction.reply({ 
            content: '❌ У вас нет доступа к этой команде!', 
            flags: MessageFlags.Ephemeral
        });
    }

    const passport = interaction.options.getString('паспорт', true);
    const result = interaction.options.getString('итог', true);
    const discordId = interaction.options.getString('discord-id') || undefined;
    const comment = interaction.options.getString('комментарий') || '';
    
    const adminId = interaction.user.id;
    const adminName = (interaction.member as GuildMember)?.displayName || interaction.user.username;
    const fullResult = comment ? `${result}\nКомментарий: ${comment}` : result;
    
    try {
        const openAlerts = SecurityRepository.getSecurityAlertsBySuspect(passport, 'OPEN');
        
        let closedCount = 0;
        if (openAlerts.length > 0) {
            closedCount = SecurityRepository.closeAlertsBySuspectIfExists(passport);
        }
        
        const reportId = InspectionsRepository.saveInspectionReport(passport, fullResult, adminId, adminName, discordId);
        const { total } = InspectionsRepository.getInspectionReportsByPassportPaginated(passport, 1, 0);
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Отчет о проверке создан')
            .setDescription(`Отчет #${reportId} успешно сохранен`)
            .addFields(
                { name: 'Паспорт (статик)', value: passport, inline: true },
                { name: 'Итог', value: result.length > 50 ? result.slice(0, 47) + '...' : result, inline: true },
                { name: 'Администратор', value: adminName, inline: true },
                { name: 'Дата', value: new Date().toLocaleString('ru-RU'), inline: true },
                { name: 'Всего проверок', value: total.toString(), inline: true }
            )
            .setFooter({ 
                text: `ID отчета: ${reportId} | Blackberry Management`,
                iconURL: interaction.client.user?.displayAvatarURL()
            })
            .setTimestamp();
        
        if (discordId) {
            embed.addFields({ name: 'Discord ID', value: discordId, inline: true });
        }
        
        if (comment) {
            embed.addFields({ name: 'Комментарий', value: comment, inline: false });
        }
        
        if (closedCount > 0) {
            embed.addFields({ 
                name: 'Автоматическое закрытие', 
                value: `Закрыто подозрений: **${closedCount}**\nВсе открытые записи на этого игрока были автоматически закрыты.`,
                inline: false 
            });
            embed.setColor(Colors.Blue);
        } else if (openAlerts.length === 0) {
            embed.addFields({ 
                name: 'Информация', 
                value: 'На этого игрока не было открытых подозрений.',
                inline: false 
            });
        }
        
        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Ошибка при сохранении отчета:', error);
        await interaction.reply({
            content: '❌ Произошла ошибка при сохранении отчета!',
            flags: MessageFlags.Ephemeral
        });
    }
}