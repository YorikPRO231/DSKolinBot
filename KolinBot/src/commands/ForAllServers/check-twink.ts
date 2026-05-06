import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    Collection,
    GuildMember,
    SlashCommandBuilder,
    TextChannel,
    PermissionFlagsBits
} from 'discord.js';
import {factionByDiscordID, FRACTION_INFO} from "../../utils/constants/fractions";
import { getPlayerServerIds } from "../../utils/config";

export const data = new SlashCommandBuilder()
    .setName("check-twink")
    .setDescription('[Admin] Проверка дискордов на наличие твинков')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply();

    const guildID = inter.guild?.id;
    if (!guildID) {
        return inter.editReply({ content: 'Ошибка: не удалось определить сервер.' });
    }

    const [currentFactionType, currentFactionData] = factionByDiscordID(guildID);
    const isState = currentFactionData.state;

    const serverIds = getPlayerServerIds();
    const currentChannel = inter.channel as TextChannel;

    const members = await inter.guild?.members.fetch();
    if (!members) {
        return inter.editReply({ content: 'Не удалось получить список участников.' });
    }

    const filteredMembers = members.filter((member: GuildMember) => {
        if (member.user.bot) return false;
        if (member.id === member.guild.ownerId) return false;
        if (member.roles.cache.some((r: any) => /администратор|admin|хелпер|helper|куратор|помощник/i.test(r.name))) return false;
        return true;
    });

    await inter.editReply({ content: `Начинаем проверку ${filteredMembers.size} участников...` });

    const serverMembersMap = new Map<string, Collection<string, GuildMember>>();

    const fetchPromises = serverIds
        .filter((sid: string) => sid !== guildID)
        .map(async (sid: string) => {
            const guild = inter.client.guilds.cache.get(sid);
            if (!guild) return;

            const [_, fData] = factionByDiscordID(sid);
            const isServerState = fData.state;

            if ((isState && isServerState)) return;

            try {
                const allMembers = await guild.members.fetch();
                serverMembersMap.set(sid, allMembers);
            } catch (error) {
                console.warn(`Не удалось загрузить участников сервера ${guild.name}`);
            }
        });

    await Promise.all(fetchPromises);

    await inter.editReply({ content: `Участники серверов загружены. Начинаем анализ...` });

    let totalFound = 0;
    const batchSize = 50;
    const twinkers: { memberId: string; intruders: number; actionRows: ActionRowBuilder<ButtonBuilder>[] }[] = [];
    const wnServer = inter.client.guilds.cache.get(FRACTION_INFO['WN'].discord_id);
    for (const [memberId] of filteredMembers) {
        const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();
        let buttonCount = 0;
        let intruders = 0;

        for (const [serverId, serverMembers] of serverMembersMap) {
            if (serverMembers.has(memberId)) {
                const [fType, serverFactionData] = factionByDiscordID(serverId);

                if (inter.guildId === FRACTION_INFO['WN'].discord_id) {
                    const serverMember = await wnServer?.members?.fetch(memberId);
                    if (serverMember && !serverMember.roles.cache.has(FRACTION_INFO['WN'].faction_role_id)) {
                        continue;
                    }
                }

                if (serverId === FRACTION_INFO['WN'].discord_id) {
                    const wnMember = await wnServer?.members.fetch(memberId).catch(() => null);
                    if (!wnMember || !wnMember.roles.cache.has(FRACTION_INFO['WN'].faction_role_id)) {
                        continue;
                    }
                }

                if (buttonCount >= 5) {
                    actionRows.push(currentRow);
                    currentRow = new ActionRowBuilder<ButtonBuilder>();
                    buttonCount = 0;
                }

                const button = new ButtonBuilder()
                    .setCustomId(`twink_${memberId}_${serverId}`)
                    .setLabel(serverFactionData.label)
                    .setStyle(ButtonStyle.Secondary);

                if (serverFactionData.emoji_id) {
                    button.setEmoji(serverFactionData.emoji_id);
                }

                currentRow.addComponents(button);
                buttonCount++;
                intruders++;
            }
        }

        if (buttonCount > 0) {
            actionRows.push(currentRow);
        }

        if (intruders > 0) {
            twinkers.push({ memberId, intruders, actionRows });
            totalFound++;
        }
    }

    await inter.editReply({ content: `Найдено ${totalFound} подозрительных. Отправляю результаты...` });

    for (let i = 0; i < twinkers.length; i += batchSize) {
        const batch = twinkers.slice(i, i + batchSize);

        const sendPromises = batch.map(twinker =>
            currentChannel.send({
                content: `**Твинкер:** <@${twinker.memberId}> (найдено в ${twinker.intruders} серверах)`,
                components: twinker.actionRows
            })
        );

        await Promise.all(sendPromises);

        if (i % 200 === 0 && i > 0) {
            await inter.editReply({ content: `Отправлено ${i}/${twinkers.length} результатов...` });
        }
    }

    await currentChannel.send({
        content: `Проверка завершена! Всего найдено аккаунтов: ${totalFound}`
    });

    return inter.editReply({ content: `Проверка завершена! Найдено: ${totalFound}` });
}