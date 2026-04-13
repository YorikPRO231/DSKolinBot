import { Client, GatewayIntentBits, REST, Routes, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getAllFiles } from './utils/fileUtils';

dotenv.config();

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, any>;
  }
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

// Функция загрузки команд из подпапок
async function loadCommands() {
    const commands: any[] = [];
    const commandsPath = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsPath)) {
        console.log('⚠️ Папка commands не найдена');
        return commands;
    }
    
    // Получаем все файлы команд рекурсивно
    const commandFiles = getAllFiles(commandsPath);
    console.log(`📁 Найдено файлов команд: ${commandFiles.length}`);
    
    for (const filePath of commandFiles) {
        try {
            const command = await import(filePath);
            
            if (command.data && command.execute) {
                // Одиночная команда
                const commandName = command.data.name;
                if (client.commands.has(commandName)) {
                    console.log(`⚠️ Дубликат команды: ${commandName}`);
                    continue;
                }
                client.commands.set(commandName, command);
                commands.push(command.data.toJSON());
                console.log(`✅ Загружена команда: ${commandName} (${path.relative(commandsPath, filePath)})`);
                
            } else if (Array.isArray(command.data)) {
                // Массив команд
                for (const cmd of command.data) {
                    if (cmd.name && cmd.description && !client.commands.has(cmd.name)) {
                        client.commands.set(cmd.name, { ...command, data: cmd });
                        commands.push(cmd.toJSON());
                        console.log(`✅ Загружена команда: ${cmd.name} (${path.relative(commandsPath, filePath)})`);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Ошибка загрузки ${path.basename(filePath)}:`, error);
        }
    }
    
    return commands;
}

// Регистрация команд для гильдии
async function registerGuildCommands(commands: any[]) {
    if (!process.env.TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
        console.error('❌ Нужны TOKEN, CLIENT_ID и GUILD_ID в .env файле');
        return;
    }
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    
    try {
        console.log('🔄 Регистрация команд для гильдии...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log(`✅ Зарегистрировано ${commands.length} команд`);
        console.log('📋 Команды:', commands.map(cmd => `/${cmd.name}`).join(', '));
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
    }
}

async function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    
    if (!fs.existsSync(eventsPath)) {
        console.log('⚠️ Папка events не найдена');
        return;
    }

    const eventFiles = getAllFiles(eventsPath);
    console.log(`📁 Найдено файлов событий: ${eventFiles.length}`);

    for (const filePath of eventFiles) {
        try {
            const event = await import(filePath);
            const eventName = event.name;

            if (!eventName) {
                console.log(`⚠️ Файл ${path.basename(filePath)} не экспортирует "name"`);
                continue;
            }

            if (event.once) {
                client.once(eventName, (...args) => event.execute(...args));
            } else {
                client.on(eventName, (...args) => event.execute(...args));
            }

            console.log(`✅ Загружено событие: ${eventName}`);
        } catch (error) {
            console.error(`❌ Ошибка загрузки события ${path.basename(filePath)}:`, error);
        }
    }
}

// Запуск
async function start() {
    console.log('🚀 Запуск бота...');
    const commands = await loadCommands();
    await loadEvents();

    if (commands.length > 0 && process.env.GUILD_ID) {
        await registerGuildCommands(commands);
    }
    
    if (!process.env.TOKEN) {
        console.error('❌ Токен не найден');
        process.exit(1);
    }
    
    await client.login(process.env.TOKEN);
}

start().catch(console.error);