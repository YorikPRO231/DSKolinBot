import {
  EmbedBuilder,
  TextChannel,
  GuildMember,
  User,
  Message,
  GuildChannel,
  Client,
  PartialGuildMember,
  AttachmentBuilder,
  AuditLogEvent,
  Guild,
  PartialMessage,
} from "discord.js";
import { factionByDiscordID, FRACTION_INFO } from "./utils/constants/fractions";
import { getStateFractionRoles, getStateServerIds } from "./utils/config";

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

async function getLogChannelInGuild(guild: Guild): Promise<TextChannel | null> {
  let logChannel = guild.channels.cache.find(
    (channel) => channel.name === "logs" && channel.isTextBased(),
  ) as TextChannel;

  if (!logChannel) {
    try {
      await guild.channels.fetch();
      logChannel = guild.channels.cache.find(
        (channel) => channel.name === "logs" && channel.isTextBased(),
      ) as TextChannel;
    } catch (error) {
      console.error(`Ошибка fetch каналов на ${guild.name}:`, error);
    }
  }

  return logChannel || null;
}

async function sendLogToGuild(
  guild: Guild,
  embed: EmbedBuilder,
  attachment?: AttachmentBuilder,
  retries = 2,
): Promise<void> {
  try {
    const logChannel = await getLogChannelInGuild(guild);

    if (!logChannel) {
      return;
    }

    const permissions = logChannel.permissionsFor(guild.members.me!);
    if (!permissions?.has("SendMessages") || !permissions?.has("EmbedLinks")) {
      console.warn(
        `Недостаточно прав для отправки логов в канал #${logChannel.name} на сервере ${guild.name}`,
      );
      return;
    }

    const messagePayload: any = { embeds: [embed] };
    if (attachment) {
      messagePayload.files = [attachment];
    }

    await logChannel.send(messagePayload);
  } catch (error: any) {
    if (retries > 0 && (error.code === 429 || error.status === 429)) {
      const waitTime = (error.retryAfter || 1000) + 100;
      await new Promise((r) => setTimeout(r, waitTime));
      return sendLogToGuild(guild, embed, attachment, retries - 1);
    }
    console.error(
      "Ошибка отправки лога:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function createTextAttachment(
  content: string,
  filename: string,
): AttachmentBuilder {
  const timestamp = new Date().toISOString();
  const fullContent = `=== Discord Log ===\nTimestamp: ${timestamp}\nLength: ${content.length} chars\n\n${content}`;

  const buffer = Buffer.from(fullContent, "utf-8");
  return new AttachmentBuilder(buffer, {
    name: filename,
    description: "Полный текст сообщения",
  });
}

function shouldCreateFile(content: string): boolean {
  return content.length > 3000;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ========== ЛОГИ СОБЫТИЙ ==========

export async function logMessageDelete(
  client: Client,
  message: Message | PartialMessage,
) {
  if (message.partial) {
    try {
      await message.fetch();
    } catch {
      return;
    }
  }

  if (message.system) return;
  if (!message.content && message.attachments.size === 0) return;
  if (!message.author) return;
  if (!message.guild) return;

  const content = message.content || "";
  const needsFile = shouldCreateFile(content);

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Сообщение удалено")
    .setDescription(
      [
        `**Автор:** ${message.author.tag}`,
        `**Канал:** <#${message.channel.id}>`,
        `**Дата создания:** ${formatDate(message.createdTimestamp)}`,
        message.reference
          ? `**Ответ на:** [сообщение](https://discord.com/channels/${message.guildId}/${message.channel.id}/${message.reference.messageId})`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .setFooter({
      text: `ID сообщения: ${message.id} | ID автора: ${message.author.id}`,
    })
    .setTimestamp();

  if (needsFile) {
    const preview = content.substring(0, 1000);
    embed.addFields({
      name: `Содержание (${content.length} символов)`,
      value: preview + "\n\n*Полный текст в прикрепленном файле*",
      inline: false,
    });

    const attachment = createTextAttachment(
      content,
      `deleted_message_${message.id}.txt`,
    );

    if (message.attachments.size > 0) {
      const attachmentsList = message.attachments
        .map((a, i) => `${i + 1}. ${a.name} (${formatSize(a.size)})`)
        .join("\n");

      embed.addFields({
        name: `Вложения (${message.attachments.size})`,
        value: attachmentsList,
        inline: false,
      });
    }

    await sendLogToGuild(message.guild, embed, attachment);
  } else {
    embed.addFields({
      name: content ? "Содержание" : "Тип сообщения",
      value: content || "Сообщение без текста (только вложения)",
      inline: false,
    });

    if (message.attachments.size > 0) {
      const attachmentsList = message.attachments
        .map(
          (a, i) => `${i + 1}. [${a.name}](${a.url}) - ${formatSize(a.size)}`,
        )
        .join("\n");

      embed.addFields({
        name: `Вложения (${message.attachments.size})`,
        value: attachmentsList.substring(0, 1024),
        inline: false,
      });
    }

    await sendLogToGuild(message.guild, embed);
  }
}

export async function logMessageUpdate(
  client: Client,
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
) {
  if (oldMessage.partial) {
    try {
      await oldMessage.fetch();
    } catch {
      return;
    }
  }
  if (newMessage.partial) {
    try {
      await newMessage.fetch();
    } catch {
      return;
    }
  }

  if (oldMessage.content === newMessage.content) return;
  if (!oldMessage.author) return;
  if (!oldMessage.guild) return;

  const oldContent = oldMessage.content || "Пусто";
  const newContent = newMessage.content || "Пусто";
  const needsFile =
    shouldCreateFile(oldContent) || shouldCreateFile(newContent);

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("Сообщение отредактировано")
    .setDescription(
      [
        `**Автор:** ${oldMessage.author.tag}`,
        `**Канал:** <#${oldMessage.channel.id}>`,
        `**ID автора:** ${oldMessage.author.id}`,
        `**Ссылка:** [Перейти к сообщению](${newMessage.url})`,
      ].join("\n"),
    )
    .setFooter({
      text: `ID сообщения: ${oldMessage.id} | Отредактировано`,
    })
    .setTimestamp();

  if (needsFile) {
    const oldPreview = oldContent.substring(0, 500);
    const newPreview = newContent.substring(0, 500);

    embed.addFields(
      {
        name: `Старая версия (${oldContent.length} символов)`,
        value:
          oldPreview +
          (oldContent.length > 500 ? "\n\n*Полный текст в файле*" : ""),
        inline: false,
      },
      {
        name: `Новая версия (${newContent.length} символов)`,
        value:
          newPreview +
          (newContent.length > 500 ? "\n\n*Полный текст в файле*" : ""),
        inline: false,
      },
    );

    const fullContent = [
      "=== СТАРАЯ ВЕРСИЯ ===",
      `Длина: ${oldContent.length} символов`,
      "",
      oldContent,
      "",
      "=== НОВАЯ ВЕРСИЯ ===",
      `Длина: ${newContent.length} символов`,
      "",
      newContent,
    ].join("\n");

    const attachment = createTextAttachment(
      fullContent,
      `edited_message_${oldMessage.id}.txt`,
    );
    await sendLogToGuild(oldMessage.guild, embed, attachment);
  } else {
    embed.addFields(
      {
        name: "Старая версия",
        value: oldContent.substring(0, 1024) || "Пусто",
        inline: false,
      },
      {
        name: "Новая версия",
        value: newContent.substring(0, 1024) || "Пусто",
        inline: false,
      },
    );

    await sendLogToGuild(oldMessage.guild, embed);
  }
}

export async function logMemberJoin(client: Client, member: GuildMember) {
  const accountAge = Math.floor(
    (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24),
  );

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Участник присоединился")
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setDescription(
      [
        `**Пользователь:** ${member.user.tag}`,
        `**Упоминание:** <@${member.id}>`,
      ].join("\n"),
    )
    .addFields(
      {
        name: "Информация об аккаунте",
        value: [
          `ID: \`${member.id}\``,
          `Создан: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          `Возраст аккаунта: ${accountAge} дней`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Информация о сервере",
        value: [
          `Всего участников: ${member.guild.memberCount}`,
          `Присоединился: <t:${Math.floor(Date.now() / 1000)}:R>`,
        ].join("\n"),
        inline: true,
      },
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();

  if (member.guild.id == FRACTION_INFO["CHP_SERVER"].discord_id) {
    if (
      member.user.bot ||
      member.roles.cache.some((r) => /администратор|хелпер/i.test(r.name))
    ) {
      await sendLogToGuild(member.guild, embed);
      return;
    }

    let roleAdded = false;
    const stateServerIds = getStateServerIds();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    for (const sid of stateServerIds) {
      const guild = client.guilds.cache.get(sid);
      if (!guild) continue;

      const factionInfo = factionByDiscordID(sid);
      if (!factionInfo || !factionInfo[1].state) continue;

      try {
        const targetMember = await guild.members
          .fetch(member.user.id)
          .catch(() => null);

        if (
          targetMember &&
          targetMember.roles.cache.has(factionInfo[1].faction_role_id)
        ) {
          const chpRole = member.guild.roles.cache.find(
            (role) => role.name === factionInfo[0],
          );

          if (!chpRole) {
            console.warn(
              `⚠️ Роль "${factionInfo[0]}" не найдена на сервере ЧП`,
            );
            continue;
          }

          if (!member.roles.cache.has(chpRole.id)) {
            try {
              await member.roles.add(
                chpRole,
                "Наличие роли в фракционном дискорде при заходе на сервер.",
              );
              console.log(
                `✅ Выдана роль ${factionInfo[0]} для ${member.user.tag}`,
              );
            } catch (error) {
              console.error(`Ошибка при выдаче роли ${factionInfo[0]}:`, error);
              continue;
            }
          }

          roleAdded = true;
        }
      } catch (error) {
        console.error(`Ошибка проверки на сервере ${guild.name}:`, error);
        continue;
      }
    }

    const freshMember = await member.guild.members
      .fetch(member.id)
      .catch(() => null);

    if (!freshMember) {
      console.error(`Не удалось перезагрузить участника ${member.user.tag}`);
      return;
    }

    const stateFractionRoles = getStateFractionRoles();
    const hasStateRole = freshMember.roles.cache.some((role) =>
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
          console.warn(
            `Не удалось отправить ЛС пользователю ${member.user.tag}`,
          );
        });

        console.log(`❌ Кикнут ${member.user.tag} - отсутствуют роли фракций`);
      } catch (error) {
        console.error(`Ошибка при кике участника ${member.user.tag}:`, error);
      }
    } else if (hasStateRole) {
      console.log(`✅ ${member.user.tag} имеет роли фракций, доступ разрешен`);
    }
  }

  await sendLogToGuild(member.guild, embed);
}

export async function logMemberLeave(
  client: Client,
  member: GuildMember | PartialGuildMember,
) {
  if (!member.guild) return;

  if (member.partial) {
    try {
      await member.fetch();
    } catch {
      // Продолжаем с тем что есть
    }
  }

  const rolesList =
    member.roles?.cache
      .filter((role) => role.name !== "@everyone")
      .map((role) => role.name)
      .join(", ") || "Не удалось получить роли";

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Участник покинул сервер")
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setDescription(
      [
        `**Пользователь:** ${member.user.tag}`,
        `**Упоминание:** <@${member.id}>`,
      ].join("\n"),
    )
    .addFields(
      {
        name: "Информация",
        value: [
          `ID: \`${member.id}\``,
          `Присоединился: ${member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Неизвестно"}`,
          `Покинул: <t:${Math.floor(Date.now() / 1000)}:R>`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Статистика сервера",
        value: [
          `Осталось участников: ${member.guild?.memberCount || "Неизвестно"}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Роли на момент выхода",
        value: rolesList.substring(0, 1024) || "Нет ролей",
        inline: false,
      },
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();
  await sendLogToGuild(member.guild, embed);

  if (getStateServerIds().includes(member.guild.id)) {
    const chpServerId = FRACTION_INFO["CHP_SERVER"].discord_id;

    const chp = client.guilds.cache.get(chpServerId);
    if (!chp) {
      console.error("Не удалось загрузить ЧП сервер!");
      return;
    }
    const chpMember = await chp.members.fetch(member.user.id).catch(() => null);
    if (!chpMember) {
      return;
    }
    if (
      chpMember.user.bot ||
      chpMember.roles.cache.some((r) => /администратор|хелпер/i.test(r.name))
    ) {
      return;
    }
    const factionInfo = factionByDiscordID(member.guild.id);

    if (chpMember.roles.cache.has(factionInfo[1].chp_role_id)) {
      await chpMember.roles.remove(
        factionInfo[1].chp_role_id,
        `Выход из фракционного дискрода ${factionInfo[0]}`,
      );
    }

    const stateChpRoleIds = Object.values(FRACTION_INFO)
      .filter(
        (i) =>
          i.state && i.discord_id !== FRACTION_INFO["CHP_SERVER"].discord_id,
      )
      .map((i) => i.chp_role_id)
      .filter((id) => id.length > 0);

    const hasOtherFractionRoles = chpMember.roles.cache.some((role) =>
      stateChpRoleIds.includes(role.id),
    );

    if (!hasOtherFractionRoles) {
      try {
        await chpMember.kick(
          "Отсутствие ролей фракций после выхода из фракционного сервера",
        );

        const kickEmbed = new EmbedBuilder()
          .setTitle("GTA 5 RP | ЧП Blackberry")
          .setTimestamp()
          .setColor(0xb8001c)
          .setDescription(
            "Вы были удалены из дискорда ЧП, так как больше не имеете ролей фракций.\nПолучите роль фракции у старшего состава для авторизации доступа.",
          );

        await chpMember.user.send({ embeds: [kickEmbed] }).catch(() => {
          console.warn(
            `Не удалось отправить ЛС пользователю ${chpMember.user.tag}`,
          );
        });
      } catch (error) {
        console.error(
          `Ошибка при кике участника ${chpMember.user.tag} из ЧП:`,
          error,
        );
      }
    } else {
      console.log(
        `${chpMember.user.tag} сохраняет другие роли фракций в ЧП, кик не требуется`,
      );
    }
  }
}

export async function logMemberUpdate(
  client: Client,
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
) {
  if (!newMember.guild) return;

  const newNick = newMember.nickname;
  let nicknameChanged = false;
  let oldNick: string | null | undefined = undefined;

  if (!oldMember.partial && "nickname" in oldMember) {
    oldNick = oldMember.nickname;
    if (oldNick !== newNick) {
      nicknameChanged = true;
    }
  } else {
    try {
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberUpdate,
        limit: 10,
      });

      const auditEntry = auditLogs.entries.find((entry) => {
        if (entry.target?.id !== newMember.id) return false;
        const timeDiff = Date.now() - entry.createdTimestamp;
        if (timeDiff > 10000) return false;

        const hasNickChange = entry.changes?.some(
          (change) => change.key === "nick",
        );
        return hasNickChange;
      });

      if (auditEntry) {
        const nickChange = auditEntry.changes?.find((c) => c.key === "nick");
        oldNick = (nickChange?.old as string) || null;
        const auditNewNick = (nickChange?.new as string) || null;

        if (oldNick !== newNick) {
          nicknameChanged = true;
        }
      }
    } catch (error) {
      console.debug(
        `Не удалось проверить аудит для ${newMember.guild.name}:`,
        error,
      );
    }
  }

  if (nicknameChanged) {
    let moderator = "Неизвестно";

    try {
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberUpdate,
        limit: 5,
      });

      const auditEntry = auditLogs.entries.find((entry) => {
        if (entry.target?.id !== newMember.id) return false;
        const timeDiff = Date.now() - entry.createdTimestamp;
        if (timeDiff > 5000) return false;
        return entry.changes?.some((change) => change.key === "nick");
      });

      if (auditEntry?.executor) {
        moderator = `<@${auditEntry.executor.id}> (${auditEntry.executor.tag})`;
      }
    } catch (error) {
      console.debug("Не удалось получить аудит для изменения ника:", error);
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("Никнейм изменен")
      .setDescription(`**Пользователь:** <@${newMember.id}>`)
      .addFields(
        {
          name: "Предыдущий никнейм",
          value:
            oldNick === null
              ? "[Стандартное имя]"
              : oldNick || "[Не удалось определить]",
          inline: true,
        },
        {
          name: "Новый никнейм",
          value: newNick || "[Стандартное имя]",
          inline: true,
        },
        {
          name: "Кто изменил",
          value: moderator,
          inline: false,
        },
        {
          name: "ID пользователя",
          value: `\`${newMember.id}\``,
          inline: false,
        },
      )
      .setFooter({ text: `Изменен: ${formatDate(Date.now())}` })
      .setTimestamp();

    await sendLogToGuild(newMember.guild, embed);
  }

  if (!oldMember.partial && "roles" in oldMember) {
    const addedRoles = newMember.roles.cache.filter(
      (role) => !oldMember.roles.cache.has(role.id),
    );
    const removedRoles = oldMember.roles.cache.filter(
      (role) => !newMember.roles.cache.has(role.id),
    );

    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const factionInfo = factionByDiscordID(newMember.guild.id);
    const factionType = factionInfo[0];
    const factionData = factionInfo[1];

    if (factionData.state && factionType !== "TEST_SERVER") {
      const chpServerId = FRACTION_INFO["CHP_SERVER"].discord_id;
      const chp = client.guilds.cache.get(chpServerId);

      if (chp) {
        const wasFactionRoleAdded = addedRoles.has(factionData.faction_role_id);
        const wasFactionRoleRemoved = removedRoles.has(
          factionData.faction_role_id,
        );

        if (wasFactionRoleAdded) {
          try {
            const chpMember = await chp.members
              .fetch(newMember.id)
              .catch(() => null);
            if (chpMember) {
              const chpRole = chp.roles.cache.find(
                (role) => role.name === factionType,
              );
              if (chpRole && !chpMember.roles.cache.has(chpRole.id)) {
                await chpMember.roles.add(
                  chpRole,
                  `Получение роли ${factionType} в фракционном дискорде`,
                );
              }
            }
          } catch (error) {
            console.error(
              `Ошибка при выдаче роли ЧП для ${newMember.id}:`,
              error,
            );
          }
        }

        if (wasFactionRoleRemoved) {
          try {
            const chpMember = await chp.members
              .fetch(newMember.id)
              .catch(() => null);
            if (!chpMember) return;

            const chpRoleToRemove = chp.roles.cache.find(
              (role) => role.name === factionType,
            );
            if (
              chpRoleToRemove &&
              chpMember.roles.cache.has(chpRoleToRemove.id)
            ) {
              await chpMember.roles.remove(
                chpRoleToRemove,
                `Снятие роли ${factionType} во фракционном дискорде`,
              );
            }

            if (
              chpMember.user.bot ||
              chpMember.roles.cache.some((r) =>
                /администратор|хелпер/i.test(r.name),
              )
            ) {
              return;
            }

            const stateFractionRoles = getStateFractionRoles();
            const hasOtherFractionRoles = chpMember.roles.cache.some((role) =>
              stateFractionRoles.includes(role.id),
            );

            if (!hasOtherFractionRoles) {
              try {
                await chpMember.kick("Отсутствие ролей фракции в ЧП");

                const kickEmbed = new EmbedBuilder()
                  .setTitle("GTA 5 RP | ЧП Blackberry")
                  .setTimestamp()
                  .setColor(0xb8001c)
                  .setDescription(
                    "Вы были удалены из дискорда ЧП, так как не имеете роли фракции.\nПолучите ее у старшего состава для авторизации доступа.",
                  );
                await chpMember.user
                  .send({ embeds: [kickEmbed] })
                  .catch(() => {});
              } catch (kickError) {
                console.error(
                  `Ошибка при кике ${chpMember.user.tag} из ЧП:`,
                  kickError,
                );
              }
            }
          } catch (error) {
            console.error(
              `Ошибка при обработке снятия роли для ${newMember.id}:`,
              error,
            );
          }
        }
      }
    }

    let moderator = "Неизвестно";
    let reason = "Причина не указана";

    try {
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 5,
      });

      const auditEntry = auditLogs.entries.find((entry) => {
        if (entry.target?.id !== newMember.id) return false;
        const timeDiff = Date.now() - entry.createdTimestamp;
        return timeDiff < 5000;
      });

      if (auditEntry) {
        moderator = `<@${auditEntry.executor?.id}> (${auditEntry.executor?.tag})`;
        reason = auditEntry.reason || "Причина не указана";
      }
    } catch (error) {
      console.error("Ошибка при получении аудита:", error);
    }

    if (addedRoles.size > 0) {
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("Роли добавлены")
        .setDescription(`**Пользователь:** <@${newMember.id}>`)
        .addFields(
          {
            name: `Добавлено ролей: ${addedRoles.size}`,
            value: addedRoles
              .map((r) => `<@&${r.id}> (\`${r.name}\`)`)
              .join("\n")
              .substring(0, 1024),
            inline: false,
          },
          { name: "Кто изменил", value: moderator, inline: true },
          { name: "Причина", value: reason, inline: true },
        )
        .setFooter({ text: `ID: ${newMember.id}` })
        .setTimestamp();

      await sendLogToGuild(newMember.guild, embed);
    }

    if (removedRoles.size > 0) {
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("Роли удалены")
        .setDescription(`**Пользователь:** <@${newMember.id}>`)
        .addFields(
          {
            name: `Удалено ролей: ${removedRoles.size}`,
            value: removedRoles
              .map((r) => `<@&${r.id}> (\`${r.name}\`)`)
              .join("\n")
              .substring(0, 1024),
            inline: false,
          },
          { name: "Кто изменил", value: moderator, inline: true },
          { name: "Причина", value: reason, inline: true },
        )
        .setFooter({ text: `ID: ${newMember.id}` })
        .setTimestamp();
      await sendLogToGuild(newMember.guild, embed);
    }
  }
}

export async function logChannelCreate(client: Client, channel: GuildChannel) {
  if (!channel.guild) return;

  let moderator = "Неизвестно";

  try {
    const auditLogs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelCreate,
      limit: 5,
    });

    const auditEntry = auditLogs.entries.find((entry) => {
      if (entry.target?.id !== channel.id) return false;
      const timeDiff = Date.now() - entry.createdTimestamp;
      return timeDiff < 5000;
    });

    if (auditEntry) {
      moderator = `<@${auditEntry.executor?.id}> (${auditEntry.executor?.tag})`;
    }
  } catch (error) {
    console.error("Ошибка при получении аудита:", error);
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Канал создан")
    .addFields(
      { name: "Название", value: `\`${channel.name}\``, inline: true },
      { name: "Тип", value: `\`${channel.type}\``, inline: true },
      { name: "ID", value: `\`${channel.id}\``, inline: true },
      { name: "Кто создал", value: moderator, inline: true },
    )
    .setFooter({ text: `Создан: ${formatDate(channel.createdTimestamp)}` })
    .setTimestamp();

  await sendLogToGuild(channel.guild, embed);
}

export async function logChannelDelete(client: Client, channel: GuildChannel) {
  if (!channel.guild) return;

  let moderator = "Неизвестно";
  let reason = "Причина не указана";

  try {
    const auditLogs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelDelete,
      limit: 5,
    });

    const auditEntry = auditLogs.entries.find((entry) => {
      if (entry.target?.id !== channel.id) return false;
      const timeDiff = Date.now() - entry.createdTimestamp;
      return timeDiff < 5000;
    });

    if (auditEntry) {
      moderator = `<@${auditEntry.executor?.id}> (${auditEntry.executor?.tag})`;
      reason = auditEntry.reason || "Причина не указана";
    }
  } catch (error) {
    console.error("Ошибка при получении аудита:", error);
  }

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Канал удален")
    .addFields(
      { name: "Название", value: `\`${channel.name}\``, inline: true },
      { name: "ID канала", value: `\`${channel.id}\``, inline: true },
      { name: "Тип", value: `\`${channel.type}\``, inline: true },
      { name: "Кто удалил", value: moderator, inline: true },
      { name: "Причина", value: reason, inline: true },
    )
    .setFooter({ text: `Удален: ${formatDate(Date.now())}` })
    .setTimestamp();

  await sendLogToGuild(channel.guild, embed);
}

export async function logChannelUpdate(
  client: Client,
  oldChannel: GuildChannel,
  newChannel: GuildChannel,
) {
  if (!newChannel.guild) return;

  if (oldChannel.name !== newChannel.name) {
    let moderator = "Неизвестно";
    let reason = "Причина не указана";

    try {
      const auditLogs = await newChannel.guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelUpdate,
        limit: 5,
      });

      const auditEntry = auditLogs.entries.find((entry) => {
        if (entry.target?.id !== newChannel.id) return false;
        const timeDiff = Date.now() - entry.createdTimestamp;
        return timeDiff < 5000;
      });

      if (auditEntry) {
        moderator = `<@${auditEntry.executor?.id}> (${auditEntry.executor?.tag})`;
        reason = auditEntry.reason || "Причина не указана";
      }
    } catch (error) {
      console.error("Ошибка при получении аудита:", error);
    }

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("Канал переименован")
      .addFields(
        {
          name: "Старое название",
          value: `\`${oldChannel.name}\``,
          inline: true,
        },
        {
          name: "Новое название",
          value: `\`${newChannel.name}\``,
          inline: true,
        },
        { name: "Кто изменил", value: moderator, inline: true },
        { name: "Причина", value: reason, inline: true },
        { name: "ID канала", value: `\`${newChannel.id}\``, inline: false },
      )
      .setTimestamp();

    await sendLogToGuild(newChannel.guild, embed);
  }

  if (
    "topic" in oldChannel &&
    "topic" in newChannel &&
    oldChannel.topic !== newChannel.topic
  ) {
    const oldTopic = (oldChannel as any).topic || "[Отсутствовала]";
    const newTopic = (newChannel as any).topic || "[Убрана]";
    const needsFile = shouldCreateFile(oldTopic) || shouldCreateFile(newTopic);

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("Тема канала изменена")
      .setDescription(`**Канал:** \`${newChannel.name}\``)
      .setTimestamp();

    if (needsFile) {
      embed.addFields(
        {
          name: "Предыдущая тема",
          value: oldTopic.substring(0, 512) + "\n\n*Полный текст в файле*",
          inline: false,
        },
        {
          name: "Новая тема",
          value: newTopic.substring(0, 512) + "\n\n*Полный текст в файле*",
          inline: false,
        },
      );

      const fullContent = `Предыдущая тема:\n${oldTopic}\n\nНовая тема:\n${newTopic}`;
      const attachment = createTextAttachment(
        fullContent,
        `channel_topic_${newChannel.id}.txt`,
      );
      await sendLogToGuild(newChannel.guild, embed, attachment);
    } else {
      embed.addFields(
        { name: "Предыдущая тема", value: oldTopic, inline: false },
        { name: "Новая тема", value: newTopic, inline: false },
      );
      await sendLogToGuild(newChannel.guild, embed);
    }
  }

  if (
    "permissionOverwrites" in oldChannel &&
    "permissionOverwrites" in newChannel
  ) {
    const oldPerms = oldChannel.permissionOverwrites.cache.size;
    const newPerms = newChannel.permissionOverwrites.cache.size;

    if (oldPerms !== newPerms) {
      let moderator = "Неизвестно";
      let reason = "Причина не указана";

      try {
        const auditLogs = await newChannel.guild.fetchAuditLogs({
          type: AuditLogEvent.ChannelOverwriteUpdate,
          limit: 5,
        });

        const auditEntry = auditLogs.entries.find((entry) => {
          const timeDiff = Date.now() - entry.createdTimestamp;
          return timeDiff < 5000;
        });

        if (auditEntry) {
          moderator = `<@${auditEntry.executor?.id}> (${auditEntry.executor?.tag})`;
          reason = auditEntry.reason || "Причина не указана";
        }
      } catch (error) {
        console.error("Ошибка при получении аудита:", error);
      }

      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle("Права канала изменены")
        .setDescription(`**Канал:** \`${newChannel.name}\``)
        .addFields(
          { name: "Было правил", value: `${oldPerms}`, inline: true },
          { name: "Стало правил", value: `${newPerms}`, inline: true },
          { name: "Кто изменил", value: moderator, inline: true },
          { name: "Причина", value: reason, inline: true },
          { name: "ID канала", value: `\`${newChannel.id}\``, inline: false },
        )
        .setTimestamp();

      await sendLogToGuild(newChannel.guild, embed);
    }
  }
}

