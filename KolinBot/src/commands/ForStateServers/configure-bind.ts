import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
  MessageFlags
} from "discord.js";
import { bindingsManager } from "../../utils/bindingsManager";
import { extractFormId } from "../../utils/fileUtils"

export const data = new SlashCommandBuilder()
  .setName("configure-bind")
  .setDescription("Настроить привязку Google Form к каналу")
  .addStringOption((option) =>
    option
      .setName("ссылка")
      .setDescription("ID Google Form или ссылка на форму")
      .setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName("канал")
      .setDescription("Канал для отправки ответов")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  )
  .addRoleOption((option) =>
    option
      .setName("роль1")
      .setDescription("Первая роль для пинга")
      .setRequired(false),
  )
  .addRoleOption((option) =>
    option
      .setName("роль2")
      .setDescription("Вторая роль для пинга")
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("название")
      .setDescription("Название формы (для удобства)")
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral});

  try {
    const inputFormId = interaction.options.getString("ссылка", true);
    const channel = interaction.options.getChannel("канал", true);
    const pingRole1 = interaction.options.getRole("роль1");
    const pingRole2 = interaction.options.getRole("роль2");
    const formName = interaction.options.getString("название") ?? undefined;

    const formId = extractFormId(inputFormId);

    const role1Id = pingRole1?.id;
    const role2Id = pingRole2?.id;

    const binding = bindingsManager.addBinding(
      interaction.user.id,
      formId,
      channel.id,
      interaction.guildId!,
      formName,
      role1Id,
      role2Id,
    );

    const pingRolesText = [pingRole1, pingRole2]
      .filter(role => role !== null)
      .map(role => `<@&${role!.id}>`)
      .join(", ");


    const formUrl = `https://docs.google.com/forms/d/${formId}/viewform`;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("Привязка настроена")
      .setDescription(`Google Form привязана к ${channel}`)
      .addFields({
        name: "Информация",
        value: [
          `**Название:** ${binding.formName}`,
          `**Form ID:** \`${binding.formId}\``,
          `**Канал:** ${channel}`,
          `**Пинг ролей:** ${pingRolesText || "Не настроены"}`,
          `**Ссылка:** [Открыть форму](${formUrl})`,
        ].join("\n"),
        inline: false,
      })
      .setFooter({ text: "Google Forms Integration" })
      .setTimestamp();

    const appsScriptCode = `
\`\`\`javascript
(function() {
  const triggers = ScriptApp.getProjectTriggers();
  const hasTrigger = triggers.some(t => t.getHandlerFunction() === 'onFormSubmit');
  
  if (!hasTrigger) {
    ScriptApp.newTrigger('onFormSubmit')
      .forForm(FormApp.getActiveForm())
      .onFormSubmit()
      .create();
  }
})();

function onFormSubmit(e) {
  const form = FormApp.getActiveForm();
  const itemResponses = e.response.getItemResponses();
  const answers = {};
  
  itemResponses.forEach(itemResponse => {
    answers[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  });
  
  UrlFetchApp.fetch('http://186.246.44.55:8080/webhook/form-response', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      formId: "${formId}",
      formTitle: form.getTitle(),
      answers: answers,
      timestamp: new Date().toISOString(),
      respondentEmail: e.response.getRespondentEmail()
    }),
    muteHttpExceptions: true
  });
}
\`\`\`
        `;

    await interaction.editReply({ embeds: [embed] });
    await interaction.followUp({ 
            content: `**Инструкция по настройке:**\n1. Откройте Google Form\n2. Расширения → Apps Script\n3. Вставьте код ниже\n4. Запустите через кнопку выполнить\`setupTrigger()\`\n5. Сохраните и авторизуйте\n6. Отправьте несколько тестовых запросов (2-3шт)\n\n${appsScriptCode}`,
            flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    console.error("Error in configure-bind:", error);
    await interaction.editReply({
      content: "❌ Произошла ошибка при настройке привязки",
    });
  }
}