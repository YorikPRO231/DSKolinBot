import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction,
    SlashCommandBuilder, TextChannel
} from 'discord.js';
import { factionByDiscordID } from "../../utils/constants/fractions";
import { getPlayerServerIds } from "../../utils/config";

export const data = new SlashCommandBuilder()
    .setName("check-twink")
    .setDescription('[Admin] Проверка дискордов на наличие твинков');

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply();

    const guildID = inter.guild?.id;
    const isState = factionByDiscordID(guildID)[1].state;
    const servers = getPlayerServerIds()
        .map(sid => inter.client.guilds.cache.get(sid))
        .filter((s): s is NonNullable<typeof s> => s !== undefined); 

    const currentChannel = inter.channel as TextChannel;

    const members = await inter.guild?.members.fetch();
    if (!members) {
        return inter.editReply({ content: 'Не удалось получить список участников.' });
    }

    let totalFound = 0;

    for (const [memberId, member] of members) {
        if (member.user.bot || member.roles.cache.some(r => /администратор|хелпер/i.test(r.name))) {
            continue;
        }

        const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();
        let buttonCount = 0;
        let intruders = 0;

        for (const s of servers) {
            const info = factionByDiscordID(s.id);
            const isServerState = info[1].state;

            if ((isState && isServerState) || s.id === guildID) {
                continue;
            }

            try {
                const targetMember = await s.members.fetch(memberId).catch(() => null);
                if (targetMember) {
                    if (buttonCount >= 5) {
                        actionRows.push(currentRow);
                        currentRow = new ActionRowBuilder<ButtonBuilder>();
                        buttonCount = 0;
                    }

                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`twink_${memberId}_${s.id}`)
                            .setLabel(info[1].label)
                            .setStyle(ButtonStyle.Secondary)
                    );
                    buttonCount++;
                    intruders++;
                }
            } catch (error) {
                continue;
            }
        }

        if (buttonCount > 0) {
            actionRows.push(currentRow);
        }

        if (intruders > 0) {
            totalFound++;
            await currentChannel.send({
                content: `**Твинкер:** <@${memberId}> (найдено в ${intruders} серверах)`,
                components: actionRows
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    await currentChannel.send({
        content: `Проверка завершена! Найдено подозрительных аккаунтов: ${totalFound}`
    });
    
    return inter.editReply({ content: 'Проверка завершена!' });
}