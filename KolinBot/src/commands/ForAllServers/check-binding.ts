import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { bindingsManager } from "../../utils/bindingsManager";

export const data = new SlashCommandBuilder()
  .setName("check-binds")
  .setDescription(
    "[Admin] Вывести полный список всех привязанных форм к данному серверу.",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(inter: ChatInputCommandInteraction) {
  await inter.deferReply();
  const guildId = inter.guild?.id;
  if (!guildId) {
    return inter.editReply({
      content:
        "Не удалось загрузить данные. Обратитесь к курирующей администрации.",
    });
  }
  const data = bindingsManager.getGuildBindings(guildId);
  const embed = new EmbedBuilder()
    .setTitle("Список привязанных форм")
    .setColor(Colors.Aqua);
  data.forEach((b) => {
    embed.addFields({
      name: `Форма #${b.formId} (${b.formName}`,
      value: `Привязана к <#${b.channelId}>\nСоздана: ${b.createdAt}\nПинги: ${b.pingRoleId || "Отсутствуют"}`,
    });
  });
  return inter.editReply({ embeds: [embed] });
}
