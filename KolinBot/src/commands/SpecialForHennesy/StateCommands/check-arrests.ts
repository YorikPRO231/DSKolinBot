import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import axios from 'axios';

export const data = new SlashCommandBuilder()
    .setName("проверить-аресты")
    .setDescription("Анализ логов на нарушение 3.24 ПГС (только файл)")
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

        const violations: string[] = [];
        const allowedStatus = ["особо опасен", "опасен", "буйный", "спокойный", "беглец"];

        for (let line of lines) {
            if (!line.includes("с комментарием:")) continue;

            const commentPart = line.split("с комментарием:")[1];
            if (!commentPart) continue;

            // Дата
            const comment = commentPart.replace(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}/, "").trim();
            
            // Тот, кто посадил
            const officerMatch = line.match(/^\d+\t(.*?)\s\[/);
            const officer = officerMatch ? officerMatch[1] : "Неизвестен";

            if (isViolation(comment, allowedStatus)) {
                violations.push(`**Сотрудник:** ${officer}\n**Комментарий:** \`${comment || "пусто"}\``);
            }
        }

        if (violations.length === 0) {
            return await inter.editReply("✅ Нарушений пункта 3.24 не найдено.");
        }

        const embeds = [];
        for (let i = 0; i < violations.length && i < 25; i += 5) {
            embeds.push(new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle(i === 0 ? `⚠️ Найдено нарушений: ${violations.length}` : null)
                .setDescription(violations.slice(i, i + 5).join("\n\n---\n\n")));
        }

        await inter.editReply({ embeds });

    } catch (e) {
        await inter.editReply("❌ Ошибка при чтении файла.");
    }
}

function isViolation(comment: string, allowedStatus: string[]): boolean {
    const clean = comment.toLowerCase().trim();

    // 1. Разрешенные статусы
    if (allowedStatus.some(s => clean.includes(s))) return false;

    // 2. Исключения
    const customExemptions = ["решение огп", "ордер", "lspd", "fib", "lssd", "gov", "army", "saspa"];
    if (customExemptions.some(ex => clean.includes(ex))) return false;

    // 3. Проверка чисел
    const numberMatch = clean.match(/\d+/);
    if (numberMatch) {
        const num = parseInt(numberMatch[0]);
        if (num === 200) return true; // Исключение: 200
        if (num >= 1 && num <= 2000) return false;
    }

    // 4. Список "Мусора" 
    const junk = ["-", ".", ",", "—", "none", "нет", "отсутствует", "", "---", "--", "...", "/"];
    if (junk.includes(clean) || clean.replace(/[-. ]/g, "").length === 0) return false;

    // 5. Проверка на описание ситуации
    const words = clean.split(/\s+/);
    const hasRussian = /[а-яё]/i.test(clean);
    
    // Слова на русском
    if (hasRussian && words.length > 2) return true; 

    // 6. Белый список технических данных
    const isTechData = /^(pa|head|swat|cpd|noose|db|srt|fna|csd|cid|usss)$/i.test(clean) || 
                       /^([a-z0-9]{2,}[- /|]+)+[a-z0-9]{2,}$/i.test(clean) ||
                       /^(\d{2}-\d{2}-\d{2,})$/.test(clean);

    if (isTechData) return false;

    // 7. Технические пометки напарников
    if (clean.includes("&") || clean.includes("|")) return false;

    // 8. Русский текст 2
    if (hasRussian) return true;

    // 9. Другое
    if (clean.length > 0 && !isTechData) return true;

    return false;
}
