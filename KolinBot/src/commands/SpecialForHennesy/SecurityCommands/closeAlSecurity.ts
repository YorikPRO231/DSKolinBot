import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder,
    Colors
} from 'discord.js';
import { getSecurityAlerts, closeAlert, getSecurityAccess } from '../../../databases/sqlite';

export const data = new SlashCommandBuilder()
    .setName("закрыть-тикет")
    .setDescription("[Security] Закрыть подозрение на игрока по статику")
    .addStringOption(option => 
        option.setName("статик")
            .setDescription("ID игрока (статик-паспорт)")
            .setRequired(true)
    )
    .addStringOption(option => 
        option.setName("причина")
            .setDescription("Причина закрытия")
            .setRequired(false)
    );

export async function execute(inter: ChatInputCommandInteraction) {
    const securityLevel = getSecurityAccess(inter.user.id);
    if (securityLevel !== 'yes') {
        return inter.reply({ 
            content: '❌ У вас нет доступа к этой команде!', 
            ephemeral: true 
        });
    }

    await inter.deferReply({ ephemeral: true });

    const suspectId = inter.options.getString("статик", true);
    const reason = inter.options.getString("причина") || "Не указана";

    const allAlerts = getSecurityAlerts();
    const suspectAlerts = allAlerts.filter(alert => 
        alert.suspect === suspectId && alert.status === 'OPEN'
    );

    if (suspectAlerts.length === 0) {
        return inter.editReply({
            content: `❌ Не найдено открытых подозрений на игрока с ID: **${suspectId}**`
        });
    }

    let closedCount = 0;
    for (const alert of suspectAlerts) {
        const result = closeAlert(alert.id, inter.user.id);
        if (result.changes > 0) closedCount++;
    }

    const embed = new EmbedBuilder()
        .setTitle("✅ Статус проверки обновлён")
        .setColor(Colors.Green)
        .setTimestamp()
        .addFields(
            { name: "Статик игрока", value: `\`${suspectId}\``, inline: true },
            { name: "Закрыто записей", value: `${closedCount} из ${suspectAlerts.length}`, inline: true },
            { name: "Закрыл", value: `<@${inter.user.id}>`, inline: true },
            { name: "Причина закрытия", value: reason, inline: false }
        )
        .setFooter({ text: "Статус изменён на 'ЗАКРЫТ'" });

    await inter.editReply({ embeds: [embed] });
}