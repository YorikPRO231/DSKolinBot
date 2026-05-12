// src/commands/dashboard.ts
import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import crypto from 'crypto';

export const data = new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Открыть панель управления');

const dashboardTokens = new Map<string, { userId: string; guildId: string; expires: number }>();

export function generateDashboardToken(userId: string, guildId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    dashboardTokens.set(token, {
        userId,
        guildId,
        expires: Date.now() + 5 * 60 * 1000 // 5 минут
    });
    return token;
}

export function verifyDashboardToken(token: string) {
    const data = dashboardTokens.get(token);
    if (!data || data.expires < Date.now()) {
        dashboardTokens.delete(token);
        return null;
    }
    dashboardTokens.delete(token);
    return data;
}

export async function execute(interaction: ChatInputCommandInteraction) {
    // Проверяем права (только администраторы)
    if (!interaction.memberPermissions?.has("Administrator")) {
        return interaction.reply({
            content: "❌ У вас недостаточно прав для доступа к панели управления.",
            ephemeral: true
        });
    }

    const token = generateDashboardToken(interaction.user.id, interaction.guildId!);
    
    const dashboardUrl = `${process.env.DASHBOARD_URL || 'http://localhost:3000'}/login?token=${token}`;

    const embed = new EmbedBuilder()
        .setTitle("Панель управления")
        .setDescription("Нажмите кнопку ниже, чтобы открыть панель управления")
        .setColor(0x3498db)
        .addFields(
            { name: "Ссылка", value: `[Открыть Dashboard](${dashboardUrl})` },
            { name: "Срок действия", value: "Ссылка действительна 5 минут" }
        );

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setLabel("Открыть Dashboard")
                .setStyle(ButtonStyle.Link)
                .setURL(dashboardUrl)
        );

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}