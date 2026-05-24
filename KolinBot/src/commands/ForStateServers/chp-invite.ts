import {
    ChatInputCommandInteraction, EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder, TextChannel
} from 'discord.js';
import { getFactionByDiscordId, getServers, getSystemChannel } from '../../config/settings-loader';

export const data = new SlashCommandBuilder()
    .setName("чп-приглашение")
    .setDescription('Создает уникальную одноразовую ссылку для получения приглашения в ЧП')

export async function execute(inter: ChatInputCommandInteraction) {
    const member = inter.guild ? await inter.guild.members.fetch(inter.user.id).catch(() => null) : null;
    if (!member || !inter.guild) {
        return inter.reply({content: '❌ Данную команду можно использовать только в фракционных каналах.', flags: MessageFlags.Ephemeral});
    }

    const factionResult = getFactionByDiscordId(inter.guild.id);
    if (!factionResult || factionResult[1].type !== 'government') {
        return inter.reply({content: '❌ Данную команду можно использовать только в каналах гос. фракций.', flags: MessageFlags.Ephemeral});
    }

    const chpServerId = getServers().chp;
    const inviteChannelId = getSystemChannel('chp_invite');

    const chpServer = inter.client.guilds.cache.get(chpServerId);
    const inviteChannel = chpServer ? await chpServer.channels.fetch(inviteChannelId).catch(() => null) : null;
    if (!chpServer || !inviteChannel?.isTextBased() || inviteChannel.isThread()) {
        return inter.reply({content: '⚠️ Не удалось определить сервер/канал ЧП. Обратитесь к ст. составу.', flags: MessageFlags.Ephemeral});
    }

    const invite = await chpServer.invites.create(inviteChannel as TextChannel, {
        maxUses: 1,
        maxAge: 30 * 60,
        reason: `Запрос пользователем ${inter.user.displayName} (${inter.user.id})`
    });

    return inter.reply({
        embeds: [new EmbedBuilder()
            .setAuthor({name: 'GTA 5 RP | ЧП Blackberry', iconURL: chpServer.iconURL() || undefined})
            .setTitle('Ссылка для подключения к ЧП')
            .setColor(0xb30024)
            .setDescription(`Ваше приглашение в ЧП: ${invite.url}`)
            .setFooter({text: 'Уникальное приглашение ЧП Blackberry', iconURL: inter.user.displayAvatarURL()})
            .setTimestamp()
        ], flags: MessageFlags.Ephemeral
    });
}