import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('проверить-лорность-ников')
    .setDescription('Проверить список членов фракции на соответствие лорным окончаниям')
    .addAttachmentOption(option =>
        option.setName('файл')
            .setDescription('TXT файл со списком членов фракции')
            .setRequired(true));

interface Member {
    nickname: string;
    rank: number;
}

// Паттерны для проверки
const MAFIA_PATTERNS: Record<string, RegExp> = {
    'Русская мафия': /(ov|ev|in|eva|ova|skiy|skaya|ina)$/i,
    'Итальянская мафия': /(ini|etti|ello|one|ucci|ardi|ano|ani|enzi|elli|ardo|asco|izzi|ato|esi|ieri|aldo|iano)$/i,
    'Армянская мафия': /(yan|yanc|ian)$/i,
    'Мексиканская мафия': /(ez|as|os|es)$/i,
    'Японская мафия': /(uki|suki|zaki|moto|shi|zuki)$/i
};

function parseFactionFromHeader(content: string): string | null {
    const lines = content.split('\n');
    for (const line of lines) {
        const match = line.match(/\(([^)]+)\)/);
        if (match && (match[1].includes('Мафия') || match[1].includes('Mafia'))) {
            return match[1];
        }
    }
    return null;
}

function parseTotalChars(content: string): number | null {
    const lines = content.split('\n');
    for (const line of lines) {
        const match = line.match(/Total chars:\s+(\d+)/i);
        if (match) {
            return parseInt(match[1]);
        }
    }
    return null;
}

function parseMembers(lines: string[]): Member[] {
    const members: Member[] = [];
    
    for (const line of lines) {
        if (line.trim().length === 0) continue;
        if (line.includes('Total chars:') || line.includes('[Blackberry]') || line.includes('Ид') || line.includes('Персонаж')) {
            continue;
        }
        
        if (!line.includes('🟢') && !line.includes('🔴')) continue;
        
        const parts = line.split(/\s+/);
        if (parts.length < 2) continue;
        
        let nickname = '';
        let rank = 0;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part === '🟢' || part === '🔴') {
                if (i + 1 < parts.length) {
                    nickname = parts[i + 1];
                }
                continue;
            }
            if (/^\d+$/.test(part)) {
                rank = parseInt(part);
            }
        }
        
        if (!nickname) {
            const nicknameMatch = line.match(/^[🟢🔴]\s+([A-Za-zА-Яа-яё_]+)/);
            if (nicknameMatch) {
                nickname = nicknameMatch[1];
            }
        }
        
        if (rank === 0) {
            const rankMatch = line.match(/\s+(\d+)$/);
            if (rankMatch) {
                rank = parseInt(rankMatch[1]);
            }
        }
        
        if (nickname && rank > 0) {
            members.push({ nickname, rank });
        }
    }
    
    return members;
}

function isNicknameValid(nickname: string, factionName: string | null): boolean {
    if (!factionName) return true;
    
    const lowerNick = nickname.toLowerCase();
    
    // Для итальянской мафии: проверяем строгое соответствие итальянским окончаниям
    if (factionName.includes('Итальян') || factionName.includes('Italian')) {
        return MAFIA_PATTERNS['Итальянская мафия'].test(lowerNick);
    }
    
    // Для русской мафии
    if (factionName.includes('Русск') || factionName.includes('Russian')) {
        return MAFIA_PATTERNS['Русская мафия'].test(lowerNick);
    }
    
    // Для армянской мафии
    if (factionName.includes('Армян') || factionName.includes('Armenian')) {
        return MAFIA_PATTERNS['Армянская мафия'].test(lowerNick);
    }
    
    // Для мексиканской мафии
    if (factionName.includes('Мексик') || factionName.includes('Mexican')) {
        return MAFIA_PATTERNS['Мексиканская мафия'].test(lowerNick);
    }
    
    return true;
}

