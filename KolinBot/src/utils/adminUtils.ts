import { 
  GuildMember, 
  MessageFlags, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  MessageActionRowComponentBuilder,
  EmbedBuilder 
} from "discord.js";
import { setAdminSurname } from "../databases/sqlite";

export async function handleTwinkKick(interaction: any) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const [, memberId, serverId] = interaction.customId.split("_");
  const guild = interaction.client.guilds.cache.get(serverId);

  if (!guild) return interaction.editReply("Сервер не найден.");

  try {
    const targetMember = await guild.members.fetch(memberId).catch(() => null);
    if (!targetMember?.kickable) return interaction.editReply("Игрок не найден или его нельзя кикнуть.");

    const adminName = (interaction.member as GuildMember)?.displayName || interaction.user.username;
    await targetMember.kick(`Админ: ${adminName} [${interaction.user.id}] Причина: твинк`);

    const newRows = interaction.message.components.map((row: any) => {
      const actionRow = ActionRowBuilder.from<MessageActionRowComponentBuilder>(row);
      actionRow.components.forEach((btn: any) => {
        if (btn.data.custom_id === interaction.customId) {
          btn.setStyle(ButtonStyle.Success).setDisabled(true);
        }
      });
      return actionRow;
    });

    await interaction.message.edit({ components: newRows });
    return interaction.editReply(`Игрок <@${memberId}> кикнут.`);
  } catch (e) {
    return interaction.editReply("Ошибка при кике.");
  }
}

export async function handleAdminRegistration(interaction: any) {
  const surname = interaction.fields.getTextInputValue("surname_input");
  setAdminSurname(interaction.user.id, surname);
  await interaction.reply({
    content: `Зарегистрирован как **${surname}**. Введите команду снова.`,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleCheckSystem(interaction: any) {
  const oldEmbed = interaction.message.embeds[0];
  if (!oldEmbed) return;

  const isApprove = interaction.customId === "check_approve";
  const newEmbed = EmbedBuilder.from(oldEmbed)
    .setTitle(isApprove ? "Запрос проверен" : "Нарушений не обнаружено")
    .setColor(isApprove ? "Green" : "Grey")
    .addFields({
      name: "Результат",
      value: `Проверил: ${interaction.user}\nСтатус: ${isApprove ? "Нарушение подтверждено" : "Игрок чист"}`,
    });

  await interaction.update({ embeds: [newEmbed], components: [] });
}