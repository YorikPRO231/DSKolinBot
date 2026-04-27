import { EmbedBuilder, TextChannel, GuildMember, User, Message, VoiceState, GuildChannel, Client, PartialGuildMember, AttachmentBuilder, AuditLogEvent} from 'discord.js';

async function getLogChannel(client: Client): Promise<TextChannel | null> {
    for (const guild of client.guilds.cache.values()) {
        const logChannel = guild.channels.cache.find(
            channel => channel.name === 'logs' && channel.isTextBased()
        ) as TextChannel;
        
        if (logChannel) return logChannel;
    }
    return null;
}

// Вспомогательная функция для форматирования контента
function formatContent(content: string, fieldName: string = 'Текст'): { name: string; value: string }[] {
    const MAX_FIELD_LENGTH = 1024;
    
    if (!content || content.trim().length === 0) {
        return [{ name: fieldName, value: '```\nПусто\n```' as string }];
    }
    
    if (content.length <= MAX_FIELD_LENGTH) {
        return [{ name: fieldName, value: content as string }];
    }
    
    const fields: { name: string; value: string }[] = [];
    let remaining: string = content;  // ← Явно указываем тип
    let partNumber = 1;
    
    while (remaining.length > 0 && fields.length < 5) {
        const chunk: string = remaining.substring(0, MAX_FIELD_LENGTH);  // ← Явно указываем тип
        remaining = remaining.substring(MAX_FIELD_LENGTH);
        
        fields.push({
            name: `${fieldName} [Часть ${partNumber}/${Math.ceil(content.length / MAX_FIELD_LENGTH)}]`,
            value: chunk
        });
        
        partNumber++;
    }
    
    if (remaining.length > 0) {
        fields.push({
            name: 'Примечание',
            value: '```\nПолный текст прикреплен в виде файла\n```' as string
        });
    }
    
    return fields;
}

// Создание файла с полным текстом
function createTextAttachment(content: string, filename: string): AttachmentBuilder {
    // Добавляем метаданные в файл
    const timestamp = new Date().toISOString();
    const fullContent = `=== Discord Log ===\nTimestamp: ${timestamp}\nLength: ${content.length} chars\n\n${content}`;
    
    const buffer = Buffer.from(fullContent, 'utf-8');
    return new AttachmentBuilder(buffer, {
        name: filename,
        description: 'Полный текст сообщения'
    });
}

// Проверка на необходимость создания файла
function shouldCreateFile(content: string): boolean {
    return content.length > 3000;
}

// Безопасная отправка логов
async function sendLog(client: Client, embed: EmbedBuilder, attachment?: AttachmentBuilder): Promise<void> {
    try {
        const logChannel = await getLogChannel(client);
        
        if (!logChannel) {
            return; // Молчаливый пропуск если канала нет
        }
        
        // Проверяем права
        const permissions = logChannel.permissionsFor(client.user!);
        if (!permissions?.has('SendMessages') || !permissions?.has('EmbedLinks')) {
            console.warn(`Недостаточно прав для отправки логов в канал #${logChannel.name}`);
            return;
        }
        
        const messagePayload: any = { embeds: [embed] };
        if (attachment) {
            messagePayload.files = [attachment];
        }
        
        await logChannel.send(messagePayload);
    } catch (error) {
        console.error('Ошибка отправки лога:', error instanceof Error ? error.message : String(error));
    }
}

