import { Client, EmbedBuilder, Guild, GuildMember } from "discord.js";
import { getFactionByDiscordId, loadSettings, getStateServerIds, getCrimeServerIds, getStateFractionRoles } from "../config/settings-loader";

interface DiscordAPIError {
  code: number;
  message: string;
}

function isDiscordAPIError(error: unknown): error is DiscordAPIError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export async function syncFactionRolesOnJoin(
  client: Client,
  member: GuildMember,
): Promise<boolean> {
  const config = loadSettings();
  const chpServerId = config.servers.chp;
  const mpServerId = config.servers.mp;
  
  if (member.guild.id !== chpServerId && member.guild.id !== mpServerId) return false;
  if (member.user.bot) return false;
  if (member.roles.cache.some(r => /администратор|хелпер/i.test(r.name))) return false;

  let roleAdded = false;
  const stateServerIds = [...getStateServerIds(), ...getCrimeServerIds()];
  await new Promise(resolve => setTimeout(resolve, 2000));

  for (const sid of stateServerIds) {
    const guild = client.guilds.cache.get(sid);
    if (!guild) continue;

    const factionInfo = getFactionByDiscordId(sid);
    if (!factionInfo) continue;

    try {
      const targetMember = await guild.members.fetch(member.user.id).catch(() => null);
      
      if (targetMember?.roles.cache.has(factionInfo[1].roles.faction)) {
        const targetRole = member.guild.roles.cache.find(
          role => role.name === factionInfo[0],
        );

        if (!targetRole) {
          console.warn(`⚠️ Роль "${factionInfo[0]}" не найдена на сервере ${member.guild.name}`);
        } else {
          if (!member.roles.cache.has(targetRole.id)) {
            await member.roles.add(targetRole, "Наличие роли в фракционном дискорде при заходе на сервер.");
            console.log(`✅ Выдана роль ${factionInfo[0]} для ${member.user.tag}`);
            roleAdded = true;
          }
        }
      }
    } catch (error) {
      console.error(`Ошибка проверки на сервере ${guild.name}:`, error);
    }
  }

  return roleAdded;
}

export async function checkAndKickIfNoRoles(
  client: Client,
  member: GuildMember,
  roleAdded: boolean,
): Promise<void> {
  const config = loadSettings();
  const chpServerId = config.servers.chp;
  if (member.guild.id !== chpServerId) return;
  if (member.user.bot) return;

  const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
  if (!freshMember) return;

  const stateFractionRoles = getStateFractionRoles();
  const hasStateRole = freshMember.roles.cache.some(role =>
    stateFractionRoles.includes(role.id),
  );

  if (!hasStateRole && !roleAdded) {
    try {
      await freshMember.kick("Отсутствие ролей в фракционных гос. серверах");

      const kickEmbed = new EmbedBuilder()
        .setTitle("GTA 5 RP | ЧП Blackberry")
        .setTimestamp()
        .setColor(0xb8001c)
        .setDescription(
          "Вы были удалены из дискорда ЧП, так как не имеете роли фракции.\nПолучите ее у старшего состава для авторизации доступа.",
        );

      await member.user.send({ embeds: [kickEmbed] }).catch(() => {
        console.warn(`Не удалось отправить ЛС пользователю ${member.user.tag}`);
      });

      console.log(`❌ Кикнут ${member.user.tag} - отсутствуют роли фракций`);
    } catch (error) {
      console.error(`Ошибка при кике участника ${member.user.tag}:`, error);
    }
  }
}

export async function handleFactionLeave(
  client: Client,
  guildId: string,
  userId: string,
): Promise<void> {
  const config = loadSettings();
  const chpServerId = config.servers.chp;
  const chp = client.guilds.cache.get(chpServerId);
  const mpServerId = config.servers.mp;
  const mp = client.guilds.cache.get(mpServerId);
  
  if (!chp || !mp) return;
  
  const chpMember = await chp.members.fetch(userId).catch(() => null);
  if (chpMember && !chpMember.user.bot) {
    await handleChpMemberLeave(chp, chpMember, guildId);
  }
  
  const mpMember = await mp.members.fetch(userId).catch(() => null);
  if (mpMember && !mpMember.user.bot) {
    await handleMpMemberLeave(mp, mpMember, guildId);
  }
}

