import { Client, ActivityType } from 'discord.js';

export const name = 'ready';
export const once = true;
export function execute(client: Client) {
  const tags = ['склад', 'переводы', 'персонал', 'GTA5RP'];
  let step = 0;

  const tick = () => {
    const isWorkingHours = [6, 7, 8, 9, 10, 18, 19, 20, 21].includes(new Date().getHours());
    
    client.user?.setPresence({
      activities: [{ name: tags[step % tags.length], type: ActivityType.Watching }],
      status: isWorkingHours ? 'dnd' : 'online',
    });
    
    step++;
  };

  tick();
  setInterval(tick, 1800000);
}