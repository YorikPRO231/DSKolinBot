import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  ModalBuilder,
  TextInputStyle,
  Colors,
  Client,
  MessageFlags,
  TextChannel,
} from "discord.js";
import { TRANSFER_LOG_CHANNEL_ID } from "./config";
import { FRACTION_INFO, TRANSFER_LOGS, FractionType } from "./constants/fractions";
import { TRANSFER_TABLE } from "./constants/transferData";

/**
 * Получает список фракций игрока на основе его ролей на ЧП сервере
 */
async function getFactionsFromRoles(
  member: GuildMember,
  client: Client,
): Promise<string[]> {
  const factions: string[] = [];
  const chpGuild = client.guilds.cache.get(FRACTION_INFO.CHP_SERVER.discord_id);
  
  if (!chpGuild) return factions;

  try {
    const chpMember = await chpGuild.members.fetch(member.id);
    const chpRoleIds = new Set(chpMember.roles.cache.map((role) => role.id));

    for (const [factionKey, factionInfo] of Object.entries(FRACTION_INFO)) {
      if (factionInfo.chp_role_id && chpRoleIds.has(factionInfo.chp_role_id)) {
        factions.push(factionKey);
      }
    }
  } catch (error) {
    console.warn(`Участник ${member.id} не найден на CHP сервере`);
  }

  return factions;
}

/**
 * Проверяет, является ли пользователь лидером или заместителем
 */
function isLeaderOfFaction(member: GuildMember, faction: string): boolean {
  const factionLower = faction.toLowerCase();

  let hasLeaderRole = false;
  let hasFactionRole = false;

  for (const [, role] of member.roles.cache) {
    const roleName = role.name.toLowerCase();

    if (/лидер|leader|зам|deputy|глава|head/i.test(roleName)) {
      hasLeaderRole = true;
    }

    if (roleName.includes(factionLower)) {
      hasFactionRole = true;
    }

    if (hasLeaderRole && hasFactionRole) {
      return true;
    }
  }

  return false;
}

/**
 * Проверка прав на одобрение/отклонение
 */
async function userHasFactionPermission(
  member: GuildMember,
  faction: string,
  client: Client,
): Promise<boolean> {
  const factions = await getFactionsFromRoles(member, client);

  if (factions.includes(faction.toUpperCase())) {
    return isLeaderOfFaction(member, faction);
  }

  return false;
}

/**
 * Отправка ответа с проверкой на replied/deferred
 */
async function sendResponse(
  interaction: any,
  message: string,
  ephemeral: boolean,
) {
  try {
    const options = { 
      content: message,
      ...(ephemeral && { flags: MessageFlags.Ephemeral })
    };
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(options);
    } else {
      await interaction.followUp(options);
    }   
  } catch (error) {
    console.error("Ошибка отправки ответа:", error);
  }
}

/**
 * Поиск лидеров фракций (только лидеры/главы, без заместителей)
 */
async function findLeaders(
  guild: any,
  client: Client,
  ...factions: string[]
): Promise<string> {
  const leaders: string[] = [];

  const chpGuild = client.guilds.cache.get(FRACTION_INFO.CHP_SERVER.discord_id);
  if (!chpGuild) {
    console.warn("CHP сервер не найден");
    return "Не найдено";
  }

  const chpMembers = await chpGuild.members.fetch();

  for (const faction of factions) {
    const factionLeaders = chpMembers.filter((m: GuildMember) => {
      const hasFactionRole = m.roles.cache.some((role) =>
        role.name.toUpperCase().includes(faction.toUpperCase()),
      );

      if (!hasFactionRole) return false;

      const isOnlyLeader = m.roles.cache.some((role) => {
        const roleName = role.name.toLowerCase();
        return (
          /лидер|leader|глава|head/i.test(roleName) &&
          !/зам|заместитель|deputy|assistant|помощник/i.test(roleName)
        );
      });

      return isOnlyLeader;
    });

    if (factionLeaders) {
      for (const [id] of factionLeaders) {
        if (!leaders.includes(id)) {
          leaders.push(id);
        }
      }
    }
  }

  return leaders.length > 0
    ? leaders.map((id: string) => `<@${id}>`).join(" ")
    : "Не найдено";
}

/**
 * Обработка одобрения заявки
 */
