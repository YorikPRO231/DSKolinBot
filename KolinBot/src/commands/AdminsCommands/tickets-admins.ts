import { 
    EmbedBuilder, 
    ChatInputCommandInteraction, 
    SlashCommandBuilder,
    MessageFlags
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName("запрос-старшим")
    .setDescription("Отправить запрос старшей администрации")
    .addStringOption(option => 
        option.setName('тип')
            .setDescription('Выберите тип запроса')
            .setRequired(true)
            .addChoices(
                { name: 'Проверить на обход', value: 'Обход' },
                { name: 'Запросить манилоги', value: 'Манилоги' },
                { name: 'Другое', value: 'Другое' }
            ))
    .addStringOption(option => 
        option.setName('суть')
            .setDescription('Опишите суть запроса (пример: манилоги Yorik_Holmes за неделю)') 
            .setRequired(true))
    .addAttachmentOption(option => 
        option.setName('скриншот')
            .setDescription('Прикрепите скриншот или видео')
            .setRequired(false));
    

export async function execute(interaction: ChatInputCommandInteraction) {
    const type = interaction.options.getString('тип');
    const description = interaction.options.getString('суть');
    const image = interaction.options.getAttachment('скриншот');
    
    const TARGET_CHANNEL_ID = '1316831634376364055';
    const SENIOR_ROLE_ID = '1316831633554542670'; 

    const channel = interaction.guild?.channels.cache.get(TARGET_CHANNEL_ID);
    if (!channel?.isTextBased()) return interaction.reply({ content: 'Канал не найден.', flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Новый запрос старшим')
        .setAuthor({ 
                        name: `${interaction.user.displayName}`, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
        .addFields(
            { name: 'Отправитель', value: `${interaction.user} (ID: ${interaction.user.id})`, inline: false },
            { name: 'Тип запроса', value: type!, inline: false },
            { name: 'Описание', value: description! }
        )
        .setFooter({ text: `User ID: ${interaction.user.id} | Blackberry System` })
        .setTimestamp();

    if (image) embed.setImage(image.url);

    const sentMessage = await channel.send({ 
        content: `<@&${SENIOR_ROLE_ID}>`, 
        embeds: [embed] 
    });

    await interaction.reply({ content: '✅ Ваш запрос успешно отправлен старшим.', flags: MessageFlags.Ephemeral });
}