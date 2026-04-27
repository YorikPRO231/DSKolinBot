import { Client, ActivityType } from 'discord.js';

export const name = 'ready';
export const once = true;
export function execute(client: Client) {

  const activities = [
    { name: 'за складом', type: ActivityType.Watching },
    { name: 'переводы', type: ActivityType.Watching },
    { name: 'за администрацией', type: ActivityType.Watching },
    { name: 'в GTA5RP', type: ActivityType.Playing },
  ];

  let activityIndex = 0;

  client.user?.setPresence({
    activities: [activities[0]],
    status: 'online',
  });

  setInterval(() => {
    activityIndex = (activityIndex + 1) % activities.length;
    const activity = activities[activityIndex];
    
    client.user?.setPresence({
      activities: [activity],
      status: 'online',
    });
    
    console.log(`🔄 Status changed to: ${activity.type} ${activity.name}`);
  }, 1800000); 
}