async function processApproval(
  interaction: any,
  oldEmbed: any,
  fromFrac: string,
  toFrac: string,
  userFrac: string,
  member: GuildMember,
  originalMsg?: any,
) {
  // Проверка прав на одобрение
  if (!(await userHasFactionPermission(member, userFrac, interaction.client))) {
    if (interaction.isStringSelectMenu?.()) {
      const disabledMenu = new StringSelectMenuBuilder()
        .setCustomId("disabled")
        .setPlaceholder("Выберите фракцию")
        .setDisabled(true)
        .addOptions([
          new StringSelectMenuOptionBuilder()
            .setLabel("Нет доступа")
            .setValue("none"),
        ]);

      const disabledRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);

      return interaction.update({
        content: `У вас нет прав лидера фракции ${userFrac}.`,
        components: [disabledRow],
      });
    }
    return interaction.reply({
      content: `У вас нет прав лидера фракции ${userFrac}.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const statusField = oldEmbed.fields?.find(
    (f: any) => f.name === "Согласование",
  );
  if (!statusField) return;

  const statusValue = statusField.value;
  const isFrom = userFrac === fromFrac;

  // Проверка на повторное одобрение
  const fromApproved = statusValue.includes(`${fromFrac}: одобрено`);
  const toApproved = statusValue.includes(`${toFrac}: одобрено`);

  let previousFromApprover: string | null = null;
  let previousToApprover: string | null = null;

  if (fromApproved) {
    const fromRegex = new RegExp(`${fromFrac}:\\s*одобрено\\s*\\(([^)]+)\\)`);
    const match = statusValue.match(fromRegex);
    previousFromApprover = match ? match[1] : "Неизвестно";
  }

  if (toApproved) {
    const toRegex = new RegExp(`${toFrac}:\\s*одобрено\\s*\\(([^)]+)\\)`);
    const match = statusValue.match(toRegex);
    previousToApprover = match ? match[1] : "Неизвестно";
  }

  if ((userFrac === fromFrac && fromApproved) || (userFrac === toFrac && toApproved)) {
    const alreadyApprovedFrac = userFrac === fromFrac ? fromFrac : toFrac;
    const approverName = userFrac === fromFrac ? previousFromApprover : previousToApprover;

    if (interaction.isStringSelectMenu?.()) {
      const disabledMenu = new StringSelectMenuBuilder()
        .setCustomId("disabled")
        .setPlaceholder("Выберите фракцию")
        .setDisabled(true)
        .addOptions([
          new StringSelectMenuOptionBuilder()
            .setLabel(`${alreadyApprovedFrac} уже одобрено`)
            .setValue("none"),
        ]);

      const disabledRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);

      return interaction.update({
        content: `Фракция ${alreadyApprovedFrac} уже одобрила перевод (${approverName})`,
        components: [disabledRow],
      });
    }
    return interaction.reply({
      content: `Фракция ${alreadyApprovedFrac} уже одобрила перевод (${approverName})`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // Формирование нового статуса
  const newFromApproved = userFrac === fromFrac ? true : fromApproved;
  const newToApproved = userFrac === toFrac ? true : toApproved;

  const fromApproverName = userFrac === fromFrac ? member.displayName : previousFromApprover;
  const toApproverName = userFrac === toFrac ? member.displayName : previousToApprover;

  const fromStatus = newFromApproved ? `одобрено (${fromApproverName})` : "ожидание";
  const toStatus = newToApproved ? `одобрено (${toApproverName})` : "ожидание";

  const newStatusValue = `${fromFrac}: ${fromStatus} | ${toFrac}: ${toStatus}`;
  const isFullyApproved = newFromApproved && newToApproved;

  const newEmbed = EmbedBuilder.from(oldEmbed).setFields({
    name: "Согласование",
    value: newStatusValue,
  });

  // Полное одобрение
  if (isFullyApproved) {
    newEmbed.setColor("#2ecc71").setTitle("Заявление на перевод (Одобрено)");

    const channel = interaction.client.channels.cache.get(interaction.channelId);
    const originalMessage = await channel?.messages.fetch(
      interaction.message?.reference?.messageId || interaction.message?.id,
    );

    if (originalMessage) {
      await originalMessage.edit({ embeds: [newEmbed], components: [] });
    }

    // Отправка уведомления автору заявки
    const description = oldEmbed.description || "";
    const mentionMatch = description.match(/<@(\d+)>/);

    if (mentionMatch) {
      const authorId = mentionMatch[1];

      const transferInfo = description.match(
        /\*\*Из\s+(\w+)\s+\[(\d+)\]\s*->\s*в\s+(\w+)\s+\[(\d+)\]\*\*/,
      );
      const oldFaction = transferInfo ? transferInfo[1] : fromFrac;
      const oldRank = transferInfo ? transferInfo[2] : "?";
      const newFaction = transferInfo ? transferInfo[3] : toFrac;
      const newRank = transferInfo ? transferInfo[4] : "?";

      try {
        const author = await interaction.client.users.fetch(authorId);

        // Уведомление автору
        const notifyEmbed = new EmbedBuilder()
          .setColor(Colors.Orange)
          .setTitle("Перевод одобрен")
          .setDescription(
            `Ваш перевод был полностью одобрен!\n\n` +
              `**Из:** ${oldFaction} [${oldRank}]\n` +
              `**В:** ${newFaction} [${newRank}]\n\n` +
              `**Одобрили:**\n` +
              `${fromFrac}: ${fromApproverName}\n` +
              `${toFrac}: ${toApproverName}`,
          )
          .setTimestamp()
          .setFooter({ text: "Система переводов" });

        await author.send({ embeds: [notifyEmbed] }).catch((error: unknown) => {
          console.warn(`Не удалось отправить ЛС пользователю ${author.tag}:`, error);
        });

        // Уведомление в канал фракции
        const passportMatch = description.match(
          /\*\*Сотрудник:\*\* <@([0-9]+)> \[([0-9]+)\]/,
        );
        const userId = passportMatch ? passportMatch[1] : "Ошибка распознания ID Дискорд";
        const passport = passportMatch ? passportMatch[2] : "Ошибка распознания номера паспорта";

        const factionEmbed = new EmbedBuilder()
          .setColor(Colors.Orange)
          .setTitle("Информация о переводе")
          .setDescription(
            `Получена информация о новом одобренном переводе!\n\n` +
              `**Из:** ${oldFaction} [${oldRank}]\n` +
              `**В:** ${newFaction} [${newRank}]\n\n` +
              `**Одобрили:**\n` +
              `${fromFrac}: ${fromApproverName}\n` +
              `${toFrac}: ${toApproverName}\n` +
              `Принять игрока <@${userId}> с паспортом ${passport}`,
          )
          .setTimestamp()
          .setFooter({ text: "Система переводов" });

        const factionLogData = TRANSFER_LOGS[toFrac.toUpperCase()];
        if (factionLogData && factionLogData[0] && factionLogData[1]) {
          const targetGuild = interaction.client.guilds.cache.get(factionLogData[0]);
          if (targetGuild) {
            const targetChannel = targetGuild.channels.cache.get(factionLogData[1]);
            if (targetChannel?.isTextBased()) {
              const fractionKey = toFrac.toUpperCase() as FractionType;
              const info = FRACTION_INFO[fractionKey];
              const roleToMention = info?.state_high_role_id;
              await targetChannel
                .send({ embeds: [factionEmbed], content: `<@&${roleToMention}>` })
                .catch((error: unknown) => {
                  console.error(`Ошибка отправки уведомления в канал фракции ${toFrac}:`, error);
                });
            }
          }
        }
      } catch (error) {
        console.error("Ошибка при отправке уведомления автору заявки:", error);
      }
    }

    if (interaction.isStringSelectMenu?.()) {
      await interaction.update({
        content: `Перевод полностью одобрен!\n${fromFrac}: ${fromApproverName}\n${toFrac}: ${toApproverName}`,
        components: [],
      });
    } else {
      await interaction.update({ embeds: [newEmbed], components: [] });
    }
  } else {
    // Частичное одобрение
    const channel = interaction.client.channels.cache.get(interaction.channelId);
    const originalMessage = await channel?.messages.fetch(
      interaction.message?.reference?.messageId || interaction.message?.id,
    );

    if (originalMessage) {
      await originalMessage.edit({ embeds: [newEmbed] });
    }

    if (interaction.isStringSelectMenu?.()) {
      await interaction.update({
        content: `Одобрено от фракции ${userFrac} (${member.displayName})`,
        components: [],
      });
    } else {
      await interaction.update({ embeds: [newEmbed] });
    }
  }
}

// ==================== ЭКСПОРТИРУЕМЫЕ ФУНКЦИИ ====================

export async function showFactionSelectMenu(
  interaction: ChatInputCommandInteraction,
  passport: string,
  currentRank: number,
  targetFrac: string,
  member: GuildMember,
) {
  const factions = await getFactionsFromRoles(member, interaction.client);

  if (factions.length === 0) {
    return await interaction.reply({
      content: "❌ Не удалось определить вашу фракцию по ролям ЧП. Обратитесь к администратору.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (factions.length === 1) {
    return await createTransferRequest(interaction, passport, currentRank, targetFrac, factions[0], member);
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_transfer_${passport}_${currentRank}_${targetFrac}`)
    .setPlaceholder("Выберите вашу текущую фракцию")
    .addOptions(
      factions.map(f => new StringSelectMenuOptionBuilder().setLabel(f).setValue(f))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: "У вас обнаружено несколько фракционных ролей. Выберите ту, из которой переводитесь:",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Создание заявки на перевод
 */
export async function createTransferRequest(
  interaction: any,
  passport: string,
  currentRank: number,
  targetFrac: string,
  currentFrac: string,
  member: GuildMember,
) {
  // Блокировка перевода с 6 ранга из определенных фракций
  if (["LSSD", "FIB", "LSPD"].includes(currentFrac) && currentRank === 6) {
    return await sendResponse(interaction, `Перевод с 6 ранга из ${currentFrac} запрещен.`, true);
  }

  const mapping = TRANSFER_TABLE[targetFrac]?.[currentFrac]?.find(
    (m) => currentRank >= m.min && currentRank <= m.max,
  );

  if (!mapping) {
    return await sendResponse(interaction, "Перевод для данного ранга/фракции не предусмотрен таблицей.", true);
  }

  const guild = interaction.guild || member.guild;
  const leaderMentions = await findLeaders(guild, interaction.client, currentFrac, targetFrac);

  const embed = new EmbedBuilder()
    .setTitle("Заявление на перевод")
    .setColor("#dda01b")
    .setDescription(
      `**Сотрудник:** <@${interaction.user.id}> [${passport}]\n` +
      `**Из ${currentFrac} [${currentRank}] -> в ${targetFrac} [${mapping.new}]**\n\n` +
      `──────────────────────────────────────────\n` +
      `**Руководство:** ${leaderMentions}`,
    )
    .addFields({
      name: "Согласование",
      value: `${currentFrac}: ожидание | ${targetFrac}: ожидание`,
    })
    .setFooter({ text: `ID автора: ${interaction.user.id}` });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`tr_approve_${currentFrac}_${targetFrac}`)
      .setLabel("Одобрить")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`tr_deny_${currentFrac}_${targetFrac}`)
      .setLabel("Отклонить")
      .setStyle(ButtonStyle.Danger),
  );

  const chpGuild = interaction.client.guilds.cache.get(FRACTION_INFO.CHP_SERVER.discord_id);
  const logChannel = chpGuild?.channels.cache.get(TRANSFER_LOG_CHANNEL_ID) as TextChannel;

  if (logChannel) {
    await logChannel.send({ content: leaderMentions, embeds: [embed], components: [buttons] });
    await sendResponse(interaction, `Заявление отправлено в канал <#${TRANSFER_LOG_CHANNEL_ID}>`, true);
  } else {
    await sendResponse(interaction, "Ошибка: Канал для заявок не найден.", true);
  }
}

