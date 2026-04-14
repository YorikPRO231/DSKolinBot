import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getLog } from '../../databases/sqlite';
import { PUNISHMENT_INFO, PunishmentType } from '../../utils/constants/punishments';

export const data = new SlashCommandBuilder()
    .setName("получить-лог")
    .setDescription("Получить лог-файл слива склада")
    .addStringOption(option => option.setName("статик").setDescription("Укажите статик игрока").setRequired(true));

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply();
    const pasport = inter.options.getString("статик")!;
    
    const entry = await getLog(pasport);

    if (!entry) {
        return inter.editReply({ content: `❌ Запись для статика **#${pasport}** не найдена.` });
    }

    try {
        const punishmentType = entry.punishment as PunishmentType;
        const punishmentInfo = PUNISHMENT_INFO[punishmentType] || { label: entry.punishment, emoji: "📝" };

        const embed = new EmbedBuilder()
            .setTitle("🔍 Информация о нарушении")
            .setColor(0x3498db)
            .addFields(
                { name: "Нарушитель", value: `**#${entry.pasport}**`, inline: true },
                { name: "Администратор", value: `<@${entry.adm_id}>`, inline: true },
                { name: "Наказание", value: `**${punishmentInfo.label}**`, inline: false },
                { name: "Срок", value: `**${entry.duration}**`, inline: true }
            )
            .setFooter({ text: "Сформированный отчет прикреплен ниже" })
            .setTimestamp();

        const reportFile = new AttachmentBuilder(Buffer.from(entry.log_file), { 
            name: `final_report_${pasport}.txt` 
        });

        await inter.editReply({ 
            embeds: [embed], 
            files: [reportFile] 
        });

    } catch (error) {
        console.error(error);
        await inter.editReply({ content: "❌ Ошибка при формировании файла." });
    }
}