import { Client } from "discord.js";
import cron from "node-cron";
import { getCrimeServerIds, getStateServerIds } from "../config/settings-loader";

export function startAutoInviteClear(client: Client): void {
    cron.schedule("0 7 * * *", () => clearAllGuildInvites(client));
}

async function clearAllGuildInvites(client: Client): Promise<void> {
    try {
        const crimeIds = getCrimeServerIds();
        const stateIds = getStateServerIds();
        const allGuildIds = [...crimeIds, ...stateIds];
        
        let totalCleared = 0;
        let totalErrors = 0;
        const results: string[] = [];

        for (const guildId of allGuildIds) {
            try {
                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) {
                    results.push(`❌ Сервер ${guildId} не найден`);
                    totalErrors++;
                    continue;
                }

                const invites = await guild.invites.fetch().catch(() => null);
                if (!invites || invites.size === 0) {
                    results.push(`${guild.name} (${guildId}): нет активных приглашений`);
                    continue;
                }

                const deletePromises = invites.map(invite =>
                    invite.delete(`[Auto] Полная очистка приглашений`).catch(() => null)
                );

                await Promise.allSettled(deletePromises);
                
                results.push(`✅ ${guild.name} (${guildId}): удалено ${invites.size} приглашений`);
                totalCleared += invites.size;

            } catch (error) {
                console.error(`[AutoInviteClear] Ошибка на сервере ${guildId}:`, error);
                results.push(`❌ ${guildId}: ошибка при очистке`);
                totalErrors++;
            }
        }

        console.log(`[AutoInviteClear] Очистка завершена:
        Всего серверов: ${allGuildIds.length}
        Удалено приглашений: ${totalCleared}
        Ошибок: ${totalErrors}
        Детали:\n${results.join('\n')}`);

    } catch (error) {
        console.error('[AutoInviteClear] Общая ошибка:', error);
    }
}