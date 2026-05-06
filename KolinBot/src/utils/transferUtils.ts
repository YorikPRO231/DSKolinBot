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
} from "discord.js";
import { TRANSFER_LOG_CHANNEL_ID } from "./config";
import { TRANSFER_LOGS, FRACTION_INFO, FractionType } from "./constants/fractions";

const transferTable: Record<
    string,
    Record<string, { new: number; min: number; max: number }[]>
> = {
    FIB: {
        ARMY: [
            { new: 3, min: 6, max: 6 },
            { new: 4, min: 7, max: 9 },
            { new: 5, min: 10, max: 12 },
            { new: 7, min: 13, max: 14 }
        ],
        LSPD: [
            { new: 3, min: 5, max: 5 },
            { new: 4, min: 7, max: 8 },
            { new: 5, min: 9, max: 11 },
            { new: 7, min: 12, max: 14 }
        ],
        LSSD: [
            { new: 3, min: 4, max: 4 },
            { new: 4, min: 5, max: 5 },
            { new: 5, min: 7, max: 7 },
            { new: 7, min: 8, max: 10 }
        ],
        SASPA: [
            { new: 3, min: 7, max: 8 },
            { new: 4, min: 9, max: 12 },
        ],
        GOV: [
            { new: 3, min: 8, max: 8 },
            { new: 4, min: 10, max: 12 },
            { new: 7, min: 16, max: 18 },
        ],
    },
    LSPD: {
        ARMY: [
            { new: 2, min: 6, max: 6 },
            { new: 3, min: 7, max: 7 },
            { new: 4, min: 8, max: 8 },
            { new: 5, min: 9, max: 10 },
            { new: 7, min: 11, max: 12 },
            { new: 8, min: 13, max: 13 },
            { new: 9, min: 14, max: 15 },
        ],
        FIB: [
            { new: 4, min: 3, max: 3 },
            { new: 7, min: 5, max: 5 },
            { new: 9, min: 7, max: 10 },
        ],
        LSSD: [
            { new: 5, min: 3, max: 4 },
            { new: 7, min: 5, max: 5 },
            { new: 8, min: 7, max: 7 },
            { new: 9, min: 8, max: 10 },
        ],
        SASPA: [
            { new: 4, min: 7, max: 8 },
            { new: 5, min: 9, max: 12 },
        ],
        GOV: [
            { new: 2, min: 8, max: 8 },
            { new: 3, min: 10, max: 12 },
            { new: 4, min: 16, max: 18 },
        ],
    },
    LSSD: {
        ARMY: [
            { new: 2, min: 6, max: 6 },
            { new: 3, min: 7, max: 7 },
            { new: 4, min: 8, max: 9 },
            { new: 5, min: 10, max: 10 },
            { new: 7, min: 14, max: 15 },
        ],
        LSPD: [
            { new: 3, min: 4, max: 5 },
            { new: 4, min: 7, max: 8 },
            { new: 5, min: 9, max: 11 },
            { new: 7, min: 12, max: 14 },
        ],
        FIB: [
            { new: 3, min: 4, max: 4 },
            { new: 4, min: 5, max: 5 },
            { new: 5, min: 7, max: 8 },
            { new: 7, min: 9, max: 10 },
        ],
        SASPA: [
            { new: 3, min: 7, max: 9 },
            { new: 4, min: 10, max: 12 },
        ],
        GOV: [
            { new: 2, min: 8, max: 8 },
            { new: 3, min: 10, max: 12 },
            { new: 4, min: 16, max: 18 },
        ],
    },
    ARMY: {
        LSSD: [
            { new: 3, min: 3, max: 3 },
            { new: 4, min: 4, max: 4 },
            { new: 6, min: 5, max: 5 },
            { new: 9, min: 7, max: 7 },
            { new: 11, min: 8, max: 9 },
            { new: 12, min: 10, max: 10 },
        ],
        LSPD: [
            { new: 3, min: 4, max: 4 },
            { new: 6, min: 7, max: 7 },
            { new: 7, min: 8, max: 8 },
            { new: 8, min: 9, max: 9 },
            { new: 9, min: 10, max: 10 },
            { new: 10, min: 11, max: 11 },
            { new: 11, min: 12, max: 13 },
            { new: 12, min: 14, max: 14 },
        ],
        FIB: [
            { new: 5, min: 4, max: 4 },
            { new: 6, min: 5, max: 5 },
            { new: 9, min: 7, max: 7 },
            { new: 11, min: 8, max: 8 },
            { new: 12, min: 9, max: 10 },
        ],
        SASPA: [
            { new: 3, min: 7, max: 9 },
            { new: 4, min: 10, max: 12 },
        ],
        GOV: [
            { new: 2, min: 8, max: 8 },
            { new: 3, min: 12, max: 18 },
        ],
    },
    SASPA: {
        LSSD: [
            { new: 4, min: 3, max: 3 },
            { new: 5, min: 4, max: 4 },
            { new: 6, min: 5, max: 5 },
            { new: 7, min: 7, max: 7 },
            { new: 9, min: 8, max: 10 },
        ],
        LSPD: [
            { new: 3, min: 3, max: 43 },
            { new: 4, min: 4, max: 4 },
            { new: 5, min: 5, max: 5 },
            { new: 6, min: 7, max: 7 },
            { new: 7, min: 8, max: 9 },
            { new: 8, min: 10, max: 11 },
            { new: 9, min: 12, max: 14 },
        ],
        FIB: [
            { new: 5, min: 3, max: 3 },
            { new: 6, min: 4, max: 4 },
            { new: 7, min: 5, max: 5 },
            { new: 8, min: 7, max: 7 },
            { new: 9, min: 8, max: 10 },
        ],
        ARMY: [
            { new: 3, min: 5, max: 6 },
            { new: 4, min: 7, max: 7 },
            { new: 5, min: 8, max: 8 },
            { new: 6, min: 9, max: 9 },
            { new: 7, min: 10, max: 10 },
            { new: 8, min: 11, max: 12 },
            { new: 9, min: 13, max: 15 },
        ],
        GOV: [
            { new: 4, min: 8, max: 8 },
            { new: 5, min: 12, max: 12 },
            { new: 6, min: 16, max: 16 },
            { new: 7, min: 18, max: 18 },
        ],
    },
    GOV: {
        ARMY: [
            { new: 8, min: 6, max: 8 },
            { new: 10, min: 9, max: 11 },
            { new: 12, min: 12, max: 15 },
        ],
        LSPD: [
            { new: 8, min: 4, max: 5 },
            { new: 10, min: 7, max: 9 },
            { new: 12, min: 10, max: 13 },
        ],
        FIB: [
            { new: 8, min: 3, max: 4 },
            { new: 10, min: 5, max: 5 },
            { new: 12, min: 7, max: 10 },
        ],
        SASPA: [
            { new: 8, min: 4, max: 6 },
            { new: 10, min: 7, max: 9 },
            { new: 12, min: 10, max: 12 },
        ],
        LSSD: [
            { new: 8, min: 4, max: 4 },
            { new: 10, min: 5, max: 5 },
            { new: 12, min: 7, max: 10 },
        ],
    },
};

