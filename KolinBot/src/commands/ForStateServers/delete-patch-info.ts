import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';
import { PatchesRepository } from "../../databases/index";
import { getSystemChannel, getSystemRole } from '../../config/settings-loader';

export const data = new SlashCommandBuilder()
    .setName("удалить-нашивку")
    .setDescription('Удаляет нашивку пользователя с уведомлением в личные сообщения')
    .addIntegerOption(opt => opt
        .setName('паспорт')
        .setDescription('Номер паспорта игрока для удаления')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(999999))


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
    const passport = inter.options.getInteger('паспорт', true)
    const ps = PatchesRepository.retrievePlayerPatch(passport)
    if (!ps) {
        return inter.reply({content: 'Не удалось найти пользователя с данным паспортом.'})
    }
    
    PatchesRepository.pushPlayerId(passport, ps.username,ps.discord_id, ps.faction, `DELETED BY <@${inter.user.id}>`)
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
    const luser = await inter.client.users.fetch(ps.discord_id).catch(() => null);
    if (!luser) {
        return inter.reply({
            content: `Не удалось отправить уведомление игроку <@${ps.discord_id}>. Попробуйте еще раз позднее, либо передайте уведомление по почте.`
        })
    } 

    try {
        await luser.send({ embeds: [embedLS] });
        
        await inter.reply({
            content: `Нашивка игрока **${ps.username}** (паспорт #${passport}) успешно удалена. Уведомление отправлено в личные сообщения.`
        });
    } catch (error) {
        console.error('Ошибка отправки ЛС:', error);
        await inter.reply({
            content: `Нашивка удалена, но не удалось отправить уведомление игроку <@${ps.discord_id}>. Возможно, у него закрыты личные сообщения.`
        });
    }
}