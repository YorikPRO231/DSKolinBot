import { Client, TextChannel, Message } from "discord.js";
import cron from "node-cron";
import { getSystemChannel } from "../config/settings-loader";
import { TIME_PATTERN, SIMPLE_PATTERN } from "../utils/punishChecker";

const URL_PATTERN = /^(https?:\/\/)[^\s$.?#].[^\s]*$/i;
const DAYS_THRESHOLD = 21;
const RECENT_HOURS_THRESHOLD = 6; 

export function startLostPunishmentsChecker(client: Client): void {
    cron.schedule("0 23 * * *", () => checkLostPunishments(client));
}

async function checkLostPunishments(client: Client): Promise<void> {
    try {
        const channel = await client.channels.fetch(getSystemChannel('punishment_admins')) as TextChannel | null;
        if (!channel) {
            console.warn(`[LostPunishments] Канал ${getSystemChannel('punishment_admins')} не найден`);
            return;
        }

        const now = Date.now();
        const twentyOneDaysAgo = now - DAYS_THRESHOLD * 24 * 60 * 60 * 1000;
        const recentThreshold = now - RECENT_HOURS_THRESHOLD * 60 * 60 * 1000; 

        const allMessages = await fetchAllMessages(channel, 1000, twentyOneDaysAgo);

        const lostMessages = allMessages.filter(msg => {
            if (msg.author.bot) return false;
            if (msg.reactions.cache.size > 0) return false;
            
            if (msg.hasThread) return false;
            
            if (msg.createdTimestamp > recentThreshold) return false;
            
            if (msg.createdTimestamp < twentyOneDaysAgo) return false;
            
            return isPunishmentMessage(msg.content);
        });

        if (lostMessages.length === 0) return;

        await channel.send(`Найдено **${lostMessages.length}** потеряшек:`);

        const chunks = chunkArray(lostMessages, 10);
        for (const chunk of chunks) {
            const links = chunk.map(m => `• ${m.url}`).join('\n');
            await channel.send(links);
        }

        console.log(`[LostPunishments] Найдено ${lostMessages.length} потеряшек`);
    } catch (error) {
        console.error('[LostPunishments] Ошибка проверки:', error);
    }
}

function isPunishmentMessage(content: string): boolean {
    const commands = content
        .replaceAll('```', '')
        .split('\n')
        .map(cmd => cmd.trim())
        .filter(Boolean);

    return commands.some(cmd =>
        TIME_PATTERN.test(cmd) ||
        SIMPLE_PATTERN.test(cmd) ||
        URL_PATTERN.test(cmd) ||
        ['после', 'потом', 'далее'].includes(cmd.toLowerCase())
    );
}

async function fetchAllMessages(
    channel: TextChannel,
    maxAmount: number,
    olderThan: number
): Promise<Message[]> {
    const messages: Message[] = [];
    let lastId: string | undefined;

    while (messages.length < maxAmount) {
        const batch = await channel.messages.fetch({
            limit: 100,
            before: lastId
        });

        if (batch.size === 0) break;

        for (const [, msg] of batch) {
            if (msg.createdTimestamp < olderThan - 14 * 24 * 60 * 60 * 1000) {
                return messages;
            }
            messages.push(msg);
        }

        lastId = batch.last()!.id;
    }

    return messages;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
    );
}