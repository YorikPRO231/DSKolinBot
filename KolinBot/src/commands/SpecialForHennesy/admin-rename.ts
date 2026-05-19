import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { AdminsRepository } from '../../databases/index';

export const data = new SlashCommandBuilder()
    .setName("настройка-администратора")
    .setDescription("Изменить фамилию или security администратора")
    .addUserOption(option => 
        option.setName("администратор")
            .setDescription("Выберите администратора")
            .setRequired(true)
    )
    .addStringOption(option => 
        option.setName("новая-фамилия")
            .setDescription("Введите новую фамилию")
            .setRequired(false)
            .setMinLength(2)
            .setMaxLength(32)
    )
    .addStringOption(option =>
        option.setName("security")
            .setDescription("Выдать или убрать security доступ (Только для владельца)")
            .setRequired(false)
            .addChoices(
                { name: "Выдать доступ", value: "yes" },
                { name: "Забрать доступ", value: "no" }
            )
    );

export async function execute(inter: ChatInputCommandInteraction) {
    const targetUser = inter.options.getUser("администратор")!;
    const newSurname = inter.options.getString("новая-фамилия");
    const securityValue = inter.options.getString("security");



    if (securityValue && inter.user.id !== process.env.OWNER_ID) {
        return await inter.reply({ 
            content: "У вас нет прав для изменения security доступа. Это доступно только владельцу бота.", 
            flags: MessageFlags.Ephemeral
        });
    }

    if (!newSurname && !securityValue) {
        return await inter.reply({ 
            content: "Укажите хотя бы один параметр для изменения: новую-фамилию или security", 
            flags: MessageFlags.Ephemeral
        });
    }

    await inter.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const embed = new EmbedBuilder()
            .setTitle("Данные обновлены")
            .setColor(0x3498DB)
            .setDescription(`Изменения для администратора ${targetUser}`)
            .setTimestamp()
            .setFooter({ text: `Изменил: ${inter.user.username}` });

        if (newSurname) {
            const oldSurname = AdminsRepository.getAdminSurname(targetUser.id);
            AdminsRepository.setAdminSurname(targetUser.id, newSurname);
            
            embed.addFields({ 
                name: "Фамилия", 
                value: `Старая: ${oldSurname || "Не установлена"}\nНовая: ${newSurname}`, 
                inline: false 
            });
        }

        if (securityValue) {
            AdminsRepository.setAdminSecurity(targetUser.id, securityValue);
            
            const securityStatus = securityValue === "yes" ? "Выдан" : "Забран";
            
            const targetMember = await inter.guild?.members.fetch(targetUser.id);
            const roleName = "Security";
            const role = inter.guild?.roles.cache.find(r => r.name === roleName);
            
            if (securityValue === "yes" && role && targetMember) {
                await targetMember.roles.add(role, "Выдан доступ к Security");
                embed.addFields({ 
                    name: "Security доступ", 
                    value: `${securityStatus}\nСтатус: Есть доступ\nРоль ${roleName} выдана`, 
                    inline: false 
                });
            } else if (securityValue === "no" && role && targetMember) {
                await targetMember.roles.remove(role, "Забран доступ к Security");
                embed.addFields({ 
                    name: "Security доступ", 
                    value: `${securityStatus}\nСтатус: Нет доступа\nРоль ${roleName} удалена`, 
                    inline: false 
                });
            } else {
                embed.addFields({ 
                    name: "Security доступ", 
                    value: `${securityStatus}\nСтатус: ${securityValue === "yes" ? "Есть доступ" : "Нет доступа"}`, 
                    inline: false 
                });
            }
        }

        await inter.editReply({ embeds: [embed] });
    } catch (error) {
        console.error(error);
        await inter.editReply({ content: "Ошибка при обновлении базы данных." });
    }
}