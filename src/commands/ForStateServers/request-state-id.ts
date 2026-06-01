import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { PatchesRepository } from "../../databases/index";
import type { StatePatch, PatchHistory } from "../../databases";
import { getSystemRole, getDetectives } from '../../config/settings-loader';

export const factions = ['GOV'];

export const data = new SlashCommandBuilder()
    .setName("поиск-нашивки")
    .setDescription("Поиск информации о нашивке по паспорту или содержимому")
    .addIntegerOption(opt => opt
        .setName('паспорт')
        .setDescription('Поиск нашивки по номеру паспорта')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(999999))
    .addStringOption(opt => opt
        .setName('нашивка')
        .setDescription('Поиск нашивки по содержимому')
        .setRequired(false));

export async function execute(inter: ChatInputCommandInteraction) {
    const passport = inter.options.getInteger('паспорт');
    const patch = inter.options.getString('нашивка');

    const gm = await inter.guild?.members.fetch(inter.user.id).catch(() => null);
    const govAccessRoles = getSystemRole('gov_access_patch_request');
    const hasRole = gm?.roles?.cache?.some((r: any) => govAccessRoles.includes(r.id));
    if (!hasRole) {
        return inter.reply({
            content: 'Данную команду можно использовать только в дискорде правительства с соответствующим доступом.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (passport === null && patch === null) {
        return inter.reply({
            content: 'Укажите номер паспорта или текст нашивки для поиска.',
            flags: MessageFlags.Ephemeral
        });
    }

    await inter.deferReply();
    const authorName = `${inter.guild?.name || 'GTA 5 RP'}`.trim();
    let showDetectives = false;
    const embed = new EmbedBuilder()
        .setAuthor({
            name: authorName,
            iconURL: inter.guild?.iconURL() || undefined
        })
        .setTitle('Поиск нашивок')
        .setColor(0x5865F2)
        .setFooter({
            text: inter.user.tag,
            iconURL: inter.user.displayAvatarURL()
        })
        .setTimestamp();

    if (passport !== null) {
        const ps = await PatchesRepository.retrievePlayerPatch(passport);
        if (!ps) {
            embed.setDescription('По указанному паспорту ничего не найдено.');
        } else {
            if (isDetectivePatch(ps.faction) && !hasDetectiveAccess(gm)) {
                embed.setDescription('❌ **Доступ запрещен:** У вас нет прав на просмотр детективных нашивок.');
            } else {
                if (isDetectivePatch(ps.faction)) {
                    showDetectives = true;
                }
                embed.setDescription(formatPatchResult('Поиск по паспорту', ps));
                embed.setThumbnail(inter.guild?.members.cache.get(ps.discord_id)?.displayAvatarURL() || null);
                addHistoryToEmbed(embed, ps);
            }
        }
    }

    if (patch !== null) {
        const matches = await PatchesRepository.findPlayerPatch(patch);
        if (!matches || matches.length === 0) {
            embed.setDescription('По указанной нашивке ничего не найдено.');
        } else {
            const hasAccess = hasDetectiveAccess(gm);
            const filteredMatches = hasAccess ? matches : matches.filter(m => !isDetectivePatch(m.faction));
            showDetectives = matches.some(m => isDetectivePatch(m.faction)) && filteredMatches.length > 0;
            
            if (filteredMatches.length === 0) {
                embed.setDescription('❌ **Доступ запрещен:** Найдены только детективные нашивки, к которым у вас нет доступа.');
            } else if (filteredMatches.length === 1) {
                embed.setDescription(formatPatchResult('Поиск по нашивке', filteredMatches[0]));
                embed.setThumbnail(inter.guild?.members.cache.get(filteredMatches[0].discord_id)?.displayAvatarURL() || null);
                addHistoryToEmbed(embed, filteredMatches[0]);
            } else {
                const matchDescriptions = filteredMatches.map((ps, index) =>
                    `${index + 1}. **${ps.username}** (Паспорт: \`${ps.passport}\`)\n\`\`\`${ps.patch}\`\`\``
                );
                
                let description = `Найдено совпадений: ${filteredMatches.length}`;
                if (!hasAccess && filteredMatches.length < matches.length) {
                    description += ` (скрыто детективных: ${matches.length - filteredMatches.length})`;
                }
                description += `\n\n${matchDescriptions.join('\n\n')}`;
                
                embed.setDescription(description);
            }
        }
    }

    if (showDetectives) {
        let success = true;
        await inter.user.send({ embeds: [embed] }).catch(error => {
            console.warn(`Не удалось отправить ЛС пользователю ${inter.user.tag}:`, error);
            success = false;
        });

        const dEmbed = new EmbedBuilder()
            .setAuthor({
                name: authorName,
                iconURL: inter.guild?.iconURL() || undefined
            })
            .setTitle('Поиск нашивок')
            .setColor(0xf10000)
            .setFooter({
                text: inter.user.tag,
                iconURL: inter.user.displayAvatarURL()
            })
            .setTimestamp()
            .setDescription(success 
                ? 'Отчет по поиску был отправлен в личные сообщения, так как содержал информацию о детективных нашивках.' 
                : 'Не удалось отправить отчет в личные сообщения.');
        
        return inter.editReply({ embeds: [dEmbed] });
    }
    
    return inter.editReply({ embeds: [embed] });
}

function isDetectivePatch(faction: string): boolean {
    const detectives = getDetectives();
    return Object.keys(detectives).includes(faction);
}

function hasDetectiveAccess(member: any): boolean {
    if (!member) return false;
    const detectiveAccessRoles = getSystemRole('detective_patch_access');
    return member.roles?.cache?.some((r: any) => detectiveAccessRoles.includes(r.id)) || false;
}

function formatPatchResult(title: string, ps: StatePatch): string {
    return [
        `**${title}**`,
        `Сотрудник: ${ps.username} (<@${ps.discord_id}>)`,
        `Паспорт: \`${ps.passport}\``,
        `Нашивка: \`\`\`${ps.patch}\`\`\``,
        `Создана: ${formatDate(ps.created_at)}`
    ].join('\n');
}

function addHistoryToEmbed(embed: EmbedBuilder, ps: StatePatch): void {
    if (!ps.history) return;

    let history: PatchHistory[];
    try {
        history = typeof ps.history === 'string' ? JSON.parse(ps.history) : ps.history;
    } catch {
        return;
    }

    if (!Array.isArray(history) || history.length === 0) return;

    const historyLines = history
        .slice(-5)
        .reverse()
        .map((entry, index) =>
            `${index + 1}. \`${entry.patch || 'Неизвестно'}\`\n└ ${formatDate(entry.updated_at)}`
        );

    embed.addFields({
        name: 'История изменений',
        value: historyLines.join('\n\n') || 'Нет данных',
        inline: false
    });
}

function formatDate(dateString: string): string {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return `<t:${Math.floor(date.getTime() / 1000)}:f>`;
    } catch {
        return dateString;
    }
}