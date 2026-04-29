import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    GuildMember 
} from 'discord.js';
import { 
    showFactionSelectMenu 
} from '../../utils/transferUtils';

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
    const passport = interaction.options.getString('паспорт')!;
    const currentRank = interaction.options.getInteger('ранг')!;
    const targetFrac = interaction.options.getString('фракция')!;
    const member = interaction.member as GuildMember;
    
    await showFactionSelectMenu(interaction, passport, currentRank, targetFrac, member);
}