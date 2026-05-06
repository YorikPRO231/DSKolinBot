import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel} from 'discord.js';
import {factionByDiscordID} from "../../utils/constants/fractions";

export const data = new SlashCommandBuilder()
    .setName("отчет-повышение")
    .setDescription('Оформляет отчет на повышение в данном канале')
    .addIntegerOption(opt => opt
        .setName('паспорт')
        .setDescription('Номер Вашего паспорта')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(999999))
    .addStringOption(opt => opt
        .setName('доказательства')
        .setDescription('Доказательства, оформленные согласно правилам повышения в этой фракции')
        .setRequired(true))
    .addIntegerOption(opt => opt
        .setName('ранг')
        .setDescription('Текущий ранг')
        .setRequired(true))
    .addStringOption(opt => opt
        .setName('билет')
        .setDescription('Наличие военного билета')
        .addChoices(
            {name: 'Нет военного билета', value: 'no'},
            {name: 'Есть военный билет', value: 'yes'}
        )
        .setRequired(false));

export async function execute(inter: ChatInputCommandInteraction) {
    const gm = await inter.guild?.members.fetch(inter.user.id).catch(() => null);
    if (!gm) {
        return inter.reply({
            content: 'Данную команду можно использовать только в фракционных каналах.',
            flags: MessageFlags.Ephemeral
        });
    }

    const passport = inter.options.getInteger('паспорт', true);
    const msg = inter.options.getString('доказательства', true);
    const rank = inter.options.getInteger('ранг', true);
    const militaryCardOption = inter.options.getString('билет');
    
    const [factionName] = factionByDiscordID(inter.guild?.id) || [];
    const noMilitaryBonusFactions = ['WN', 'EMS'];
    const militaryCard = militaryCardOption === 'yes' && !noMilitaryBonusFactions.includes(factionName) ? 1 : 0;
    
    let rankTo = rank + 1 + militaryCard;

    if (['LSPD', 'LSSD', 'FIB'].includes(factionName) && rankTo === 6) {
        rankTo += 1;
    }

    const embed = new EmbedBuilder()
        .setTitle(`Отчет о повышении | ${inter.guild?.name}`)
        .addFields(
            {name: 'Информация о сотруднике', value: `<@${inter.user.id}>`, inline: false},
            {name: 'Имя', value: `${gm.displayName || 'Неизвестно'}`, inline: true},
            {name: 'ID', value: `${inter.user.id}`, inline: true},
            {name: 'Паспорт', value: `${passport}`, inline: true},
            {name: 'Детали повышения', value: `${rank} -> ${rankTo}`, inline: false},
            {name: 'Текущий ранг', value: `${rank}`, inline: true},
            {name: 'Новый ранг', value: `${rankTo}`, inline: true},
            {name: 'Военный билет', value: `${militaryCardOption === 'yes' ? 'Есть' : 'Нет'}`, inline: true},
            {name: 'Доказательства', value: `${msg}`, inline: false}
        )
        .setTimestamp()
        .setColor(0x9003fc);

    const channel = inter.channel as TextChannel;
    
    const roleNames = ['Старший состав', 'Центральное командование', 'Руководящий состав'];
    const roles = roleNames.map(name => inter.guild?.roles.cache.find(role => role.name === name));
    const targetRole = roles.find(role => role !== undefined);
    const roleMention = targetRole ? `<@&${targetRole.id}> ` : '';


    await channel.send({
        embeds: [embed],
        content: roleMention
    });

    return inter.reply({
        content: 'Отчет успешно отправлен.',
        flags: MessageFlags.Ephemeral
    });
}