// Форматирование даты
function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Форматирование размера файла
function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function logMessageDelete(client: Client, message: Message) {
    if (message.system) return;
    if (!message.content && message.attachments.size === 0) return;
    if (!message.author) return;
    
    const content = message.content || '';
    const needsFile = shouldCreateFile(content);
    
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('Сообщение удалено')
        .setDescription([
            `**Автор:** ${message.author.tag}`,
            `**Канал:** <#${message.channel.id}>`,
            `**Дата создания:** ${formatDate(message.createdTimestamp)}`,
            message.reference ? `**Ответ на:** [сообщение](https://discord.com/channels/${message.guildId}/${message.channel.id}/${message.reference.messageId})` : null,
        ].filter(Boolean).join('\n'))
        .setFooter({ 
            text: `ID сообщения: ${message.id} | ID автора: ${message.author.id}` 
        })
        .setTimestamp();
    
    if (needsFile) {
        // Показываем превью и добавляем файл
        const preview = content.substring(0, 1000);
        embed.addFields({ 
            name: `Содержание (${content.length} символов)`, 
            value: preview + '\n\n*Полный текст в прикрепленном файле*',
            inline: false 
        });
        
        const attachment = createTextAttachment(
            content, 
            `deleted_message_${message.id}.txt`
        );
        
        if (message.attachments.size > 0) {
            const attachmentsList = message.attachments.map((a, i) => 
                `${i + 1}. ${a.name} (${formatSize(a.size)})`
            ).join('\n');
            
            embed.addFields({ 
                name: `Вложения (${message.attachments.size})`, 
                value: attachmentsList,
                inline: false 
            });
        }
        
        await sendLog(client, embed, attachment);
    } else {
        // Стандартное отображение
        embed.addFields({ 
            name: content ? 'Содержание' : 'Тип сообщения', 
            value: content || 'Сообщение без текста (только вложения)',
            inline: false 
        });
        
        if (message.attachments.size > 0) {
            const attachmentsList = message.attachments.map((a, i) => 
                `${i + 1}. [${a.name}](${a.url}) - ${formatSize(a.size)}`
            ).join('\n');
            
            embed.addFields({ 
                name: `Вложения (${message.attachments.size})`, 
                value: attachmentsList.substring(0, 1024),
                inline: false 
            });
        }
        
        await sendLog(client, embed);
    }
}

export async function logMessageUpdate(client: Client, oldMessage: Message, newMessage: Message) {
    if (oldMessage.content === newMessage.content) return;
    if (!oldMessage.author) return;
    
    const oldContent = oldMessage.content || 'Пусто';
    const newContent = newMessage.content || 'Пусто';
    const needsFile = shouldCreateFile(oldContent) || shouldCreateFile(newContent);
    
    const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('Сообщение отредактировано')
        .setDescription([
            `**Автор:** ${oldMessage.author.tag}`,
            `**Канал:** <#${oldMessage.channel.id}>`,
            `**ID автора:** ${oldMessage.author.id}`,
            `**Ссылка:** [Перейти к сообщению](${newMessage.url})`,
        ].join('\n'))
        .setFooter({ 
            text: `ID сообщения: ${oldMessage.id} | Отредактировано` 
        })
        .setTimestamp();
    
    if (needsFile) {
        const oldPreview = oldContent.substring(0, 500);
        const newPreview = newContent.substring(0, 500);
        
        embed.addFields(
            { 
                name: `Старая версия (${oldContent.length} символов)`, 
                value: oldPreview + (oldContent.length > 500 ? '\n\n*Полный текст в файле*' : ''),
                inline: false 
            },
            { 
                name: `Новая версия (${newContent.length} символов)`, 
                value: newPreview + (newContent.length > 500 ? '\n\n*Полный текст в файле*' : ''),
                inline: false 
            }
        );
        
        const fullContent = [
            '=== СТАРАЯ ВЕРСИЯ ===',
            `Длина: ${oldContent.length} символов`,
            '',
            oldContent,
            '',
            '=== НОВАЯ ВЕРСИЯ ===',
            `Длина: ${newContent.length} символов`,
            '',
            newContent
        ].join('\n');
        
        const attachment = createTextAttachment(fullContent, `edited_message_${oldMessage.id}.txt`);
        await sendLog(client, embed, attachment);
    } else {
        embed.addFields(
            { name: 'Старая версия', value: oldContent.substring(0, 1024) || 'Пусто', inline: false },
            { name: 'Новая версия', value: newContent.substring(0, 1024) || 'Пусто', inline: false }
        );
        
        await sendLog(client, embed);
    }
}

