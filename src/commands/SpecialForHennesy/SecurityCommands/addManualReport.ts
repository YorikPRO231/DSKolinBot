import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';
import {AdminsRepository, SecurityRepository} from '../../../databases';

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
    ).addStringOption(opt => opt.setName('тип')
        .setDescription('Cheats/Bots')
        .addChoices({name: 'Cheats', value: 'Cheats'}, {name: 'Bots', value: 'Bots'})
        .setRequired(true));

export async function execute(inter: ChatInputCommandInteraction) {
    const securityLevel = await AdminsRepository.getSecurityAccess(inter.user.id);
    if (securityLevel !== 'yes') {
        return inter.reply({ 
            content: '❌ У вас нет доступа к этой команде!', 
            flags: MessageFlags.Ephemeral
        });
    }

    await inter.deferReply();

    const playerId = inter.options.getString("статик", true);
    const reason = inter.options.getString("причина", true);
    const type = inter.options.getString('тип', true);

    if (!/^\d+$/.test(playerId)) {
        return inter.editReply("❌ ID игрока должен содержать только цифры");
    }

    try {
        await SecurityRepository.addSecurityRequest(type, inter.user.id, reason, playerId)

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('Игрок добавлен в список проверок')
            .setDescription(`Пользователь **${inter.user.displayName}** добавил нового подозрительного игрока`)
            .addFields(
                { name: 'ID игрока', value: `\`${playerId}\``, inline: true },
                {name: 'Причина добавления', value: `\`${reason}\``, inline: true},
                {name: 'Тип проверки', value: type, inline: true},
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