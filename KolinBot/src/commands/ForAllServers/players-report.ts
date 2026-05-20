import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';
import {SecurityRepository} from '../../databases'

export const data = new SlashCommandBuilder()
    .setName("софт-жалоба")
    .setDescription("Оформить жалобу для проверки игрока на софт")
    .addStringOption(option =>
        option.setName('подозреваемый')
            .setDescription('Информация об игроке: ник, дискорд - всё что есть. Паспорт здесь не указывать.')
            .setRequired(true))
    .addStringOption(option => option
        .setName('паспорт')
        .setDescription('Паспорт подозреваемого')
        .setRequired(true))
    .addStringOption(option => option
        .setName('бизкапт')
        .setDescription('Все сыгранные игроком капты/бизы/территории. Пример: 2025-19-3-9 и 2025-19-3-8')
        .setRequired(true))
    .addStringOption(option =>
        option.setName('видео')
            .setDescription('Ссылка на видео-доказательство'));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({flags: 'Ephemeral'});

    try {
        const staticId = interaction.options.getString('паспорт', true);
        const suspectData = interaction.options.getString('подозреваемый', true);
        const video = interaction.options.getString('видео');
        const bizData = interaction.options.getString('бизкапт', true);

        const urlPattern = /^(https?:\/\/)[^\s$.?#].[^\s]*$/i;

        if (!urlPattern.test(video!)) {
            return interaction.editReply({
                content: '❌ Ошибка: В поле "видео" должна быть указана прямая ссылка (начинающаяся с http:// или https://).'
            });
        }

        try {
            SecurityRepository.addSecurityRequest('Cheats',
                interaction.user.id, `Запрос от игроков, ${suspectData}, ${video}, ${bizData}`, staticId)
        } catch (error) {
            console.error('Ошибка при записи запроса в БД:', error);
        }
        const channelId = '1400796902559322193'
        const roleId = '1401249725499576361'
        const color = 0xED4245;
        const channel = interaction.guild?.channels.cache.get(channelId);

        if (!channel?.isTextBased()) {
            return interaction.editReply({content: '❌ Ошибка: Канал для отправки не найден.'});
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`Запрос на проверку [CHEATS]`)
            .addFields(
                {name: 'Статик игрока', value: staticId!, inline: false},
                {name: 'Запросил', value: `${interaction.user}`, inline: false},
                {name: 'Информация о подозреваемом', value: suspectData},
                {name: 'Доказательства', value: video || 'Видео не указано'},
                {name: 'БизИнфо', value: bizData}
            )
            .setTimestamp()
            .setFooter({text: `User ID: ${interaction.user.id} | Blackberry Security`});


        await channel.send({
            content: `<@&${roleId}>`,
            embeds: [embed]
        });

        await interaction.editReply({content: '✅ Запрос отправлен на проверку игрокам.'});

    } catch (error) {
        console.error('Ошибка в команде:', error);
        throw error;
    }
}