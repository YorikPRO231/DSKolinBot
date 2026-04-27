import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { exportSecurityAlertsMany, getSecurityAccess } from '../../../databases/sqlite';

export const data = new SlashCommandBuilder()
    .setName("добавить-игрока")
    .setDescription("[Security] Ручное добавление игрока в список проверок")
    .addStringOption(option => 
        option.setName("статик")
            .setDescription("Статик игрока")
            .setRequired(true)
    )
    .addStringOption(option => 
        option.setName("причина")
            .setDescription("Укажите на что требуется проверить игрока")
            .setRequired(true)
    );

export async function execute(inter: ChatInputCommandInteraction) {
    const securityLevel = getSecurityAccess(inter.user.id);
    if (securityLevel !== 'yes') {
        return inter.reply({ 
            content: '❌ У вас нет доступа к этой команде!', 
            ephemeral: true 
        });
    }

    await inter.deferReply();

    const playerId = inter.options.getString("статик", true);
    const actionType = inter.options.getString("причина", true);

    if (!/^\d+$/.test(playerId)) {
        return inter.editReply("❌ ID игрока должен содержать только цифры");
    }

    try {
        exportSecurityAlertsMany(inter.user.id, [{
            suspect: playerId,
            action: actionType,
            data: 'Ручное добавление'
        }]);

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('Игрок добавлен в список проверок')
            .setDescription(`Пользователь **${inter.user.displayName}** добавил нового подозрительного игрока`)
            .addFields(
                { name: 'ID игрока', value: `\`${playerId}\``, inline: true },
                { name: 'Причина добавления', value: `\`${actionType}\``, inline: true },
                { name: 'Дата добавления', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: `Добавлено: ${inter.user.tag}` })
            .setTimestamp();

        await inter.editReply({ embeds: [embed] });
        
    } catch (e) {
        console.error('Ошибка при добавлении игрока:', e);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('Ошибка')
            .setDescription('Произошла ошибка при добавлении игрока в базу данных')
            .setTimestamp();
            
        await inter.editReply({ embeds: [errorEmbed] });
    }
}