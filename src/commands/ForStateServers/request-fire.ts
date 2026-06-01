import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    SlashCommandBuilder,
    TextChannel,
} from "discord.js";
import {getStatePositions} from "../../config/settings-loader";


const SPECIAL_BRANCH_LEADERSHIP: Record<string, Record<string, string>> = {
    'fib': {
        'fna': 'ASD'
    },
    'lssd': {
        'sa': 'RU'
    },
    'lspd': {
        'pa': 'PAI'
    },
    'saspa': {
        'pa': 'HRD'
    },
    'army': {
        'a': 'MA'
    }
};

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

function getBranchesForFaction(faction: string): string[] {
    const statePositions = getStatePositions();
    const factionData = statePositions[faction];
    
    if (!factionData) return [];
    
    return factionData.branches;
}

function hasChiefRole(gm: GuildMember, branch: string): boolean {
    const branchLower = branch.toLowerCase();
    
    for (const role of gm.roles.cache.values()) {
        const name = role.name.toLowerCase();
        if (!name.includes(branchLower)) continue;
        if (name.includes('куратор')) continue;
        if (name.includes('командир') && !name.includes('зам.')) continue;
        if (name.includes('начальник') || name.includes('head') || name.includes('командир')) return true;
    }
    
    return false;
}

function hasDeputyRole(gm: GuildMember, branch: string): boolean {
    const branchLower = branch.toLowerCase();
    
    for (const role of gm.roles.cache.values()) {
        const name = role.name.toLowerCase();
        if (!name.includes(branchLower)) continue;
        if (name.includes('начальник') || name.includes('head') || name.includes('куратор') || name.includes('командир')) continue;
        if (name.includes('зам.') || name.includes('deputy') || name.includes('заместитель') || name.includes('d.head') || name.includes('d. head') || name.includes('dc-') || name.includes('c-')) return true;
    }
    
    return false;
}

function findCuratorRoles(gm: GuildMember, branch: string): string[] {
    const roles = gm.guild.roles.cache;
    const branchLower = branch.toLowerCase();
    const result: string[] = [];
    
    for (const [id, role] of roles) {
        const name = role.name.toLowerCase();
        if (!name.includes(branchLower)) continue;
        if (!name.includes('куратор')) continue;
        result.push(id);
    }
    
    return result;
}

function findChiefRoles(gm: GuildMember, branch: string): string[] {
    const roles = gm.guild.roles.cache;
    const branchLower = branch.toLowerCase();
    const result: string[] = [];
    
    for (const [id, role] of roles) {
        const name = role.name.toLowerCase();
        if (!name.includes(branchLower)) continue;
        if (name.includes('куратор')) continue;
        if (name.includes('командир') && !name.includes('зам.')) continue;
        if (!name.includes('начальник') && !name.includes('head') && !name.includes('командир')) continue;
        result.push(id);
    }
    
    return result;
}

function findAllLeadershipRoles(gm: GuildMember, branch: string): string[] {
    const roles = gm.guild.roles.cache;
    const branchLower = branch.toLowerCase();
    const result: string[] = [];
    
    for (const [id, role] of roles) {
        const name = role.name.toLowerCase();
        if (!name.includes(branchLower)) continue;
        if (name.includes('куратор')) continue;
        if (
            name.includes('начальник') || 
            name.includes('head') || 
            name.includes('командир') ||
            name.includes('зам.') || 
            name.includes('deputy') || 
            name.includes('заместитель') || 
            name.includes('d.head') || 
            name.includes('d. head') ||
            name.includes('dc-') ||
            name.includes('c-')
        ) {
            result.push(id);
        }
    }
    
    return result;
}

function findSpecialLeadershipRoles(gm: GuildMember, specialDepartment: string): string[] {
    const roles = gm.guild.roles.cache;
    const deptLower = specialDepartment.toLowerCase();
    const result: string[] = [];
    
    for (const [id, role] of roles) {
        const name = role.name.toLowerCase();
        if (!name.includes(deptLower)) continue;
        result.push(id);
    }
    
    return result;
}

export const data = new SlashCommandBuilder()
    .setName("увольнение")
    .setDescription("Оформить заявление на увольнение")
    .addIntegerOption(opt =>
        opt.setName("паспорт")
            .setDescription("Номер паспорта")
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName("причина")
            .setDescription("Причина увольнения")
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName("отдел")
            .setDescription("Ваш отдел")
            .setRequired(true)
            .setAutocomplete(true)
    )
    .addAttachmentOption(opt =>
        opt.setName("инвентарь")
            .setDescription("Скриншот инвентаря")
            .setRequired(true)
    )
    .addAttachmentOption(opt =>
        opt.setName("документы")
            .setDescription("Скриншот ваших документов")
            .setRequired(true)
    );

