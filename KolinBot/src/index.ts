import { Client, GatewayIntentBits, REST, Routes, Collection, Partials} from 'discord.js';
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
    intents: [
        GatewayIntentBits.Guilds,          
        GatewayIntentBits.GuildMessages,    
        GatewayIntentBits.MessageContent,  
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,   
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration
    ],
    partials: [
        Partials.Channel,                  
        Partials.Message
    ]
});

client.commands = new Collection();

function shouldLoadCommandForServer(commandPath: string, serverId?: string): boolean {
    if (!serverId) return false;
    
    const normalizedPath = commandPath.replace(/\\/g, '/');
    
    const folderToEnvMap: Record<string, string | undefined> = {
        'SpecialForHennesy': process.env.ADMINS,
        'AdminsCommands': process.env.ADMIN_SERVER,
        'ForServer': process.env.STATE_FACTIONS
    };

    if (normalizedPath.includes('/ForAllServers/') && serverId != process.env.ADMIN_SERVER) {
        return true;
    }

    for (const [folderName, envValue] of Object.entries(folderToEnvMap)) {
        if (normalizedPath.includes(`/${folderName}/`)) {
            const allowedServers = envValue?.split(',').map(id => id.trim()) || [];
            const canLoad = allowedServers.includes(serverId);
            
            if (!canLoad) {
                console.log(`⏭️ Пропущена команда из ${folderName}: ${path.basename(commandPath)} (сервер не в списке)`);
            }
            return canLoad;
        }
    }

    return false;
}

async function loadCommands() {
    const commands: any[] = [];
    const commandsPath = path.join(__dirname, 'commands');
    const serverId = process.env.GUILD_ID;
    
    if (!fs.existsSync(commandsPath)) {
        console.log('⚠️ Папка commands не найдена');
        return commands;
    }
    
    const commandFiles = getAllFiles(commandsPath);
    console.log(`📁 Найдено файлов команд: ${commandFiles.length}`);
    
    console.log(`🎯 Текущий сервер: ${serverId || 'не указан'}`);
    
    const filteredCommandFiles = commandFiles.filter(filePath => {
        const shouldLoad = shouldLoadCommandForServer(filePath, serverId);
        return shouldLoad;
    });
    
    console.log(`📁 Будет загружено команд: ${filteredCommandFiles.length}`);
    
    for (const filePath of filteredCommandFiles) {
        try {
            const command = await import(filePath);
            
            if (command.data && command.execute) {
                const commandName = command.data.name;
                if (client.commands.has(commandName)) {
                    console.log(`⚠️ Дубликат команды: ${commandName}`);
                    continue;
                }
                client.commands.set(commandName, command);
                commands.push(command.data.toJSON());
                
                const relativePath = path.relative(commandsPath, filePath);
                console.log(`✅ Загружена команда: ${commandName} (${relativePath})`);
                
            } else if (Array.isArray(command.data)) {
                for (const cmd of command.data) {
                    if (cmd.name && cmd.description && !client.commands.has(cmd.name)) {
                        client.commands.set(cmd.name, { ...command, data: cmd });
                        commands.push(cmd.toJSON());
                        
                        const relativePath = path.relative(commandsPath, filePath);
                        console.log(`✅ Загружена команда: ${cmd.name} (${relativePath})`);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Ошибка загрузки ${path.basename(filePath)}:`, error);
        }
    }
    
    return commands;
}

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
        if (commands.length > 0) {
            console.log('📋 Команды:', commands.map(cmd => `/${cmd.name}`).join(', '));
        }
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

async function start() {
    console.log('🚀 Запуск бота...');
    console.log(`🎯 Целевой сервер: ${process.env.GUILD_ID || 'не указан'}`);
    console.log('📂 Правила загрузки команд:');
    console.log('   - SpecialForHennesy → только для серверов из ADMINS');
    console.log('   - ForServer → только для серверов из STATE_FACTIONS');
    
    const commands = await loadCommands();
    await loadEvents();

    if (commands.length > 0 && process.env.GUILD_ID) {
        await registerGuildCommands(commands);
    } else if (commands.length === 0) {
        console.log('⚠️ Нет команд для регистрации на этом сервере');
    }
    
    if (!process.env.TOKEN) {
        console.error('❌ Токен не найден');
        process.exit(1);
    }
    
    await client.login(process.env.TOKEN);
}

start().catch(console.error);