async function handleChpMemberLeave(
  chp: Guild,
  member: GuildMember,
  leavingGuildId: string,
): Promise<void> {
  if (!member.manageable) return;
  if (member.roles.cache.some(r => /администратор|хелпер/i.test(r.name))) return;
  
  const factionInfo = getFactionByDiscordId(leavingGuildId);
  if (!factionInfo?.[1]?.roles.chp) return;
  
  if (member.roles.cache.has(factionInfo[1].roles.chp)) {
    try {
      await member.roles.remove(
        factionInfo[1].roles.chp,
        `Выход из фракционного дискорда ${factionInfo[0]}`,
      );
      console.log(`✅ Снята роль ${factionInfo[0]} у ${member.user.tag} на ЧП сервере`);
    } catch (error) {
      if (isDiscordAPIError(error) && error.code !== 10007) {
        console.error(`Ошибка при снятии роли у ${member.user.tag}:`, error);
      }
    }
  }
  
  const config = loadSettings();
  const factions = config.factions;
  const stateChpRoleIds = Object.values(factions)
    .filter((i: any) => i.type === 'government' && i.discord_id !== leavingGuildId)
    .map((i: any) => i.roles.chp || '')
    .filter((id: string) => id.length > 0);
  
  const hasOtherFractionRoles = member.roles.cache.some(role =>
    stateChpRoleIds.includes(role.id),
  );
  
  if (!hasOtherFractionRoles) {
    try {
      await member.kick("Отсутствие ролей фракций после выхода из фракционного сервера");
      
      const kickEmbed = new EmbedBuilder()
        .setTitle("GTA 5 RP | ЧП Blackberry")
        .setTimestamp()
        .setColor(0xb8001c)
        .setDescription(
          "Вы были удалены из дискорда ЧП, так как больше не имеете ролей фракций.\nПолучите роль фракции у старшего состава для авторизации доступа.",
        );
      
      await member.user.send({embeds: [kickEmbed]}).catch(() => {});
      console.log(`❌ Кикнут ${member.user.tag} из ЧП - нет ролей фракций`);
    } catch (error) {
      if (isDiscordAPIError(error) && error.code !== 10007) {
        console.error(`Ошибка при кике ${member.user.tag} из ЧП:`, error);
      }
    }
  }
}

async function handleMpMemberLeave(
  mp: Guild,
  member: GuildMember,
  leavingGuildId: string,
): Promise<void> {
  if (member.roles.cache.some(r => /администратор|хелпер/i.test(r.name))) return;
  
  const factionInfo = getFactionByDiscordId(leavingGuildId);
  if (!factionInfo?.[1]?.roles.mp) return;
  
  if (member.roles.cache.has(factionInfo[1].roles.mp)) {
    try {
      await member.roles.remove(
        factionInfo[1].roles.mp,
        `Выход из фракционного дискорда ${factionInfo[0]}`,
      );
      console.log(`✅ Снята роль ${factionInfo[0]} у ${member.user.tag} на МП сервере`);
    } catch (error) {
      if (isDiscordAPIError(error) && error.code !== 10007) {
        console.error(`Ошибка при снятии роли у ${member.user.tag} на МП:`, error);
      }
    }
  }
}

async function addMPRole(mp: Guild, member: GuildMember, factionName: string) {
  try {
    const mpMember = await mp.members.fetch(member.id).catch(() => null);
    if (!mpMember) return;

    const mpRole = mp.roles.cache.find(role => role.name === factionName);
    if (mpRole && !mpMember.roles.cache.has(mpRole.id)) {
      await mpMember.roles.add(mpRole, `Получение роли ${factionName} в фракционном дискорде`);
    }
  } catch (error) {
    if (!(isDiscordAPIError(error) && error.code === 10007)) {
      console.error(`Ошибка при выдаче роли МП для ${member.id}:`, error);
    }
  }
}

