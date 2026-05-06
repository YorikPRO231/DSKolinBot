import {
  Events,
  Interaction,
  GuildMember,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  MessageActionRowComponentBuilder,
} from "discord.js";
import { setAdminSurname } from "../databases/sqlite";
import {
  handleTransferSelect,
  handleApproveButton,
  handleApproveSelect,
  handleDenyButton,
  handleDenyModal,
} from "../utils/transferUtils";

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
  // --- ОБРАБОТКА СЛЭШ-КОМАНД ---
  if (interaction.isChatInputCommand()) {
    const command = (interaction.client as any).commands.get(
      interaction.commandName,
    );

    if (!command) {
      console.log(`Команда ${interaction.commandName} не найдена`);
      return;
    }

    try {
      await command.execute(interaction);
      console.log(`Выполнена команда: ${interaction.commandName}`);
    } catch (error) {
      console.error(`Ошибка в команде ${interaction.commandName}:`, error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Произошла ошибка при выполнении команды";
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `Ошибка: ${errorMessage}`,
            ephemeral: true,
          });
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

      // --- ТВИНКИ ---
      if (interaction.customId.startsWith("twink_")) {
        await interaction.deferReply({ ephemeral: true });

        const [, memberId, serverId] = interaction.customId.split("_");
        const guild = interaction.client.guilds.cache.get(serverId);

        if (!guild) {
          return interaction.editReply({ content: "Сервер не найден." });
        }

        try {
          const targetMember = await guild.members
            .fetch(memberId)
            .catch(() => null);

          if (!targetMember) {
            return interaction.editReply({
              content: "Игрок не найден на сервере.",
            });
          }

          if (!targetMember.kickable) {
            return interaction.editReply({
              content: "У бота недостаточно прав для кика.",
            });
          }

          const adminName = (interaction.member as GuildMember)?.displayName || interaction.user.username;
          await targetMember.kick(`Админ: ${adminName} [${interaction.user.id}] Причина: твинк`);

          const originalMessage = interaction.message;

          const newRows = originalMessage.components.map((row) => {
            const actionRow =
              ActionRowBuilder.from<MessageActionRowComponentBuilder>(
                row as any,
              );

            actionRow.components.forEach((component) => {
              if (component instanceof ButtonBuilder) {
                const data = component.data as any;
                if (data.custom_id === interaction.customId) {
                  component.setStyle(ButtonStyle.Success);
                  component.setDisabled(true);
                }
              }
            });

            return actionRow;
          });

          await originalMessage.edit({ components: newRows });

          return interaction.editReply({
            content: `Игрок <@${memberId}> успешно кикнут из **${guild.name}**`,
          });
        } catch (error) {
          console.error(error);
          return interaction.editReply({
            content: "Ошибка при выполнении кика.",
          });
        }
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
      if (
        interaction.customId === "check_approve" ||
        interaction.customId === "check_deny"
      ) {
        const oldEmbed = interaction.message.embeds[0];
        if (!oldEmbed) return;

        const EmbedBuilder = require("discord.js").EmbedBuilder;
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
