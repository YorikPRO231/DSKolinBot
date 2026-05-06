import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName("вернуть-из-внедрения")
    .setDescription('Вернуть игрока из внедрения')
    .addUserOption(opt => opt.setName('игрок').setDescription('Возвращаемый игрок').setRequired(true))
    .addStringOption(opt => opt.setName('ранг').setDescription('Ранг после возвращения').setRequired(true));

export async function execute(inter: ChatInputCommandInteraction) {
    const p = inter.options.getUser('игрок', true);
    const rank = inter.options.getString('ранг', true);
    const gm = await inter.guild?.members.fetch(p.id).catch(() => null)
    const gm2 = await inter.guild?.members.fetch(inter.user.id).catch(() => null)
    const embed = new EmbedBuilder()
        .setTitle(`Отчет о возвращении из внедрения | ${inter.guild?.name}`)
        .addFields(
            {name: 'Возвращенный игрок', value: `<@${p.id}>`, inline: true},
            {name: 'Имя игрока', value: `${gm?.displayName || 'Неизвестно'}`, inline: true},
            {name: 'ID игрока', value: `${p.id}`, inline: true},
            {name: 'Вернул', value: `<@${inter.user.id}>`, inline: true},
            {name: 'Имя вернувшего', value: `${gm2?.displayName || 'Неизвестно'}`, inline: true},
            {name: 'ID вернувшего', value: `${inter.user.id}`, inline: true},
            {name: 'Ранг после возвращения', value: `${rank}`, inline: true},
        )
        .setTimestamp()
        .setColor(0x9003fc)
    return inter.reply({embeds: [embed], content: `<@${inter.user.id}> возвращает из внедрения <@${p.id}>` })
}