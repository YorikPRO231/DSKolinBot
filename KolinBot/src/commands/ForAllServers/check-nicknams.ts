import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    GuildMember,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextChannel
} from 'discord.js';
import { getSystemRole } from '../../config/settings-loader';

export const data = new SlashCommandBuilder()
    .setName("check-nicknames")
    .setDescription('[Admin] Проверка дискорда на правильность формы ников')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply();

    const guildID = inter.guild?.id;
    if (!guildID) {
        return inter.editReply({content: 'Ошибка: не удалось определить сервер.'});
    }

    const currentChannel = inter.channel as TextChannel;

    const members = await inter.guild?.members.fetch();
    if (!members) {
        return inter.editReply({content: 'Не удалось получить список участников.'});
    }

    const filteredMembers = members.filter((member: GuildMember) => {
        if (member.user.bot) return false;
        if (member.id === member.guild.ownerId) return false;
        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return false;
        }
        if (member.roles.cache.some((r: any) => /администратор|admin|хелпер|helper|куратор|помощник/i.test(r.name))) return false;
        return true;
    });

    let data: { memberId: string; row: ActionRowBuilder<ButtonBuilder>; reason: string; }[] = [];
    const batchSize = 50;
    await inter.editReply({content: `Начинаем проверку ${filteredMembers.size} участников...`});
    for (let [mID, member] of filteredMembers) {
        let reason = 'NO REASON';
        if (member.roles.cache.size === 0) {
            reason = `Отсутствие ролей (Дата входа: ${member.joinedAt || 'Не найдена'}).`
        }
        if ([member.user.displayName, member.user.username, member.user.globalName].includes(member.displayName)) {
            reason = 'Отсутствие ника в дискорде.';
        }
        if (member.roles.cache.some(r => getSystemRole('capters').includes(r.id))) {
            const m = /capt|biz \w+ \w+ \d+/.test(member.displayName)
            if (!m) {
                reason = 'Неверная форма ника для капт/биз состава.'
            }
        }

        if (reason !== 'NO REASON') {
            const button = new ButtonBuilder()
                .setCustomId(`nicknames_${mID}`)
                .setLabel('Кикнуть')
                .setStyle(ButtonStyle.Danger);
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)
            data.push({memberId: mID, row: row, reason: reason})
        }
    }

    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        const sendPromises = batch.map(d =>
            currentChannel.send({
                content: `**Нарушитель:** <@${d.memberId}> Причина: ${d.reason}`,
                components: [d.row]
            })
        );

        await Promise.all(sendPromises);

        if (i % 200 === 0 && i > 0) {
            await inter.editReply({content: `Отправлено ${i}/${data.length} результатов...`});
        }
    }

    await currentChannel.send({
        content: `Проверка завершена! Всего найдено аккаунтов: ${data.length}`
    });

    return inter.editReply({content: `Проверка завершена! Найдено: ${data.length}`});
}