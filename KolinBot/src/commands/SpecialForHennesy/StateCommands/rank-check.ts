import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('проверить-повышения')
    .setDescription('Проверить CSV/TXT лог повышений на нарушения')
    .addAttachmentOption(option =>
        option.setName('файл')
            .setDescription('CSV или TXT файл с логами повышений')
            .setRequired(true));


const LEADERSHIP_RANKS: Record<string, Record<string, number>> = {
    'LSPD': {
        'зам. начальника': 12,
        'зам начальника': 12,
        'заместитель начальника': 12,
        'начальник': 13,
        'chief': 13,
        'd. head': 12,
        'd.head': 12,
        'deputy head': 12,
        'head': 13
    },
    'FIB': {
        'зам. начальника': 8,
        'зам начальника': 8,
        'заместитель начальника': 8,
        'начальник': 9,
        'chief': 9,
        'd. head': 8,
        'd.head': 8,
        'deputy head': 8,
        'head': 9
    },
    'LSSD': {
        'зам. начальника': 8,
        'зам начальника': 8,
        'заместитель начальника': 8,
        'начальник': 9,
        'chief': 9,
        'd. head': 8,
        'd.head': 8,
        'deputy head': 8,
        'head': 9
    }
};

const SPECIAL_PROGRAMS: Record<string, { 
    factions: string[], 
    maxRank: number, 
    aliases: string[],
    leadershipRanks: number[]
}> = {
    'GATE': {
        factions: ['LSPD'],
        maxRank: 6,
        aliases: ['gate', 'гейт'],
        leadershipRanks: [12, 13]
    },
    'HRT': {
        factions: ['FIB'],
        maxRank: 6,
        aliases: ['hrt', 'хрт'],
        leadershipRanks: [8, 9]
    },
    'VICE': {
        factions: ['LSSD'],
        maxRank: 6,
        aliases: ['vice', 'вайс'],
        leadershipRanks: [8, 9]
    }
};

function getAllValidShortReasons(): string[] {
    const baseReasons = [
        'должность', 'должност', 'должности', 'назначение', 'повышение', 'перевод'
    ];
    
    const programAliases: string[] = [];
    for (const program of Object.values(SPECIAL_PROGRAMS)) {
        for (const alias of program.aliases) {
            programAliases.push(alias);
        }
    }
    
    return [...baseReasons, ...programAliases];
}

const VALID_SHORT_REASONS = getAllValidShortReasons();

const BAD_REASON_PATTERNS = [
    /^\d+$/,
    /^123+$/,
    /^qwe+$/,
    /^йцу+$/,
    /^test$/i,
    /^бб$/i,
    /^\.+$/,
    /^!+$/,
    /^[0-9]{1,5}$/,
    /^[а-яА-Я]{1,2}$/i,
    /^[a-z]{1,2}$/i,
    /^$/
];

const LEADERSHIP_PHRASES = [
    'начальник', 'зам. начальника', 'зам начальника', 
    'руководитель', 'глава', 'заместитель', 
    'd. head', 'd.head', 'deputy head', 'head'
];

function parseRank(rankString: string): { name: string; level: number } {
    const match = rankString.match(/(.+)\s*\((\d+)\)/);
    if (match) {
        return { name: match[1].trim(), level: parseInt(match[2]) };
    }
    return { name: rankString, level: 0 };
}

function getExpectedLeadershipRank(faction: string, rankName: string): number | null {
    const factionRanks = LEADERSHIP_RANKS[faction.toUpperCase()];
    if (!factionRanks) return null;
    
    const lowerRankName = rankName.toLowerCase();
    for (const [key, rank] of Object.entries(factionRanks)) {
        if (lowerRankName.includes(key)) {
            return rank;
        }
    }
    return null;
}

function isLeadershipPosition(rank: string, faction: string): { isLeader: boolean; expectedRank: number | null } {
    const expectedRank = getExpectedLeadershipRank(faction, rank);
    return {
        isLeader: expectedRank !== null,
        expectedRank: expectedRank
    };
}

