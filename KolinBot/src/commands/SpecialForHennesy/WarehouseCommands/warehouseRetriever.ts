import {AttachmentBuilder, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import { WarehouseRepository } from '../../../databases/index';
import {PUNISHMENT_INFO, PunishmentType} from '../../../utils/constants/punishments';
import {formReportData, WarehouseData} from "../../../utils/warehouseUtils";

export const data = new SlashCommandBuilder()
    .setName("warehouse-retrieve")
    .setDescription("Получить лог-файл слива склада")
    .addStringOption(option => option.setName("статик").setDescription("Укажите статик игрока").setRequired(true));

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply();
    const passport = inter.options.getString("статик", true);

    const entry = WarehouseRepository.retrieveDrain(passport);

    if (!entry) {
        return inter.editReply({content: `❌ Запись для статика **#${passport}** не найдена.`});
    }

    try {
        const punishmentType = entry.punishment as PunishmentType;
        const punishmentInfo = PUNISHMENT_INFO[punishmentType] || {label: entry.punishment, emoji: "📝"};
        const report = JSON.parse(entry.report_data) as WarehouseData;
        const embed = new EmbedBuilder()
            .setTitle("🔍 Информация о нарушении")
            .setColor(0x3498db)
            .addFields(
                {name: "Нарушитель", value: `**#${entry.passport}**`, inline: true},
                {name: "Администратор", value: `<@${entry.adminId}>`, inline: true},
                {name: "Наказание", value: `**${punishmentInfo.label}**`, inline: false},
                {name: "Срок", value: `**${entry.duration}**`, inline: true}
            )
            .setFooter({text: "Сформированный отчет прикреплен ниже"})
            .setTimestamp();

        const reportFile = new AttachmentBuilder(Buffer.from(formReportData(report)[0], 'utf-8'), {name: `report_${report.passport}.txt`});

        await inter.editReply({
            embeds: [embed],
            files: [reportFile]
        });

    } catch (error) {
        console.error(error);
        await inter.editReply({content: "❌ Ошибка при формировании файла."});
    }
}