export async function logMemberBan(
  client: Client,
  user: User,
  guildId: string,
  reason?: string | null,
) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  let executor: User | undefined;

  try {
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MemberBanAdd,
      limit: 5,
    });

    const auditEntry = auditLogs.entries.find(
      (entry): entry is typeof entry => {
        if (entry.target?.id !== user.id) return false;
        const timeDiff = Date.now() - entry.createdTimestamp;
        return timeDiff < 5000;
      },
    );

    if (auditEntry?.executor) {
      const fetchedUser = await client.users
        .fetch(auditEntry.executor.id)
        .catch(() => undefined);
      if (fetchedUser) {
        executor = fetchedUser;
      }
    }
  } catch (error) {
    console.error("Ошибка при получении аудита:", error);
  }

  const embed = new EmbedBuilder()
    .setColor(0xc0392b)
    .setTitle("Участник заблокирован")
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(`**Пользователь:** ${user.tag}`)
    .addFields(
      { name: "ID пользователя", value: `\`${user.id}\``, inline: true },
      {
        name: "Кто забанил",
        value: executor ? `${executor.tag} (<@${executor.id}>)` : "Неизвестно",
        inline: true,
      },
      { name: "Причина", value: reason || "Не указана", inline: true },
      { name: "Дата", value: formatDate(Date.now()), inline: true },
    )
    .setTimestamp();

  await sendLogToGuild(guild, embed);
}

