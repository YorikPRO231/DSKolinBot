import { Router } from 'express';
import { ensureAuthenticatedAndAuthorized } from '../../middleware/auth.middleware';
import { fetchChannel, fetchRole, fetchGuild, getChannelName } from '../../services/discord.service';
import { getUserNicknameWithFallback, getUserAvatarWithFallback  } from '../../../utils/discord';


const router = Router();

router.get('/user/nickname/:userId', ensureAuthenticatedAndAuthorized, async (req, res) => {
  const userId = req.params.userId as string;
  
  try {
    const nickname = await getUserNicknameWithFallback(userId);
    res.json({ success: true, nickname });
  } catch (error) {
    console.error(`Ошибка получения никнейма для ${userId}:`, error);
    res.json({ success: true, nickname: userId });
  }
});

router.get('/channel/:channelId/name', ensureAuthenticatedAndAuthorized, async (req, res) => {
  const channelId = req.params.channelId as string;
  const name = await getChannelName(channelId);
  res.json({ success: true, name });
});

router.get('/channel/:channelId/info', ensureAuthenticatedAndAuthorized, async (req, res) => {
  const channelId = req.params.channelId as string;
  const channel = await fetchChannel(channelId);
  
  if (!channel) {
    return res.json({ success: false, error: 'Channel not found' });
  }

  const channelData: any = channel;
  
  let guildId = null;
  let guildName = null;
  let channelName = channelId;
  
  try {
    if (channelData.name) {
      channelName = channelData.name;
    } else if (channelData.recipient && channelData.recipient.username) {
      channelName = `DM: ${channelData.recipient.username}`;
    }
    
    if (channelData.guild) {
      guildId = channelData.guild.id;
      guildName = channelData.guild.name;
    }
  } catch (error) {
    console.error('Error parsing channel info:', error);
  }

  res.json({ 
    success: true, 
    channel: { 
      id: channel.id, 
      name: channelName, 
      type: channel.type 
    },
    guild: { id: guildId, name: guildName }
  });
});


router.get('/role/:guildId/:roleId/name', ensureAuthenticatedAndAuthorized, async (req, res) => {
  const guildId = req.params.guildId as string;
  const roleId = req.params.roleId as string;
  const role = await fetchRole(guildId, roleId);
  res.json({ success: true, name: role?.name || roleId });
});

router.get('/user/avatar/:userId', ensureAuthenticatedAndAuthorized, async (req, res) => {
  const userId = req.params.userId as string;
  
  try {
    const avatarUrl = await getUserAvatarWithFallback(userId);
    res.json({ success: true, avatarUrl });
  } catch (error) {
    console.error(`Ошибка получения аватара для ${userId}:`, error);
    res.json({ success: false, avatarUrl: null });
  }
});

router.get('/guild/:guildId/name', ensureAuthenticatedAndAuthorized, async (req, res) => {
  const guildId = req.params.guildId as string;
  try {
    const guild = await fetchGuild(guildId);
    res.json({ success: true, name: guild.name });
  } catch {
    res.json({ success: true, name: guildId });
  }
});

export default router;