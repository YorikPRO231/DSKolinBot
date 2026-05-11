import {
  Events,
  Interaction,
  GuildMember,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  MessageActionRowComponentBuilder,
  MessageFlags
} from "discord.js";
import { setAdminSurname } from "../databases/sqlite";
import {
  handleTransferSelect,
  handleApproveButton,
  handleApproveSelect,
  handleDenyButton,
  handleDenyModal,
} from "../utils/transferUtils";
import {handleButton, handleModal} from "../utils/detectiveUtils";

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
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
            flags: MessageFlags.Ephemeral,
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

  if (interaction.isStringSelectMenu()) {
    const member = interaction.member as GuildMember;

    if (interaction.customId.startsWith("select_transfer_")) {
      await handleTransferSelect(interaction, member);
      return;
    }

    if (interaction.customId.startsWith("approve_as_")) {
      await handleApproveSelect(interaction, member);
      return;
    }

    return;
  }

  if (interaction.isButton()) {
    try {
      const member = interaction.member as GuildMember;

      if (interaction.customId.startsWith("twink_")) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

      if (interaction.customId.startsWith("tr_approve_")) {
        await handleApproveButton(interaction, member);
        return;
      }

      if (interaction.customId.startsWith("tr_deny_")) {
        await handleDenyButton(interaction, member);
        return;
      }

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

      if (interaction.customId.startsWith('dnames')) {
        const member = interaction.member as GuildMember;
        if (!member || !(member instanceof GuildMember)) {
          return interaction.reply({
            content: 'Не удалось получить данные участника.',
            flags: MessageFlags.Ephemeral
          });
        }
        await handleButton(interaction, member);
        return;
      }
    } catch (error) {
      console.error("Ошибка при обработке кнопки:", error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Произошла ошибка при обработке кнопки!",
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (e) {
        console.error("Не удалось отправить ошибку:", e);
      }
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    try {
      const member = interaction.member as GuildMember;

      if (interaction.customId === "admin_registration") {
        const surname = interaction.fields.getTextInputValue("surname_input");
        setAdminSurname(interaction.user.id, surname);
        await interaction.reply({
          content: `Вы успешно зарегистрированы под фамилией **${surname}**.\nТеперь введите команду \`/добавить-лог\` еще раз.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.customId.startsWith("deny_modal_")) {
        await handleDenyModal(interaction, member);
        return;
      }
      
      if (interaction.customId.startsWith('dnames_')) {
        await handleModal(interaction, member)
        return;
      }
    } catch (error) {
      console.error("Ошибка при обработке модального окна:", error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Произошла ошибка при обработке данных!",
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (e) {
        console.error("Не удалось отправить ошибку:", e);
      }
    }
    return;
  }
}