export async function logMemberUnban(
  client: Client,
  user: User,
  guildId: string,
) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  let executor: User | undefined;

  try {
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MemberBanRemove,
      limit: 5,
    });

    const auditEntry = auditLogs.entries.find(
      (entry): entry is typeof entry => {
        if (entry.target?.id !== user.id) return false;
        const timeDiff = Date.now() - entry.createdTimestamp;
        return timeDiff < 5000;
      },
    );

    if (auditEntry?.executor) {
      const fetchedUser = await client.users
        .fetch(auditEntry.executor.id)
        .catch(() => undefined);
      if (fetchedUser) {
        executor = fetchedUser;
      }
    }
  } catch (error) {
    console.error("Ошибка при получении аудита:", error);
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Участник разблокирован")
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(`**Пользователь:** ${user.tag}`)
    .addFields(
      { name: "ID пользователя", value: `\`${user.id}\``, inline: true },
      {
        name: "Кто разбанил",
        value: executor ? `${executor.tag} (<@${executor.id}>)` : "Неизвестно",
        inline: true,
      },
      { name: "Дата", value: formatDate(Date.now()), inline: true },
    )
    .setTimestamp();

  await sendLogToGuild(guild, embed);
}

export async function logMemberKick(
  client: Client,
  guild: Guild,
  target: User,
  executor?: User,
  reason?: string | null,
) {
  if (!guild) return;

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Участник кикнут")
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setDescription(
      [
        `**Кикнут:** ${target.tag}`,
        `**ID:** \`${target.id}\``,
        executor
          ? `**Кто кикнул:** ${executor.tag} (<@${executor.id}>)`
          : "**Кто кикнул:** Неизвестно",
        reason ? `**Причина:** ${reason}` : "**Причина:** Не указана",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .setFooter({ text: `ID кикнутого: ${target.id}` })
    .setTimestamp();

  await sendLogToGuild(guild, embed);
}

export async function logCommand(
  client: Client,
  user: User,
  commandName: string,
  options: any,
  channelId: string,
) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  const guild =
    channel?.isTextBased() && "guild" in channel ? channel.guild : null;

  if (!guild) return;

  const optionsString = JSON.stringify(options, null, 2);
  const needsFile = shouldCreateFile(optionsString);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("Использована команда")
    .setDescription(`**Пользователь:** ${user.tag}`)
    .addFields(
      { name: "Команда", value: `\`/${commandName}\``, inline: true },
      { name: "Канал", value: `<#${channelId}>`, inline: true },
      {
        name: "Параметры",
        value: needsFile
          ? "См. вложение"
          : optionsString.substring(0, 1024) || "Без параметров",
        inline: false,
      },
    )
    .setFooter({ text: `ID: ${user.id}` })
    .setTimestamp();

  if (needsFile) {
    const attachment = createTextAttachment(
      optionsString,
      `command_${commandName}_${Date.now()}.json`,
    );
    await sendLogToGuild(guild, embed, attachment);
  } else {
    await sendLogToGuild(guild, embed);
  }
}

export async function logError(client: Client, error: Error, context?: string) {
  const Yorik = "1429367223373533285";

  try {
    const user = await client.users.fetch(Yorik);
    if (!user) return;

    const errorMessage = error.stack || error.message;
    const needsFile = shouldCreateFile(errorMessage);

    const embed = new EmbedBuilder()
      .setColor(0xc0392b)
      .setTitle("Критическая ошибка")
      .addFields(
        { name: "Контекст", value: context || "Не указан", inline: false },
        {
          name: "Сообщение ошибки",
          value: error.message.substring(0, 1024),
          inline: false,
        },
      )
      .setFooter({ text: `Произошла: ${formatDate(Date.now())}` })
      .setTimestamp();

    if (needsFile) {
      embed.addFields({
        name: "Дополнительно",
        value: "Полный стек ошибки прикреплен в виде файла",
        inline: false,
      });

      const attachment = createTextAttachment(
        errorMessage,
        `error_${Date.now()}.txt`,
      );
      await user.send({ embeds: [embed], files: [attachment] });
    } else {
      if (error.stack) {
        embed.addFields({
          name: "Стек вызовов",
          value: error.stack.substring(0, 1024),
          inline: false,
        });
      }

      await user.send({ embeds: [embed] });
    }

    console.error(`[ERROR] ${context || "No context"}:`, error);
  } catch (err) {
    console.error("Не удалось отправить ошибку в личку:", err);
    console.error("Исходная ошибка:", error);
  }
}
