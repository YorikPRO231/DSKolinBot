import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { bindingsManager } from "../../utils/bindingsManager";
import { extractFormId } from "../../utils/fileUtils";

export const data = new SlashCommandBuilder()
  .setName("remove-bind")
  .setDescription("[Admin] Удаляет привязку гугл формы")
  .addStringOption((opt) =>
    opt
      .setName("form-id")
      .setRequired(true)
      .setDescription("Ссылка/id гугл формы для удаления"),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(inter: ChatInputCommandInteraction) {
  await inter.deferReply();
  const formData = inter.options.getString("form-id", true);
  const formId = extractFormId(formData);
  const data = bindingsManager.getBinding(formId);
  if (!data) {
    return inter.editReply({
      content: `Не удалось обнаружить данные по указанному formID ${formId}. Проверьте введенные данные`,
    });
  }
  try {
    bindingsManager.removeBinding(data.formId);
    return inter.editReply({
      content: `Привязка формы ${data.formName} ${formId} была успешно удалена!`,
    });
  } catch (e) {
    return inter.editReply({
      content: `Ошибка удаления формы ${formId}. Обратитесь к администрации проекта. `,
    });
  }
}
