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

// ID ролей, которые могут управлять заявками и проверками
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
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: '❌ Произошла ошибка при выполнении команды!', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Произошла ошибка!', ephemeral: true });
            }
        }
    }

    // --- ОБРАБОТКА КНОПОК ---
    if (interaction.isButton()) {
        const member = interaction.member as any;
        const hasRole = member.roles.cache.some((r: any) => ADMIN_ROLES.includes(r.id));
        
        if (!hasRole && interaction.customId.startsWith('tr_')) {
            return interaction.reply({ content: "У вас нет прав для использования этой кнопки.", ephemeral: true });
        }

        // 2. Логика КНОПОК ПЕРЕВОДОВ (начинаются на tr_)
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

        // 3. Логика КНОПОК ПРОВЕРОК (check_approve и check_deny)
        if (interaction.customId === 'check_approve' || interaction.customId === 'check_deny') {
            const oldEmbed = interaction.message.embeds[0];
            if (!oldEmbed) return;

            const newEmbed = EmbedBuilder.from(oldEmbed);

            if (interaction.customId === 'check_approve') {
                newEmbed
                    .setTitle('Запрос проверен')
                    .setColor('Green')
                    .addFields({ name: 'Результат', value: `Проверил: ${interaction.user}\nСтатус: Нарушение подтверждено` });
            } else {
                newEmbed
                    .setTitle('Нарушений не обнаружено')
                    .setColor('Grey')
                    .addFields({ name: 'Результат', value: `Проверил: ${interaction.user}\nСтатус: Игрок чист` });
            }

            try {
                await interaction.update({ embeds: [newEmbed], components: [] });
                
            } catch (error) {
                console.error('Ошибка при обновлении кнопки проверки:', error);
            }
        }
    }

    // --- ОБРАБОТКА МОДАЛЬНЫХ ОКОН ---
    if (interaction.isModalSubmit()) {
        // Регистрация админа
        if (interaction.customId === 'admin_registration') {
            const surname = interaction.fields.getTextInputValue('surname_input');
            try {
                setAdminSurname(interaction.user.id, surname);
                await interaction.reply({ 
                    content: `✅ Вы успешно зарегистрированы под фамилией **${surname}**.\nТеперь введите команду \`/добавить-лог\` еще раз.`, 
                    ephemeral: true 
                });
            } catch (error) {
                console.error('Ошибка сохранения админа:', error);
                await interaction.reply({ content: '❌ Не удалось сохранить данные в базу.', ephemeral: true });
            }
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
    }
}