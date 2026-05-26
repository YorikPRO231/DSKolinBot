import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags
} from "discord.js";

export const factions = ['check']
export const data = new SlashCommandBuilder()
  .setName("запрос-мп")
  .setDescription("Запрос на выдачу для мероприятия");

export async function execute(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("mpRequestModal")
    .setTitle("Запрос на выдачу для мероприятия");

  const essenceInput = new TextInputBuilder()
    .setCustomId("essence")
    .setLabel("Требования к администрации")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Опишите, что вам необходимо выдать...")
    .setRequired(true)
    .setMaxLength(1500);

  const authorIdInput = new TextInputBuilder()
    .setCustomId("authorId")
    .setLabel("ID автора запроса")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Введите ваш ID или никнейм")
    .setRequired(true)
    .setMaxLength(100);

  const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    essenceInput,
  );
  const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    authorIdInput,
  );

  modal.addComponents(firstRow, secondRow);

  await interaction.showModal(modal);

  const filter = (i: any) =>
    i.customId === "mpRequestModal" && i.user.id === interaction.user.id;
  const submitted = await interaction
    .awaitModalSubmit({ filter, time: 300000 })
    .catch(() => null);

  if (!submitted) return;

  const essence = submitted.fields.getTextInputValue("essence");
  const authorId = submitted.fields.getTextInputValue("authorId");
  const author = submitted.user;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`ЗАПРОС НА МЕРОПРИЯТИЕ | ${interaction.guild?.name}`)
    .addFields(
      {
        name: "Запрос",
        value: essence,
        inline: false,
      },
      {
        name: "ID автора запроса",
        value: authorId,
        inline: true,
      },
      {
        name: "Отправитель",
        value: `${author.username} (${author.id})`,
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter({ text: "Запрос на мероприятие" });

  const discordChannelId = process.env.DISCORD_MP_CHANNEL_ID || "";
  const discordChannel = submitted.guild?.channels.cache.get(discordChannelId);

  if (discordChannel?.isTextBased()) {
    await discordChannel.send({ embeds: [embed] });
  }

  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_MP_CHAT_ID;

  if (telegramBotToken && telegramChatId) {
    const dateStr = new Date().toLocaleString("ru-RU", {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const telegramMessage = [
        `<b>НОВЫЙ ЗАПРОС НА МЕРОПРИЯТИЕ | ${interaction.guild?.name}</b>`,
        `────────────────────`,
        `<b>Отправитель:</b> ${author.username} <code>(${author.id})</code>`,
        `<b>ID в игре:</b> <code>${authorId}</code>`,
        `<b>Время:</b> ${dateStr}`,
        ``,
        `<b>ТРЕБОВАНИЯ:</b>`,
        `<blockquote>${essence}</blockquote>`,
    ].join('\n');

    try {
        await fetch(
            `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: telegramChatId,
                    text: telegramMessage,
                    parse_mode: "HTML",
                    disable_web_page_preview: true,
                }),
            }
        );
    } catch (error) {
        console.error("Telegram send error:", error);
    }
}

  await submitted.reply({
    content: "Ваш запрос на мероприятие успешно отправлен.",
    flags: MessageFlags.Ephemeral,
  });
}
