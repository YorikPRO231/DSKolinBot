import { 
    ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, 
    Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle 
} from 'discord.js';
import { getAdminSurname, getSecurityAlerts } from '../../databases/sqlite';

export const data = new SlashCommandBuilder()
    .setName("лог-бот-чит")
    .setDescription("[Security] Список подозреваемых ");

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply();

    const alerts = getSecurityAlerts();

    if (!alerts || alerts.length === 0) {
        return inter.editReply(`🔍 В базе данных пока нет записей.`);
    }

    const MAX_PER_PAGE = 10;
    const totalPages = Math.ceil(alerts.length / MAX_PER_PAGE);
    let currentPage = 0;

    const generateEmbed = (page: number) => {
        const start = page * MAX_PER_PAGE;
        const end = start + MAX_PER_PAGE;
        const currentAlerts = alerts.slice(start, end);

        const embed = new EmbedBuilder()
            .setTitle("🚨 Реестр подозреваемых")
            .setColor(Colors.DarkRed)
            .setTimestamp()
            .setFooter({ text: `Страница ${page + 1} из ${totalPages} | Всего записей: ${alerts.length}` });

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

        embed.setDescription(description);
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
        if (i.user.id !== inter.user.id) return i.reply({ content: "Это не ваше меню", ephemeral: true });

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
}