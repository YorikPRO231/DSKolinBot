import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';
import {findPlayerPatch, retrievePlayerPatch} from "../../databases/sqlite";
import type {StatePatch, PatchHistory} from "../../databases/sqlite";

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

    if (passport === null && patch === null) {
        return inter.reply({
            content: 'Укажите номер паспорта или текст нашивки для поиска.',
            flags: MessageFlags.Ephemeral
        });
    }

    await inter.deferReply();

    const embed = new EmbedBuilder()
        .setAuthor({
            name: inter.guild?.name || 'GTA 5 RP',
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
        const ps = retrievePlayerPatch(passport);
        if (!ps) {
            embed.setDescription('По указанному паспорту ничего не найдено.');
        } else {
            embed.setDescription(formatPatchResult('Поиск по паспорту', ps));
            embed.setThumbnail(inter.guild?.members.cache.get(ps.discord_id)?.displayAvatarURL() || null);
            addHistoryToEmbed(embed, ps);
        }
    }

    if (patch !== null) {
        const matches = findPlayerPatch(patch);
        if (!matches || matches.length === 0) {
            embed.setDescription('По указанной нашивке ничего не найдено.');
        } else if (matches.length === 1) {
            embed.setDescription(formatPatchResult('Поиск по нашивке', matches[0]));
            embed.setThumbnail(inter.guild?.members.cache.get(matches[0].discord_id)?.displayAvatarURL() || null);
            addHistoryToEmbed(embed, matches[0]);
        } else {
            const matchDescriptions = matches.map((ps, index) =>
                `${index + 1}. **${ps.username}** (Паспорт: \`${ps.passport}\`)\n\`\`\`${ps.patch}\`\`\``
            );
            embed.setDescription(`Найдено совпадений: ${matches.length}\n\n${matchDescriptions.join('\n\n')}`);
        }
    }

    return inter.editReply({embeds: [embed]});
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