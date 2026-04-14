import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { removeLogById } from '../../databases/sqlite'; 

export const data = new SlashCommandBuilder()
    .setName("удалить-лог-id")
    .setDescription("Удалить конкретную запись из базы по её ID")
    .addIntegerOption(option => 
        option.setName("id")
            .setDescription("Уникальный номер записи (ID)")
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply();

    const logId = inter.options.getInteger("id")!;

    try {
        const result = await removeLogById(logId);

        if (result.changes === 0) {
            return await inter.editReply({ 
                content: `❌ Запись с ID **#${logId}** не найдена. Проверьте правильность номера через список логов.` 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle("Запись удалена")
            .setColor(0xFF4500)
            .setDescription(`Лог под номером **#${logId}** был навсегда удален из базы данных.`)
            .addFields(
                { name: "ID записи", value: `${logId}`, inline: true },
                { name: "Модератор", value: `${inter.user}`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: "Управление базой данных" });

        await inter.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        await inter.editReply({ content: "❌ Произошла техническая ошибка при обращении к SQLite." });
    }
}