function getSpecialProgramInfo(reason: string, faction: string, newRank: string, newLevel: number): { 
    program: string | null; 
    isValid: boolean; 
    maxRank: number; 
    isLeadershipAssignment: boolean;
    error?: string 
} {
    const lowerReason = reason.toLowerCase().trim();
    const lowerNewRank = newRank.toLowerCase();
    
    for (const [programName, programInfo] of Object.entries(SPECIAL_PROGRAMS)) {
        const isMatch = programInfo.aliases.some(alias => lowerReason.includes(alias));
        
        if (isMatch) {
            if (!programInfo.factions.includes(faction.toUpperCase())) {
                return {
                    program: programName,
                    isValid: false,
                    maxRank: programInfo.maxRank,
                    isLeadershipAssignment: false,
                    error: `Программа ${programName} доступна только для фракции ${programInfo.factions.join(', ')} (текущая фракция: ${faction})`
                };
            }
            
            const isLeadership = LEADERSHIP_PHRASES.some(phrase => 
                lowerReason.includes(phrase) || lowerNewRank.includes(phrase)
            );
            
            if (isLeadership) {
                if (!programInfo.leadershipRanks.includes(newLevel)) {
                    return {
                        program: programName,
                        isValid: false,
                        maxRank: programInfo.maxRank,
                        isLeadershipAssignment: true,
                        error: `Для руководящей должности в программе ${programName} допустимые ранги: ${programInfo.leadershipRanks.join(', ')} (указан ${newLevel} ранг)`
                    };
                }
                return {
                    program: programName,
                    isValid: true,
                    maxRank: newLevel,
                    isLeadershipAssignment: true,
                    error: undefined
                };
            }
            
            if (newLevel > programInfo.maxRank) {
                return {
                    program: programName,
                    isValid: false,
                    maxRank: programInfo.maxRank,
                    isLeadershipAssignment: false,
                    error: `Максимальный ранг для программы ${programName} - ${programInfo.maxRank} (указан ${newLevel} ранг)`
                };
            }
            
            return {
                program: programName,
                isValid: true,
                maxRank: programInfo.maxRank,
                isLeadershipAssignment: false,
                error: undefined
            };
        }
    }
    
    return { program: null, isValid: false, maxRank: 0, isLeadershipAssignment: false };
}

function validateReason(reason: string, faction: string, newRank: string): { isValid: boolean; error?: string } {
    const lowerReason = reason.toLowerCase().trim();
    
    if (VALID_SHORT_REASONS.includes(lowerReason)) {
        return { isValid: true };
    }
    
    const isDiscordLink = /^https?:\/\/(?:www\.)?(discord\.com|discordapp\.com)\/channels\/\S+$/i.test(reason.trim());
    if (isDiscordLink) {
        return { isValid: true };
    }
    
    const hasAnyLink = /https?:\/\/\S+/i.test(reason);
    if (hasAnyLink) {
        return { isValid: false, error: 'Некорректная причина: разрешены только ссылки на Discord (доказательства)' };
    }
    
    const tempRankData = parseRank(newRank);
    const specialProgram = getSpecialProgramInfo(reason, faction, newRank, tempRankData.level);
    if (specialProgram.program && specialProgram.isValid) {
        return { isValid: true };
    }
    
    if (!reason || reason.length < 3) {
        return { isValid: false, error: 'Причина слишком короткая' };
    }
    
    for (const pattern of BAD_REASON_PATTERNS) {
        if (pattern.test(reason)) {
            return { isValid: false, error: 'Некорректная причина (цифры/буквы/символы)' };
        }
    }
    
    const isLeader = LEADERSHIP_PHRASES.some(phrase => lowerReason.includes(phrase) || newRank.toLowerCase().includes(phrase));
    
    if (reason.length < 10 && !isLeader && !VALID_SHORT_REASONS.includes(lowerReason)) {
        return { isValid: false, error: 'Причина должна быть более содержательной (минимум 10 символов) или ссылка на Discord' };
    }
    
    return { isValid: true };
}

