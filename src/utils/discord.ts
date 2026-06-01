import { getUserDisplayName } from '../dashboard/services/discord.service'; 
import { getCrimeServerIds, getServers} from '../config/settings-loader'; 

export async function getUserNicknameWithFallback(userId: string): Promise<string> {
  const adminServerIds = getServers().admins[0].split(',').filter(id => id.trim());
  
  for (const guildId of adminServerIds) {
    try {
      const nickname = await getUserDisplayName(userId, guildId);
      if (nickname && nickname !== userId) {
        return nickname;
      }
    } catch (error) {
      console.error(`Ошибка при проверке админского сервера ${guildId}:`, error);
    }
  }
  
  const crimeServerIds = getCrimeServerIds();
  
  const promises = crimeServerIds.map(async (guildId) => {
    try {
      const nickname = await getUserDisplayName(userId, guildId);
      if (nickname && nickname !== userId) {
        return { nickname, guildId };
      }
    } catch (error) {
      console.error(`Ошибка при проверке сервера ${guildId}:`, error);
    }
    return null;
  });
  
  const results = await Promise.all(promises);
  const found = results.find(result => result !== null);
  
  if (found) {
    return found.nickname;
  }
   
  return userId;
}

export async function getUserAvatarWithFallback(userId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://discord.com/api/v10/users/${userId}`, {
      headers: {
        'Authorization': `Bot ${process.env.TOKEN}`
      }
    });
    
    if (!response.ok) {
      console.error(`Ошибка получения аватара: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.avatar) {
      const extension = data.avatar.startsWith('a_') ? 'gif' : 'png';
      return `https://cdn.discordapp.com/avatars/${userId}/${data.avatar}.${extension}?size=64`;
    }
    
    return null;
  } catch (error) {
    console.error(`Ошибка получения аватара для ${userId}:`, error);
    return null;
  }
}