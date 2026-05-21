import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {SecurityRepository} from '../../databases'

export const data = new SlashCommandBuilder()
    .setName("запрос-проверки")
    .setDescription("Создать запрос на проверку игрока")
    .addStringOption(option =>
        option.setName('адресат')
            .setDescription('Кому адресован запрос')
            .setRequired(true)
            .addChoices(
                { name: 'Bots', value: 'Bots' },
                { name: 'Cheats', value: 'Cheats' }
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
            .setDescription('Ссылка на видео-доказательство'));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: 'Ephemeral' });
    
    try {
        const target = interaction.options.getString('адресат', true);
        const staticId = interaction.options.getString('статик', true);
        const reason = interaction.options.getString('причина', true);
        const video = interaction.options.getString('видео');
        
        if (video) {
            const urlPattern = /^(https?:\/\/)[^\s$.?#].[^\s]*$/i;
            if (!urlPattern.test(video)) {
                return interaction.editReply({
                    content: '❌ Ошибка: В поле "видео" должна быть указана прямая ссылка (начинающаяся с http:// или https://).'
                });
            }
        }
        
        const requestText = `Запрос от админов: ${reason}${video ? `\nВидео: ${video}` : ''}`;
        
        try {
            SecurityRepository.addSecurityRequest(
                target,
                interaction.user.id,
                requestText,
                staticId
            );
        } catch (error) {
            console.error('Ошибка при записи запроса в БД:', error);
            return interaction.editReply({ content: '❌ Ошибка при сохранении запроса в базу данных.' });
        }

        const CONFIG = {
            Bots: { channelId: '1400796902559322193', roleId: '1401249757904633856', color: 0xFEE75C },
            Cheats: { channelId: '1400796902559322193', roleId: '1401249725499576361', color: 0xED4245 }
        };

        const selected = CONFIG[target as keyof typeof CONFIG];
        const channel = interaction.guild?.channels.cache.get(selected.channelId);

        if (!channel?.isTextBased()) {
            return interaction.editReply({ content: '❌ Ошибка: Канал для отправки не найден.' });
        }

        const embed = new EmbedBuilder()
            .setColor(selected.color)
            .setTitle(`Запрос на проверку [${target.toUpperCase()}]`)
            .addFields(
                { name: 'Статик игрока', value: staticId, inline: false },
                { name: 'Запросил', value: `${interaction.user}`, inline: false },
                { name: 'Причина', value: reason, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `User ID: ${interaction.user.id} | Blackberry Security` });

        if (video) {
            embed.addFields({ name: 'Доказательства', value: video, inline: false });
        }

        await channel.send({ 
            content: `<@&${selected.roleId}>`, 
            embeds: [embed]
        });

        await interaction.editReply({ content: '✅ Запрос отправлен и занесен в базу данных.' });
        
    } catch (error) {
        console.error('Ошибка в команде:', error);
        await interaction.editReply({ content: '❌ Произошла ошибка при выполнении команды.' });
    }
}