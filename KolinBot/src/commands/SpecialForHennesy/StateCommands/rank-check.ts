import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getSecurityAcsess } from '../../../databases/sqlite';

export const data = new SlashCommandBuilder()
    .setName('проверить-повышения')
    .setDescription('Проверить CSV/TXT лог повышений на нарушения')
    .addAttachmentOption(option =>
        option.setName('файл')
            .setDescription('CSV или TXT файл с логами повышений')
            .setRequired(true));

const FACTION_RANK_LIMITS: Record<string, number> = {
    'LSPD': 3,
    'ARMY': 3,
    'SASPA': 3,
    'LSSD': 2,
    'FIB': 2,
    'EMS': 1,
    'WN': 1
};

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

const VALID_SHORT_REASONS = [
    'должность',
    'должност',
    'должности',
    'назначение',
    'повышение',
    'перевод'
];

const SPECIAL_PROGRAMS: Record<string, { factions: string[], maxRank: number, aliases: string[] }> = {
    'GATE': {
        factions: ['LSPD'],
        maxRank: 6,
        aliases: ['gate', 'гейт']
    },
    'HRT': {
        factions: ['FIB'],
        maxRank: 6,
        aliases: ['hrt', 'хрт']
    },
    'VICE': {
        factions: ['LSSD'],
        maxRank: 6,
        aliases: ['vice', 'вайс']
    }
};

const LEADERSHIP_PHRASES = ['начальник', 'зам. начальника', 'руководитель', 'глава', 'заместитель'];

function parseRank(rankString: string): { name: string; level: number } {
    const match = rankString.match(/(.+)\s*\((\d+)\)/);
    if (match) {
        return { name: match[1].trim(), level: parseInt(match[2]) };
    }
    return { name: rankString, level: 0 };
}

function isLeadershipPosition(rank: string): boolean {
    return LEADERSHIP_PHRASES.some(phrase => rank.toLowerCase().includes(phrase));
}

function getSpecialProgramInfo(reason: string, faction: string): { program: string | null; isValid: boolean; maxRank: number; error?: string } {
    const lowerReason = reason.toLowerCase().trim();
    
    for (const [programName, programInfo] of Object.entries(SPECIAL_PROGRAMS)) {
        const isMatch = programInfo.aliases.some(alias => lowerReason.includes(alias));
        
        if (isMatch) {
            if (!programInfo.factions.includes(faction.toUpperCase())) {
                return {
                    program: programName,
                    isValid: false,
                    maxRank: programInfo.maxRank,
                    error: `Программа ${programName} доступна только для фракции ${programInfo.factions.join(', ')} (текущая фракция: ${faction})`
                };
            }
            return {
                program: programName,
                isValid: true,
                maxRank: programInfo.maxRank
            };
        }
    }
    
    return { program: null, isValid: false, maxRank: 0 };
}

