import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import {getFactionByDiscordId, getStatePositions, StatePositions} from "../../config/settings-loader";
import {getCompiledPositions} from "./patch-request";

function getFactionFromName(guildName?: string): string | null {
    if (!guildName) return null;

    const cleanName = guildName.replace("GTA 5 RP | ", "").trim();
    const positions = getStatePositions();

    for (const faction of Object.keys(positions)) {
        if (cleanName.includes(faction)) {
            return faction;
        }
    }

    return null;
}


export const data = new SlashCommandBuilder()
    .setName("увольнение")
    .setDescription(
        "Оформить заявление на увольнение",
    )
    .addIntegerOption((opt) =>
        opt
            .setName("паспорт")
            .setDescription("Номер паспорта игрока (от 1 до 999999)")
            .setRequired(true),
    )
    .addStringOption((opt) =>
        opt
            .setName("отдел")
            .setDescription("Ваш отдел или должность (Пример: FPB, D. Head FPB)")
            .setRequired(true)
            .setAutocomplete(true),
    )
    .addStringOption((opt) =>
        opt
            .setName("ник")
            .setDescription('Ваш ник в формате "Имя Фамилия"')
            .setRequired(true),
    )
    .addStringOption(opt => opt.setName('причина').setDescription('Причина увольнения').setRequired(true))
    .addAttachmentOption(opt => opt.setName('инвентарь').setDescription('Скриншот инвентаря с HUD\'ом'));

export async function autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const faction = getFactionFromName(interaction.guild?.name);

    if (!faction) {
        await interaction.respond([]);
        return;
    }

    const choices = getCompiledPositions(faction);
    const filtered = choices.filter((choice) =>
        choice.toLowerCase().includes(focusedValue.toLowerCase()),
    );

    await interaction.respond(
        filtered.slice(0, 25).map((choice) => ({name: choice, value: choice})),
    );
}

function findRole(gm: GuildMember, fp: string, branch: string) {
    return gm.guild.roles.cache.filter(role =>
        role.name.toLowerCase().includes(fp.toLowerCase()) && role.name.toLowerCase().includes(branch.toLowerCase()))
        .map(r => r.id);
}

function findBranchName(position: string, data: StatePositions) {
    for (const branch of data.branches) {
        if (position.toLowerCase().includes(branch.toLowerCase())) {
            return branch;
        }
    }
}

function findRoles(gm: GuildMember, position: string, data: StatePositions) {
    const branch = findBranchName(position, data);
    if (position.startsWith('Deputy') || position.startsWith('L. Gen')) {
        return [data.leader_role_id];
    }
    if (!branch) {
        return [] as string[];
    }
    if (position.startsWith('Head')) {
        return findRole(gm, `Куратор`, branch)
    }
    if (position.startsWith('D. Head')) {
        return [...findRole(gm, `Начальник`, branch), ...findRole(gm, `Куратор`, branch)]
    }
    return [...findRole(gm, `Зам. Начальника`, branch), ...findRole(gm, `Начальник`, branch)]
}

export async function execute(inter: ChatInputCommandInteraction) {
    const gm = inter.guild?.members.cache.get(inter.user.id);
    if (!gm || !inter.guild) {
        return inter.reply({
            content: 'Не удалось определить пользователя сервера. Попробуйте позже.',
            flags: MessageFlags.Ephemeral
        })
    }
    const attachment = inter.options.getAttachment('инвентарь', true);
    if (!attachment.contentType?.startsWith('image/')) {
        return inter.reply({content: 'Требуется фотография инвентаря.', flags: MessageFlags.Ephemeral})
    }
    await inter.deferReply();
    const nickname = inter.options.getString('ник', true);
    const pos = inter.options.getString('отдел', true);
    const passport = inter.options.getInteger('паспорт', true);
    const factionData = getFactionByDiscordId(inter.guild.id)!;
    const positionData = getStatePositions()[factionData[0]];
    const rolesPing = [...new Set(findRoles(gm, pos, positionData).map(r => `<@&${r}>`))].join(' ');
    const reason = inter.options.getString('причина', true);
    const embed = new EmbedBuilder()
        .setTitle('Заявление на увольнение')
        .setColor(Colors.Gold)
        .setDescription(`${nickname} [${passport}] подает заявление на увольнение.`)
        .setAuthor({
            name: `${inter.guild?.name || 'GTA 5 RP State'}`.trim(),
            iconURL: inter.guild?.iconURL() || undefined
        })
        .setImage(attachment.url).addFields({name: 'Причина увольнения', value: reason});
    return inter.editReply({content: rolesPing, embeds: [embed]});
}