export async function autocomplete(inter: AutocompleteInteraction) {
    const focusedValue = inter.options.getFocused();
    const guildName = inter.guild?.name;
    
    if (!guildName) return inter.respond([]);
    
    const faction = getFactionFromName(guildName);
    if (!faction) return inter.respond([]);
    
    const branches = getBranchesForFaction(faction);
    
    const filtered = branches
        .filter(branch => branch.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25)
        .map(branch => ({ name: branch, value: branch }));
    
    await inter.respond(filtered);
}

export async function execute(inter: ChatInputCommandInteraction) {
    if (!inter.guild) {
        return inter.reply({
            content: 'Команда доступна только на сервере.',
            flags: MessageFlags.Ephemeral
        });
    }

    const gm = inter.guild.members.cache.get(inter.user.id);
    if (!gm) {
        return inter.reply({
            content: 'Не удалось найти участника.',
            flags: MessageFlags.Ephemeral
        });
    }

    const displayName = gm.displayName;
    const passport = inter.options.getInteger('паспорт', true);
    const reason = inter.options.getString('причина', true);
    const attachment = inter.options.getAttachment('инвентарь', true);
    const attachment2 = inter.options.getAttachment('документы', true);
    const branchInput = inter.options.getString('отдел', true);

    if (!attachment.contentType?.startsWith('image/')) {
        return inter.reply({
            content: 'Первое вложение должно быть изображением.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (attachment2 && !attachment2.contentType?.startsWith('image/')) {
        return inter.reply({
            content: 'Второе вложение должно быть изображением.',
            flags: MessageFlags.Ephemeral
        });
    }

    const faction = getFactionFromName(inter.guild.name);

    if (!faction) {
        return inter.reply({
            content: 'Не удалось определить фракцию из названия сервера.',
            flags: MessageFlags.Ephemeral
        });
    }

    const branches = getBranchesForFaction(faction);
    const foundBranch = branches.find(b => b.toLowerCase() === branchInput.toLowerCase());
    
    if (!foundBranch) {
        return inter.reply({
            content: `Отдел "${branchInput}" не найден. Доступные отделы: ${branches.join(', ')}`,
            flags: MessageFlags.Ephemeral
        });
    }
    
    const branch = foundBranch;

    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    let leadershipRoles: string[] = [];
    
    const factionLower = faction.toLowerCase();
    const branchLower = branch.toLowerCase();
    const specialDept = SPECIAL_BRANCH_LEADERSHIP[factionLower]?.[branchLower];
    
    if (specialDept) {
        leadershipRoles = findSpecialLeadershipRoles(gm, specialDept);
    } else {
        const isChief = hasChiefRole(gm, branch);
        const isDeputy = hasDeputyRole(gm, branch);
        
        if (isChief) {
            leadershipRoles = findCuratorRoles(gm, branch);
        } else if (isDeputy) {
            leadershipRoles = findChiefRoles(gm, branch);
        } else {
            leadershipRoles = findAllLeadershipRoles(gm, branch);
        }
    }
    
    const uniqueRoles = [...new Set(leadershipRoles)];
    const roleMentions = uniqueRoles.length > 0 
        ? uniqueRoles.map(id => `<@&${id}>`).join(' ') 
        : '';

    const embed = new EmbedBuilder()
        .setColor(Colors.DarkRed)
        .setAuthor({
            name: inter.user.displayName || inter.user.username,
            iconURL: inter.user.displayAvatarURL()
        })
        .setTitle('Заявление на увольнение')
        .setDescription(
            `**${displayName}** подал заявление на увольнение из фракции **${faction}**.\n\n` +
            `>>> **Паспорт:** ${passport}\n` +
            `**Причина:** ${reason}`
        )
        .setImage(attachment.url)
        .setFooter({
            text: inter.guild.name,
            iconURL: inter.guild.iconURL() || undefined
        })
        .setTimestamp();

    const channel = inter.channel as TextChannel;
    
    const embeds: EmbedBuilder[] = [embed];
    
    if (attachment2) {
        const embed2 = new EmbedBuilder()
            .setImage(attachment2.url);
        embeds.push(embed2);
    }
    
    if (roleMentions) {
        await channel.send({
            content: roleMentions,
            embeds: embeds
        });
    } else {
        await channel.send({
            embeds: embeds
        });
    }

    await inter.editReply({
        content: 'Заявление на увольнение успешно отправлено.'
    });
}