import { Client, GatewayIntentBits, ActivityType } from 'discord.js';

export const name = 'ready';
export const once = true;
export function execute(client: Client) {
  console.log(`🤖 Bot online as ${client.user?.tag}`);

  client.user?.setPresence({
        activities: [{ 
            name: 'за складом', 
            type: ActivityType.Watching 
        }],
        status: 'online',
    });
}