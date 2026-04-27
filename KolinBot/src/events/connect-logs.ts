import { Client, Events } from 'discord.js';
import * as logger from '../logger'; // путь к вашему logs.ts

export const name = 'ready';
export const once = true;

export function execute(client: Client) {
    console.log('📝 Логи подключены, канал "logs" отслеживается');

    // Удаление сообщения
    client.on(Events.MessageDelete, async (message) => {
        if (message.partial) return;
        await logger.logMessageDelete(client, message);
    });

    // Редактирование сообщения
    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
        if (oldMessage.partial || newMessage.partial) return;
        await logger.logMessageUpdate(client, oldMessage as any, newMessage as any);
    });

    // Пользователь зашёл
    client.on(Events.GuildMemberAdd, async (member) => {
        await logger.logMemberJoin(client, member);
    });

    // Пользователь вышел
    client.on(Events.GuildMemberRemove, async (member) => {
        await logger.logMemberLeave(client, member);
    });

    // Голосовые каналы
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        await logger.logVoiceStateUpdate(client, oldState, newState);
    });

    // Изменение участника (ник/роли)
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        await logger.logMemberUpdate(client, oldMember, newMember);
    });

    // Создание канала
    client.on(Events.ChannelCreate, async (channel) => {
        if ('guild' in channel && channel.guild) {
            await logger.logChannelCreate(client, channel);
        }
    });

    // Удаление канала
    client.on(Events.ChannelDelete, async (channel) => {
        if ('guild' in channel && channel.guild) {
            await logger.logChannelDelete(client, channel);
        }
    });

    // Бан
    client.on(Events.GuildBanAdd, async (ban) => {
        await logger.logMemberBan(client, ban.user, ban.guild.id, ban.reason);
    });

    // Разбан
    client.on(Events.GuildBanRemove, async (ban) => {
        await logger.logMemberUnban(client, ban.user, ban.guild.id);
    });

    // Добавьте это событие
    client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
        if ('guild' in oldChannel && oldChannel.guild && 'guild' in newChannel && newChannel.guild) {
            await logger.logChannelUpdate(client, oldChannel as any, newChannel as any);
        }
    });
}