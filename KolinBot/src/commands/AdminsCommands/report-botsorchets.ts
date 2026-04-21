import { 
    EmbedBuilder, 
    ChatInputCommandInteraction, 
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} from 'discord.js';
import { addSecurityRequest } from '../../databases/sqlite'

export const data = new SlashCommandBuilder()
    .setName("запрос-проверки")
    .setDescription("Создать запрос на проверку игрока")
    .addStringOption(option =>
        option.setName('адресат')
            .setDescription('Кому адресован запрос')
            .setRequired(true)
            .addChoices(
                { name: 'Bots', value: 'bots' },
                { name: 'Cheats', value: 'cheats' }
            ))
    .addStringOption(option =>
        option.setName('статик')
            .setDescription('Статик проверяемого')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('причина')
            .setDescription('Причина запроса на проверку')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('видео')
            .setDescription('Ссылка на видео-доказательство')
            .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getString('адресат');
    const staticId = interaction.options.getString('статик');
    const reason = interaction.options.getString('причина');
    const video = interaction.options.getString('видео');

    const urlPattern = /^(https?:\/\/)[^\s$.?#].[^\s]*$/i;

    if (!urlPattern.test(video!)) {
        return interaction.reply({ 
            content: '❌ Ошибка: В поле "видео" должна быть указана прямая ссылка (начинающаяся с http:// или https://).', 
            ephemeral: true 
        });
    }
    
    try {
        addSecurityRequest(staticId!, interaction.user.id, reason!, video!);
    } catch (error) {
        console.error('Ошибка при записи запроса в БД:', error);
    }

    const CONFIG = {
        bots: { channelId: '1494095206994411731', roleId: '1486138193697964042', color: 0xFEE75C },
        cheats: { channelId: '1494095206994411731', roleId: '1486138193697964042', color: 0xED4245 }
    };

    const selected = target === 'bots' ? CONFIG.bots : CONFIG.cheats;
    const channel = interaction.guild?.channels.cache.get(selected.channelId);

    if (!channel?.isTextBased()) {
        return interaction.reply({ content: 'Ошибка: Канал для отправки не найден.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setColor(selected.color)
        .setTitle(`Запрос на проверку [${target?.toUpperCase()}]`)
        .addFields(
            { name: 'Статик игрока', value: staticId!, inline: false },
            { name: 'Запросил', value: `${interaction.user}`, inline: false },
            { name: 'Причина', value: reason! },
            { name: 'Доказательства', value: video! }
        )
        .setTimestamp()
        .setFooter({ text: `User ID: ${interaction.user.id} | Blackberry Security` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('check_approve')
            .setLabel('Нарушение обнаружено')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('check_deny')
            .setLabel('Чист')
            .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ 
        content: `<@&${selected.roleId}>`, 
        embeds: [embed],
        components: [row]
    });

    await interaction.reply({ content: '✅ Запрос отправлен и занесен в базу данных.', ephemeral: true });
}