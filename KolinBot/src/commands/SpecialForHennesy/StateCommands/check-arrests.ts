import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import axios from 'axios';

export const data = new SlashCommandBuilder()
    .setName("проверить-аресты")
    .setDescription("Анализ логов на нарушение 3.24 ПГС")
    .addAttachmentOption(option => 
        option.setName("файл")
            .setDescription("Загрузите .txt файл с логами")
            .setRequired(true)
    );

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply({ ephemeral: true });

    const attachment = inter.options.getAttachment("файл")!;
    if (!attachment.name.endsWith('.txt')) {
        return await inter.editReply("❌ Нужен файл .txt");
    }

    try {
        const response = await axios.get(attachment.url, { responseType: 'text' });
        const lines = response.data.split('\n');

        const violations: { officer: string; comment: string }[] = [];

        for (const line of lines) {
            if (!line.includes("с комментарием:")) continue;

            const commentPart = line.split("с комментарием:")[1];
            if (!commentPart) continue;

            let comment = commentPart.replace(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}/, "").trim();
            
            const officerMatch = line.match(/^\d+\t(.*?)\s\[/);
            const officer = officerMatch ? officerMatch[1] : "Неизвестен";

            if (isViolation(comment)) {
                violations.push({ officer, comment: comment || "пусто" });
            }
        }

        if (violations.length === 0) {
            return await inter.editReply("✅ Нарушений пункта 3.24 не найдено.");
        }

        const embeds = [];
        for (let i = 0; i < violations.length && i < 25; i += 5) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(violations.slice(i, i + 5).map(v => 
                    `**Сотрудник:** ${v.officer}\n**Комментарий:** \`${v.comment}\``
                ).join("\n\n---\n\n"));
            
            if (i === 0) {
                embed.setTitle(`⚠️ Найдено нарушений: ${violations.length}`);
            }
            embeds.push(embed);
        }

        await inter.editReply({ embeds });

    } catch (e) {
        console.error(e);
        await inter.editReply("❌ Ошибка при чтении файла.");
    }
}

function isViolation(comment: string): boolean {
    const clean = comment.toLowerCase().trim();
    
    // ============================================
    // НЕ ЯВЛЯЮТСЯ НАРУШЕНИЕМ (РАЗРЕШЕНО)
    // ============================================
    
    // 1. Пустые и дефисные комментарии
    if (!clean || clean === "" || /^[-*.,]+$/.test(clean) || /^[-]{1,3}$/.test(clean)) {
        return false;
    }
    
    // 2. Разрешенные статусы опасности
    const allowedStatus = ["особо опасен", "опасен", "буйный", "спокойный", "беглец", "буйны", "буйный!"];
    if (allowedStatus.some(s => clean.includes(s))) return false;
    
    // 3. Характеристики поведения
    const allowedBehavior = ["адекватный", "адеватный", "дерзкий", "неадекват", "спокоен"];
    if (allowedBehavior.some(b => clean.includes(b))) return false;
    
    // 4. Фракции и гос. структуры
    const allowedFactions = [
        "lspd", "fib", "lssd", "gov", "army", "saspa", "usss", "csd", "sang", "fna", 
        "cpd", "noose", "db", "srt", "swat", "atf", "pa", "pd", "lsdp", "asphyxia", 
        "usss", "srt", "atd", "csd"
    ];
    if (allowedFactions.some(f => clean.includes(f))) return false;
    
    // 5. Технические коды (AR-DJ-3435, 00-09-07, 08-08/09-06, D.Com DF|5084-DS)
    const techPatterns = [
        /^[a-z]{2,4}[-][a-z]{2,4}[-]\d+$/i,  // AR-DJ-3435
        /^\d{2}[-]\d{2}[-]\d{2,4}$/,          // 00-09-07, 00-08-94
        /^\d{2}[-]\d{2}\s*\/\s*\d{2}[-]\d{2}$/, // 08-08 / 09-06
        /^[a-z]\.\s?[a-z]+\s?\|\s?\d{4}[-][a-z]{2}$/i, // D.Com DF | 5084-DS
        /^d\.head\s+[a-z]+\s+\d{2}[-]\d{2}$/i, // D.Head ATD 00-83
        /^[a-z0-9]{2,4}\s?\|\s?[a-z0-9]{2,4}\s?\|\s?\d{2}[-]\d{2}[-]\d{2,4}$/i, // USSS | CSD | 00-09-07
    ];
    if (techPatterns.some(p => p.test(clean))) return false;
    
    // 6. Номера статей УК/АК (60ук, 44ак, 48ч1, 22ч1, 51АК и т.д.)
    const articlePatterns = [
        /^\d{1,3}[а-яё]{0,2}$/i,           // 60ук, 44ак
        /^\d{1,2}ч\d{1}$/i,                 // 48ч1, 22ч1
        /^\d{1,2}[а-яё]{0,2}\s?\d{1,2}[а-яё]{0,2}$/i, // 51ак48ч1
    ];
    if (articlePatterns.some(p => p.test(clean))) return false;
    
    // 7. Имена напарников (одно слово или имя+фамилия)
    const partnerPatterns = [
        /^[a-zа-яё]+(?:[ _-][a-zа-яё]+)?$/i,
        /^[a-zа-яё]+\s+[a-zа-яё]+$/i,
        /^[a-z]\.\s?[a-z]+$/i,
    ];
    if (partnerPatterns.some(p => p.test(clean)) && clean.length >= 3 && clean.length <= 30) {
        const forbidden = ["nilzya", "ninada", "nelzya", "sato", "sat", "нельзя", "низя", "lokko"];
        if (forbidden.includes(clean)) return true;
        return false;
    }
    
    // 8. Указание напарника (Нап:, PA, PD, by)
    if (clean.includes("нап:") || clean.includes("pa ") || clean.includes("па ") || 
        clean.includes("by ") || clean.includes("pd ")) {
        return false;
    }
    
    // 9. Решение ОГП, ордер
    if (clean.includes("решение огп") || clean.includes("ордер") || clean.includes("постановление")) {
        return false;
    }
    
    // ============================================
    // НАРУШЕНИЯ
    // ============================================
    
    // 10. Транслит "нельзя" и "ситуация"
    const forbiddenTranslit = [
        "nilzya", "ninada", "nelzya", "nelzyaa", "nilzyaa", "низя", "нельзя", "нельза", "нильза",
        "sato", "sat", "сато", "сат", "ситуация", "lokko"
    ];
    if (forbiddenTranslit.includes(clean)) return true;
    if (/^н?[еe]?л[ьb]?з[яа]?$/i.test(clean)) return true;
    if (/^с[аa]т[оo]?$/i.test(clean)) return true;
    
    // 11. Одиночные буквы или бессмысленные символы
    if (/^[а-яёa-z]$/i.test(clean)) return true;  // я, й
    if (/^[=]+$/.test(clean)) return true;         // =
    if (/^[а-яёa-z]{2,4}$/i.test(clean) && !allowedFactions.includes(clean) && !articlePatterns.some(p => p.test(clean))) {
        // Короткие слова, не являющиеся фракциями или статьями
        const allowedShort = ["lspd", "fib", "usss", "csd", "srt", "atd", "pa", "pd"];
        if (!allowedShort.includes(clean)) return true;
    }
    
    // 12. Бессмысленные комбинации (-и, -ы и т.д.)
    if (/^[-][а-яёa-z]+$/i.test(clean)) return true;
    
    return false;
}