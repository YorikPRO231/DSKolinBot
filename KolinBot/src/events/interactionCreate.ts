import {
  Events,
  Interaction,
  GuildMember
} from "discord.js";
import { setAdminSurname } from "../databases/sqlite";
import { 
  handleTransferSelect, 
  handleApproveButton, 
  handleApproveSelect, 
  handleDenyButton, 
  handleDenyModal 
} from "../utils/transferUtils";

const ADMIN_ROLES = ["1495186421345161456", "ID_ROLE_2"];

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
  // --- ОБРАБОТКА СЛЭШ-КОМАНД ---
  if (interaction.isChatInputCommand()) {
    const command = (interaction.client as any).commands.get(interaction.commandName);

    if (!command) {
      console.log(`Команда ${interaction.commandName} не найдена`);
      return;
    }

    try {
      await command.execute(interaction);
      console.log(`Выполнена команда: ${interaction.commandName}`);
    } catch (error) {
      console.error(`Ошибка в команде ${interaction.commandName}:`, error);
      const errorMessage = error instanceof Error ? error.message : "Произошла ошибка при выполнении команды";
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `Ошибка: ${errorMessage}`, ephemeral: true });
        } else if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({ content: `Ошибка: ${errorMessage}` });
        }
      } catch (replyError) {
        console.error("Не удалось отправить сообщение об ошибке:", replyError);
      }
    }
    return;
  }

  // --- ОБРАБОТКА SELECT MENU ---
  if (interaction.isStringSelectMenu()) {
    const member = interaction.member as GuildMember;

    // Выбор фракции/персонажа для перевода
    if (interaction.customId.startsWith("select_transfer_")) {
      await handleTransferSelect(interaction, member);
      return;
    }

    // Выбор фракции при одобрении (если пользователь в двух фракциях)
    if (interaction.customId.startsWith("approve_as_")) {
      await handleApproveSelect(interaction, member);
      return;
    }

    return;
  }

  // --- ОБРАБОТКА КНОПОК ---
  if (interaction.isButton()) {
    try {
      const member = interaction.member as GuildMember;
      const hasRole = member?.roles?.cache?.some((r: any) => ADMIN_ROLES.includes(r.id));

      // --- ТВИНКИ ---
      if (interaction.customId.startsWith("twink_")) {
        const twinkData = interaction.customId.split("_");
        const memberId = twinkData[1];
        const serverId = twinkData[2];
        const guild = interaction.client.guilds.cache.get(serverId);
        const targetMember = guild?.members?.cache.get(memberId);

        if (!targetMember) {
          return interaction.reply({
            content: "Игрок не был найден в указанном дискорде.",
            ephemeral: true,
          });
        }

        try {
          await guild?.members.kick(targetMember, `Кикнут администратором ${interaction.user.id}`);

          const originalMessage = interaction.message;
          const newRows: any[] = [];

          for (const row of originalMessage.components) {
            const ActionRowBuilder = require('discord.js').ActionRowBuilder;
            const ButtonBuilder = require('discord.js').ButtonBuilder;
            const ButtonStyle = require('discord.js').ButtonStyle;
            
            const actionRow = new ActionRowBuilder();
            if (row.type === 1) {
              for (const button of row.components) {
                const newButton = ButtonBuilder.from(button);
                if (button.customId === interaction.customId) {
                  newButton.setStyle(ButtonStyle.Success);
                  newButton.setDisabled(true);
                }
                actionRow.addComponents(newButton);
              }
              newRows.push(actionRow);
            }
          }

          await originalMessage.edit({ components: newRows });
          return interaction.reply({
            content: `Игрок <@${memberId}> был успешно кикнут из ${guild?.name}`,
            ephemeral: true,
          });
        } catch (error) {
          console.error(`Ошибка при кике:`, error);
          return interaction.reply({
            content: "Произошла ошибка при попытке кикнуть игрока.",
            ephemeral: true,
          });
        }
      }

      // Проверка прав для кнопок переводов
      if (!hasRole && interaction.customId.startsWith("tr_")) {
        return interaction.reply({
          content: "У вас нет прав для использования этой кнопки.",
          ephemeral: true,
        });
      }

      // --- КНОПКА ОДОБРИТЬ ПЕРЕВОД ---
      if (interaction.customId.startsWith("tr_approve_")) {
        await handleApproveButton(interaction, member);
        return;
      }

      // --- КНОПКА ОТКЛОНИТЬ ПЕРЕВОД ---
      if (interaction.customId.startsWith("tr_deny_")) {
        await handleDenyButton(interaction, member);
        return;
      }

      // --- КНОПКИ ПРОВЕРОК ---
      if (interaction.customId === "check_approve" || interaction.customId === "check_deny") {
        const oldEmbed = interaction.message.embeds[0];
        if (!oldEmbed) return;

        const EmbedBuilder = require('discord.js').EmbedBuilder;
        const newEmbed = EmbedBuilder.from(oldEmbed);

        if (interaction.customId === "check_approve") {
          newEmbed
            .setTitle("Запрос проверен")
            .setColor("Green")
            .addFields({
              name: "Результат",
              value: `Проверил: ${interaction.user}\nСтатус: Нарушение подтверждено`,
            });
        } else {
          newEmbed
            .setTitle("Нарушений не обнаружено")
            .setColor("Grey")
            .addFields({
              name: "Результат",
              value: `Проверил: ${interaction.user}\nСтатус: Игрок чист`,
            });
        }

        await interaction.update({ embeds: [newEmbed], components: [] });
        return;
      }
    } catch (error) {
      console.error("Ошибка при обработке кнопки:", error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Произошла ошибка при обработке кнопки!",
            ephemeral: true,
          });
        }
      } catch (e) {
        console.error("Не удалось отправить ошибку:", e);
      }
    }
    return;
  }

  // --- ОБРАБОТКА МОДАЛЬНЫХ ОКОН ---
  if (interaction.isModalSubmit()) {
    try {
      const member = interaction.member as GuildMember;

      if (interaction.customId === "admin_registration") {
        const surname = interaction.fields.getTextInputValue("surname_input");
        setAdminSurname(interaction.user.id, surname);
        await interaction.reply({
          content: `Вы успешно зарегистрированы под фамилией **${surname}**.\nТеперь введите команду \`/добавить-лог\` еще раз.`,
          ephemeral: true,
        });
        return;
      }

      if (interaction.customId.startsWith("deny_modal_")) {
        await handleDenyModal(interaction, member);
        return;
      }
    } catch (error) {
      console.error("Ошибка при обработке модального окна:", error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Произошла ошибка при обработке данных!",
            ephemeral: true,
          });
        }
      } catch (e) {
        console.error("Не удалось отправить ошибку:", e);
      }
    }
    return;
  }
}