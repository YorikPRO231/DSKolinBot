import { Client, Collection, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getAllFiles } from './utils/fileUtils';
import { loadSettings, getStateServerIds, getCrimeServerIds, getAllServerIds, getDiscordIdsByFactionKey } from './config/settings-loader';
import { createDashboardApp } from './dashboard/app';
import { setDiscordClient as setAuthDiscordClient } from './dashboard/middleware/auth.middleware';
import { setDiscordClient as setServiceDiscordClient } from './dashboard/services/discord.service';
import { PermissionsRepository } from './databases';
import * as logger from "./logging";
import { startLostPunishmentsChecker } from './tasks/lostPunishments';
import { punishChecker } from './utils/punishChecker';
import prisma from './databases/prisma.service'; 

dotenv.config({ path: '.env' });

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

function shouldLoadCommandForServer(commandPath: string, serverId: string, commandData?: any): boolean {
    if (!serverId) return false;

    const config = loadSettings();
    const normalizedPath = commandPath.replace(/\\/g, '/');
    
    const folderToEnvMap: Record<string, string[] | undefined> = {
        'SpecialForHennesy': config.servers.check,
        'AdminsCommands': config.servers.admins,
        'ForServer': [config.servers.chp],
        'ForStateServers': [...getStateServerIds(), ...Object.values(config.detectives).map(i => i.discord_id)],
        'DetectiveCommands': Object.values(config.detectives).map(info => info.discord_id),
        'CrimeCommands': [...getCrimeServerIds()]
    };

    if (normalizedPath.includes('/ForAllServers/')) {
        return serverId !== process.env.ADMIN_SERVER;
    }

    for (const [folderName, envValue] of Object.entries(folderToEnvMap)) {
        if (normalizedPath.includes(`/${folderName}/`)) {
            const allowedServers = envValue?.map(id => id.trim()) || [];
            return allowedServers.includes(serverId);
        }
    }

    return false;
}