async function removeMPRole(mp: Guild, member: GuildMember, factionName: string): Promise<void> {
  try {
    const mpMember = await mp.members.fetch(member.id).catch(() => null);
    if (!mpMember) return;
    if (mpMember.user.bot) return;
    if (mpMember.roles.cache.some(r => /администратор|хелпер/i.test(r.name))) return;

    const mpRoleToRemove = mp.roles.cache.find(role => role.name === factionName);
    if (mpRoleToRemove && mpMember.roles.cache.has(mpRoleToRemove.id)) {
      await mpMember.roles.remove(mpRoleToRemove, `Снятие роли ${factionName} во фракционном дискорде`);
    }
  } catch (error) {
    if (!(isDiscordAPIError(error) && error.code === 10007)) {
      console.error(`Ошибка при обработке снятия роли для ${member.id}:`, error);
    }
  }
}

export async function syncFactionRolesOnRoleChange(
  client: Client,
  member: GuildMember,
  addedRoleIds: string[],
  removedRoleIds: string[],
): Promise<void> {
  const factionInfo = getFactionByDiscordId(member.guild.id);
  if (!factionInfo || factionInfo[0] === "TEST_SERVER") return;
  
  const wasFactionRoleAdded = addedRoleIds.includes(factionInfo[1].roles.faction);
  const wasFactionRoleRemoved = removedRoleIds.includes(factionInfo[1].roles.faction);
  
  if (!wasFactionRoleAdded && !wasFactionRoleRemoved) return;

  const config = loadSettings();
  const chp = client.guilds.cache.get(config.servers.chp);
  const mp = client.guilds.cache.get(config.servers.mp);
  
  if (!chp || !mp) return;

  const chpMember = await chp.members.fetch(member.id).catch(() => null);
  const mpMember = await mp.members.fetch(member.id).catch(() => null);

  if (wasFactionRoleAdded) {
    if (factionInfo[1].type === 'government' && factionInfo[1].roles.chp && chpMember) {
      const chpRole = chp.roles.cache.find(role => role.name === factionInfo[0]);
      if (chpRole && !chpMember.roles.cache.has(chpRole.id)) {
        await chpMember.roles.add(chpRole, `Получение роли ${factionInfo[0]} в фракционном дискорде`);
        console.log(`✅ Выдана роль ЧП ${factionInfo[0]} для ${member.user.tag}`);
      }
    }
    
    if (factionInfo[1].roles.mp && mpMember) {
      const mpRole = mp.roles.cache.find(role => role.name === factionInfo[0]);
      if (mpRole && !mpMember.roles.cache.has(mpRole.id)) {
        await mpMember.roles.add(mpRole, `Получение роли ${factionInfo[0]} в фракционном дискорде`);
        console.log(`✅ Выдана роль МП ${factionInfo[0]} для ${member.user.tag}`);
      }
    }
  }

  if (wasFactionRoleRemoved) {
    if (factionInfo[1].type === 'government' && factionInfo[1].roles.chp && chpMember) {
      const chpRole = chp.roles.cache.find(role => role.name === factionInfo[0]);
      if (chpRole && chpMember.roles.cache.has(chpRole.id)) {
        await chpMember.roles.remove(chpRole, `Снятие роли ${factionInfo[0]} во фракционном дискорде`);
        console.log(`✅ Снята роль ЧП ${factionInfo[0]} у ${member.user.tag}`);
        
        const stateFractionRoles = getStateFractionRoles();
        const hasOtherFractionRoles = chpMember.roles.cache.some(role =>
          stateFractionRoles.includes(role.id),
        );

        if (!hasOtherFractionRoles && !chpMember.roles.cache.some(r => /администратор|хелпер/i.test(r.name))) {
          await chpMember.kick("Отсутствие ролей фракции в ЧП");
          console.log(`❌ Кикнут ${member.user.tag} из ЧП - нет ролей фракций`);
        }
      }
    }
    
    if (factionInfo[1].roles.mp && mpMember) {
      const mpRole = mp.roles.cache.find(role => role.name === factionInfo[0]);
      if (mpRole && mpMember.roles.cache.has(mpRole.id)) {
        await mpMember.roles.remove(mpRole, `Снятие роли ${factionInfo[0]} во фракционном дискорде`);
        console.log(`✅ Снята роль МП ${factionInfo[0]} у ${member.user.tag}`);
      }
    }
  }
}