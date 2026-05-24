import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
    TextChannel,
    NewsChannel,
    ThreadChannel
} from 'discord.js';
import { InfiltrationsRepository } from "../../databases/index";
import { getSystemChannel, getSystemRole } from '../../config/settings-loader';

type SendableChannel = TextChannel | NewsChannel | ThreadChannel;

function isSendableChannel(channel: unknown): channel is SendableChannel {
    return channel instanceof TextChannel || 
           channel instanceof NewsChannel || 
           channel instanceof ThreadChannel;
}

export const data = new SlashCommandBuilder()
    .setName("отправить-во-внедрение")
    .setDescription('Отправить игрока во внедрения')
    .addUserOption(opt => 
        opt.setName('игрок')
            .setDescription('Отправляемый игрок')
            .setRequired(true)
    )
    .addIntegerOption(opt => 
        opt.setName('ранг')
            .setDescription('Ранг игрока до внедрения')
            .setRequired(true)
    )
    .addStringOption(opt => 
        opt.setName('фракция')
            .setDescription('Укажите фракцию куда внедряется игрок')
            .setRequired(true)
        .addChoices(
                { name: 'Мексиканская мафия (MM)', value: 'MM' },
                { name: 'Русская мафия (RM)', value: 'RM' },
                { name: 'Итальянская мафия (LCN)', value: 'LCN' },
                { name: 'Японская мафия (YAK)', value: 'YAK' },
                { name: 'Армянская мафия (AM)', value: 'AM' },
                { name: 'The Families (FAM)', value: 'FAM' },
                { name: 'Marabunta Grande (MG)', value: 'MG' },
                { name: 'Los Santos Vagos (LSV)', value: 'LSV' },
                { name: 'East Side Ballas (ESB)', value: 'ESB' },
                { name: 'Bloods Street Gang (BSG)', value: 'BSG' }
            )
    )
    .addStringOption(opt => 
        opt.setName("ник-внедрения")
            .setDescription("Укажите ник во внедрение")
            .setRequired(false)
    )
    .addStringOption(opt => 
        opt.setName('паспорт')
            .setDescription('Укажите паспорт игрока')
            .setRequired(false)
    );

export async function execute(inter: ChatInputCommandInteraction) {
    if (!inter.guild) {
        throw new Error('Не удалось получить гильдию.');
    }

    const targetUser = inter.options.getUser('игрок', true);
    const rank = inter.options.getInteger('ранг', true);
    const faction = inter.options.getString('фракция', true);
    const infiltrationNickname = inter.options.getString('ник-внедрения', false);
    const passport = inter.options.getString('паспорт', false);
    
    const targetMember = await inter.guild.members.fetch(targetUser.id).catch(() => null);
    const adminMember = await inter.guild.members.fetch(inter.user.id).catch(() => null);
    
    const targetDisplayName = targetMember?.displayName || 'Неизвестно';
    const adminDisplayName = adminMember?.displayName || 'Неизвестно';
    const guildName = inter.guild.name;

    const reportEmbed = new EmbedBuilder()
        .setTitle(`Отчет об отправке во внедрение | ${guildName}`)
        .addFields(
            {name: 'Отправленный игрок', value: `<@${targetUser.id}>`, inline: true},
            {name: 'Имя игрока', value: targetDisplayName, inline: true},
            {name: 'ID игрока', value: targetUser.id, inline: true},
            {name: 'Отправил', value: `<@${inter.user.id}>`, inline: true},
            {name: 'Имя отправившего', value: adminDisplayName, inline: true},
            {name: 'ID отправившего', value: inter.user.id, inline: true},
            {name: 'Ранг до внедрения', value: rank.toString(), inline: true},
            {name: 'Фракция внедрения', value: faction, inline: true}
        )
        .setTimestamp()
        .setColor(0x9003fc);

    if (infiltrationNickname && !passport) {
        return inter.reply({
            content: 'Для создания запроса смены никнейма следует указывать паспорт игрока.', 
            flags: MessageFlags.Ephemeral
        });
    }

    if (infiltrationNickname && passport) {
        const govRequestEmbed = new EmbedBuilder()
            .setTitle(`Запрос на смену паспортных данных | ${guildName}`)
            .addFields(
                {name: 'Имя отправляемого игрока', value: targetDisplayName, inline: true},
                {name: 'Имя заявителя', value: adminDisplayName, inline: true},
                {name: 'Фракция внедрения', value: faction, inline: true},
                {name: 'Новый ник для игрока', value: infiltrationNickname}
            )
            .setTimestamp()
            .setColor(Colors.DarkRed);

        const govChannel = await inter.client.channels.fetch(getSystemChannel('gov_nickname_requests')).catch(() => null);
        
        if (!govChannel || !isSendableChannel(govChannel)) {
            return inter.reply({
                content: 'Не удалось отправить сообщение об отправке во внедрение. Сообщите администрации об ошибке.', 
                flags: MessageFlags.Ephemeral
            });
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`dnames_${inter.channelId}_${targetUser.id}_gov`)
                .setLabel('Одобрить')
                .setStyle(ButtonStyle.Primary)
        );

        const mentions = getSystemRole('gov_nickname_requests').map(id => `<@&${id}>`).join(' ');
        
        await govChannel.send({
            embeds: [govRequestEmbed], 
            components: [row], 
            content: mentions
        });

        reportEmbed.addFields({name: 'Ник для внедрения', value: infiltrationNickname});
    }

    InfiltrationsRepository.pushInfiltration(
        rank,
        faction, 
        guildName.replace(' | Blackberry', ''),
        targetUser.id,
        infiltrationNickname || 'NoNickChange',
        targetDisplayName, 
        passport || 'NoNickChange'
    );

    if (passport) {
        reportEmbed.addFields({name: 'Паспорт игрока', value: passport});
    }

    return inter.reply({
        embeds: [reportEmbed], 
        content: `<@${inter.user.id}> отправляет во внедрение <@${targetUser.id}>`
    });
}