export async function handleTransferSelect(interaction: any, member: GuildMember) {
  const parts = interaction.customId.split("_");
  const [, , passport, currentRank] = parts;
  const targetFrac = parts.slice(4).join("_");
  const selectedFrac = interaction.values[0];

  await interaction.update({ content: `Выбрана фракция: ${selectedFrac}. Создаю заявку...`, components: [] });
  await createTransferRequest(interaction, passport, parseInt(currentRank), targetFrac, selectedFrac, member);
}

export async function handleApproveButton(interaction: any, member: GuildMember) {
  const oldEmbed = interaction.message.embeds[0];
  if (!oldEmbed) return;

  const [, , fromFrac, toFrac] = interaction.customId.split("_");
  const hasFromPerm = await userHasFactionPermission(member, fromFrac, interaction.client);
  const hasToPerm = await userHasFactionPermission(member, toFrac, interaction.client);

  if (!hasFromPerm && !hasToPerm) {
    return interaction.reply({ content: `У вас нет прав лидера ${fromFrac} или ${toFrac}`, flags: MessageFlags.Ephemeral });
  }

  if (hasFromPerm && hasToPerm) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`approve_as_${interaction.customId}`)
      .setPlaceholder("От какой фракции одобряете?")
      .addOptions([
        { label: fromFrac, value: fromFrac },
        { label: toFrac, value: toFrac },
      ]);
    return interaction.reply({ 
      content: "Выберите фракцию для одобрения:", 
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)], 
      flags: MessageFlags.Ephemeral 
    });
  }

  const userFrac = hasFromPerm ? fromFrac : toFrac;
  await processApproval(interaction, oldEmbed, fromFrac, toFrac, userFrac, member);
}

