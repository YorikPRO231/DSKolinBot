import { Client, EmbedBuilder, Guild, GuildMember } from "discord.js";
import { factionByDiscordID, FRACTION_INFO } from "../utils/constants/fractions";
import { getStateFractionRoles, getStateServerIds } from "../utils/config";


export async function syncFactionRolesOnJoin(
  client: Client,
  member: GuildMember,
): Promise<boolean> {
  if (member.guild.id !== FRACTION_INFO["CHP_SERVER"].discord_id) return false;
  if (member.user.bot) return false;
  if (member.roles.cache.some(r => /администратор|хелпер/i.test(r.name))) return false;

  let roleAdded = false;
  const stateServerIds = getStateServerIds();
  await new Promise(resolve => setTimeout(resolve, 2000));

  for (const sid of stateServerIds) {
    const guild = client.guilds.cache.get(sid);
    if (!guild) continue;

    const factionInfo = factionByDiscordID(sid);
    if (!factionInfo?.[1]?.state) continue;

    try {
      const targetMember = await guild.members.fetch(member.user.id).catch(() => null);
      
      if (targetMember?.roles.cache.has(factionInfo[1].faction_role_id)) {
        const chpRole = member.guild.roles.cache.find(
          role => role.name === factionInfo[0],
        );

        if (!chpRole) {
          console.warn(`⚠️ Роль "${factionInfo[0]}" не найдена на сервере ЧП`);
          continue;
        }

        if (!member.roles.cache.has(chpRole.id)) {
          await member.roles.add(chpRole, "Наличие роли в фракционном дискорде при заходе на сервер.");
          console.log(`✅ Выдана роль ${factionInfo[0]} для ${member.user.tag}`);
        }

        roleAdded = true;
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
  if (!getStateServerIds().includes(guildId)) return;

  const chpServerId = FRACTION_INFO["CHP_SERVER"].discord_id;
  const chp = client.guilds.cache.get(chpServerId);
  if (!chp) return;

  const chpMember = await chp.members.fetch(userId).catch(() => null);
  if (!chpMember) return;
  if (chpMember.user.bot) return;
  if (chpMember.roles.cache.some(r => /администратор|хелпер/i.test(r.name))) return;

  const factionInfo = factionByDiscordID(guildId);
  if (!factionInfo?.[1]?.chp_role_id) return;

  if (chpMember.roles.cache.has(factionInfo[1].chp_role_id)) {
    await chpMember.roles.remove(
      factionInfo[1].chp_role_id,
      `Выход из фракционного дискорда ${factionInfo[0]}`,
    );
  }

  const stateChpRoleIds = Object.values(FRACTION_INFO)
    .filter(i => i.state && i.discord_id !== chpServerId)
    .map(i => i.chp_role_id)
    .filter(id => id.length > 0);

  const hasOtherFractionRoles = chpMember.roles.cache.some(role =>
    stateChpRoleIds.includes(role.id),
  );

  if (!hasOtherFractionRoles) {
    try {
      await chpMember.kick("Отсутствие ролей фракций после выхода из фракционного сервера");

      const kickEmbed = new EmbedBuilder()
        .setTitle("GTA 5 RP | ЧП Blackberry")
        .setTimestamp()
        .setColor(0xb8001c)
        .setDescription(
          "Вы были удалены из дискорда ЧП, так как больше не имеете ролей фракций.\nПолучите роль фракции у старшего состава для авторизации доступа.",
        );

      await chpMember.user.send({ embeds: [kickEmbed] }).catch(() => {});
    } catch (error) {
      console.error(`Ошибка при кике ${chpMember.user.tag} из ЧП:`, error);
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
  if (!factionInfo?.[1]?.state || factionInfo[0] === "TEST_SERVER") return;

  const chpServerId = FRACTION_INFO["CHP_SERVER"].discord_id;
  const chp = client.guilds.cache.get(chpServerId);
  if (!chp) return;

  const wasFactionRoleAdded = addedRoleIds.includes(factionInfo[1].faction_role_id);
  const wasFactionRoleRemoved = removedRoleIds.includes(factionInfo[1].faction_role_id);

  if (wasFactionRoleAdded) {
    await addChpRole(chp, member, factionInfo[0]);
  }

  if (wasFactionRoleRemoved) {
    await removeChpRoleAndCheck(chp, member, factionInfo[0]);
  }
}

async function addChpRole(chp: Guild, member: GuildMember, factionName: string): Promise<void> {
  try {
    const chpMember = await chp.members.fetch(member.id).catch(() => null);
    if (!chpMember) return;

    const chpRole = chp.roles.cache.find(role => role.name === factionName);
    if (chpRole && !chpMember.roles.cache.has(chpRole.id)) {
      await chpMember.roles.add(chpRole, `Получение роли ${factionName} в фракционном дискорде`);
    }
  } catch (error) {
    console.error(`Ошибка при выдаче роли ЧП для ${member.id}:`, error);
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
    console.error(`Ошибка при обработке снятия роли для ${member.id}:`, error);
  }
}