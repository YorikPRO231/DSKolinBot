import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { setAdminSurname, getAdminSurname } from '../../databases/sqlite';

export const data = new SlashCommandBuilder()
    .setName("admin-rename")
    .setDescription("Изменить фамилию администратора (Только для владельца)")
    .addUserOption(option => 
        option.setName("администратор")
            .setDescription("Выберите администратора, которому нужно сменить фамилию")
            .setRequired(true)
    )
    .addStringOption(option => 
        option.setName("новая-фамилия")
            .setDescription("Введите новую фамилию")
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(32)
    );

export async function execute(inter: ChatInputCommandInteraction) {
    if (inter.user.id !== process.env.OWNER_ID) {
        return await inter.reply({ 
            content: "❌ У вас нет прав для использования этой команды. Она доступна только владельцу бота.", 
            ephemeral: true 
        });
    }

    await inter.deferReply({ ephemeral: true });

    const targetUser = inter.options.getUser("администратор")!;
    const newSurname = inter.options.getString("новая-фамилия")!;
    const oldSurname = getAdminSurname(targetUser.id);

    try {
        setAdminSurname(targetUser.id, newSurname);

        const embed = new EmbedBuilder()
            .setTitle("Данные обновлены")
            .setColor(0x3498DB)
            .setDescription(`Фамилия для администратора ${targetUser} была успешно изменена.`)
            .addFields(
                { name: "Старая фамилия", value: oldSurname || "Не установлена", inline: true },
                { name: "Новая фамилия", value: newSurname, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Изменил: ${inter.user.username}` });

        await inter.editReply({ embeds: [embed] });
    } catch (error) {
        console.error(error);
        await inter.editReply({ content: "❌ Ошибка при обновлении базы данных." });
    }
}