import { 
    Events, 
    Interaction, 
    EmbedBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder 
} from 'discord.js';
import { setAdminSurname } from '../databases/sqlite';

const ADMIN_ROLES = ['1495186421345161456', 'ID_ROLE_2']; 

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
    // --- ОБРАБОТКА СЛЭШ-КОМАНД ---
    if (interaction.isChatInputCommand()) {
        const command = (interaction.client as any).commands.get(interaction.commandName);
        
        if (!command) {
            console.log(`❌ Команда ${interaction.commandName} не найдена`);
            return;
        }
        
        try {
            await command.execute(interaction);
            console.log(`✅ Выполнена команда: ${interaction.commandName}`);
        } catch (error) {
            console.error(`❌ Ошибка в команде ${interaction.commandName}:`, error);
            
            const errorMessage = error instanceof Error ? error.message : 'Произошла ошибка при выполнении команды';
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: `❌ Ошибка: ${errorMessage}`, 
                        ephemeral: true 
                    });
                } else if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({ 
                        content: `❌ Ошибка: ${errorMessage}`
                    });
                }
            } catch (replyError) {
                console.error('Не удалось отправить сообщение об ошибке:', replyError);
            }
        }
        return;
    }

    // --- ОБРАБОТКА КНОПОК ---
    if (interaction.isButton()) {
        try {
            const member = interaction.member as any;
            const hasRole = member?.roles?.cache?.some((r: any) => ADMIN_ROLES.includes(r.id));
            
            if (!hasRole && interaction.customId.startsWith('tr_')) {
                return interaction.reply({ 
                    content: "У вас нет прав для использования этой кнопки.", 
                    ephemeral: true 
                });
            }

            // Кнопки переводов
            if (interaction.customId.startsWith('tr_')) {
                const oldEmbed = interaction.message.embeds[0];
                if (!oldEmbed) return;

                if (interaction.customId === 'tr_approve') {
                    const newEmbed = EmbedBuilder.from(oldEmbed)
                        .setColor('Green')
                        .setFooter({ text: `Одобрил: ${member.displayName}`})
                        .setTimestamp();

                    await interaction.update({ embeds: [newEmbed], components: [] });
                }

                if (interaction.customId === 'tr_deny') {
                    const modal = new ModalBuilder()
                        .setCustomId('deny_modal')
                        .setTitle('Причина отказа');

                    const reasonInput = new TextInputBuilder()
                        .setCustomId('reason_text')
                        .setLabel("Почему отказано?")
                        .setPlaceholder("Опишите причину отказа")
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(100)
                        .setRequired(true);

                    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
                    modal.addComponents(row);

                    await interaction.showModal(modal);
                }
            }

            // Кнопки проверок
            if (interaction.customId === 'check_approve' || interaction.customId === 'check_deny') {
                const oldEmbed = interaction.message.embeds[0];
                if (!oldEmbed) return;

                const newEmbed = EmbedBuilder.from(oldEmbed);

                if (interaction.customId === 'check_approve') {
                    newEmbed
                        .setTitle('Запрос проверен')
                        .setColor('Green')
                        .addFields({ 
                            name: 'Результат', 
                            value: `Проверил: ${interaction.user}\nСтатус: Нарушение подтверждено` 
                        });
                } else {
                    newEmbed
                        .setTitle('Нарушений не обнаружено')
                        .setColor('Grey')
                        .addFields({ 
                            name: 'Результат', 
                            value: `Проверил: ${interaction.user}\nСтатус: Игрок чист` 
                        });
                }

                await interaction.update({ embeds: [newEmbed], components: [] });
            }
        } catch (error) {
            console.error('Ошибка при обработке кнопки:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ Произошла ошибка при обработке кнопки!', 
                        ephemeral: true 
                    });
                }
            } catch (e) {
                console.error('Не удалось отправить ошибку:', e);
            }
        }
        return;
    }

    // --- ОБРАБОТКА МОДАЛЬНЫХ ОКОН ---
    if (interaction.isModalSubmit()) {
        try {
            // Регистрация админа
            if (interaction.customId === 'admin_registration') {
                const surname = interaction.fields.getTextInputValue('surname_input');
                setAdminSurname(interaction.user.id, surname);
                await interaction.reply({ 
                    content: `✅ Вы успешно зарегистрированы под фамилией **${surname}**.\nТеперь введите команду \`/добавить-лог\` еще раз.`, 
                    ephemeral: true 
                });
            }

            // Причина отказа в переводе
            if (interaction.customId === 'deny_modal') {
                const reason = interaction.fields.getTextInputValue('reason_text');
                const member = interaction.member as any;

                if (!interaction.isFromMessage()) return;

                const oldEmbed = interaction.message?.embeds[0];

                if (oldEmbed) {
                    const newEmbed = EmbedBuilder.from(oldEmbed)
                        .setColor('Red')
                        .addFields(
                            { name: 'Статус', value: `Отклонено: **${member.displayName}**` },
                            { name: 'Причина', value: reason }
                        );

                    await interaction.update({ embeds: [newEmbed], components: [] });
                }
            }
        } catch (error) {
            console.error('Ошибка при обработке модального окна:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ Произошла ошибка при обработке данных!', 
                        ephemeral: true 
                    });
                }
            } catch (e) {
                console.error('Не удалось отправить ошибку:', e);
            }
        }
        return;
    }
}