function checkRankJumpViolation(
    oldLevel: number, 
    newLevel: number, 
    faction: string, 
    isLeadershipAssignment: boolean, 
    expectedLeadershipRank: number | null,
    isReinstatement: boolean,
    reason: string,
    newRank: string
): { isViolation: boolean; isNeedCheck: boolean; allowed: number; message: string } {
    const specialProgram = getSpecialProgramInfo(reason, faction, newRank, newLevel);
    
    if (specialProgram.program) {
        if (!specialProgram.isValid) {
            return { 
                isViolation: true, 
                isNeedCheck: false,
                allowed: specialProgram.maxRank, 
                message: specialProgram.error || `Нарушение в программе ${specialProgram.program}`
            };
        }
        
        if (specialProgram.isLeadershipAssignment) {
            return { 
                isViolation: false, 
                isNeedCheck: false,
                allowed: newLevel, 
                message: `Назначение на руководящую должность в программе ${specialProgram.program} (разрешено, ранг ${newLevel})`
            };
        }
        
        return { 
            isViolation: false, 
            isNeedCheck: false,
            allowed: specialProgram.maxRank, 
            message: `Программа ${specialProgram.program}: разрешено до ${specialProgram.maxRank} ранга (повышение до ${newLevel})`
        };
    }
    
    const isLeadershipAppointment = isLeadershipAssignment || 
        /должност|назначени|должность/i.test(reason);
    
    if (isReinstatement) {
        return { 
            isViolation: false, 
            isNeedCheck: false,
            allowed: 99, 
            message: 'Перевод/восстановление во фракцию (разрешено, любой ранг)' 
        };
    }
    
    const levelDiff = newLevel - oldLevel;
    const factionUpper = faction.toUpperCase();
    
    if (isLeadershipAppointment) {
        let maxAllowed = 1;
        let factionType = '';
        
        if (['LSPD', 'ARMY', 'SASPA'].includes(factionUpper)) {
            maxAllowed = 3;
            factionType = 'LSPD/ARMY/SASPA';
        } else if (['LSSD', 'FIB'].includes(factionUpper)) {
            maxAllowed = 2;
            factionType = 'LSSD/FIB';
        } else if (['EMS', 'WN'].includes(factionUpper)) {
            maxAllowed = 1;
            factionType = 'EMS/WN';
        }
        
        if (levelDiff <= maxAllowed) {
            return { 
                isViolation: false, 
                isNeedCheck: false,
                allowed: maxAllowed, 
                message: `Назначение на руководящую должность (${factionType}): разрешено до +${maxAllowed} рангов (повышение на ${levelDiff} ранга)`
            };
        } else {
            return { 
                isViolation: true, 
                isNeedCheck: false,
                allowed: maxAllowed, 
                message: `Нарушение 12.8: При назначении на руководящую должность (${factionType}) разрешено максимум +${maxAllowed} ранга (повышение на ${levelDiff} ранга)`
            };
        }
    }
    
    const maxAllowed = 1;
    
    if (levelDiff === 1) {
        return { 
            isViolation: false, 
            isNeedCheck: false,
            allowed: 1, 
            message: `Обычное повышение: +1 ранг (разрешено)` 
        };
    }
    
    if (levelDiff === 2) {
        return { 
            isViolation: false,
            isNeedCheck: true,
            allowed: 2, 
            message: `Требует проверки: повышение на 2 ранга. Проверьте наличие военного билета! (с военником разрешено, без военника - нарушение 12.7)`
        };
    }
    
    if (levelDiff >= 3) {
        return { 
            isViolation: true, 
            isNeedCheck: false,
            allowed: 2, 
            message: `Нарушение 12.7: повышение на ${levelDiff} ранга (максимум: 1 ранг, с военником: 2 ранга)`
        };
    }
    
    if (levelDiff <= 0) {
        return { 
            isViolation: false, 
            isNeedCheck: false,
            allowed: 0, 
            message: `Понижение в должности (не проверяется)` 
        };
    }
    
    return { 
        isViolation: false, 
        isNeedCheck: false,
        allowed: maxAllowed, 
        message: `Разрешено до ${maxAllowed} ранга (повышение на ${levelDiff} ранга)` 
    };
}

