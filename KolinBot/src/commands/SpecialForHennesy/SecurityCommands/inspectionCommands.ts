import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder 
} from 'discord.js';
import { saveInspectionReport, getInspectionReportsByPassportPaginated, getSecurityAcsess, getAdminSurname } from '../../../databases/sqlite';

export const data = new SlashCommandBuilder()
    .setName('отчет-проверки')
    .setDescription('Создать отчет о проверке игрока')
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
    const securityLevel = getSecurityAcsess(interaction.user.id);
    if (securityLevel !== 'yes') {
        return interaction.reply({ 
            content: 'У вас нет доступа к этой команде!', 
            ephemeral: true 
        });
    }

    const passport = interaction.options.getString('паспорт', true);
    const result = interaction.options.getString('итог', true);
    const discordId = interaction.options.getString('discord-id') || undefined;
    const comment = interaction.options.getString('комментарий') || '';
    
    const adminId = interaction.user.id;
    const adminName = interaction.user.username;
    const adminSurname = getAdminSurname(adminId);
    const fullAdminName = adminSurname ? `${adminName} (${adminSurname})` : adminName;
    const fullResult = comment ? `${result}\nКомментарий: ${comment}` : result;
    
    try {
        const reportId = saveInspectionReport(passport, fullResult, adminId, fullAdminName, discordId);
        const { total } = getInspectionReportsByPassportPaginated(passport, 1, 0);
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Отчет о проверке создан')
            .setDescription(`Отчет #${reportId} успешно сохранен`)
            .addFields(
                { name: 'Паспорт (статик)', value: passport, inline: true },
                { name: 'Итог', value: result, inline: true },
                { name: 'Администратор', value: fullAdminName, inline: true },
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
        
        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Ошибка при сохранении отчета:', error);
        await interaction.reply({
            content: 'Произошла ошибка при сохранении отчета!',
            ephemeral: true
        });
    }
}