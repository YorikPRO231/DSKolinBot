import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName("отправить-во-внедрение")
    .setDescription('Отправить игрока во внедрения')
    .addUserOption(opt => opt.setName('игрок').setDescription('Отправляемый игрок').setRequired(true))
    .addStringOption(opt => opt.setName('ранг').setDescription('Ранг до внедрения').setRequired(true))
    .addStringOption(opt => opt.setName('фракция').setDescription('Укажите фракцию куда внедряется игрок').setRequired(true));

export async function execute(inter: ChatInputCommandInteraction) {
    const p = inter.options.getUser('игрок', true);
    const rank = inter.options.getString('ранг', true);
    const faction = inter.options.getString('фракция', true);
    const gm = await inter.guild?.members.fetch(p.id).catch(() => null)
    const gm2 = await inter.guild?.members.fetch(inter.user.id).catch(() => null)
    const embed = new EmbedBuilder()
        .setTitle(`Отчет об отправке во внедрение | ${inter.guild?.name}`)
        .addFields(
            {name: 'Отправленный игрок', value: `<@${p.id}>`, inline: true},
            {name: 'Имя игрока', value: `${gm?.displayName || 'Неизвестно'}`, inline: true},
            {name: 'ID игрока', value: `${p.id}`, inline: true},
            {name: 'Отправил', value: `<@${inter.user.id}>`, inline: true},
            {name: 'Имя отправившего', value: `${gm2?.displayName || 'Неизвестно'}`, inline: true},
            {name: 'ID отправившего', value: `${inter.user.id}`, inline: true},
            {name: 'Ранг до внедрения', value: `${rank}`, inline: true},
            {name: 'Фракция внедрения', value: `${faction}`, inline: true}
        )
        .setTimestamp()
        .setColor(0x9003fc)
    return inter.reply({embeds: [embed], content: `<@${inter.user.id}> отправляет во внедрение <@${p.id}>`})
}