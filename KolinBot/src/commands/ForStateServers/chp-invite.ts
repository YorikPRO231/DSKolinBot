import {
    ChatInputCommandInteraction, EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder, TextChannel
} from 'discord.js';
import {factionByDiscordID, FRACTION_INFO} from "../../utils/constants/fractions";
import { CHP_INVITE_CHANNEL_ID } from "../../utils/config";


export const data = new SlashCommandBuilder()
    .setName("чп-приглашение")
    .setDescription('Создает уникальную одноразовую ссылку для получения приглашения в ЧП')


export async function execute(inter: ChatInputCommandInteraction) {
    const member = inter.guild ? await inter.guild.members.fetch(inter.user.id).catch(() => null) : null;
    if (!member || !inter.guild) {
        return inter.reply({content: '❌ Данную команду можно использовать только в фракционных каналах.', flags: MessageFlags.Ephemeral});
    }

    const [serverType, factionInfo] = factionByDiscordID(inter.guild.id);
    if (serverType === 'TEST_SERVER' || !factionInfo?.state) {
        return inter.reply({content: '❌ Данную команду можно использовать только в каналах гос. фракций.', flags: MessageFlags.Ephemeral});
    }

    const chpServer = inter.client.guilds.cache.get(FRACTION_INFO['CHP_SERVER'].discord_id);
    const inviteChannel = chpServer ? await chpServer.channels.fetch(CHP_INVITE_CHANNEL_ID).catch(() => null) : null;
    if (!chpServer || !inviteChannel?.isTextBased() || inviteChannel.isThread()) {
        return inter.reply({content: '⚠️ Не удалось определить сервер/канал ЧП. Обратитесь к ст. составу.', flags: MessageFlags.Ephemeral});
    }

    const invite = await chpServer.invites.create(inviteChannel, {
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