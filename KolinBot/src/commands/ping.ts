import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder 
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Проверить задержку и статус работы бота');

export async function execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.deferReply({ fetchReply: true, ephemeral: true });
    
    const apiLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;

    const statusColor = wsPing < 150 ? 0x2ECC71 : (wsPing < 300 ? 0xF1C40F : 0xE74C3C);

    const embed = new EmbedBuilder()
        .setColor(statusColor)
        .setTitle('📡 Статус соединения')
        .addFields(
            { 
                name: 'WebSocket Ping', 
                value: `\`${wsPing}ms\``, 
                inline: true 
            },
            { 
                name: 'API Latency', 
                value: `\`${apiLatency}ms\``, 
                inline: true 
            },
            { 
                name: 'Uptime', 
                value: `<t:${Math.floor(Date.now() / 1000 - interaction.client.uptime! / 1000)}:R>`, 
                inline: false 
            }
        )
        .setFooter({ 
            text: `Blackberry Management | System Status`,
            iconURL: interaction.client.user?.displayAvatarURL()
        })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}