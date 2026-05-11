import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel, NewsChannel, ThreadChannel} from 'discord.js';
import {retrieveInfiltration} from "../../databases/sqlite";
import {DETECTIVES_INFO} from "../../utils/constants/fractions";
import {ADMIN_NICKNAME_LOGS_CHANNEL_ID} from "../../utils/config";

type SendableChannel = TextChannel | NewsChannel | ThreadChannel;
type FactionType = keyof typeof DETECTIVES_INFO;

export const data = new SlashCommandBuilder()
    .setName("вернуть-из-внедрения")
    .setDescription('Вернуть игрока из внедрения')
    .addUserOption(opt => 
        opt.setName('игрок')
            .setDescription('Возвращаемый игрок')
            .setRequired(true)
    );

function isSendableChannel(channel: unknown): channel is SendableChannel {
    return channel instanceof TextChannel || 
           channel instanceof NewsChannel || 
           channel instanceof ThreadChannel;
}

async function fetchSendableChannel(client: any, channelId: string): Promise<SendableChannel | null> {
    try {
        const channel = await client.channels.fetch(channelId);
        return isSendableChannel(channel) ? channel : null;
    } catch {
        return null;
    }
}

function getNameLogsChannel(faction: string): string {
    if (faction in DETECTIVES_INFO) {
        return DETECTIVES_INFO[faction as FactionType].name_logs_id;
    }
    return 'nn';
}

export async function execute(inter: ChatInputCommandInteraction) {
    const targetUser = inter.options.getUser('игрок', true);
    const targetMember = await inter.guild?.members.fetch(targetUser.id).catch(() => null);
    const adminMember = await inter.guild?.members.fetch(inter.user.id).catch(() => null);
    
    const infiltration = retrieveInfiltration(targetUser.id);
    if (!infiltration) {
        return inter.reply({
            content: 'Не удалось найти информацию о внедрении данного игрока.', 
            flags: MessageFlags.Ephemeral
        });
    }

    const wasNickChange = infiltration.passport !== 'NoNickChange';
    const rank = infiltration.rank;
    const adminDisplayName = adminMember?.displayName || 'Неизвестно';
    
    let embed: EmbedBuilder;
    let adminEmbed: EmbedBuilder | null = null;
    
    if (wasNickChange) {
        embed = new EmbedBuilder()
            .setTitle(`Отчет о возвращении из внедрения | ${inter.guild?.name}`)
            .addFields(
                {name: 'Возвращенный игрок', value: `<@${targetUser.id}>`, inline: true},
                {name: 'Старое имя игрока', value: infiltration.oldnickname, inline: true},
                {name: 'Имя игрока во внедрении', value: infiltration.newnickname, inline: true},
                {name: 'Вернул', value: `<@${inter.user.id}>`, inline: true},
                {name: 'Имя вернувшего', value: adminDisplayName, inline: true},
                {name: 'Ранг после возвращения', value: rank.toString(), inline: true},
            )
            .setTimestamp()
            .setColor(0x9003fc);

        adminEmbed = new EmbedBuilder()
            .setTitle(`Запрос на обратную смену имени ${infiltration.detectivefaction}`)
            .setDescription(`Требуется выдача бесплатной смены ника на ${infiltration.oldnickname}:\n\`\`\`\noffforce_rename ${infiltration.passport} С внедрения\`\`\``)
            .setFooter({ text: `Запрос составлен ${adminDisplayName} ${inter.user.id}` })
            .setColor(0xFF0000)
            .setTimestamp();        
        
    } else {
        embed = new EmbedBuilder()
            .setTitle(`Отчет о возвращении из внедрения | ${inter.guild?.name}`)
            .addFields(
                {name: 'Возвращенный игрок', value: `<@${targetUser.id}>`, inline: true},
                {name: 'Имя игрока', value: targetMember?.displayName || 'Неизвестно', inline: true},
                {name: 'ID игрока', value: targetUser.id, inline: true},
                {name: 'Вернул', value: `<@${inter.user.id}>`, inline: true},
                {name: 'Имя вернувшего', value: adminDisplayName, inline: true},
                {name: 'ID вернувшего', value: inter.user.id, inline: true},
                {name: 'Ранг после возвращения', value: rank.toString(), inline: true},
            )
            .setTimestamp()
            .setColor(0x9003fc);
    }

    const adminLogsChannel = await fetchSendableChannel(inter.client, ADMIN_NICKNAME_LOGS_CHANNEL_ID);
    if (adminLogsChannel && adminEmbed) {
        await adminLogsChannel.send({ embeds: [adminEmbed], content: "<@&796471733057880174>" });
    }

    return inter.reply({
        embeds: [embed], 
        content: `<@${inter.user.id}> возвращает из внедрения <@${targetUser.id}>`
    });
}