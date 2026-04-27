import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    GuildMember 
} from 'discord.js';

/**
 * Таблица перевода согласно вашему скриншоту.
 * Формат: [Куда][Откуда] -> { новый_ранг, мин_старый, макс_старый }
 */
const transferTable: Record<string, Record<string, { new: number, min: number, max: number }[]>> = {
    "FIB": {
        "NG": [{ 'new': 2, 'min': 6, 'max': 6 }, { 'new': 3, 'min': 7, 'max': 9 }, { 'new': 4, 'min': 10, 'max': 12 }, { 'new': 5, 'min': 13, 'max': 14 }],
        "LSPD": [{ 'new': 2, 'min': 5, 'max': 5 }, {'new': 3,'min': 6,'max': 8 }, { 'new': 4, 'min': 9, 'max': 11 }, { 'new': 5, 'min': 12, 'max': 13 }],
        "LSSD": [{ 'new': 2, 'min': 4, 'max': 4 }, {'new': 3,'min': 5,'max': 6 }, { 'new': 4, 'min': 7, 'max': 7 }, { 'new': 5, 'min': 8, 'max': 9 }],
        "SASPA": [{ 'new': 2, 'min': 7, 'max': 7 }, { 'new': 3, 'min': 8, 'max': 8 }, { 'new': 4, 'min': 9, 'max': 12 }],
        "USSS": [{ 'new': 2, 'min': 8, 'max': 8 }, { 'new': 3, 'min': 10, 'max': 12 }, { 'new': 4, 'min': 16, 'max': 18 }]
    },
    "LSPD": {
        "NG": [{ 'new': 2, 'min': 6, 'max': 6 }, { 'new': 3, 'min': 7, 'max': 7 }, { 'new': 4, 'min': 8, 'max': 8 }, { 'new': 5, 'min': 9, 'max': 9 }, { 'new': 6, 'min': 10, 'max': 10 }, { 'new': 7, 'min': 11, 'max': 12 }, { 'new': 8, 'min': 13, 'max': 13 }, { 'new': 9, 'min': 14, 'max': 15 }],
        "FIB": [{ 'new': 5, 'min': 4, 'max': 4 }, { 'new': 6, 'min': 5, 'max': 5 }, { 'new': 7, 'min': 7, 'max': 7 }, { 'new': 8, 'min': 8, 'max': 8 }, { 'new': 9, 'min': 9, 'max': 10 }],
        "LSSD": [{ 'new': 5, 'min': 4, 'max': 4 }, { 'new': 6, 'min': 5, 'max': 5 }, { 'new': 8, 'min': 7, 'max': 8 }, { 'new': 9, 'min': 9, 'max': 10 }],
        "SASPA": [{ 'new': 4, 'min': 7, 'max': 9 }, { 'new': 6, 'min': 10, 'max': 12 }],
        "USSS": [{ 'new': 2, 'min': 8, 'max': 8 }, { 'new': 3, 'min': 10, 'max': 12 }, { 'new': 4, 'min': 16, 'max': 18 }]
    },
    "LSSD": {
        "NG": [{ 'new': 2, 'min': 6, 'max': 6 }, { 'new': 3, 'min': 7, 'max': 7 }, { 'new': 4, 'min': 8, 'max': 9 }, { 'new': 5, 'min': 10, 'max': 10 }, { 'new': 6, 'min': 11, 'max': 13 }, { 'new': 7, 'min': 14, 'max': 15 }],
        "LSPD": [{ 'new': 3, 'min': 4, 'max': 4 }, { 'new': 4, 'min': 5, 'max': 5 }, { 'new': 6, 'min': 10, 'max': 11 }, { 'new': 7, 'min': 12, 'max': 14 }],
        "FIB": [{ 'new': 3, 'min': 3, 'max': 3 }, { 'new': 4, 'min': 4, 'max': 4 }, { 'new': 5, 'min': 5, 'max': 5 }, { 'new': 6, 'min': 7, 'max': 8 }, { 'new': 7, 'min': 9, 'max': 10 }],
        "SASPA": [{ 'new': 3, 'min': 7, 'max': 9 }, { 'new': 4, 'min': 10, 'max': 12 }],
        "USSS": [{ 'new': 2, 'min': 8, 'max': 8 }, { 'new': 3, 'min': 10, 'max': 12 }, { 'new': 4, 'min': 16, 'max': 18 }]
    },
    "NG": {
        "LSSD": [{ 'new': 3, 'min': 4, 'max': 4 }, { 'new': 6, 'min': 5, 'max': 5 }, { 'new': 7, 'min': 6, 'max': 6 }, { 'new': 8, 'min': 7, 'max': 7 }, { 'new': 11, 'min': 8, 'max': 9 }, { 'new': 12, 'min': 10, 'max': 10 }],
        "LSPD": [{ 'new': 3, 'min': 6, 'max': 6 }, { 'new': 6, 'min': 7, 'max': 7 }, { 'new': 7, 'min': 8, 'max': 8 }, { 'new': 8, 'min': 9, 'max': 9 }, { 'new': 9, 'min': 10, 'max': 10 }, { 'new': 10, 'min': 11, 'max': 11 }, { 'new': 11, 'min': 12, 'max': 13 }, { 'new': 12, 'min': 14, 'max': 14 }],
        "FIB": [{ 'new': 5, 'min': 4, 'max': 4 }, { 'new': 6, 'min': 5, 'max': 5 }, { 'new': 9, 'min': 7, 'max': 7 }, { 'new': 11, 'min': 8, 'max': 8 }, { 'new': 12, 'min': 9, 'max': 10 }],
        "SASPA": [{ 'new': 3, 'min': 7, 'max': 9 }, { 'new': 4, 'min': 10, 'max': 12 }],
        "USSS": [{ 'new': 2, 'min': 8, 'max': 8 }, { 'new': 3, 'min': 12, 'max': 18 }]
    },
    "SASPA": {
        "LSSD": [{ 'new': 3, 'min': 4, 'max': 4 }, { 'new': 4, 'min': 5, 'max': 5 }, { 'new': 5, 'min': 6, 'max': 6 }, { 'new': 6, 'min': 7, 'max': 7 }, { 'new': 9, 'min': 8, 'max': 10 }],
        "LSPD": [{ 'new': 3, 'min': 4, 'max': 4 }, { 'new': 4, 'min': 5, 'max': 6 }, { 'new': 5, 'min': 7, 'max': 7 }, { 'new': 6, 'min': 8, 'max': 8 }, { 'new': 7, 'min': 9, 'max': 9 }, { 'new': 8, 'min': 10, 'max': 11 }, { 'new': 9, 'min': 12, 'max': 14 }],
        "FIB": [{ 'new': 5, 'min': 3, 'max': 3 }, { 'new': 6, 'min': 4, 'max': 4 }, { 'new': 7, 'min': 5, 'max': 5 }, { 'new': 8, 'min': 7, 'max': 7 }, { 'new': 9, 'min': 8, 'max': 10 }],
        "NG": [{ 'new': 3, 'min': 5, 'max': 6 }, { 'new': 4, 'min': 7, 'max': 7 }, { 'new': 5, 'min': 8, 'max': 8 }, { 'new': 6, 'min': 9, 'max': 9 }, { 'new': 7, 'min': 10, 'max': 10 }, { 'new': 8, 'min': 11, 'max': 12 }, { 'new': 9, 'min': 13, 'max': 15 }],
        "USSS": [{ 'new': 4, 'min': 8, 'max': 8 }, { 'new': 5, 'min': 12, 'max': 12 }, { 'new': 6, 'min': 16, 'max': 16 }, { 'new': 7, 'min': 18, 'max': 18 }]
    },
    "USSS": {
        "NG": [{ 'new': 8, 'min': 6, 'max': 8 }, { 'new': 10, 'min': 9, 'max': 11 }, { 'new': 12, 'min': 12, 'max': 15 }],
        "LSPD": [{ 'new': 8, 'min': 4, 'max': 7 }, { 'new': 10, 'min': 8, 'max': 10 }, { 'new': 12, 'min': 11, 'max': 14 }],
        "FIB": [{ 'new': 8, 'min': 3, 'max': 4 }, { 'new': 10, 'min': 5, 'max': 5 }, { 'new': 12, 'min': 7, 'max': 10 }],
        "SASPA": [{ 'new': 8, 'min': 4, 'max': 6 }, { 'new': 10, 'min': 7, 'max': 9 }, { 'new': 12, 'min': 10, 'max': 12 }],
        "LSSD": [{ 'new': 8, 'min': 4, 'max': 4 }, { 'new': 10, 'min': 5, 'max': 6 }, { 'new': 12, 'min': 7, 'max': 10 }]
    }
};