export async function logMemberJoin(client: Client, member: GuildMember) {
    const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
    
    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('Участник присоединился')
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setDescription([
            `**Пользователь:** ${member.user.tag}`,
            `**Упоминание:** <@${member.id}>`,
        ].join('\n'))
        .addFields(
            { 
                name: 'Информация об аккаунте', 
                value: [
                    `ID: \`${member.id}\``,
                    `Создан: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                    `Возраст аккаунта: ${accountAge} дней`,
                ].join('\n'),
                inline: true 
            },
            { 
                name: 'Информация о сервере', 
                value: [
                    `Всего участников: ${member.guild.memberCount}`,
                    `Присоединился: <t:${Math.floor(Date.now() / 1000)}:R>`,
                ].join('\n'),
                inline: true 
            }
        )
        .setFooter({ text: `ID: ${member.id}` })
        .setTimestamp();
    
    await sendLog(client, embed);
}

export async function logMemberLeave(client: Client, member: GuildMember | PartialGuildMember) {
    const rolesList = member.roles?.cache
        .filter(role => role.name !== '@everyone')
        .map(role => role.name)
        .join(', ') || 'Не удалось получить роли';
    
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('Участник покинул сервер')
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setDescription([
            `**Пользователь:** ${member.user.tag}`,
            `**Упоминание:** <@${member.id}>`,
        ].join('\n'))
        .addFields(
            { 
                name: 'Информация', 
                value: [
                    `ID: \`${member.id}\``,
                    `Присоединился: ${member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Неизвестно'}`,
                    `Покинул: <t:${Math.floor(Date.now() / 1000)}:R>`,
                ].join('\n'),
                inline: true 
            },
            { 
                name: 'Статистика сервера', 
                value: [
                    `Осталось участников: ${member.guild?.memberCount || 'Неизвестно'}`,
                ].join('\n'),
                inline: true 
            },
            {
                name: 'Роли на момент выхода',
                value: rolesList.substring(0, 1024) || 'Нет ролей',
                inline: false
            }
        )
        .setFooter({ text: `ID: ${member.id}` })
        .setTimestamp();
    
    await sendLog(client, embed);
}

export async function logVoiceStateUpdate(client: Client, oldState: VoiceState, newState: VoiceState) {
    const member = newState.member || oldState.member;
    if (!member) return;
    
    let action = '';
    let color = 0x3498DB;
    
    if (!oldState.channelId && newState.channelId) {
        action = `Подключился к голосовому каналу`;
        color = 0x2ECC71;
    } else if (oldState.channelId && !newState.channelId) {
        action = `Отключился от голосового канала`;
        color = 0xE74C3C;
    } else if (oldState.channelId !== newState.channelId) {
        action = `Переместился в другой голосовой канал`;
        color = 0xF39C12;
    } else {
        // Изменилось состояние (микрофон, наушники, стрим и т.д.)
        const changes: string[] = [];
        
        if (oldState.serverMute !== newState.serverMute) {
            changes.push(newState.serverMute ? 'Заглушен сервером' : 'Разглушен сервером');
        }
        if (oldState.serverDeaf !== newState.serverDeaf) {
            changes.push(newState.serverDeaf ? 'Наушники отключены сервером' : 'Наушники включены сервером');
        }
        if (oldState.selfMute !== newState.selfMute) {
            changes.push(newState.selfMute ? 'Выключил микрофон' : 'Включил микрофон');
        }
        if (oldState.selfDeaf !== newState.selfDeaf) {
            changes.push(newState.selfDeaf ? 'Отключил наушники' : 'Включил наушники');
        }
        if (oldState.streaming !== newState.streaming) {
            changes.push(newState.streaming ? 'Начал стрим' : 'Завершил стрим');
        }
        
        if (changes.length > 0) {
            action = `Изменил состояние: ${changes.join(', ')}`;
            color = 0x9B59B6;
        } else {
            return;
        }
    }
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('Голосовой канал')
        .setDescription(`**Пользователь:** ${member.user.tag}\n**Действие:** ${action}`)
        .addFields(
            { 
                name: 'Детали', 
                value: [
                    oldState.channelId ? `Предыдущий канал: **${oldState.channel?.name || 'Неизвестно'}**` : null,
                    newState.channelId ? `Текущий канал: **${newState.channel?.name || 'Неизвестно'}**` : null,
                    `Пользователей в канале: ${newState.channel?.members.size || 0}`,
                ].filter(Boolean).join('\n'),
                inline: false 
            }
        )
        .setFooter({ text: `ID: ${member.id} | ${formatDate(Date.now())}` })
        .setTimestamp();
    
    await sendLog(client, embed);
}