export async function handleApproveSelect(interaction: any, member: GuildMember) {
  const originalCustomId = interaction.customId.replace("approve_as_", "");
  const selectedFrac = interaction.values[0];
  const [, , fromFrac, toFrac] = originalCustomId.split("_");

  // Проверка прав на выбранную фракцию
  if (!(await userHasFactionPermission(member, selectedFrac, interaction.client))) {
    const disabledMenu = new StringSelectMenuBuilder()
      .setCustomId("disabled")
      .setPlaceholder("Выберите фракцию")
      .setDisabled(true)
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel("Нет доступа")
          .setValue("none"),
      ]);

    const disabledRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);

    return interaction.update({
      content: `Ошибка: у вас нет прав лидера фракции ${selectedFrac}`,
      components: [disabledRow],
    });
  }

  const channel = interaction.client.channels.cache.get(interaction.channelId);
  const originalMessage = await channel?.messages.fetch(interaction.message.reference?.messageId || interaction.message.id);
  
  if (!originalMessage?.embeds[0]) return interaction.update({ content: "Заявка не найдена", components: [] });

  await processApproval(interaction, originalMessage.embeds[0], fromFrac, toFrac, selectedFrac, member, originalMessage);
}

export async function handleDenyButton(interaction: any, member: GuildMember) {
  const [, , fromFrac, toFrac] = interaction.customId.split("_");
  if (!(await userHasFactionPermission(member, fromFrac, interaction.client)) && 
      !(await userHasFactionPermission(member, toFrac, interaction.client))) {
    return interaction.reply({ content: "Нет прав на отклонение", flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder().setCustomId(`deny_modal_${fromFrac}_${toFrac}`).setTitle("Причина отказа");
  const reasonInput = new TextInputBuilder().setCustomId("reason_text").setLabel("Причина").setStyle(TextInputStyle.Short).setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
  await interaction.showModal(modal);
}

export async function handleDenyModal(interaction: any, member: GuildMember) {
  const reason = interaction.fields.getTextInputValue("reason_text");
  const oldEmbed = interaction.message.embeds[0];
  const authorId = oldEmbed?.footer?.text?.split(": ")[1];

  // Обновление Embed в канале
  const newEmbed = EmbedBuilder.from(oldEmbed)
    .setColor("#e74c3c")
    .setTitle("Заявление на перевод (Отклонено)")
    .addFields({ name: "Причина отказа", value: `${reason} (${member.displayName})` });

  await interaction.update({ embeds: [newEmbed], components: [] });

  // Отправка уведомления автору
  if (authorId) {
    try {
      const user = await interaction.client.users.fetch(authorId);
      const description = oldEmbed.description || "";
      const transferInfo = description.match(
        /\*\*Из\s+(\w+)\s+\[(\d+)\]\s*->\s*в\s+(\w+)\s+\[(\d+)\]\*\*/,
      );
      const oldFaction = transferInfo ? transferInfo[1] : "Неизвестно";
      const oldRank = transferInfo ? transferInfo[2] : "?";
      const newFaction = transferInfo ? transferInfo[3] : "Неизвестно";
      const newRank = transferInfo ? transferInfo[4] : "?";

      const denyEmbed = new EmbedBuilder()
        .setColor("#e74c3c")
        .setTitle("Перевод отклонен")
        .setDescription(
          `Ваш перевод был отклонен.\n\n` +
            `**Из:** ${oldFaction} [${oldRank}]\n` +
            `**В:** ${newFaction} [${newRank}]\n\n` +
            `**Отклонил:** ${member.displayName}\n` +
            `**Причина:** ${reason}`,
        )
        .setTimestamp()
        .setFooter({ text: "Система переводов" });

      await user.send({ embeds: [denyEmbed] }).catch((error: unknown) => {
        console.warn(`Не удалось отправить ЛС пользователю ${user.tag}:`, error);
      });
    } catch (e) {
      console.error("Не удалось отправить ЛС автору");
    }
  }
}