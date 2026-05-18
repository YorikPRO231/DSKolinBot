import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {addSecurityRequest} from '../../databases/sqlite'

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
    await interaction.deferReply({ flags: 'Ephemeral' });
    
    try {
        const target = interaction.options.getString('адресат');
        const staticId = interaction.options.getString('статик');
        const reason = interaction.options.getString('причина');
        const video = interaction.options.getString('видео');

        const urlPattern = /^(https?:\/\/)[^\s$.?#].[^\s]*$/i;

        if (!urlPattern.test(video!)) {
            return interaction.editReply({ 
                content: '❌ Ошибка: В поле "видео" должна быть указана прямая ссылка (начинающаяся с http:// или https://).'
            });
        }
        
        try {
            addSecurityRequest(staticId!, interaction.user.id, reason!, video!);
        } catch (error) {
            console.error('Ошибка при записи запроса в БД:', error);
        }

        const CONFIG = {
            bots: { channelId: '1400796902559322193', roleId: '1401249757904633856', color: 0xFEE75C },
            cheats: { channelId: '1400796902559322193', roleId: '1401249725499576361', color: 0xED4245 }
        };

        const selected = target === 'bots' ? CONFIG.bots : CONFIG.cheats;
        const channel = interaction.guild?.channels.cache.get(selected.channelId);

        if (!channel?.isTextBased()) {
            return interaction.editReply({ content: '❌ Ошибка: Канал для отправки не найден.' });
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
<<<<<<< HEAD


        await channel.send({ 
            content: `<@&${selected.roleId}>`, 
=======
        await channel.send({ 
            content: `<@&${selected.roleId}>`,
>>>>>>> dd425c6dae134013772a334dd7dbc861047be186
            embeds: [embed]
        });

        await interaction.editReply({ content: '✅ Запрос отправлен и занесен в базу данных.' });
        
    } catch (error) {
        console.error('Ошибка в команде:', error);
        throw error; 
    }
}