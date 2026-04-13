import { Events, Interaction } from 'discord.js';
import { setAdminSurname } from '../databases/sqlite';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        
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

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'admin_registration') {
            const surname = interaction.fields.getTextInputValue('surname_input');
            
            try {
                setAdminSurname(interaction.user.id, surname);

                await interaction.reply({ 
                    content: `✅ Вы успешно зарегистрированы под фамилией **${surname}**.\nТеперь введите команду \`/добавить-лог\` еще раз, чтобы создать запись.`, 
                    ephemeral: true 
                });
            } catch (error) {
                console.error('Ошибка сохранения админа:', error);
                await interaction.reply({ content: '❌ Не удалось сохранить данные в базу.', ephemeral: true });
            }
        }
    }
}