export async function logMemberUpdate(client: Client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    // Логирование изменения никнейма
    if (oldMember.nickname !== newMember.nickname) {
        const oldNick = oldMember.nickname || '[Отсутствовал]';
        const newNick = newMember.nickname || '[Убран]';
        
        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('Изменен никнейм')
            .setDescription(`**Пользователь:** ${newMember.user.tag}`)
            .addFields(
                { name: 'Предыдущий никнейм', value: oldNick, inline: true },
                { name: 'Новый никнейм', value: newNick, inline: true }
            )
            .setFooter({ text: `ID: ${newMember.id}` })
            .setTimestamp();
        
        await sendLog(client, embed);
    }
    
    // Логирование изменения ролей
    if (!('roles' in oldMember)) return;
    
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    let moderator = 'Неизвестно';
    let reason = 'Причина не указана';
    
    if (addedRoles.size > 0 || removedRoles.size > 0) {
        try {
            const auditLogs = await newMember.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberRoleUpdate,
                limit: 5
            });
            
            const auditEntry = auditLogs.entries.find(entry => {
                if (entry.target?.id !== newMember.id) return false;
                
                const changes = entry.changes;
                if (!changes) return false;
                
                const timeDiff = Date.now() - entry.createdTimestamp;
                if (timeDiff > 5000) return false;
                
                return true;
            });
            
            if (auditEntry) {
                moderator = `<@${auditEntry.executor?.id}> (${auditEntry.executor?.tag})`;
                reason = auditEntry.reason || 'Причина не указана';
            }
        } catch (error) {
            console.error('Ошибка при получении аудита:', error);
        }
    }

    if (addedRoles.size > 0) {
        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('Роли добавлены')
            .setDescription(`**Пользователь:** ${newMember.user}`)
            .addFields(
                { 
                    name: `Добавлено ролей: ${addedRoles.size}`, 
                    value: addedRoles.map(r => `<@&${r.id}> (\`${r.name}\`)`).join('\n').substring(0, 1024), 
                    inline: false 
                },
                { 
                    name: 'Кто изменил', 
                    value: moderator, 
                    inline: true 
                },
                { 
                    name: 'Причина', 
                    value: reason, 
                    inline: true 
                }
            )
            .setFooter({ text: `ID: ${newMember.id}` })
            .setTimestamp();
        await sendLog(client, embed);
    }
    
    if (removedRoles.size > 0) {
        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('Роли удалены')
            .setDescription(`**Пользователь:** ${newMember.user}`)
            .addFields(
                { 
                    name: `Удалено ролей: ${removedRoles.size}`, 
                    value: removedRoles.map(r => `<@&${r.id}> (\`${r.name}\`)`).join('\n').substring(0, 1024), 
                    inline: false 
                },
                { 
                    name: 'Кто изменил', 
                    value: moderator, 
                    inline: true 
                },
                { 
                    name: 'Причина', 
                    value: reason, 
                    inline: true 
                }
            )
            .setFooter({ text: `ID: ${newMember.id}` })
            .setTimestamp();
        await sendLog(client, embed);
    }
}

export async function logChannelCreate(client: Client, channel: GuildChannel) {
    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('Канал создан')
        .addFields(
            { name: 'Название', value: `\`${channel.name}\``, inline: true },
            { name: 'Тип', value: `\`${channel.type}\``, inline: true },
            { name: 'ID', value: `\`${channel.id}\``, inline: true }
        )
        .setFooter({ text: `Создан: ${formatDate(channel.createdTimestamp)}` })
        .setTimestamp();
    
    await sendLog(client, embed);
}

export async function logChannelDelete(client: Client, channel: GuildChannel) {
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('Канал удален')
        .addFields(
            { name: 'Название', value: `\`${channel.name}\``, inline: true },
            { name: 'Тип', value: `\`${channel.type}\``, inline: true },
            { name: 'ID', value: `\`${channel.id}\``, inline: true }
        )
        .setFooter({ text: `Удален: ${formatDate(Date.now())}` })
        .setTimestamp();
    
    await sendLog(client, embed);
}

export async function logMemberBan(client: Client, user: User, guildId: string, reason?: string | null) {
    const embed = new EmbedBuilder()
        .setColor(0xC0392B)
        .setTitle('Участник заблокирован')
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setDescription(`**Пользователь:** ${user.tag}`)
        .addFields(
            { name: 'ID пользователя', value: `\`${user.id}\``, inline: true },
            { name: 'Причина', value: reason || 'Не указана', inline: true },
            { name: 'Дата', value: formatDate(Date.now()), inline: true }
        )
        .setTimestamp();
    
    await sendLog(client, embed);
}

export async function logMemberUnban(client: Client, user: User, guildId: string) {
    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('Участник разблокирован')
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setDescription(`**Пользователь:** ${user.tag}`)
        .addFields(
            { name: 'ID пользователя', value: `\`${user.id}\``, inline: true },
            { name: 'Дата', value: formatDate(Date.now()), inline: true }
        )
        .setTimestamp();
    
    await sendLog(client, embed);
}