export const data = new SlashCommandBuilder()
    .setName('запрос-перевода')
    .setDescription('Создать заявление на перевод')
    .addStringOption(opt => opt.setName('паспорт').setDescription('Номер паспорта').setRequired(true))
    .addIntegerOption(opt => opt.setName('ранг').setDescription('Текущий ранг').setRequired(true))
    .addStringOption(opt => opt.setName('фракция').setDescription('Куда переводитесь')
        .setRequired(true)
        .addChoices(
            { name: 'FIB', value: 'FIB' },
            { name: 'LSPD', value: 'LSPD' },
            { name: 'LSSD', value: 'LSSD' },
            { name: 'SASPA', value: 'SASPA' },
            { name: 'Army', value: 'NG' },
            { name: 'USSS', value: 'USSS' }
        ));
    

export async function execute(interaction: ChatInputCommandInteraction) {
    const passport = interaction.options.getString('паспорт');
    const currentRank = interaction.options.getInteger('ранг')!;
    const targetFrac = interaction.options.getString('фракция')!;

    const member = interaction.member as GuildMember;

    const displayName = member.displayName || "";
    const parts = displayName.split(' | ');
    if (parts.length < 2) {
        return interaction.reply({ content: "Ваш ник должен быть в формате `Фракция | Имя_Фамилия`", ephemeral: true });
    }
    const currentFrac = parts[0].trim();
    const userName = parts[1].trim();

    if (['LSSD', 'FIB', 'LSPD'].includes(currentFrac) && currentRank === 6) {
        return interaction.reply({ content: `Перевод с **6** ранга из **${currentFrac}** запрещен.`, ephemeral: true });
    }

    const options = transferTable[targetFrac]?.[currentFrac];
    const mapping = options?.find(m => currentRank >= m.min && currentRank <= m.max);

    if (!mapping) {
        return interaction.reply({ content: "Перевод для данного ранга/фракции не предусмотрен таблицей.", ephemeral: true });
    }

    const findLeaders = (fName: string) => {
        return interaction.guild?.members.cache.filter(m => 
            m.roles.cache.some(r => /лидер|leader/i.test(r.name)) &&
            m.roles.cache.some(r => r.name.toUpperCase().includes(fName.toUpperCase()))
        );
    };

    const targetLeaders = findLeaders(targetFrac);
    const currentLeaders = findLeaders(currentFrac);
    const allLeaders = [...(targetLeaders?.values() || []), ...(currentLeaders?.values() || [])];
    const leaderMentions = allLeaders.length > 0 ? allLeaders.map(m => `<@${m.id}>`).join(' ') : "Не найдено";

    const embed = new EmbedBuilder()
        .setTitle('Заявление на перевод')
        .setColor('#dda01b')
        .setDescription(
            `**Сотрудник:** <@${interaction.user.id}> | ${userName} [${passport}]\n` +
            `**Из ${currentFrac} [${currentRank}] -> в ${targetFrac} [${mapping.new}]**\n\n` +
            `──────────────────────────────────────────\n` +
            `**Руководство:** ${leaderMentions}\n` 
        ).setFooter({text:`⚠️ Перевод игрока принятого в день блата в течение 7 дней запрещен!`})

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('tr_approve').setLabel('✅').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tr_deny').setLabel('❌').setStyle(ButtonStyle.Secondary)
    );

    const logChannel = interaction.guild?.channels.cache.get("1494095206994411731");

    if (logChannel?.isTextBased()) {
        await logChannel.send({ embeds: [embed], components: [buttons] });
        
        await interaction.reply({ 
            content: `✅ Ваше заявление успешно отправлено в канал <#${1494095206994411731}>`, 
            ephemeral: true 
        });
    } else {
        await interaction.reply({ 
            content: "❌ Ошибка: Канал для заявок не найден или бот не имеет к нему доступа.", 
            ephemeral: true 
        });
    }
}