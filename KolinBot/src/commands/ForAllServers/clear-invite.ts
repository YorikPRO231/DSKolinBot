import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("clear-invite")
  .setDescription("[Admin] Очистка всех приглашений на сервере")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

export async function execute(inter: ChatInputCommandInteraction) {
  if (!inter.guild) {
    return inter.reply({
      content: "Эту команду можно использовать только на сервере!",
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    const invites = await inter.guild.invites.fetch();

    if (invites.size === 0) {
      return inter.reply({
        content: "На сервере нет активных приглашений!",
        flags: MessageFlags.Ephemeral
      });
    }

    const deletePromises = invites.map((invite) => 
      invite.delete(`Очистка администратором ${inter.user.username}`).catch(() => null)
    );
    
    await Promise.allSettled(deletePromises);
    
    return inter.reply({
      content: `✅ Удалено ${invites.size} приглашений`,
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    console.error("Ошибка при очистке приглашений:", error);
    return inter.reply({
      content: "❌ Ошибка при очистке приглашений",
      flags: MessageFlags.Ephemeral
    });
  }
}