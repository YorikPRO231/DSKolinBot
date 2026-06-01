import {
    ActionRowBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import { PatchesRepository, StatePatch } from "../../databases";
import { getSystemChannel, getSystemRole } from '../../config/settings-loader';
import { ComponentType } from "discord-api-types/v10";

export const factions = ['GOV'];

export const data = new SlashCommandBuilder()
    .setName("удалить-нашивку")
    .setDescription('Удаляет нашивку пользователя с уведомлением в личные сообщения')
    .addIntegerOption(opt => opt
        .setName('паспорт')
        .setDescription('Номер паспорта игрока для удаления')
        .setMinValue(1)
        .setMaxValue(999999))
    .addStringOption(opt => opt
        .setName('дискорд-id')
        .setDescription('Удалить по discord-id'));

async function safeReply(interaction: ChatInputCommandInteraction, data: any) {
    if (interaction.replied || interaction.deferred) {
        return interaction.editReply(data);
    }
    return interaction.reply(data);
}

async function sendNotificationToUser(inter: ChatInputCommandInteraction, ps: StatePatch): Promise<boolean> {
    const user = await inter.client.users.fetch(ps.discord_id).catch(() => null);
    
    if (!user) {
        await safeReply(inter, {
            content: `Не удалось отправить уведомление игроку <@${ps.discord_id}>. Попробуйте еще раз позднее, либо передайте уведомление по почте.`
        });
        return false;
    }

    const embed = new EmbedBuilder()
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
        await user.send({ embeds: [embed] });
        await safeReply(inter, {
            content: `Нашивка игрока **${ps.username}** (паспорт #${ps.passport}) успешно удалена. Уведомление отправлено в личные сообщения.`
        });
        return true;
    } catch (error) {
        console.error('Ошибка отправки ЛС:', error);
        await safeReply(inter, {
            content: `Нашивка удалена, но не удалось отправить уведомление игроку <@${ps.discord_id}>. Возможно, у него закрыты личные сообщения.`
        });
        return false;
    }
}

async function checkPermissions(inter: ChatInputCommandInteraction): Promise<boolean> {
    const member = await inter.guild?.members.fetch(inter.user.id).catch(() => null);
    
    if (!member) {
        await inter.reply({
            content: 'Данную команду можно использовать только в дискорде правительства с соответствующим доступом и в определенном канале.',
            flags: MessageFlags.Ephemeral
        });
        return false;
    }

    const hasRole = member.roles?.cache?.some((r: any) => getSystemRole('gov_delete_patch').includes(r.id));
    const isCorrectChannel = inter.channelId === getSystemChannel('gov_delete_patch');

    if (!hasRole || !isCorrectChannel) {
        await inter.reply({
            content: 'Доступ к данной команде имеется только у администрации и губернатора штата.',
            flags: MessageFlags.Ephemeral
        });
        return false;
    }

    return true;
}

async function findPatchByPassport(passport: number): Promise<StatePatch | undefined> {
    return await PatchesRepository.retrievePlayerPatch(passport);
}

async function findPatchByDiscordId(inter: ChatInputCommandInteraction, discordId: string): Promise<StatePatch | undefined> {
    const patches = await PatchesRepository.getPatchByDiscord(discordId);
    
    if (patches.length === 1) {
        return patches[0];
    }
    
    if (patches.length === 0) {
        return undefined;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('delete_patch_select')
        .setPlaceholder('Выберите нашивку для удаления...')
        .addOptions(patches.map((patch, index) => 
            new StringSelectMenuOptionBuilder()
                .setLabel(patch.patch || `Нашивка №${index + 1}`)
                .setDescription(`ID: ${patch.id}, Паспорт: ${patch.passport}`)
                .setValue(patch.id.toString())
        ));

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
        const selectedPatch = patches.find(patch => patch.id.toString() === selectedId);
        
        await confirmation.deferUpdate();
        return selectedPatch;
    } catch (error) {
        await inter.editReply({
            content: 'Время ожидания выбора истекло. Команда отменена.',
            components: []
        });
        return undefined;
    }
}

export async function execute(inter: ChatInputCommandInteraction) {
    const hasAccess = await checkPermissions(inter);
    if (!hasAccess) return;

    const passport = inter.options.getInteger('паспорт');
    const discordId = inter.options.getString('дискорд-id');

    let patch: StatePatch | undefined;

    if (passport) {
        patch = await findPatchByPassport(passport);
    } else if (discordId) {
        patch = await findPatchByDiscordId(inter, discordId);
    }

    if (!patch) {
        const errorMessage = inter.replied 
            ? { content: 'Не удалось найти или выбрать нашивку.', components: [] }
            : { content: 'Не удалось найти пользователя с данным паспортом или Discord ID.' };
        
        return inter.replied ? inter.editReply(errorMessage) : inter.reply(errorMessage);
    }

    const isDeleted = await PatchesRepository.deletePatch(patch.id, inter.user.tag);
    
    if (!isDeleted) {
        return safeReply(inter, { 
            content: `Не удалось удалить нашивку игрока ${patch.username} #${patch.id}` 
        });
    }

    await sendNotificationToUser(inter, patch);
}