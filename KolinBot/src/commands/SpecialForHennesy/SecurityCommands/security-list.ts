import { 
    ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, 
    Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} from 'discord.js';
import { getAdminSurname, getSecurityAlerts, getSecurityAccess } from '../../../databases/sqlite';

export const data = new SlashCommandBuilder()
    .setName("лог-бот-чит")
    .setDescription("[Security] Список подозреваемых");

export async function execute(inter: ChatInputCommandInteraction) {
    const securityLevel = getSecurityAccess(inter.user.id);
    if (securityLevel !== 'yes') {
        return inter.reply({ 
            content: '❌ У вас нет доступа к этой команде!', 
            flags: MessageFlags.Ephemeral
        });
    }

    await inter.deferReply();

    const alerts = getSecurityAlerts('OPEN');

    if (!alerts || alerts.length === 0) {
        return inter.editReply(`🔍 Нет открытых подозрений в базе данных.`);
    }

    const MAX_PER_PAGE = 10;
    const totalPages = Math.ceil(alerts.length / MAX_PER_PAGE);
    let currentPage = 0;
    let collectorActive = true;

    const generateEmbed = (page: number) => {
        const start = page * MAX_PER_PAGE;
        const end = start + MAX_PER_PAGE;
        const currentAlerts = alerts.slice(start, end);

        const embed = new EmbedBuilder()
            .setTitle("🚨 Реестр подозреваемых (открытые)")
            .setColor(Colors.DarkRed)
            .setTimestamp()
            .setFooter({ text: `Страница ${page + 1} из ${totalPages} | Всего открытых: ${alerts.length}` });

        const description = currentAlerts.map(alert => {
            const date = new Date(alert.created_at);
            const timeStr = date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            
            const adminName = getAdminSurname(alert.admin_id) || `<@${alert.admin_id}>`;
            
            const warningLevel = alert.count > 5 ? '⚠️' : '';
            const countLabel = alert.count > 1 ? ` (x${alert.count})` : '';

            return `**${timeStr}** | \`ID: ${alert.suspect}\`${countLabel} ${warningLevel}\n` +
                   `┣ **${alert.suspected_action}**\n` +
                   `┗ 🔍 ${alert.work_data} — ${adminName}\n`;
        }).join('\n');

        embed.setDescription(description || 'Нет записей на этой странице');
        return embed;
    };

    if (totalPages <= 1) {
        return inter.editReply({ embeds: [generateEmbed(0)] });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('⬅️ Назад')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('Вперед ➡️')
            .setStyle(ButtonStyle.Secondary)
    );

    const message = await inter.editReply({ 
        embeds: [generateEmbed(0)], 
        components: [row] 
    });

    const collector = message.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (i) => {
        if (!collectorActive) return;
        
        if (i.user.id !== inter.user.id) {
            return i.reply({ content: "❌ Это не ваше меню", flags: MessageFlags.Ephemeral});
        }

        if (i.customId === 'prev_page') currentPage--;
        if (i.customId === 'next_page') currentPage++;

        const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('⬅️ Назад')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('Вперед ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages - 1)
        );

        await i.update({ embeds: [generateEmbed(currentPage)], components: [updatedRow] });
    });

    collector.on('end', async () => {
        collectorActive = false;
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('⬅️ Назад')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('Вперед ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );
        
        try {
            await message.edit({ components: [disabledRow] });
        } catch (error) {
            // Сообщение могло быть удалено
        }
    });
}