import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel, NewsChannel} from 'discord.js';
import {SecurityRepository} from '../../databases'

export const data = new SlashCommandBuilder()
    .setName("софт-жалоба")
    .setDescription("Оформить жалобу для проверки игрока на софт")
    .addStringOption(option => option
        .setName('паспорт')
        .setDescription('Паспорт подозреваемого')
        .setRequired(true))
    .addStringOption(option => option
        .setName('бизкапт')
        .setDescription('Все сыгранные игроком капты/бизы/территории. Пример: 2025-19-3-9 и 2025-19-3-8')
        .setRequired(true))
    .addStringOption(option =>
        option.setName('доказательства')
            .setDescription('Ссылка на доказательства')
            .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({flags: 'Ephemeral'});

    try {
        const staticId = interaction.options.getString('паспорт', true);
        const video = interaction.options.getString('доказательства');
        const bizData = interaction.options.getString('бизкапт', true);

        if (!/^\d+$/.test(staticId)) {
            return interaction.editReply({ 
                content: 'Ошибка: Паспорт должен содержать только цифры. Пожалуйста, введите корректный ID игрока.' 
            });
        }

        const requestText = `Запрос от игроков${video ? `\nВидео: ${video}` : ''}\n${bizData}`;

        

        try {
            SecurityRepository.addSecurityRequest('Cheats',
                interaction.user.id, requestText, staticId)
        } catch (error) {
            console.error('Ошибка при записи запроса в БД:', error);
            return interaction.editReply({ content: '❌ Ошибка при сохранении запроса в базу данных.' });
        }

        const channelId = '1478001437387788338';
        const roleId = '1401249725499576361';
        const color = 0xED4245;
        
        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);

        if (!channel || !('send' in channel) || typeof channel.send !== 'function') {
            return interaction.editReply({content: '❌ Ошибка: Канал для отправки не найден или бот не может в него писать.'});
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`Запрос на проверку от фракции ${interaction.guild?.name.replace('GTA 5 RP | ', '').toLowerCase() || 'Неизвестно'}`)
            .addFields(
                {name: 'Статик игрока', value: staticId, inline: false},
                {name: 'Запросил', value: `${interaction.user}`, inline: false},
                {name: 'БизИнфо', value: bizData, inline: false}
            )
            .setTimestamp()
            .setFooter({text: `User ID: ${interaction.user.id} | Blackberry Security`});

        if (video) {
            embed.addFields({name: 'Доказательства', value: video, inline: false});
        } else {
            embed.addFields({name: 'Доказательства', value: 'Не предоставлены', inline: false});
        }

        await channel.send({
            content: `<@&${roleId}>`,
            embeds: [embed]
        });

        await interaction.editReply({content: 'Жалоба передана администрации. Старшая администрация сервера проконтролирует исполнение необходимых действий, в случае если игроком было допущено нарушение пункта 1.7 правил проекта.'});

    } catch (error) {
        console.error('Ошибка в команде:', error);
        await interaction.editReply({ content: 'Произошла ошибка при выполнении команды.' });
    }
}