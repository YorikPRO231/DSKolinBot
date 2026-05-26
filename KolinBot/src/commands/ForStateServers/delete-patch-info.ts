import {
    ActionRowBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import {PatchesRepository, StatePatch} from "../../databases";
import {getSystemChannel, getSystemRole} from '../../config/settings-loader';
import {ComponentType} from "discord-api-types/v10";

export const factions = ['GOV'];

export const data = new SlashCommandBuilder()
    .setName("удалить-нашивку")
    .setDescription('Удаляет нашивку пользователя с уведомлением в личные сообщения')
    .addIntegerOption(opt => opt
        .setName('паспорт')
        .setDescription('Номер паспорта игрока для удаления. ')
        .setMinValue(1)
        .setMaxValue(999999))
    .addStringOption(opt => opt
        .setName('дискорд-id')
        .setDescription('Удалить по discord-id'))

async function safeReply(interaction: ChatInputCommandInteraction, data: any) {
    if (interaction.replied || interaction.deferred) {
        return interaction.editReply(data);
    }
    return interaction.reply(data);
}


async function inform(inter: ChatInputCommandInteraction, ps: StatePatch) {
    const luser = await inter.client.users.fetch(ps.discord_id).catch(() => null);
    if (!luser) {
        return await safeReply(inter, {
            content: `Не удалось отправить уведомление игроку <@${ps.discord_id}>. Попробуйте еще раз позднее, либо передайте уведомление по почте.`
        })
    }
    const embedLS = new EmbedBuilder()
        .setAuthor({
            name: `GTA 5 RP | Blackberry`,
            iconURL: inter.guild?.iconURL() || undefined
        })
        .setTitle('Уведомление об удалении нашивки')
        .setColor(0x5865F2)
        .setFooter({
            text: `Удаление произведено ${inter.user.tag}`,
            iconURL: inter.user.displayAvatarURL()
        })
        .setTimestamp()
        .setDescription('Ваша нашивка была удалена за несоответствие правилам сервера или иным причинам. \nЗапросите новую нашивку у старшего состава, старой пользоваться - запрещено и будет приравнено к обману в /do.');

    try {
        await luser.send({embeds: [embedLS]});

        return await safeReply(inter, {
            content: `Нашивка игрока **${ps.username}** (паспорт #${ps.passport}) успешно удалена. Уведомление отправлено в личные сообщения.`
        });
    } catch (error) {
        console.error('Ошибка отправки ЛС:', error);
        return await safeReply(inter, {
            content: `Нашивка удалена, но не удалось отправить уведомление игроку <@${ps.discord_id}>. Возможно, у него закрыты личные сообщения.`
        });
    }
}

export async function execute(inter: ChatInputCommandInteraction) {
    const gm = await inter.guild?.members.fetch(inter.user.id).catch(() => null);
    if (!gm) {
        return inter.reply({
            content:'Данную команду можно использовать только в дискорде правительства с соответствующим доступом и в определенном канале.',
            flags: MessageFlags.Ephemeral
        })
    }

    const hasRole = gm.roles?.cache?.some((r: any) => getSystemRole('gov_delete_patch').includes(r.id));
    if (!hasRole || inter.channelId != getSystemChannel('gov_delete_patch')) {
        return inter.reply({
            content:'Доступ к данной команде имеется только у администрации и губернатора штата.',
            flags: MessageFlags.Ephemeral
        })
    }
    const passport = inter.options.getInteger('паспорт')
    const discordId = inter.options.getString('дискорд-id')
    let ps: StatePatch | undefined = undefined;
    if (passport) {
        ps = PatchesRepository.retrievePlayerPatch(passport)
    } else if (discordId) {
        const l = PatchesRepository.getPatchByDiscord(discordId);
        if (l.length === 1) {
            ps = l[0];
        } else {
            const options = l.map((patch, index) => {
                return new StringSelectMenuOptionBuilder()
                    .setLabel(patch.patch || `Нашивка №${index + 1}`)
                    .setDescription(`ID: ${patch.id}`)
                    .setValue(patch.id.toString());
            });
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('delete_patch_select')
                .setPlaceholder('Выберите нашивку для удаления...')
                .addOptions(options);
            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
            const response = await inter.reply({
                content: 'У этого пользователя несколько нашивок. Выберите нужную для удаления:',
                components: [row],
                flags: MessageFlags.Ephemeral
            });
            try {
                const confirmation = await response.awaitMessageComponent({
                    componentType: ComponentType.StringSelect,
                    time: 60000
                });
                const selectedId = confirmation.values[0];
                ps = l.find(patch => patch.id.toString() === selectedId);
                await confirmation.deferUpdate();
            } catch (e) {
                return inter.editReply({
                    content: 'Время ожидания выбора истекло. Команда отменена.',
                    components: []
                });
            }
        }
    }
    if (!ps) {
        if (inter.replied) {
            return inter.editReply({content: 'Не удалось найти или выбрать нашивку.', components: []});
        }
        return inter.reply({content: 'Не удалось найти пользователя с данным паспортом или Discord ID.'});
    }
    const status = PatchesRepository.deletePatch(ps.id, inter.user.tag);
    if (!status) {
        return safeReply(inter, {content: `Не удалось удалить нашивку игрока ${ps.username} #${ps.id}`})
    }
    return await inform(inter, ps)
}