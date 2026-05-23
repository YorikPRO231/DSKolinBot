import {Client, EmbedBuilder, Guild, GuildMember} from "discord.js";
import {factionByDiscordID, FRACTION_INFO} from "../utils/constants/fractions";
import {getCrimeServerIds, getStateFractionRoles, getStateServerIds} from "../utils/config";

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
  if (member.guild.id !== FRACTION_INFO["CHP_SERVER"].discord_id && member.guild.id !== FRACTION_INFO['MP_SERVER'].discord_id) return false;
  if (member.user.bot) return false;
  if (member.roles.cache.some(r => /администратор|хелпер/i.test(r.name))) return false;

  let roleAdded = false;
  const stateServerIds = [...getStateServerIds(), ...getCrimeServerIds()];
  await new Promise(resolve => setTimeout(resolve, 2000));

  for (const sid of stateServerIds) {
    const guild = client.guilds.cache.get(sid);
    if (!guild) continue;

    const factionInfo = factionByDiscordID(sid);

    try {
      const targetMember = await guild.members.fetch(member.user.id).catch(() => null);
      
      if (targetMember?.roles.cache.has(factionInfo[1].faction_role_id)) {
        const targetRole = member.guild.roles.cache.find(
            role => role.name === factionInfo[0],
        );

        if (!targetRole) {
          console.warn(`⚠️ Роль "${factionInfo[0]}" не найдена на сервере ЧП/МП`);
        } else {
          if (!member.roles.cache.has(targetRole.id)) {
            await member.roles.add(targetRole, "Наличие роли в фракционном дискорде при заходе на сервер.");
            console.log(`✅ Выдана роль ${factionInfo[0]} для ${member.user.tag}`);
          }
          roleAdded = true;
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
  if (member.guild.id !== FRACTION_INFO["CHP_SERVER"].discord_id) return;
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
  const chpServerId = FRACTION_INFO["CHP_SERVER"].discord_id;
  const chp = client.guilds.cache.get(chpServerId);
  const mpServerId = FRACTION_INFO['MP_SERVER'].discord_id;
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
  
  const factionInfo = factionByDiscordID(leavingGuildId);
  if (!factionInfo?.[1]?.chp_role_id) return;
  
  if (member.roles.cache.has(factionInfo[1].chp_role_id)) {
    try {
      await member.roles.remove(
        factionInfo[1].chp_role_id,
        `Выход из фракционного дискорда ${factionInfo[0]}`,
      );
      console.log(`✅ Снята роль ${factionInfo[0]} у ${member.user.tag} на ЧП сервере`);
    } catch (error) {
      if (isDiscordAPIError(error) && error.code !== 10007) {
        console.error(`Ошибка при снятии роли у ${member.user.tag}:`, error);
      }
    }
  }
  
  const stateChpRoleIds = Object.values(FRACTION_INFO)
    .filter(i => i.state && i.discord_id !== leavingGuildId)
    .map(i => i.chp_role_id)
    .filter(id => id.length > 0);
  
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
  
  const factionInfo = factionByDiscordID(leavingGuildId);
  if (!factionInfo?.[1]?.mp_role_id) return;
  
  if (member.roles.cache.has(factionInfo[1].mp_role_id)) {
    try {
      await member.roles.remove(
        factionInfo[1].mp_role_id,
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

async function addMPRole(
  mp: Guild,
  member: GuildMember,
  factionName: string
) {
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

async function removeMPRole(
  mp: Guild,
  member: GuildMember,
  factionName: string,
): Promise<void> {
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
  const factionInfo = factionByDiscordID(member.guild.id);
  if (!factionInfo || factionInfo[0] === "TEST_SERVER") return;
  
  const wasFactionRoleAdded = addedRoleIds.includes(factionInfo[1].faction_role_id);
  const wasFactionRoleRemoved = removedRoleIds.includes(factionInfo[1].faction_role_id);
  
  if (!wasFactionRoleAdded && !wasFactionRoleRemoved) return;

  const chpServerId = FRACTION_INFO["CHP_SERVER"].discord_id;
  const chp = client.guilds.cache.get(chpServerId);
  const mpServerId = FRACTION_INFO['MP_SERVER'].discord_id;
  const mp = client.guilds.cache.get(mpServerId);
  
  if (!chp || !mp) return;

  if (wasFactionRoleAdded) {
    if (factionInfo[1].state) {
      await addChpRole(chp, member, factionInfo[0]);
    }
    await addMPRole(mp, member, factionInfo[0]);
  }

  if (wasFactionRoleRemoved) {
    if (factionInfo[1].state) {
      await removeChpRoleAndCheck(chp, member, factionInfo[0]);
    }
    await removeMPRole(mp, member, factionInfo[0]);
  }
}

async function addChpRole(chp: Guild, member: GuildMember, factionName: string): Promise<void> {
  try {
    const chpMember = await chp.members.fetch(member.id).catch(() => null);
    if (!chpMember) return;
    if (!chpMember.manageable) return;
    
    const chpRole = chp.roles.cache.find(role => role.name === factionName);
    if (chpRole && !chpMember.roles.cache.has(chpRole.id)) {
      await chpMember.roles.add(chpRole, `Получение роли ${factionName} в фракционном дискорде`);
    }
  } catch (error) {
    if (!(isDiscordAPIError(error) && error.code === 10007)) {
      console.error(`Ошибка при выдаче роли ЧП для ${member.id}:`, error);
    }
  }
}

async function removeChpRoleAndCheck(
  chp: Guild,
  member: GuildMember,
  factionName: string,
): Promise<void> {
  try {
    const chpMember = await chp.members.fetch(member.id).catch(() => null);
    if (!chpMember) return;
    if (!chpMember.manageable) return;
    if (chpMember.user.bot) return;
    if (chpMember.roles.cache.some(r => /администратор|хелпер/i.test(r.name))) return;

    const chpRoleToRemove = chp.roles.cache.find(role => role.name === factionName);
    if (chpRoleToRemove && chpMember.roles.cache.has(chpRoleToRemove.id)) {
      await chpMember.roles.remove(chpRoleToRemove, `Снятие роли ${factionName} во фракционном дискорде`);
    }

    const stateFractionRoles = getStateFractionRoles();
    const hasOtherFractionRoles = chpMember.roles.cache.some(role =>
      stateFractionRoles.includes(role.id),
    );

    if (!hasOtherFractionRoles) {
      await chpMember.kick("Отсутствие ролей фракции в ЧП");

      const kickEmbed = new EmbedBuilder()
        .setTitle("GTA 5 RP | ЧП Blackberry")
        .setTimestamp()
        .setColor(0xb8001c)
        .setDescription(
          "Вы были удалены из дискорда ЧП, так как не имеете роли фракции.\nПолучите ее у старшего состава для авторизации доступа.",
        );
      
      await chpMember.user.send({ embeds: [kickEmbed] }).catch(() => {});
    }
  } catch (error) {
    if (!(isDiscordAPIError(error) && error.code === 10007)) {
      console.error(`Ошибка при обработке снятия роли для ${member.id}:`, error);
    }
  }
}