import {
    ActionRowBuilder,
    ButtonInteraction,
    ButtonStyle,
    EmbedBuilder,
    GuildMember,
    MessageActionRowComponentBuilder,
    MessageFlags
} from "discord.js";
import { AdminsRepository } from "../databases/index";

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

export async function handleNickKick(inter: ButtonInteraction, member: GuildMember) {
    await inter.deferReply({flags: MessageFlags.Ephemeral});
    const parts = inter.customId.split('_');
    const mid = parts[1]
    if (!inter.guild) {
        return inter.editReply({content: 'Сервер не найден. '});
    }
    try {
        const targetMember = await inter.guild.members.fetch(mid).catch(() => null);
        if (!targetMember?.kickable) return inter.editReply("Игрок не найден или его нельзя кикнуть.");
        const adminName = (inter.member as GuildMember)?.displayName || inter.user.username;
        const kickEmbed = new EmbedBuilder()
          .setTitle(`GTA 5 RP | ${inter.guild?.name}`)
          .setTimestamp()
          .setColor(0xb8001c)
          .setDescription(
            `Вы были удалены из дискорда ${inter.guild?.name} администратором ${adminName}, так как ваш ник не соответствует форме никнеймов.\n`,
          );
        await targetMember.user.send({ embeds: [kickEmbed] }).catch(() => {
          console.warn(
            `Не удалось отправить ЛС пользователю ${targetMember.user.tag}`,
          );
        });
        await targetMember.kick(`Админ: ${adminName} [${inter.user.id}] Причина: check-nicknames`);
        const actionRow = ActionRowBuilder.from<MessageActionRowComponentBuilder>(inter.message.components[0] as any);
        actionRow.components.forEach((btn: any) => {
            if (btn.data.custom_id === inter.customId) {
                btn.setStyle(ButtonStyle.Success).setDisabled(true);
            }
        });

        await inter.message.edit({components: [actionRow]});
        return inter.editReply(`Игрок <@${mid}> кикнут.`);
    } catch (e) {
        return inter.editReply("Ошибка при кике.");
    }
}

export async function handleAdminRegistration(interaction: any) {
  const surname = interaction.fields.getTextInputValue("surname_input");
  AdminsRepository.setAdminSurname(interaction.user.id, surname);
  await interaction.reply({
    content: `Зарегистрирован как **${surname}**. Введите команду снова.`,
    flags: MessageFlags.Ephemeral,
  });
}