import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

async function clearGlobalCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    
    try {
        console.log('🗑️ Удаление ГЛОБАЛЬНЫХ команд...');
        
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
        
        console.log('✅ Все глобальные команды успешно удалены!');
        console.log('⏳ Discord может кэшировать команды до 1 часа, но обычно обновляется быстрее');
        
    } catch (error) {
        console.error('❌ Ошибка при удалении глобальных команд:', error);
    }
}

clearGlobalCommands();