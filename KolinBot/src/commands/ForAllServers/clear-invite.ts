import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("clear-invite")
  .setDescription("[Admin] Очистка всех приглашений на сервере")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

export async function execute(inter: ChatInputCommandInteraction) {
  await inter.deferReply();

  if (!inter.guild) {
    return inter.reply({
      content: "Эту команду можно использовать только на сервере!",
      ephemeral: true,
    });
  }

  try {
    const invites = await inter.guild.invites.fetch();

    if (invites.size === 0) {
      return inter.editReply({
        content: "На сервере нет активных приглашений!",
      });
    }

    const results = await Promise.allSettled(
      invites.map((invite) =>
        invite.delete(`Очистка администратором ${inter.user.username}`),
      ),
    );
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    let response = `Успешно удалено: ${successful} из ${invites.size} приглашений`;
    if (failed > 0) {
      response += `\nНе удалось удалить: ${failed} приглашений`;
    }
    return inter.editReply({ content: response });
  } catch (error) {
    console.error("Ошибка при очистке приглашений:", error);
    return inter.editReply({
      content:
        "❌ Произошла ошибка при очистке приглашений. Проверьте логи бота.",
    });
  }
}
