// src/commands/ForAllServers/configureBind.ts
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder,
    ChannelType
} from 'discord.js';
import { bindingsManager } from '../../utils/bindingsManager';

function extractFormId(input: string): string {
    input = input.trim();
    
    if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) return input;
    
    const match1 = input.match(/\/d\/e\/([a-zA-Z0-9_-]+)\//);
    if (match1) return match1[1];
    
    const match2 = input.match(/\/d\/([a-zA-Z0-9_-]+)\//);
    if (match2) return match2[1];
    
    const match3 = input.match(/\/d\/([a-zA-Z0-9_-]+)$/);
    if (match3) return match3[1];
    
    return input;
}

export const data = new SlashCommandBuilder()
    .setName('configure-bind')
    .setDescription('Настроить привязку Google Form к каналу')
    .addStringOption(option =>
        option.setName('form_id')
            .setDescription('ID Google Form или ссылка на форму')
            .setRequired(true)
    )
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Канал для отправки ответов')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
    )
    .addRoleOption(option =>
        option.setName('ping_role')
            .setDescription('Роль для пинга при новом ответе')
            .setRequired(false)
    )
    .addStringOption(option =>
        option.setName('form_name')
            .setDescription('Название формы (для удобства)')
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const inputFormId = interaction.options.getString('form_id', true);
        const channel = interaction.options.getChannel('channel', true);
        const pingRole = interaction.options.getRole('ping_role');
        const formName = interaction.options.getString('form_name') ?? undefined;
        
        const formId = extractFormId(inputFormId);

        const binding = bindingsManager.addBinding(
            formId, 
            channel.id, 
            interaction.guildId!, 
            formName,
            pingRole?.id
        );

        const serverUrl = process.env.FORMS_SERVER_URL || `http://localhost:${process.env.FORMS_SERVER_PORT || 3000}`;
        const formUrl = `https://docs.google.com/forms/d/${formId}/viewform`;

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('Привязка настроена')
            .setDescription(`Google Form привязана к ${channel}`)
            .addFields(
                {
                    name: 'Информация',
                    value: [
                        `**Название:** ${binding.formName}`,
                        `**Form ID:** \`${binding.formId}\``,
                        `**Канал:** ${channel}`,
                        `**Пинг роли:** ${pingRole ? `<@&${pingRole.id}>` : 'Не настроен'}`,
                        `**Ссылка:** [Открыть форму](${formUrl})`
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Google Forms Integration' })
            .setTimestamp();

        const appsScriptCode = `
\`\`\`javascript
function onFormSubmit(e) {
  const form = FormApp.getActiveForm();
  const itemResponses = e.response.getItemResponses();
  const answers = {};
  
  itemResponses.forEach(itemResponse => {
    answers[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  });
  
  UrlFetchApp.fetch('${serverUrl}/webhook/form-response', {
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

function setupTrigger() {
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(FormApp.getActiveForm())
    .onFormSubmit()
    .create();
}
\`\`\`
        `;

        await interaction.editReply({ embeds: [embed] });
        await interaction.followUp({ 
            content: `**Инструкция по настройке:**\n1. Откройте Google Form\n2. Расширения → Apps Script\n3. Вставьте код ниже\n4. Запустите \`setupTrigger()\`\n5. Сохраните и авторизуйте\n\n${appsScriptCode}`,
            ephemeral: true 
        });

    } catch (error) {
        console.error('Error in configure-bind:', error);
        await interaction.editReply({
            content: '❌ Произошла ошибка при настройке привязки'
        });
    }
}