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

        const violations: string[] = [];

        lines.forEach(line => {
            const match = line.match(/\(([^)]+)\)\d{2}\.\d{2}\.\d{4}/);
            
            if (match) {
                const reason = match[1].trim();
                const reasonLower = reason.toLowerCase();

                // Условие исключения:
                // 1. Содержит "дк" или "ак"
                // 2. Является просто числом от 1 до 70
                
                const isDK = reasonLower.includes("дк") || reasonLower.includes("дорожного кодекса");
                const isAK = reasonLower.includes("ак") || reasonLower.includes("а.к") || reasonLower.includes("а\к");
                
                const onlyNumberMatch = reason.match(/^(\d+)$/);
                const isStandardNumber = onlyNumberMatch && 
                                       parseInt(onlyNumberMatch[1]) >= 1 && 
                                       parseInt(onlyNumberMatch[1]) <= 70;

                if (!isDK && !isAK && !isStandardNumber) {
                    violations.push(`⚠️ **Нарушение:** \`${reason}\`\nСтрока: \`${line.substring(0, 100)}...\``);
                }
            }
        });

        const embed = new EmbedBuilder()
            .setTitle("📊 Анализ штрафов")
            .setTimestamp();

        if (violations.length === 0) {
            embed.setColor(0x2ECC71).setDescription("✅ Нарушений в причинах штрафов не обнаружено. Все записи содержат ДК/АК или корректные статьи.");
            return inter.editReply({ embeds: [embed] });
        } else {
            const report = violations.join('\n\n');
            embed.setColor(0xE74C3C).setDescription(`Найдено подозрительных записей: **${violations.length}**`);

            if (report.length > 2000) {
                const buffer = Buffer.from(report, 'utf-8');
                const file = new AttachmentBuilder(buffer, { name: 'violations_fines.txt' });
                return inter.editReply({ embeds: [embed], files: [file] });
            }

            embed.addFields({ name: "Список подозрительных причин:", value: report.substring(0, 1024) });
            embed.setFooter({ text: "Лог требует проверки со стороны администратора"})
            return inter.editReply({ embeds: [embed] });
        }

    } catch (e) {
        console.error(e);
        await inter.editReply("❌ Ошибка при чтении файла логов штрафов.");
    }
}