async function loadCommands() {
    const commands: any[] = [];
    const commandsPath = path.join(__dirname, 'commands');
    
    if (!fs.existsSync(commandsPath)) {
        console.log('⚠️ Папка commands не найдена');
        return commands;
    }
    
    const commandFiles = getAllFiles(commandsPath);
    console.log(`📁 Найдено файлов команд: ${commandFiles.length}`);
    
    for (const filePath of commandFiles) {
        try {
            const command = await import(filePath);
            
            const commandFactions = command.factions;
            
            if (command.data && command.execute) {
                const commandName = command.data.name;
                if (client.commands.has(commandName)) {
                    console.log(`⚠️ Дубликат команды: ${commandName}`);
                    continue;
                }
                
                client.commands.set(commandName, {
                    ...command,
                    filePath: filePath,
                    factions: commandFactions
                });
                
                commands.push({
                    ...command.data.toJSON(),
                    _filePath: filePath,
                    _factions: commandFactions 
                });
                
            } else if (Array.isArray(command.data)) {
                for (const cmd of command.data) {
                    if (cmd.name && cmd.description && !client.commands.has(cmd.name)) {
                        client.commands.set(cmd.name, {
                            ...command,
                            data: cmd,
                            filePath: filePath,
                            factions: commandFactions
                        });
                        
                        commands.push({
                            ...cmd.toJSON(),
                            _filePath: filePath,
                            _factions: commandFactions
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Ошибка загрузки ${path.basename(filePath)}:`, error);
        }
    }
    
    console.log(`✅ Загружено команд: ${client.commands.size}`);
    return commands;
}

async function registerGuildCommands(commands: any[]) {
    if (!process.env.TOKEN || !process.env.CLIENT_ID) {
        console.error('❌ Нужны TOKEN и CLIENT_ID в .env файле');
        return;
    }
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    let guildIds = new Set<string>();
    const devServers = ['1467227742037741846', '1498687307593683174', '1499051164195356914', '1498691947345350880', '1499063053600424136'];

    if (process.env.ENVIRONMENT === 'dev') {
        console.warn('Загрузка девелоп серверов....');
        devServers.forEach(id => guildIds.add(id));
    } else {
        getAllServerIds().forEach(id => guildIds.add(id));
    }
    console.log(`🎯 Серверы для регистрации: ${Array.from(guildIds).join(', ')}`);
    
    for (const guildId of guildIds) {
        try {
            const guildCommands = commands
                .filter(cmd => {
                    const filePath = (cmd as any)._filePath;
                    const cmdFactions = (cmd as any)._factions;
                    
                    if (!filePath) return false;
                    
                    if (cmdFactions && Array.isArray(cmdFactions) && cmdFactions.length > 0) {
                        const allowedIds = getDiscordIdsByFactionKey(cmdFactions);
                        return allowedIds.includes(guildId);
                    }
                    
                    return shouldLoadCommandForServer(filePath, guildId);
                })
                .map(cmd => {
                    const { _filePath, _factions, ...cleanCmd } = cmd;
                    return cleanCmd;
                });
            
            if (guildCommands.length === 0) {
                continue;
            }
            
            console.log(`🔄 Регистрация ${guildCommands.length} команд для сервера ${guildId}...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                { body: guildCommands }
            );
            
            console.log(`✅ Зарегистрировано ${guildCommands.length} команд на сервере ${guildId}`);
            
        } catch (error) {
            const ser = (error + '');
            if (ser.includes('You are not authorized') || ser.includes('Missing access')) {
                console.error(`Нет доступа к ${guildId} ${ser}`);
            } else {
                console.error(`❌ Ошибка регистрации на сервере ${guildId}:`, error);
            }
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
    
    try {
        await prisma.$connect();
        console.log('✅ Подключение к PostgreSQL установлено');
    } catch (error) {
        console.error('❌ Не удалось подключиться к PostgreSQL:', error);
        process.exit(1);
    }
    
    await PermissionsRepository.initDefaultPermissions();
    
    const commands = await loadCommands();
    await loadEvents();

    const PORT = parseInt(process.env.PORT || '8080', 10);

    client.once('ready', async (readyClient) => {  
        console.log(`✅ Бот запущен как ${readyClient.user?.tag}`);

        startLostPunishmentsChecker(readyClient);
        console.log('✅ Запущен планировщик проверки потеряшек');

        if (process.env.DASHBOARD === 'true') {
            setAuthDiscordClient(readyClient);
            setServiceDiscordClient(readyClient);
            const app = createDashboardApp(readyClient);
            app.listen(PORT, '0.0.0.0', () => {
                console.log(`📊 Dashboard сервер запущен на порту ${PORT}`);

                const ALLOWED_ROLES = (process.env.ALLOWED_ROLES || "").split(",").filter(r => r.trim());
                if (ALLOWED_ROLES.length > 0) {
                    console.log(`🔒 Role protection enabled: ${ALLOWED_ROLES.join(", ")}`);
                }
            });
        } else {
            console.warn('Отключение дешборда..');
        }
        console.log('✅ Google Forms интеграция активирована');
    });

    client.on('messageCreate', async (message) => {
        await punishChecker(client, message);
    });
    console.log('✅ Загружен обработчик punishChecker');

    if (commands.length > 0 && process.env.GUILD_ID) {
        await registerGuildCommands(commands);
    } else if (commands.length === 0) {
        console.log('⚠️ Нет команд для регистрации');
    }
    
    if (!process.env.TOKEN) {
        console.error('❌ Токен не найден');
        process.exit(1);
    }
    
    await client.login(process.env.TOKEN);
}

async function shutdown(signal: string) {
    console.log(`\n🛑 Получен сигнал ${signal}. Завершение работы...`);
    try {
        await prisma.$disconnect();
        console.log('✅ Отключено от PostgreSQL');
        client.destroy();
        console.log('✅ Бот остановлен');
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка при завершении:', error);
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', async (error: Error) => {
    console.error('❌ Необработанная ошибка (unhandledRejection):', error);
    
    try {
        await logger.logError(client, error, 'Глобальный обработчик - unhandledRejection');
    } catch (logError) {
        console.error('Ошибка при логировании unhandledRejection:', logError);
    }
});

process.on('warning', async (warning: Error) => {
    console.warn('⚠️ Предупреждение:', warning);
    
    if (warning.name === 'DeprecationWarning') {
        return;
    }
    
    try {
        await logger.logError(client, warning, 'Глобальный обработчик - process warning');
    } catch (logError) {
        console.error('Ошибка при логировании warning:', logError);
    }
});

start().catch(async (error) => {
    console.error('❌ Ошибка при запуске:', error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
});