async function getFactionsFromRoles(
  member: GuildMember,
  client: Client,
): Promise<string[]> {
  const factions: string[] = [];

  const chpGuild = client.guilds.cache.get(FRACTION_INFO.CHP_SERVER.discord_id);
  if (!chpGuild) {
    console.warn("ЧП сервер не найден");
    return factions;
  }

  let chpMember: GuildMember | null = null;
  try {
    chpMember = await chpGuild.members.fetch(member.id);
  } catch (error) {
    console.warn(`Участник ${member.id} не найден на CHP сервере`);
    return factions;
  }

  const chpRoleIds = new Set(chpMember.roles.cache.map((role) => role.id));

  for (const [factionKey, factionInfo] of Object.entries(FRACTION_INFO)) {
    if (factionInfo.chp_role_id && chpRoleIds.has(factionInfo.chp_role_id)) {
      factions.push(factionKey);
    }
  }

  return factions;
}

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

export async function createTransferRequest(
  interaction: ChatInputCommandInteraction | any,
  passport: string,
  currentRank: number,
  targetFrac: string,
  currentFrac: string,
  member: GuildMember,
) {
  if (["LSSD", "FIB", "LSPD"].includes(currentFrac) && currentRank === 6) {
    const msg = `Перевод с 6 ранга из ${currentFrac} запрещен.`;
    return await sendResponse(interaction, msg, true);
  }

  const options = transferTable[targetFrac]?.[currentFrac];
  const mapping = options?.find(
    (m: any) => currentRank >= m.min && currentRank <= m.max,
  );

  if (!mapping) {
    const msg = "Перевод для данного ранга/фракции не предусмотрен таблицей.";
    return await sendResponse(interaction, msg, true);
  }

  const guild = interaction.guild || member.guild;
  if (!guild) {
    const msg = "Ошибка: не удалось получить сервер.";
    return await sendResponse(interaction, msg, true);
  }

  const leaderMentions = await findLeaders(
    guild,
    interaction.client,
    currentFrac,
    targetFrac,
  );

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
    });

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

  const chpGuild = interaction.client.guilds.cache.get(
    FRACTION_INFO.CHP_SERVER.discord_id,
  );
  const logChannel = chpGuild?.channels.cache.get(TRANSFER_LOG_CHANNEL_ID);

  if (logChannel?.isTextBased()) {
        await logChannel.send({ content: leaderMentions, embeds: [embed], components: [buttons] });
        await sendResponse(interaction, `Заявление отправлено в канал <#${TRANSFER_LOG_CHANNEL_ID}>`, true);
    } else {
        await sendResponse(interaction, "Ошибка: Канал для заявок не найден.", true);
    }
}

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
      content:
        "Не удалось определить вашу фракцию по ролям. Обратитесь к администратору.",
      ephemeral: true,
    });
  }

  if (factions.length === 1) {
    await createTransferRequest(
      interaction,
      passport,
      currentRank,
      targetFrac,
      factions[0],
      member,
    );
    return;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_transfer_${passport}_${currentRank}_${targetFrac}`)
    .setPlaceholder("Выберите фракцию");

  for (const faction of factions.slice(0, 25)) {
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(faction)
        .setDescription(`Перевод из ${faction}`)
        .setValue(faction),
    );
  }

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectMenu,
  );

  await interaction.reply({
    content: "У вас несколько фракций. Выберите из какой переводитесь:",
    components: [row],
    ephemeral: true,
  });
}

export async function handleTransferSelect(
  interaction: any,
  member: GuildMember,
) {
  const parts = interaction.customId.split("_");
  const passport = parts[2];
  const currentRank = parseInt(parts[3]);
  const targetFrac = parts.slice(4).join("_");

  const selectedFrac = interaction.values[0];

  const disabledMenu = new StringSelectMenuBuilder()
    .setCustomId("disabled")
    .setPlaceholder(selectedFrac)
    .setDisabled(true)
    .addOptions([
      new StringSelectMenuOptionBuilder()
        .setLabel(selectedFrac)
        .setValue(selectedFrac),
    ]);

  const disabledRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);

  await interaction.update({
    content: `Выбрана фракция: ${selectedFrac}. Создаю заявку...`,
    components: [disabledRow],
  });

  await createTransferRequest(
    interaction,
    passport,
    currentRank,
    targetFrac,
    selectedFrac,
    member,
  );
}

export async function handleApproveButton(
  interaction: any,
  member: GuildMember,
) {
  const oldEmbed = interaction.message.embeds[0];
  if (!oldEmbed) return;

  const parts = interaction.customId.split("_");
  const fromFrac = parts[2];
  const toFrac = parts[3];

  const hasFromFactionPerm = await userHasFactionPermission(
    member,
    fromFrac,
    interaction.client,
  );
  const hasToFactionPerm = await userHasFactionPermission(
    member,
    toFrac,
    interaction.client,
  );

  if (!hasFromFactionPerm && !hasToFactionPerm) {
    const userRoles = member.roles.cache
      .filter((role: any) => role.name !== "@everyone")
      .map((role: any) => role.name)
      .join(", ");

    return interaction.reply({
      content:
        `У вас нет прав на одобрение перевода.\n` +
        `Требуется роль лидера ${fromFrac} или ${toFrac}\n` +
        `Ваши роли: ${userRoles || "нет ролей"}`,
      ephemeral: true,
    });
  }

  if (hasFromFactionPerm && hasToFactionPerm) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`approve_as_${interaction.customId}`)
      .setPlaceholder("От какой фракции одобряете?")
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel(fromFrac)
          .setDescription(`Одобрить от ${fromFrac}`)
          .setValue(fromFrac),
        new StringSelectMenuOptionBuilder()
          .setLabel(toFrac)
          .setDescription(`Одобрить от ${toFrac}`)
          .setValue(toFrac),
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu,
    );

    return interaction.reply({
      content:
        "Вы лидер/зам. лидера обеих фракций.\n Выберите от какой одобряете:",
      components: [row],
      ephemeral: true,
    });
  }

  const userFrac = hasFromFactionPerm ? fromFrac : toFrac;
  await processApproval(
    interaction,
    oldEmbed,
    fromFrac,
    toFrac,
    userFrac,
    member,
  );
}

export async function handleApproveSelect(
  interaction: any,
  member: GuildMember,
) {
  const originalCustomId = interaction.customId.replace("approve_as_", "");
  const selectedFrac = interaction.values[0];

  if (
    !(await userHasFactionPermission(member, selectedFrac, interaction.client))
  ) {
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
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        disabledMenu,
      );

    return interaction.update({
      content: `Ошибка: у вас нет прав лидера фракции ${selectedFrac}`,
      components: [disabledRow],
    });
  }

  const channel = interaction.client.channels.cache.get(interaction.channelId);
  const originalMessage = await channel?.messages.fetch(
    interaction.message.reference?.messageId || interaction.message.id,
  );
  const embed = originalMessage?.embeds[0] || interaction.message.embeds[0];

  if (!embed) {
    const disabledMenu = new StringSelectMenuBuilder()
      .setCustomId("disabled")
      .setPlaceholder("Выберите фракцию")
      .setDisabled(true)
      .addOptions([
        new StringSelectMenuOptionBuilder().setLabel("Ошибка").setValue("none"),
      ]);

    const disabledRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        disabledMenu,
      );

    return interaction.update({
      content: "Ошибка: не удалось найти заявку",
      components: [disabledRow],
    });
  }

  const parts = originalCustomId.split("_");
  const fromFrac = parts[2];
  const toFrac = parts[3];

  await processApproval(
    interaction,
    embed,
    fromFrac,
    toFrac,
    selectedFrac,
    member,
  );
}

export async function handleDenyButton(interaction: any, member: GuildMember) {
  const oldEmbed = interaction.message.embeds[0];
  if (!oldEmbed) return;

  const parts = interaction.customId.split("_");
  const fromFrac = parts[2];
  const toFrac = parts[3];

  const hasFromFactionPerm = await userHasFactionPermission(
    member,
    fromFrac,
    interaction.client,
  );
  const hasToFactionPerm = await userHasFactionPermission(
    member,
    toFrac,
    interaction.client,
  );

  if (!hasFromFactionPerm && !hasToFactionPerm) {
    return interaction.reply({
      content: `У вас нет прав на отклонение перевода. Требуется роль лидера ${fromFrac} или ${toFrac}`,
      ephemeral: true,
    });
  }

  const statusField = oldEmbed.fields?.find(
    (f: any) => f.name === "Согласование",
  );
  if (statusField) {
    const parts = statusField.value.split(" | ");
    if (
      parts.length === 2 &&
      parts[0].includes("одобрено") &&
      parts[1].includes("одобрено")
    ) {
      return interaction.reply({
        content: "Перевод уже полностью одобрен",
        ephemeral: true,
      });
    }
  }

  const modal = new ModalBuilder()
    .setCustomId(`deny_modal_${interaction.customId.replace("tr_deny_", "")}`)
    .setTitle("Причина отказа");

  const reasonInput = new TextInputBuilder()
    .setCustomId("reason_text")
    .setLabel("Причина отказа")
    .setPlaceholder("Опишите причину отказа")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(
    reasonInput,
  );
  modal.addComponents(row);

  await interaction.showModal(modal);
}

export async function handleDenyModal(interaction: any, member: GuildMember) {
  const reason = interaction.fields.getTextInputValue("reason_text");

  const channel = interaction.client.channels.cache.get(interaction.channelId);
  const originalMessage = await channel?.messages.fetch(
    interaction.message?.reference?.messageId || interaction.message?.id,
  );
  const oldEmbed = originalMessage?.embeds[0] || interaction.message?.embeds[0];

  if (oldEmbed) {
    const newEmbed = EmbedBuilder.from(oldEmbed)
      .setColor("#e74c3c")
      .setFields({
        name: "Статус",
        value: `Отклонено: ${member.displayName}\nПричина: ${reason}`,
      });

    if (originalMessage) {
      await originalMessage.edit({ embeds: [newEmbed], components: [] });
    }

    const description = oldEmbed.description || "";
    const mentionMatch = description.match(/<@(\d+)>/);

    if (mentionMatch) {
      const authorId = mentionMatch[1];

      const transferInfo = description.match(
        /\*\*Из\s+(\w+)\s+\[(\d+)\]\s*->\s*в\s+(\w+)\s+\[(\d+)\]\*\*/,
      );
      const oldFaction = transferInfo ? transferInfo[1] : "Неизвестно";
      const oldRank = transferInfo ? transferInfo[2] : "?";
      const newFaction = transferInfo ? transferInfo[3] : "Неизвестно";
      const newRank = transferInfo ? transferInfo[4] : "?";

      try {
        const author = await interaction.client.users.fetch(authorId);

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

        await author.send({ embeds: [denyEmbed] }).catch((error: unknown) => {
          console.warn(
            `Не удалось отправить ЛС пользователю ${author.tag}:`,
            error,
          );
        });
      } catch (error: unknown) {
        console.error("Ошибка при отправке уведомления автору заявки:", error);
      }
    }

    await interaction.update({
      content: "Перевод отклонен",
      components: [],
    });
  }
}

async function findLeaders(
  guild: any,
  client: Client,
  ...factions: string[]
): Promise<string> {
  const leaders: string[] = [];

  // Получаем CHP сервер
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

async function processApproval(
  interaction: any,
  oldEmbed: any,
  fromFrac: string,
  toFrac: string,
  userFrac: string,
  member: GuildMember,
) {
  if (!(await userHasFactionPermission(member, userFrac, interaction.client))) {
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
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        disabledMenu,
      );

    if (interaction.isStringSelectMenu?.()) {
      return interaction.update({
        content: `У вас нет прав лидера фракции ${userFrac}.`,
        components: [disabledRow],
      });
    }
    return interaction.reply({
      content: `У вас нет прав лидера фракции ${userFrac}.`,
      ephemeral: true,
    });
  }

  const statusField = oldEmbed.fields?.find(
    (f: any) => f.name === "Согласование",
  );
  if (!statusField) return;

  const statusValue = statusField.value;

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

  if (
    (userFrac === fromFrac && fromApproved) ||
    (userFrac === toFrac && toApproved)
  ) {
    const alreadyApprovedFrac = userFrac === fromFrac ? fromFrac : toFrac;
    const approverName =
      userFrac === fromFrac ? previousFromApprover : previousToApprover;

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
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          disabledMenu,
        );

      return interaction.update({
        content: `Фракция ${alreadyApprovedFrac} уже одобрила перевод (${approverName})`,
        components: [disabledRow],
      });
    }
    return interaction.reply({
      content: `Фракция ${alreadyApprovedFrac} уже одобрила перевод (${approverName})`,
      ephemeral: true,
    });
  }

  const newFromApproved = userFrac === fromFrac ? true : fromApproved;
  const newToApproved = userFrac === toFrac ? true : toApproved;

  const fromApproverName =
    userFrac === fromFrac ? member.displayName : previousFromApprover;
  const toApproverName =
    userFrac === toFrac ? member.displayName : previousToApprover;

  const fromStatus = newFromApproved
    ? `одобрено (${fromApproverName})`
    : "ожидание";
  const toStatus = newToApproved ? `одобрено (${toApproverName})` : "ожидание";

  const newStatusValue = `${fromFrac}: ${fromStatus} | ${toFrac}: ${toStatus}`;

  const newEmbed = EmbedBuilder.from(oldEmbed).setFields({
    name: "Согласование",
    value: newStatusValue,
  });

  if (newFromApproved && newToApproved) {
    newEmbed.setColor("#2ecc71");
    newEmbed.setTitle("Заявление на перевод (Одобрено)");

    const channel = interaction.client.channels.cache.get(
      interaction.channelId,
    );
    const originalMessage = await channel?.messages.fetch(
      interaction.message?.reference?.messageId || interaction.message?.id,
    );

    if (originalMessage) {
      await originalMessage.edit({ embeds: [newEmbed], components: [] });
    }

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
      const passportMatch = description.match(
        /\*\*Сотрудник:\*\* <@([0-9]+)> \[([0-9]+)\]/,
      );
      const userId = passportMatch
        ? passportMatch[1]
        : "Ошибка распознания ID Дискорд";
      const passport = passportMatch
        ? passportMatch[2]
        : "Ошибка распознания номера паспорта";
      try {
        const author = await interaction.client.users.fetch(authorId);

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
          const targetGuild = interaction.client.guilds.cache.get(
            factionLogData[0],
          );
          if (targetGuild) {
            const targetChannel = targetGuild.channels.cache.get(factionLogData[1]);
            if (targetChannel?.isTextBased()) {
              const fractionKey = toFrac.toUpperCase() as FractionType;
              const info = FRACTION_INFO[fractionKey];
              const roleToMention = info?.state_high_role_id
              await targetChannel
                .send({ embeds: [factionEmbed], content: `<@&${roleToMention}>` })
                .catch((error: unknown) => {
                  console.error(
                    `Ошибка отправки уведомления в канал фракции ${toFrac}:`,
                    error,
                  );
                });
            }
          }
        }
        await author.send({ embeds: [notifyEmbed] }).catch((error: unknown) => {
          console.warn(
            `Не удалось отправить ЛС пользователю ${author.tag}:`,
            error,
          );
        });
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
    const channel = interaction.client.channels.cache.get(
      interaction.channelId,
    );
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

async function sendResponse(
  interaction: any,
  message: string,
  ephemeral: boolean,
) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: message, components: [] });
    } else {
      await interaction.reply({ content: message, ephemeral });
    }
  } catch (error) {
    console.error("Ошибка отправки ответа:", error);
  }
}
