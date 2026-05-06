// src/deployFormsCommands.ts
import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import * as config from './utils/config';

dotenv.config();

const formsCommands = [
    {
        name: 'configure-bind',
        description: 'Настроить привязку Google Form к каналу',
        options: [
            {
                name: 'form_id',
                description: 'ID Google Form (из URL)',
                type: 3, // STRING
                required: true
            },
            {
                name: 'channel',
                description: 'Канал для отправки ответов',
                type: 7, // CHANNEL
                required: true
            },
            {
                name: 'form_name',
                description: 'Название формы (для удобства)',
                type: 3, // STRING
                required: false
            }
        ],
        default_member_permissions: '0' // Только админы
    },
    {
        name: 'form',
        description: 'Отправить форму для заполнения',
        options: [
            {
                name: 'form_id',
                description: 'ID формы (оставьте пустым для выбора)',
                type: 3, // STRING
                required: false
            },
            {
                name: 'title',
                description: 'Заголовок сообщения',
                type: 3, // STRING
                required: false
            },
            {
                name: 'description',
                description: 'Описание',
                type: 3, // STRING
                required: false
            }
        ]
    }
];

async function deployCommands() {
    console.log('🚀 Начинаем деплой команд Google Forms...');
    
    if (!process.env.TOKEN || !process.env.CLIENT_ID) {
        console.error('❌ Нужны TOKEN и CLIENT_ID в .env файле');
        process.exit(1);
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    
    try {
        // Получаем все серверы
        const guildIds = new Set<string>();
        config.getAllServerIds().forEach(id => guildIds.add(id));
        
        console.log(`📊 Серверы для регистрации: ${Array.from(guildIds).join(', ')}`);
        console.log(`📝 Команды: ${formsCommands.map(c => c.name).join(', ')}`);

        for (const guildId of guildIds) {
            console.log(`\n🔄 Регистрация команд на сервере ${guildId}...`);
            
            // Сначала получаем существующие команды
            const existingCommands = await rest.get(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId)
            ) as any[];
            
            console.log(`📋 Существующих команд на сервере: ${existingCommands.length}`);
            
            // Регистрируем новые команды
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                { body: formsCommands }
            );
            
            console.log(`✅ Команды зарегистрированы на сервере ${guildId}`);
        }
        
        console.log('\n✨ Деплой завершен успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка при деплое команд:', error);
        
        if (error instanceof Error) {
            console.error('Детали ошибки:', error.message);
            
            // Проверяем на частые ошибки
            if (error.message.includes('Missing Access')) {
                console.error('💡 Бот не добавлен на сервер или не имеет прав');
            } else if (error.message.includes('Invalid Form Body')) {
                console.error('💡 Проверьте структуру команд');
            }
        }
    }
}

// Запускаем деплой
deployCommands();