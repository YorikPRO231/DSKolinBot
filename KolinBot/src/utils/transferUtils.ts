import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  Colors,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {getFactionByKey, getServers, getSystemChannel, loadSettings} from "../config/settings-loader";
import {ComponentType} from "discord-api-types/v10";
import {TransferData, TransfersRepository} from "../databases/repositories/transfers.repository";
import {TRANSFER_TABLE} from "./constants/transferData";


async function safeReply(interaction: any, data: any) {
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(data);
  }

  return interaction.reply(data);
}


async function getFactionsFromRoles(
  member: GuildMember,
  client: Client,
): Promise<string[]> {
  const factions: string[] = [];
  const chpServerId = getServers().chp;
  const chpGuild = client.guilds.cache.get(chpServerId);
  
  if (!chpGuild) return factions;

  try {
    const chpMember = await chpGuild.members.fetch(member.id).catch(() => null);
    if (!chpMember) {
      return ['NOCHP'];
    }
    const chpRoleIds = new Set(chpMember.roles.cache.map((role) => role.id));
    const config = loadSettings();
    for (const [factionKey, factionInfo] of Object.entries(config.factions)) {
      if (factionInfo.roles.chp && chpRoleIds.has(factionInfo.roles.chp)) {
        factions.push(factionKey);
      }
    }
  } catch (error) {
    console.warn(`Участник ${member.id} не найден на CHP сервере`);
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

async function findLeaders(
  client: Client,
  ...factions: string[]
): Promise<string> {
  const leaders: string[] = [];

  const chpServerId = getServers().chp;
  const chpGuild = client.guilds.cache.get(chpServerId);
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

      return m.roles.cache.some((role) => {
        const roleName = role.name.toLowerCase();
        return (
            /лидер|leader|глава|head/i.test(roleName) &&
            !/зам|заместитель|deputy|assistant|помощник/i.test(roleName)
        );
      });
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


export async function showFactionSelectMenu(
  interaction: ChatInputCommandInteraction,
  passport: string,
  currentRank: number,
  targetFrac: string,
  member: GuildMember,
  nickname: string,
) {
  const factions = await getFactionsFromRoles(member, interaction.client);

  if (factions.length === 0) {
    return await safeReply(interaction, {
      content: "❌ Не удалось определить вашу фракцию по ролям ЧП. Обратитесь к администратору.",
      flags: MessageFlags.Ephemeral,
    });
  }
  if (factions.length === 1 && factions[0] === 'NOCHP') {
    return await safeReply(interaction, {
      content: "❌ Для использования функционала перевода зайдите в сервер ЧП. Получите ссылку командой /чп-приглашение.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (factions.length === 1) {
    return await createTransferRequest(interaction, passport, currentRank, targetFrac, factions[0], member, nickname);
  }

  const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`tr_nselect_${passport}`)
    .setPlaceholder("Выберите вашу текущую фракцию")
    .addOptions(
      factions.map(f => new StringSelectMenuOptionBuilder().setLabel(f).setValue(f))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const response = await safeReply(interaction, {
    content: "У вас обнаружено несколько фракционных ролей. Выберите ту, из которой переводитесь:",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
  const collector = response.createMessageComponentCollector({componentType: ComponentType.StringSelect, time: 30_000});
  collector.on('collect', async (i: StringSelectMenuInteraction) => {
    if (i.user.id !== interaction.user.id) {
      return safeReply(i, {content: "Недостаточно доступа!", flags: [MessageFlags.Ephemeral]});
    }
    const selected = i.values[0]
    await interaction.editReply({content: 'Информация получена.', components: []})
    return await createTransferRequest(i, passport, currentRank, targetFrac, selected, member, nickname);
  })
}

export async function createTransferRequest(interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
                                            passport: string,
                                            currentRank: number,
                                            targetFrac: string,
                                            currentFrac: string,
                                            _member: GuildMember,
                                            nickname: string) {
  if (["LSSD", "FIB", "LSPD"].includes(currentFrac) && currentRank === 6) {
    const res = `Перевод из ${currentFrac} с 6 ранга запрещен.`;
    if (interaction instanceof StringSelectMenuInteraction) {
      return await interaction.update({content: res, components: [], embeds: []});
    } else {
      return await safeReply(interaction, {content: res, flags: MessageFlags.Ephemeral});
    }
  }
  const mapping = TRANSFER_TABLE[targetFrac]?.[currentFrac]?.find(
      (m) => currentRank >= m.min && currentRank <= m.max,
  );

  if (!mapping) {
    const res = "Перевод для данного ранга/фракции не предусмотрен таблицей.";
    if (interaction instanceof StringSelectMenuInteraction) {
      return await interaction.update({content: res, components: [], embeds: []});
    } else {
      return await safeReply(interaction, {content: res, flags: MessageFlags.Ephemeral});
    }
  }
  const leaderMentions = await findLeaders(interaction.client, currentFrac, targetFrac);
  const embed = new EmbedBuilder()
      .setTitle('Заявление на перевод')
      .setColor("#dda01b")
      .setDescription(
          `Сотрудник: <@${interaction.user.id}> ${nickname} [${passport}]\n` +
          `**Из ${currentFrac} [${currentRank}] -> в ${targetFrac} [${mapping.new}]**\n\n` +
          `──────────────────────────────────────────\n` +
          `**Руководство:** ${leaderMentions}`,)
      .addFields({
        name: "Согласование",
        value: `${currentFrac}: ожидание | ${targetFrac}: ожидание`,
      })
      .setFooter({text: `ID автора: ${interaction.user.id}`});
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
          .setCustomId(`tr_approve_${passport}`)
          .setLabel("Одобрить")
          .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
          .setCustomId(`tr_deny_${passport}`)
          .setLabel("Отклонить")
          .setStyle(ButtonStyle.Danger),
  );
  
  const transferLogChannelId = getSystemChannel('transfer_log');
  const chpGuild = interaction.client.guilds.cache.get(getServers().chp);
  const logChannel = chpGuild?.channels.cache.get(transferLogChannelId) as TextChannel;

  if (logChannel) {
    const msg = await logChannel.send({content: leaderMentions, embeds: [embed], components: [buttons]});
    TransfersRepository.pushTransfer(currentRank, currentFrac, targetFrac, passport, interaction.user.id, nickname, 'ожидание', 'ожидание', msg.id);
    if (interaction instanceof StringSelectMenuInteraction) {
      await interaction.update({
        content: 'Заявление было отправлено на рассмотрение руководству фракции.\nОтвет придет Вам в личные сообщения. ',
        components: [],
        embeds: []
      });
    } else {
      await safeReply(interaction, {
        content: 'Заявление было отправлено на рассмотрение руководству фракции.\nОтвет придет Вам в личные сообщения. ',
        flags: MessageFlags.Ephemeral
      });
    }
  } else {
    await interaction.reply({content: 'Не удалось отправить заявление: не найден канал', flags: MessageFlags.Ephemeral})
  }
}

async function findOriginal(msg: string, client: Client) {
  const chpGuild = client.guilds.cache.get(getServers().chp);
  const transferLogChannelId = getSystemChannel('transfer_log');
  const logChannel = chpGuild?.channels.cache.get(transferLogChannelId) as TextChannel;
  if (logChannel) {
    const cached = logChannel.messages.cache.get(msg);
    if (cached) return cached;
    return logChannel.messages.fetch(msg);
  }
  throw new Error('Не удалось найти оригинальное сообщение.');
}

async function inform(data: TransferData, client: Client) {
  const mapping = TRANSFER_TABLE[data.destination]?.[data.current]?.find(
      (m) => data.current_rank >= m.min && data.current_rank <= m.max,
  )!;
  const embed = new EmbedBuilder()
      .setTitle('Одобренное заявление на перевод')
      .setColor("#2ecc71")
      .setDescription(
          `Ваше заявление на перевод из ${data.current} в ${data.destination} одобрено на ${mapping.new} ранг. Для перевода придите в холл организации и вызовите старший состав ${data.destination}.`)
      .addFields({
        name: "Одобрено:",
        value: `${data.current_approve} и ${data.destination_approve}`,
      })
      .setFooter({text: `ID заявителя: ${data.user_id}`});
  try {
    const user = client.users.cache.get(data.user_id) || await client.users.fetch(data.user_id);
    await user.send({embeds: [embed]});
    return true;
  } catch (e) {
    return false;
  }
}

export async function processApproval(inter: ButtonInteraction, member: GuildMember, data: TransferData, pFaction: string) {
  let fromApprove = data.current_approve;
  let toApprove = data.destination_approve;
  const isFrom = pFaction === data.current;
  if (isFrom && fromApprove !== 'ожидание' || !isFrom && toApprove !== 'ожидание') {
    return inter.update({
      content: `Перевод уже одобрен стороной ${(isFrom ? data.current : data.destination)}. Ожидается одобрение ${((!isFrom) ? data.current : data.destination)}.`,
      components: []
    });
  }
  if (isFrom) {
    fromApprove = member.displayName;
  } else {
    toApprove = member.displayName;
  }
  const mapping = TRANSFER_TABLE[data.destination]?.[data.current]?.find(
      (m) => data.current_rank >= m.min && data.current_rank <= m.max,
  )!;
  const original = await findOriginal(data.msg_id, inter.client);
  const embed = EmbedBuilder.from(original.embeds[0]).setFields({
    name: "Согласование",
    value: `${data.current}: ${fromApprove} | ${data.destination}: ${toApprove}`,
  });

  if (fromApprove !== 'ожидание' && toApprove !== 'ожидание') {
    const targetFaction = getFactionByKey(data.destination);
    const transferLogChannel = targetFaction?.channels?.transfer_log;
    const destChannel = transferLogChannel ? await inter.client.channels.fetch(transferLogChannel) : null;
    if (!destChannel || !destChannel.isSendable()) {
      return inter.update({content: `Не удалось определить целевой дискорд ${data.destination}.`, components: []})
    }
    embed.setColor("#2ecc71");
    await original.edit({content: '', embeds: [embed], components: []});
    data.current_approve = fromApprove;
    data.destination_approve = toApprove;
    const factionEmbed = new EmbedBuilder()
        .setTitle('Одобренное заявление на перевод')
        .setColor("#2ecc71")
        .setDescription(
            `Сотрудник: <@${data.user_id}> ${data.nickname} [${data.passport}]\n` +
            `**Из ${data.current} [${data.current_rank}] -> в ${data.destination} [${mapping.new}]**`)
        .addFields({
          name: "Одобрено:",
          value: `${data.current}: ${fromApprove} | ${data.destination}: ${toApprove}`,
        })
        .setFooter({text: `ID заявителя: ${data.user_id}`});
    const highRoleMentions = (targetFaction?.roles?.high || []).map(id => `<@&${id}>`).join(' ');
    await destChannel.send({content: highRoleMentions, embeds: [factionEmbed]});
    const informStatus = await inform(data, inter.client);
    TransfersRepository.removeTransfer(data.passport);
    if (informStatus) {
      return inter.update({
        content: `Заявление одобрено. Информация передана старшему составу ${data.destination}, уведомление в ЛС доставлено.`,
        components: [],
        embeds: []
      })
    } else {
      return inter.update({
        content: `Заявление одобрено. Информация передана старшему составу ${data.destination}, однако произошла ошибка уведомления.`,
        components: [],
        embeds: []
      })
    }
  }
  await original.edit({embeds: [embed]});
  TransfersRepository.pushTransfer(data.current_rank, data.current, data.destination, data.passport, data.user_id, data.nickname, fromApprove, toApprove, data.msg_id);
  return inter.update({
    content: `Заявление одобрено со стороны ${isFrom ? data.current : data.destination}. Ожидается второе одобрение.`,
    components: [],
    embeds: []
  });
}

export async function processAction(inter: ButtonInteraction | StringSelectMenuInteraction, _member: GuildMember, data: TransferData, action: string, pFaction: string) {
  switch (action) {
    case 'approve':
      const fromApprove = data.current_approve;
      const toApprove = data.destination_approve;
      const isFrom = pFaction === data.current;
      if (isFrom && fromApprove !== 'ожидание' || !isFrom && toApprove !== 'ожидание') {
        return safeReply(inter, {
          content: `Перевод уже одобрен стороной ${(isFrom ? data.current : data.destination)}. Ожидается одобрение ${((!isFrom) ? data.current : data.destination)}.`,
          components: [], flags: MessageFlags.Ephemeral
        });
      }
      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
              .setCustomId(`tr_confirm_${data.passport}_${pFaction}`)
              .setLabel("Одобрить?")
              .setStyle(ButtonStyle.Success)
      );
      const embed = new EmbedBuilder().setTitle(`Одобрение перевода ${data.current} => ${data.destination}`)
          .setDescription(`\`\`\`\n` +
              `Одобряя данный перевод, Вы разрешите игроку повышение на ${data.current_rank} в фракции ${data.destination}. Если Вы текущий работодатель игрока (${data.current}), то обязательно проверьте следующее:\n` +
              `1. Наличие сотрудника во фракции\n2. Отсутствие у сотрудника запретов на кадровые изменения\n3. Наличие у сотрудника указанного ранга\n` +
              `Если Вы будущий работодатель игрока (${data.destination}), то проверьте:\n` +
              `1. Наличие сотрудника в черных списках своей фракции\n2. Судимости сотрудника.\`\`\`\n` +
              `**После одобрения перевода кнопкой ниже отменить его возможно будет только через администрацию.**`).setColor(Colors.Aqua);
      return safeReply(inter, {embeds: [embed], components: [buttons], flags: MessageFlags.Ephemeral})
    case 'deny':
      const modal = new ModalBuilder().setCustomId(`tr_deny_${data.passport}`).setTitle("Причина отказа");
      const reasonInput = new TextInputBuilder().setCustomId("reason_text")
          .setLabel("Причина")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
      return await inter.showModal(modal);
  }
}


export async function handleTransferButtons(inter: ButtonInteraction, member: GuildMember) {
  const parts = inter.customId.split('_');
  const type = parts[1];
  const passport = parts[2];
  const data = TransfersRepository.retrieveTransferData(passport);
  if (!data) {
    return safeReply(inter, {content: 'Не удалось найти информацию о данном переводе.', flags: MessageFlags.Ephemeral})
  }
  if (data.user_id === inter.user.id) {
    return safeReply(inter, {
      content: 'Невозможно влиять на собственный перевод, ожидайте его рассмотрения Вашим руководством',
      flags: MessageFlags.Ephemeral
    })
  }
  if (type === 'confirm') {
    return processApproval(inter, member, data, parts[3]);
  }
  const hasFromPerm = await userHasFactionPermission(member, data.current, inter.client);
  const hasToPerm = await userHasFactionPermission(member, data.destination, inter.client);
  if (hasFromPerm && hasToPerm) {
    const placeholder = type === 'deny' ? 'отклоняете' : 'одобряете'
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`tr_selectp_${passport}_${type}`)
        .setPlaceholder(`От какой фракции ${placeholder}?`)
        .addOptions([
          {label: data.current, value: data.current},
          {label: data.destination, value: data.destination},
        ]);
    await safeReply(inter, {
      content: "Выберите фракцию для продолжения:",
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
      flags: MessageFlags.Ephemeral,
    });
    const collector = inter.channel?.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 30_000,
      filter: (i) => {
        return i.customId.startsWith('tr_selectp')
      }
    });
    collector?.on('collect', async (i) => {
      if (i.user.id != inter.user.id) {
        return i.reply({content: 'Нет прав на управление этим меню.', flags: MessageFlags.Ephemeral});
      }
      const parts = i.customId.split('_');
      const passport = parts[2];
      const pType = parts[3];
      const data = TransfersRepository.retrieveTransferData(passport);
      if (!data) {
        return i.reply({content: 'Не удалось найти информацию о данном переводе.', flags: MessageFlags.Ephemeral})
      }
      const pFaction = i.values[0];
      await inter.editReply({content: 'Информация получена.', components: []});
      return processAction(i, member, data, pType, pFaction);
    });
  } else if (hasFromPerm && !hasToPerm) {
    return processAction(inter, member, data, type, data.current)
  } else if (!hasFromPerm && hasToPerm) {
    return processAction(inter, member, data, type, data.destination)
  } else {
    return safeReply(inter, {content: 'Нет прав управления данными кнопками', flags: MessageFlags.Ephemeral})
  }
}

export async function handleDenyModal(inter: any, member: GuildMember) {
  const parts = inter.customId.split('_');
  const passport = parts[2];
  const data = TransfersRepository.retrieveTransferData(passport);
  if (!data) {
    return safeReply(inter, {content: 'Не удалось найти информацию о данном переводе.', flags: MessageFlags.Ephemeral})
  }
  const original = await findOriginal(data.msg_id, inter.client);
  const reason = inter.fields.getTextInputValue("reason_text");
  const oldEmbed = original.embeds[0];
  const authorId = data.user_id;

  const newEmbed = EmbedBuilder.from(oldEmbed)
      .setColor("#e74c3c")
      .setTitle("Заявление на перевод (Отклонено)")
      .setFields({name: "Причина отказа", value: `${reason} (${member.displayName})`});
  await original.edit({embeds: [newEmbed], components: []})
  if (authorId) {
    try {
      const user = await inter.client.users.fetch(authorId);
      const oldFaction = data.current;
      const newFaction = data.destination

      const denyEmbed = new EmbedBuilder()
          .setColor("#e74c3c")
          .setTitle("Перевод отклонен")
          .setDescription(
              `Ваше заявление на перевод из ${oldFaction} в ${newFaction} было отклонено ${member.displayName}. Причина: ${reason}.\n` +
              `В случае несогласия с решением, обратитесть в правительство для аппеляции данного решения.`
          )
          .setTimestamp()
          .setFooter({text: "Система переводов"});

      await user.send({embeds: [denyEmbed]}).catch((error: unknown) => {
        console.warn(`Не удалось отправить ЛС пользователю ${user.tag}:`, error);
      });
      TransfersRepository.removeTransfer(passport);
    } catch (e) {
      console.error("Не удалось отправить ЛС автору");
    }
  }
  return safeReply(inter, {content: `Перевод был отклонен: ${reason}`, flags: MessageFlags.Ephemeral})
}