export async function logCommand(client: Client, user: User, commandName: string, options: any, channelId: string) {
    const optionsString = JSON.stringify(options, null, 2);
    const needsFile = shouldCreateFile(optionsString);
    
    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('Использована команда')
        .setDescription(`**Пользователь:** ${user.tag}`)
        .addFields(
            { name: 'Команда', value: `\`/${commandName}\``, inline: true },
            { name: 'Канал', value: `<#${channelId}>`, inline: true },
            { name: 'Параметры', value: needsFile ? 'См. вложение' : (optionsString.substring(0, 1024) || 'Без параметров'), inline: false }
        )
        .setFooter({ text: `ID: ${user.id}` })
        .setTimestamp();
    
    if (needsFile) {
        const attachment = createTextAttachment(optionsString, `command_${commandName}_${Date.now()}.json`);
        await sendLog(client, embed, attachment);
    } else {
        await sendLog(client, embed);
    }
}

export async function logChannelUpdate(client: Client, oldChannel: GuildChannel, newChannel: GuildChannel) {
    if (oldChannel.name !== newChannel.name) {
        const embed = new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('Канал переименован')
            .addFields(
                { name: 'Предыдущее название', value: `\`${oldChannel.name}\``, inline: true },
                { name: 'Новое название', value: `\`${newChannel.name}\``, inline: true },
                { name: 'ID канала', value: `\`${newChannel.id}\``, inline: true },
                { name: 'Тип', value: `\`${newChannel.type}\``, inline: true }
            )
            .setTimestamp();
        
        await sendLog(client, embed);
    }
    
    // Логирование изменения темы канала
    if ('topic' in oldChannel && 'topic' in newChannel && oldChannel.topic !== newChannel.topic) {
        const oldTopic = (oldChannel as any).topic || '[Отсутствовала]';
        const newTopic = (newChannel as any).topic || '[Убрана]';
        const needsFile = shouldCreateFile(oldTopic) || shouldCreateFile(newTopic);
        
        const embed = new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('Тема канала изменена')
            .setDescription(`**Канал:** \`${newChannel.name}\``)
            .setTimestamp();
        
        if (needsFile) {
            embed.addFields(
                { name: 'Предыдущая тема', value: oldTopic.substring(0, 512) + '\n\n*Полный текст в файле*', inline: false },
                { name: 'Новая тема', value: newTopic.substring(0, 512) + '\n\n*Полный текст в файле*', inline: false }
            );
            
            const fullContent = `Предыдущая тема:\n${oldTopic}\n\nНовая тема:\n${newTopic}`;
            const attachment = createTextAttachment(fullContent, `channel_topic_${newChannel.id}.txt`);
            await sendLog(client, embed, attachment);
        } else {
            embed.addFields(...[
                { name: 'Предыдущая тема', value: oldTopic, inline: false },
                { name: 'Новая тема', value: newTopic, inline: false }]as const);
            await sendLog(client, embed);
        }
    }
    
    // Логирование изменения прав канала
    if ('permissionOverwrites' in oldChannel && 'permissionOverwrites' in newChannel) {
        const oldPerms = oldChannel.permissionOverwrites.cache.size;
        const newPerms = newChannel.permissionOverwrites.cache.size;
        
        if (oldPerms !== newPerms) {
            const embed = new EmbedBuilder()
                .setColor(0xF39C12)
                .setTitle('Права канала изменены')
                .setDescription(`**Канал:** \`${newChannel.name}\``)
                .addFields(
                    { name: 'Было правил', value: `${oldPerms}`, inline: true },
                    { name: 'Стало правил', value: `${newPerms}`, inline: true },
                    { name: 'ID канала', value: `\`${newChannel.id}\``, inline: true }
                )
                .setTimestamp();
            
            await sendLog(client, embed);
        }
    }
}

export async function logError(client: Client, error: Error, context?: string) {
    const errorMessage = error.stack || error.message;
    const needsFile = shouldCreateFile(errorMessage);
    
    const embed = new EmbedBuilder()
        .setColor(0xC0392B)
        .setTitle('Критическая ошибка')
        .addFields(
            { name: 'Контекст', value: context || 'Не указан', inline: false },
            { name: 'Сообщение ошибки', value: error.message.substring(0, 1024), inline: false }
        )
        .setFooter({ text: `Произошла: ${formatDate(Date.now())}` })
        .setTimestamp();
    
    if (needsFile) {
        embed.addFields({
            name: 'Дополнительно',
            value: 'Полный стек ошибки прикреплен в виде файла',
            inline: false
        });
        
        const attachment = createTextAttachment(errorMessage, `error_${Date.now()}.txt`);
        await sendLog(client, embed, attachment);
    } else {
        if (error.stack) {
            embed.addFields({ name: 'Стек вызовов', value: error.stack.substring(0, 1024), inline: false });
        }
        
        await sendLog(client, embed);
    }
}