import { 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    SlashCommandBuilder, 
    AttachmentBuilder 
} from 'discord.js';
import axios from 'axios';

export const data = new SlashCommandBuilder()
    .setName("проверить-штрафы")
    .setDescription("Анализ логов штрафов на наличие нарушений в причинах")
    .addAttachmentOption(option => option.setName("лог-штрафов").setDescription("Файл с логами штрафов").setRequired(true));

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply();

    const attachment = inter.options.getAttachment("лог-штрафов")!;
    
    try {
        const response = await axios.get(attachment.url, { responseType: 'text' });
        const fileContent = response.data as string;
        const lines = fileContent.split('\n').filter(l => l.trim().length > 10);

        const violations: { officer: string; officerId: string; faction: string; reason: string; line: string }[] = [];

        lines.forEach(line => {
            const match = line.match(/\(([^)]+)\)/);
            
            if (match) {
                let reason = match[1].trim();
                const originalReason = reason;
                const reasonLower = reason.toLowerCase();
                
                // Извлечение информации о сотруднике: Имя, ID (статик), Фракция
                let officer = "Неизвестен";
                let officerId = "Неизвестен";
                let faction = "Неизвестна";
                
                // Формат строки: "Ид	Персонаж [ID]	Фракция	Текст	Время"
                const parts = line.split('\t');
                if (parts.length >= 3) {
                    const characterPart = parts[1] || "";
                    const idMatch = characterPart.match(/\[(\d+)\]/);
                    if (idMatch) {
                        officerId = idMatch[1];
                    }
                    officer = characterPart.replace(/\[\d+\]/, "").trim();
                    
                    // Фракция
                    faction = parts[2]?.trim() || "Неизвестна";
                }
                
                // Альтернативный парсинг через regex
                if (officer === "Неизвестен") {
                    const officerMatch = line.match(/^\d+\s+([^\[]+)\[(\d+)\]\s+([^\s]+)/);
                    if (officerMatch) {
                        officer = officerMatch[1].trim();
                        officerId = officerMatch[2];
                        faction = officerMatch[3].trim();
                    }
                }

                // ============================================
                // ПРОВЕРКА НА РАЗРЕШЁННЫЕ ПРИЧИНЫ (НЕ НАРУШЕНИЕ)
                // ============================================
                
                // 1. Пустая причина или только дефис/точка/звездочка - НАРУШЕНИЕ!
                const isEmpty = /^[-*.,\s]*$/.test(reason);
                if (isEmpty) {
                    violations.push({ officer, officerId, faction, reason: originalReason || "ПУСТО", line: line.substring(0, 150) });
                    return;
                }
                
                // 2. Короткие бессмысленные слова (до 3 символов, не похожи на статьи)
                if (reason.length <= 3 && !/\d/.test(reason)) {
                    violations.push({ officer, officerId, faction, reason: originalReason, line: line.substring(0, 150) });
                    return;
                }
                
                // 3. Номера статей ДК (дорожный кодекс) - РАЗРЕШЕНО
                const isDK = /дк|д\.к|дорожного кодекса/i.test(reasonLower);
                
                // 4. Номера статей АК (административный кодекс) - РАЗРЕШЕНО
                const isAK = /ак|а\.к|а\/к|административного кодекса/i.test(reasonLower);
                
                // 5. Транслит ДК и АК (dk, ak) - РАЗРЕШЕНО
                const isDKTranslit = /\bdk\b/i.test(reasonLower);
                const isAKTranslit = /\bak\b/i.test(reasonLower);
                
                // 6. Комбинации ДК/АК с номерами (34дк, 51ак, 12д.к, 40 дк, 48ч1) - РАЗРЕШЕНО
                const hasDKNumber = /\d{1,2}\s?дк|\d{1,2}\s?д\.к/i.test(reasonLower);
                const hasAKNumber = /\d{1,2}\s?ак|\d{1,2}\s?а\.к/i.test(reasonLower);
                
                // 7. Статьи с "ст." (ст 22, ст.16 ДК, ст.40 ДК) - РАЗРЕШЕНО
                const hasArticleWithDK = /ст\.?\s?\d{1,2}\s?дк/i.test(reasonLower);
                const hasArticleWithAK = /ст\.?\s?\d{1,2}\s?ак/i.test(reasonLower);
                const hasArticleOnly = /^ст\.?\s?\d{1,2}$/i.test(reasonLower);
                
                // 8. Просто число от 1 до 70 (стандартная статья) - РАЗРЕШЕНО
                const onlyNumberMatch = reason.match(/^(\d+)$/);
                const isStandardNumber = onlyNumberMatch && 
                                       parseInt(onlyNumberMatch[1]) >= 1 && 
                                       parseInt(onlyNumberMatch[1]) <= 70;
                
                // 9. Числа-суммы (2000, 10000, 20000 и т.д.) - НАРУШЕНИЕ!
                const isMoneyNumber = /^\d{4,5}$/.test(reason) && 
                                     parseInt(reason) >= 1000;
                
                if (isMoneyNumber) {
                    violations.push({ officer, officerId, faction, reason: originalReason, line: line.substring(0, 150) });
                    return;
                }
                
                // 10. Одиночные буквы или бессмыслица - НАРУШЕНИЕ
                const isSingleLetter = /^[a-zа-яё]$/i.test(reason);
                const isNonsense = /^(lr|Lr|LR|нет|none|null|бред)$/i.test(reason);
                
                if (isSingleLetter || isNonsense) {
                    violations.push({ officer, officerId, faction, reason: originalReason, line: line.substring(0, 150) });
                    return;
                }
                
                // 11. Суммы с указанием валюты (2000$, 10000$) - НАРУШЕНИЕ
                const isMoneyWithSymbol = /^\d{4,5}\$?$/.test(reason);
                
                if (isMoneyWithSymbol) {
                    violations.push({ officer, officerId, faction, reason: originalReason, line: line.substring(0, 150) });
                    return;
                }
                
                // 12. Если ни одно из разрешённых условий не подошло - НАРУШЕНИЕ
                const isValid = isDK || isAK || 
                               isDKTranslit || isAKTranslit ||
                               hasDKNumber || hasAKNumber ||
                               hasArticleWithDK || hasArticleWithAK ||
                               hasArticleOnly ||
                               isStandardNumber;
                
                if (!isValid) {
                    violations.push({ officer, officerId, faction, reason: originalReason, line: line.substring(0, 150) });
                }
            }
        });

        const embed = new EmbedBuilder()
            .setTitle("Анализ штрафов")
            .setTimestamp();

        if (violations.length === 0) {
            embed.setColor(0x2ECC71)
                .setDescription("✅ Нарушений в причинах штрафов не обнаружено. Все записи содержат корректные статьи ДК/АК.");
            return inter.editReply({ embeds: [embed] });
        } else {
            embed.setColor(0xE74C3C)
                .setDescription(`Найдено нарушений: **${violations.length}**\n\n> **Нарушением считается:**\n> • Пустая или дефисная причина\n> • Бессмысленный текст (lr, нет, бред и т.д.)\n> • Сумма вместо статьи (2000, 10000)\n> • Отсутствие ДК/АК в причине`);

            const reportLines = violations.map(v => 
                `**Сотрудник:** ${v.officer}\n**Статик (ID):** \`${v.officerId}\`\n**Фракция:** ${v.faction}\n**Причина:** \`${v.reason}\``
            );
            const report = reportLines.join('\n\n---\n\n');

            if (report.length > 1900) {
                const buffer = Buffer.from(report, 'utf-8');
                const file = new AttachmentBuilder(buffer, { name: 'violations_fines.txt' });
                return inter.editReply({ embeds: [embed], files: [file] });
            }

            embed.addFields({ name: "Список нарушений:", value: report.substring(0, 1024) });
            embed.setFooter({ text: "Лог требует проверки со стороны администратора" });
            return inter.editReply({ embeds: [embed] });
        }

    } catch (e) {
        console.error(e);
        await inter.editReply("❌ Ошибка при чтении файла логов штрафов.");
    }
}