export async function execute(interaction: ChatInputCommandInteraction) {

    await interaction.deferReply();

    const attachment = interaction.options.getAttachment('файл', true);
    
    if (!attachment.contentType?.includes('text') && !attachment.name?.match(/\.(csv|txt)$/i)) {
        return interaction.editReply({ content: 'Пожалуйста, загрузите CSV или TXT файл' });
    }

    try {
        const response = await fetch(attachment.url);
        const fileContent = await response.text();
        
        const lines = fileContent.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
            return interaction.editReply({ content: 'Файл пуст или имеет неверный формат' });
        }
        
        const promotions = [];
        
        for (const line of lines) {
            const values = line.split('\t');
            if (values.length < 5) continue;
            
            const actionText = values[3];
            
            const actionMatch = actionText.match(/Повышает\s+(.+?)\[(\d+)\]\s+с\s+(.+?)\s+до\s+(.+?)\s+с\s+причиной\s+"(.+?)"/i);
            if (!actionMatch) continue;
            
            promotions.push({
                id: parseInt(values[0]) || 0,
                character: values[1] || '',
                faction: values[2] || '',
                text: actionText,
                time: values[4] || '',
                promotedCharacter: actionMatch[1].trim(),
                promotedId: actionMatch[2].trim(),
                oldRank: actionMatch[3].trim(),
                newRank: actionMatch[4].trim(),
                reason: actionMatch[5].trim()
            });
        }
        
        if (promotions.length === 0) {
            return interaction.editReply({ content: 'Не удалось найти записи о повышениях в файле.' });
        }
        
        const badReasons = [];
        const rankJumpViolations = [];
        const needCheckList = [];
        const validPromotions = [];
        const characterDayPromotions = new Map();
        
        for (const promo of promotions) {
            const oldRankData = parseRank(promo.oldRank);
            const newRankData = parseRank(promo.newRank);
            
            const promoDate = new Date(promo.time);
            const dateKey = `${promo.promotedId}_${promoDate.toDateString()}`;
            
            if (!characterDayPromotions.has(dateKey)) {
                characterDayPromotions.set(dateKey, []);
            }
            characterDayPromotions.get(dateKey).push({
                ...promo,
                oldLevel: oldRankData.level,
                newLevel: newRankData.level,
                oldRankName: oldRankData.name,
                newRankName: newRankData.name
            });
        }
        
        for (const [key, dayPromos] of characterDayPromotions) {
            dayPromos.sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime());
            
            for (let i = 0; i < dayPromos.length; i++) {
                const promo = dayPromos[i];
                
                const isReinstatement = i === 0 && promo.oldLevel === 0 && promo.oldRank.includes('Студент');
                const leadershipCheck = isLeadershipPosition(promo.newRank, promo.faction);
                const isLeadershipAssign = leadershipCheck.isLeader;
                const expectedRank = leadershipCheck.expectedRank;
                
                const violation = checkRankJumpViolation(
                    promo.oldLevel, 
                    promo.newLevel, 
                    promo.faction, 
                    isLeadershipAssign,
                    expectedRank,
                    isReinstatement,
                    promo.reason,
                    promo.newRank
                );
                
                if (violation.isViolation) {
                    rankJumpViolations.push({
                        ...promo,
                        oldLevel: promo.oldLevel,
                        newLevel: promo.newLevel,
                        violationMessage: violation.message,
                        allowedRank: violation.allowed
                    });
                } else if (violation.isNeedCheck) {
                    needCheckList.push({
                        ...promo,
                        oldLevel: promo.oldLevel,
                        newLevel: promo.newLevel,
                        checkMessage: violation.message,
                        levelDiff: promo.newLevel - promo.oldLevel
                    });
                }
                
                const reasonValidation = validateReason(promo.reason, promo.faction, promo.newRank);
                if (!reasonValidation.isValid) {
                    badReasons.push({
                        ...promo,
                        error: reasonValidation.error
                    });
                }
                
                if (!violation.isViolation && !violation.isNeedCheck && reasonValidation.isValid) {
                    validPromotions.push(promo);
                }
            }
        }
        
        const uniqueNeedCheck = new Map();
        for (const check of needCheckList) {
            const key = check.promotedId;
            if (!uniqueNeedCheck.has(key)) {
                uniqueNeedCheck.set(key, check);
            }
        }
        const uniqueNeedCheckList = Array.from(uniqueNeedCheck.values());
        
        const totalIssues = rankJumpViolations.length + badReasons.length + uniqueNeedCheckList.length;
        
        const embed = new EmbedBuilder()
            .setColor(rankJumpViolations.length > 0 || badReasons.length > 0 ? 0xFF0000 : (uniqueNeedCheckList.length > 0 ? 0xFFA500 : 0x00FF00))
            .setTitle('Результат проверки логов повышений')
            .setDescription(`Проверено записей: ${promotions.length}`)
            .addFields(
                { name: 'Нарушение КД повышения', value: rankJumpViolations.length.toString(), inline: true },
                { name: 'Требует проверки (военник)', value: uniqueNeedCheckList.length.toString(), inline: true },
                { name: 'Некорректная причина', value: badReasons.length.toString(), inline: true },
                { name: 'Валидных записей', value: validPromotions.length.toString(), inline: true }
            )
            .setFooter({ text: 'GATE(LSPD до 6, рук. 12-13) | HRT(FIB до 6, рук. 8-9) | VICE(LSSD до 6, рук. 8-9)' })
            .setTimestamp();
        
        let reportText = 'ОТЧЕТ О ПРОВЕРКЕ ЛОГОВ ПОВЫШЕНИЙ\n';
        reportText += '='.repeat(60) + '\n\n';
        reportText += `Дата проверки: ${new Date().toLocaleString()}\n`;
        reportText += `Проверено записей: ${promotions.length}\n`;
        reportText += `Валидных: ${validPromotions.length}\n`;
        reportText += `Нарушений: ${rankJumpViolations.length + badReasons.length}\n`;
        reportText += `Требует проверки военника: ${uniqueNeedCheckList.length}\n\n`;
        
        reportText += 'ПРАВИЛА ПРОВЕРКИ:\n';
        reportText += '-'.repeat(40) + '\n';
        reportText += '• GATE (гейт) - только для LSPD, макс. ранг 6, руководящие: 12-13\n';
        reportText += '• HRT (хрт) - только для FIB, макс. ранг 6, руководящие: 8-9\n';
        reportText += '• VICE (вайс) - только для LSSD, макс. ранг 6, руководящие: 8-9\n';
        reportText += '• Запрещено повышать игрока более чем на 1 ранг в 24 часа (12.7)\n';
        reportText += '• С военным билетом: до +2 рангов в день\n';
        reportText += '• LSPD, ARMY, SASPA: при назначении до +3 рангов (12.8)\n';
        reportText += '• LSSD, FIB: при назначении до +2 рангов (12.8)\n';
        reportText += '• EMS, WN: при назначении +1 ранг (12.8)\n';
        reportText += '• Руководящие должности и восстановление - исключения\n\n';
        
        if (uniqueNeedCheckList.length > 0) {
            reportText += 'ТРЕБУЕТ ПРОВЕРКИ ВОЕННОГО БИЛЕТА:\n';
            reportText += '-'.repeat(40) + '\n';
            for (const check of uniqueNeedCheckList) {
                reportText += `\n[${check.time}] ${check.promotedCharacter}[${check.promotedId}] (${check.faction})\n`;
                reportText += `  ${check.oldRank} → ${check.newRank}\n`;
                reportText += `  Повышение на ${check.levelDiff} ранга\n`;
                reportText += `  Причина: "${check.reason}"\n`;
                reportText += `  ${check.checkMessage}\n`;
                reportText += `  check_military_card ${check.promotedId}\n`
            }
            reportText += '\n';
        }
        
        if (rankJumpViolations.length > 0) {
            reportText += 'НАРУШЕНИЕ КД ПОВЫШЕНИЯ:\n';
            reportText += '-'.repeat(40) + '\n';
            for (const violation of rankJumpViolations) {
                reportText += `\n[${violation.time}] ${violation.promotedCharacter}[${violation.promotedId}] (${violation.faction})\n`;
                reportText += `  ${violation.oldRank} → ${violation.newRank}\n`;
                reportText += `  Причина: "${violation.reason}"\n`;
                reportText += `  ${violation.violationMessage}\n`;
            }
            reportText += '\n';
        }
        
        if (badReasons.length > 0) {
            reportText += 'НЕКОРРЕКТНАЯ ПРИЧИНА:\n';
            reportText += '-'.repeat(40) + '\n';
            for (const bad of badReasons) {
                reportText += `\n[${bad.time}] ${bad.promotedCharacter}[${bad.promotedId}] (${bad.faction})\n`;
                reportText += `  Причина: "${bad.reason}"\n`;
                reportText += `  ${bad.error}\n`;
            }
            reportText += '\n';
        }
        
        const reportBuffer = Buffer.from(reportText, 'utf-8');
        const reportAttachment = new AttachmentBuilder(reportBuffer, { name: `promotion_check_${Date.now()}.txt` });
        
        await interaction.editReply({ embeds: [embed], files: [reportAttachment] });
        
    } catch (error) {
        console.error('Ошибка при проверке логов:', error);
        await interaction.editReply({ content: 'Ошибка при обработке файла. Убедитесь, что файл в правильном формате.' });
    }
}