function validateReason(reason: string, faction: string): { isValid: boolean; error?: string } {
    const lowerReason = reason.toLowerCase().trim();
    
    if (VALID_SHORT_REASONS.includes(lowerReason)) {
        return { isValid: true };
    }
    
    const specialProgram = getSpecialProgramInfo(reason, faction);
    if (specialProgram.program) {
        if (!specialProgram.isValid) {
            return { isValid: false, error: specialProgram.error };
        }
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
    
    if (reason.startsWith('http') && (reason.includes('discord.com/channels') || reason.includes('discordapp.com/channels'))) {
        return { isValid: true };
    }
    
    if (reason.length < 10 && !isLeadershipPosition(reason) && !VALID_SHORT_REASONS.includes(lowerReason)) {
        return { isValid: false, error: 'Причина должна быть более содержательной (минимум 10 символов) или ссылка на Discord' };
    }
    
    return { isValid: true };
}

function checkRankJumpViolation(
    oldLevel: number, 
    newLevel: number, 
    faction: string, 
    isLeadershipAssignment: boolean, 
    isReinstatement: boolean, 
    hasMilitaryCard: boolean,
    reason: string
): { isViolation: boolean; allowed: number; message: string } {
    const specialProgram = getSpecialProgramInfo(reason, faction);
    
    if (specialProgram.program && specialProgram.isValid) {
        if (newLevel > specialProgram.maxRank) {
            return { 
                isViolation: true, 
                allowed: specialProgram.maxRank, 
                message: `Нарушение: По программе ${specialProgram.program} максимальный ранг - ${specialProgram.maxRank} (повышение до ${newLevel} ранга)` 
            };
        }
        return { 
            isViolation: false, 
            allowed: specialProgram.maxRank, 
            message: `Программа ${specialProgram.program}: разрешено до ${specialProgram.maxRank} ранга (повышение до ${newLevel})` 
        };
    }
    
    if (isLeadershipAssignment) {
        return { isViolation: false, allowed: 99, message: 'Назначение на руководящую должность (разрешено)' };
    }
    
    if (isReinstatement) {
        return { isViolation: false, allowed: 99, message: 'Восстановление во фракцию (разрешено)' };
    }
    
    const levelDiff = newLevel - oldLevel;
    const factionUpper = faction.toUpperCase();
    const maxAllowed = FACTION_RANK_LIMITS[factionUpper] || 1;
    
    if (hasMilitaryCard) {
        if (levelDiff > 2) {
            return { isViolation: true, allowed: 2, message: `Нарушение 12.7: При наличии военного билета можно повышаться максимум на 2 ранга в день (повышение на ${levelDiff} ранга)` };
        }
        return { isViolation: false, allowed: 2, message: `Военный билет: разрешено до 2 рангов (повышение на ${levelDiff} ранга)` };
    }
    
    if (levelDiff > maxAllowed) {
        return { isViolation: true, allowed: maxAllowed, message: `Нарушение 12.7: Для фракции ${faction} разрешено повышение максимум на ${maxAllowed} ранг(а) в день (повышение на ${levelDiff} ранга)` };
    }
    
    return { isViolation: false, allowed: maxAllowed, message: `Разрешено до ${maxAllowed} рангов (повышение на ${levelDiff} ранга)` };
}

export async function execute(interaction: ChatInputCommandInteraction) {

    await interaction.deferReply({ ephemeral: true });

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
            return interaction.editReply({ content: 'Не удалось найти записи о повышениях в файле. Убедитесь, что формат соответствует примеру.' });
        }
        
        const badReasons = [];
        const rankJumpViolations = [];
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
                newLevel: newRankData.level
            });
        }
        
        for (const [key, dayPromos] of characterDayPromotions) {
            dayPromos.sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime());
            
            let hasMilitaryCard = false;
            
            for (let i = 0; i < dayPromos.length; i++) {
                const promo = dayPromos[i];
                const oldRankData = parseRank(promo.oldRank);
                const newRankData = parseRank(promo.newRank);
                
                const isReinstatement = i === 0 && oldRankData.level === 0 && promo.oldRank.includes('Студент');
                const isLeadershipAssign = isLeadershipPosition(promo.newRank);
                
                const violation = checkRankJumpViolation(
                    oldRankData.level, 
                    newRankData.level, 
                    promo.faction, 
                    isLeadershipAssign,
                    isReinstatement,
                    hasMilitaryCard,
                    promo.reason
                );
                
                if (violation.isViolation) {
                    rankJumpViolations.push({
                        ...promo,
                        oldLevel: oldRankData.level,
                        newLevel: newRankData.level,
                        violationMessage: violation.message,
                        allowedRank: violation.allowed
                    });
                }
                
                const reasonValidation = validateReason(promo.reason, promo.faction);
                if (!reasonValidation.isValid) {
                    badReasons.push({
                        ...promo,
                        error: reasonValidation.error
                    });
                }
                
                if (!violation.isViolation && reasonValidation.isValid) {
                    validPromotions.push(promo);
                }
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor(rankJumpViolations.length > 0 || badReasons.length > 0 ? 0xFF0000 : 0x00FF00)
            .setTitle('Результат проверки логов повышений')
            .setDescription(`Проверено записей: ${promotions.length}`)
            .addFields(
                { name: '⚠️ Нарушение КД повышения (12.7)', value: rankJumpViolations.length.toString(), inline: true },
                { name: '❌ Некорректная причина', value: badReasons.length.toString(), inline: true },
                { name: '✅ Валидных записей', value: validPromotions.length.toString(), inline: true }
            )
            .setFooter({ text: 'Полный отчет в прикрепленном файле | GATE(LSPD) | HRT(FIB) | VICE(LSSD) | Макс. ранг: 6' })
            .setTimestamp();
        
        let reportText = 'ОТЧЕТ О ПРОВЕРКЕ ЛОГОВ ПОВЫШЕНИЙ\n';
        reportText += '='.repeat(60) + '\n\n';
        reportText += `Дата проверки: ${new Date().toLocaleString()}\n`;
        reportText += `Проверено записей: ${promotions.length}\n`;
        reportText += `Валидных: ${validPromotions.length}\n`;
        reportText += `Нарушений: ${rankJumpViolations.length + badReasons.length}\n\n`;
        
        reportText += 'ПРАВИЛА ПРОВЕРКИ:\n';
        reportText += '-'.repeat(40) + '\n';
        reportText += '• GATE (гейт) - только для LSPD, максимальный ранг - 6\n';
        reportText += '• HRT (хрт) - только для FIB, максимальный ранг - 6\n';
        reportText += '• VICE (вайс) - только для LSSD, максимальный ранг - 6\n';
        reportText += '• Запрещено повышать игрока более чем на 1 ранг в 24 часа\n';
        reportText += '• При наличии военного билета: +2 ранга в день\n';
        reportText += '• LSPD, ARMY, SASPA: до +3 рангов при назначении\n';
        reportText += '• LSSD, FIB: до +2 рангов при назначении\n';
        reportText += '• EMS, WN: +1 ранг в день\n';
        reportText += '• Руководящие должности и восстановление - исключения\n\n';
        
        if (rankJumpViolations.length > 0) {
            reportText += 'НАРУШЕНИЕ 12.7 (КД ПОВЫШЕНИЯ):\n';
            reportText += '-'.repeat(40) + '\n';
            for (const violation of rankJumpViolations) {
                reportText += `\n[${violation.time}] ${violation.promotedCharacter}[${violation.promotedId}] (${violation.faction})\n`;
                reportText += `  ${violation.oldRank} → ${violation.newRank}\n`;
                reportText += `  Причина: "${violation.reason}"\n`;
                reportText += `  Нарушение: ${violation.violationMessage}\n`;
            }
            reportText += '\n';
        }
        
        if (badReasons.length > 0) {
            reportText += 'НЕКОРРЕКТНАЯ ПРИЧИНА:\n';
            reportText += '-'.repeat(40) + '\n';
            for (const bad of badReasons) {
                reportText += `\n[${bad.time}] ${bad.promotedCharacter}[${bad.promotedId}] (${bad.faction})\n`;
                reportText += `  Причина: "${bad.reason}"\n`;
                reportText += `  Ошибка: ${bad.error}\n`;
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