import { Client, GatewayIntentBits, REST, Routes, Collection, Partials} from 'discord.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getAllFiles } from './utils/fileUtils';
import * as config from "./utils/config";

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
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences
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
    
    const folderToEnvMap: Record<string, string[] | undefined> = {
        'SpecialForHennesy': config.CHECK_SERVER_ID,
        'AdminsCommands': config.ADMINS_SERVER_ID,
        'ForServer': config.EMERGENCY_SERVER_ID,
        'ForStateServers': config.getStateServerIds(),
    };

    if (normalizedPath.includes('/ForAllServers/')) {
        return serverId !== process.env.ADMIN_SERVER;
    }

    for (const [folderName, envValue] of Object.entries(folderToEnvMap)) {
        if (normalizedPath.includes(`/${folderName}/`)) {
            const allowedServers = envValue?.map(id => id.trim()) || [];
            const canLoad = allowedServers.includes(serverId);
            
            if (!canLoad) {
                console.log(`⏭️ Пропущена команда из ${folderName}: ${path.basename(commandPath)} (сервер ${serverId} не в списке)`);
            } else {
                console.log(`✅ Команда из ${folderName} будет загружена на сервер ${serverId}`);
            }
            return canLoad;
        }
    }

    console.log(`⏭️ Пропущена команда: ${path.basename(commandPath)} (не в специальной папке)`);
    return false;
}

async function loadCommands() {
    const commands: any[] = [];
    const commandsPath = path.join(__dirname, 'commands');
    const serverId = process.env.GUILD_ID;
    
    if (!fs.existsSync(commandsPath)) {
        console.log('⚠️ Папка commands йдена');
        return commands;
    }
    
    const commandFiles = getAllFiles(commandsPath);
    console.log(`📁 Найдено файлов команд: ${commandFiles.length}`);
    console.log(`🎯 Текущий сервер: ${serverId || 'не указан'}`);
    
    for (const filePath of commandFiles) {
        try {
            const command = await import(filePath);
            
            if (command.data && command.execute) {
                const commandName = command.data.name;
                if (client.commands.has(commandName)) {
                    console.log(`⚠️ Дубликат команды: ${commandName}`);
                    continue;
                }
                
                client.commands.set(commandName, {
                    ...command,
                    filePath: filePath  
                });
                
                commands.push({
                    ...command.data.toJSON(),
                    _filePath: filePath  
                });
                
                const relativePath = path.relative(commandsPath, filePath);
                console.log(`✅ Загружена команда: ${commandName} (${relativePath})`);
                
            } else if (Array.isArray(command.data)) {
                for (const cmd of command.data) {
                    if (cmd.name && cmd.description && !client.commands.has(cmd.name)) {
                        client.commands.set(cmd.name, {
                            ...command,
                            data: cmd,
                            filePath: filePath  
                        });
                        
                        commands.push({
                            ...cmd.toJSON(),
                            _filePath: filePath
                        });
                        
                        const relativePath = path.relative(commandsPath, filePath);
                        console.log(`✅ Загружена команда: ${cmd.name} (${relativePath})`);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Ошибка загрузки ${path.basename(filePath)}:`, error);
        }
    }
    
    console.log(`📁 Всего загружено команд: ${client.commands.size}`);
    return commands;
}

async function registerGuildCommands(commands: any[]) {
    if (!process.env.TOKEN || !process.env.CLIENT_ID) {
        console.error('❌ Нужны TOKEN и CLIENT_ID в .env файле');
        return;
    }
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    
    const guildIds = new Set<string>();
    config.getAllServerIds().forEach(id => guildIds.add(id));
    
    console.log(`🎯 Серверы для регистрации: ${Array.from(guildIds).join(', ')}`);
    
    for (const guildId of guildIds) {
        try {
            const guildCommands = commands
                .filter(cmd => {
                    const filePath = (cmd as any)._filePath;
                    if (!filePath) {
                        console.log(`⚠️ Команда ${cmd.name} не имеет пути к файлу`);
                        return false;
                    }
                    return shouldLoadCommandForServer(filePath, guildId);
                })
                .map(cmd => {
                    const { _filePath, ...cleanCmd } = cmd;
                    return cleanCmd;
                });
            
            if (guildCommands.length === 0) {
                console.log(`⚠️ Нет команд для сервера ${guildId}`);
                continue;
            }
            
            console.log(`🔄 Регистрация ${guildCommands.length} команд для сервера ${guildId}...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                { body: guildCommands }
            );
            
            const cmdNames = guildCommands.map(cmd => `/${cmd.name}`).join(', ');
            console.log(`✅ Зарегистрировано ${guildCommands.length} команд на сервере ${guildId}: ${cmdNames}`);
            
        } catch (error) {
            console.error(`❌ Ошибка регистрации на сервере ${guildId}:`, error);
        }
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