function getViolationLevel(totalMembers: number, violationsCount: number): { 
    level: 'normal' | 'warning' | 'danger';
    message: string;
    min: number;
    max: number;
} {
    let min = 0, max = 0;
    
    if (totalMembers <= 100) {
        min = 0; max = 7;
        if (violationsCount <= 7) return { level: 'normal', message: 'В пределах нормы', min, max };
        else if (violationsCount <= 10) return { level: 'warning', message: 'Превышение нормы, требуется предупреждение', min, max };
        else return { level: 'danger', message: 'Критическое превышение, рекомендуется выдать минуса', min, max };
    }
    else if (totalMembers <= 200) {
        min = 7; max = 11;
        if (violationsCount <= 11) return { level: 'normal', message: 'В пределах нормы', min, max };
        else if (violationsCount <= 14) return { level: 'warning', message: 'Превышение нормы, требуется предупреждение', min, max };
        else return { level: 'danger', message: 'Критическое превышение, рекомендуется выдать минуса', min, max };
    }
    else if (totalMembers <= 300) {
        min = 11; max = 14;
        if (violationsCount <= 14) return { level: 'normal', message: 'В пределах нормы', min, max };
        else if (violationsCount <= 18) return { level: 'warning', message: 'Превышение нормы, требуется предупреждение', min, max };
        else return { level: 'danger', message: 'Критическое превышение, рекомендуется выдать минуса', min, max };
    }
    else if (totalMembers <= 400) {
        min = 14; max = 18;
        if (violationsCount <= 18) return { level: 'normal', message: 'В пределах нормы', min, max };
        else if (violationsCount <= 23) return { level: 'warning', message: 'Превышение нормы, требуется предупреждение', min, max };
        else return { level: 'danger', message: 'Критическое превышение, рекомендуется выдать минуса', min, max };
    }
    else if (totalMembers <= 500) {
        min = 18; max = 21;
        if (violationsCount <= 21) return { level: 'normal', message: 'В пределах нормы', min, max };
        else if (violationsCount <= 27) return { level: 'warning', message: 'Превышение нормы, требуется предупреждение', min, max };
        else return { level: 'danger', message: 'Критическое превышение, рекомендуется выдать минуса', min, max };
    }
    else if (totalMembers <= 600) {
        min = 21; max = 25;
        if (violationsCount <= 25) return { level: 'normal', message: 'В пределах нормы', min, max };
        else if (violationsCount <= 32) return { level: 'warning', message: 'Превышение нормы, требуется предупреждение', min, max };
        else return { level: 'danger', message: 'Критическое превышение, рекомендуется выдать минуса', min, max };
    }
    else if (totalMembers <= 700) {
        min = 25; max = 28;
        if (violationsCount <= 28) return { level: 'normal', message: 'В пределах нормы', min, max };
        else if (violationsCount <= 36) return { level: 'warning', message: 'Превышение нормы, требуется предупреждение', min, max };
        else return { level: 'danger', message: 'Критическое превышение, рекомендуется выдать минуса', min, max };
    }
    else if (totalMembers <= 800) {
        min = 28; max = 32;
        if (violationsCount <= 32) return { level: 'normal', message: 'В пределах нормы', min, max };
        else if (violationsCount <= 41) return { level: 'warning', message: 'Превышение нормы, требуется предупреждение', min, max };
        else return { level: 'danger', message: 'Критическое превышение, рекомендуется выдать минуса', min, max };
    }
    else if (totalMembers <= 900) {
        min = 32; max = 35;
        if (violationsCount <= 35) return { level: 'normal', message: 'В пределах нормы', min, max };
        else if (violationsCount <= 45) return { level: 'warning', message: 'Превышение нормы, требуется предупреждение', min, max };
        else return { level: 'danger', message: 'Критическое превышение, рекомендуется выдать минуса', min, max };
    }
    else if (totalMembers <= 1000) {
        min = 35; max = 38;
        if (violationsCount <= 38) return { level: 'normal', message: 'В пределах нормы', min, max };
        else if (violationsCount <= 49) return { level: 'warning', message: 'Превышение нормы, требуется предупреждение', min, max };
        else return { level: 'danger', message: 'Критическое превышение, рекомендуется выдать минуса', min, max };
    }
    else {
        min = 38; max = 41;
        if (violationsCount <= 38) return { level: 'normal', message: 'В пределах нормы', min, max };
        else if (violationsCount <= 50) return { level: 'warning', message: 'Превышение нормы, требуется предупреждение', min, max };
        else return { level: 'danger', message: 'Критическое превышение, рекомендуется выдать минуса', min, max };
    }
}

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const attachment = interaction.options.getAttachment('файл', true);
    
    if (!attachment.contentType?.includes('text') && !attachment.name?.match(/\.(txt)$/i)) {
        return interaction.editReply({ content: 'Пожалуйста, загрузите TXT файл' });
    }

    try {
        const response = await fetch(attachment.url);
        const fileContent = await response.text();
        
        const lines = fileContent.split('\n');
        
        let totalMembers = parseTotalChars(fileContent);
        
        if (!totalMembers) {
            return interaction.editReply({ 
                content: 'Не удалось найти строку "Total chars:" в файле. Проверьте файл.' 
            });
        }
        
        const factionName = parseFactionFromHeader(fileContent);
        const members = parseMembers(lines);
        
        const MIN_RANK_FOR_CHECK = 5;
        
        const violations: Member[] = [];
        let validCount = 0;
        let lowRankSkipped = 0;
        
        for (const member of members) {
            if (member.rank < MIN_RANK_FOR_CHECK) {
                lowRankSkipped++;
                continue;
            }
            
            const isValid = isNicknameValid(member.nickname, factionName);
            
            if (!isValid) {
                violations.push(member);
            } else {
                validCount++;
            }
        }
        
        const violationsCount = violations.length;
        const violationLevel = getViolationLevel(totalMembers, violationsCount);
        const totalChecked = members.filter(m => m.rank >= MIN_RANK_FOR_CHECK).length;
        
        let color = 0x00FF00;
        if (violationLevel.level === 'warning') color = 0xFFA500;
        if (violationLevel.level === 'danger') color = 0xFF0000;
        
        violations.sort((a, b) => b.rank - a.rank);
        
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('Результат проверки лорности ников')
            .setDescription(factionName ? `Фракция: **${factionName}**` : `Проверено ников с ${MIN_RANK_FOR_CHECK}+ рангом: ${totalChecked}`)
            .addFields(
                { name: 'Численность фракции', value: `${totalMembers} чел.`, inline: true },
                { name: 'Проверено (5+ ранг)', value: `${totalChecked}`, inline: true },
                { name: 'Пропущено (1-4 ранг)', value: `${lowRankSkipped}`, inline: true },
                { name: 'Норма NRP ников', value: `${violationLevel.min}-${violationLevel.max}`, inline: true },
                { name: 'Найдено NRP ников', value: `${violationsCount}`, inline: true },
                { name: 'Статус', value: violationLevel.message, inline: false },
                { name: 'Валидных ников', value: `${validCount}`, inline: true },
                { name: 'NRP ников', value: `${violationsCount}`, inline: true }
            )
            .setFooter({ text: 'Проверяются только игроки с рангом 5 и выше | NRP ники требуют исправления' })
            .setTimestamp();
        
        if (violations.length > 0) {
            const violationList = violations.slice(0, 25).map(v => `• ${v.nickname} (ранг ${v.rank})`).join('\n');
            embed.addFields({ 
                name: `Список NRP ников (5+ ранг)${violations.length > 25 ? ` — показаны первые 25 из ${violations.length}` : ''}`, 
                value: violationList.substring(0, 1024), 
                inline: false 
            });
        }
        
        let reportText = 'ОТЧЕТ О ПРОВЕРКЕ ЛОРНОСТИ НИКОВ\n';
        reportText += '='.repeat(60) + '\n\n';
        reportText += factionName ? `Фракция: ${factionName}\n` : '';
        reportText += `Дата проверки: ${new Date().toLocaleString()}\n`;
        reportText += `Численность фракции: ${totalMembers} чел.\n`;
        reportText += `Проверено ников (5+ ранг): ${totalChecked}\n`;
        reportText += `Пропущено (1-4 ранг): ${lowRankSkipped}\n`;
        reportText += `Норма NRP ников: ${violationLevel.min}-${violationLevel.max}\n`;
        reportText += `Найдено NRP ников: ${violationsCount}\n`;
        reportText += `Статус: ${violationLevel.message}\n\n`;
        
        if (violations.length > 0) {
            reportText += 'СПИСОК NRP НИКОВ (НЕ СООТВЕТСТВУЮТ, РАНГ 5+):\n';
            reportText += '-'.repeat(40) + '\n';
            for (const violation of violations) {
                reportText += `${violation.nickname} (ранг ${violation.rank})\n`;
            }
            reportText += '\n';
        }
        
        reportText += 'ПРАВИЛА ЛОРНЫХ ОКОНЧАНИЙ:\n';
        reportText += '-'.repeat(40) + '\n';
        reportText += 'Русская мафия: -ov, -ev, -in (Ivanov, Sobolev, Pushkin)\n';
        reportText += 'Итальянская мафия: -ini, -ino, -elli, -etti, -atti, -oni, -icci, -ano, -acci, -izzi\n';
        reportText += 'Армянская мафия: -yan, -yanc, -ian (Galstyan, Sargsian)\n';
        reportText += 'Мексиканская мафия: -ez, -as, -os, -es (Rodriguez, Vargas, Rios)\n';
        reportText += '\nПримечание: Проверяются только игроки с рангом 5 и выше.\n';
        
        const reportBuffer = Buffer.from(reportText, 'utf-8');
        const reportAttachment = new AttachmentBuilder(reportBuffer, { name: `lore_check_${Date.now()}.txt` });
        
        await interaction.editReply({ embeds: [embed], files: [reportAttachment] });
        
    } catch (error) {
        console.error('Ошибка при проверке ников:', error);
        await interaction.editReply({ content: 'Ошибка при обработке файла. Убедитесь, что файл в правильном формате.' });
    }
}