import {ChatInputCommandInteraction, GuildMember, SlashCommandBuilder} from 'discord.js';
import {showFactionSelectMenu} from '../../utils/transferUtils';
import {MessageFlags} from "discord-api-types/v10";
import {TransfersRepository} from "../../databases/repositories/transfers.repository";

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
            { name: 'ARMY', value: 'ARMY' },
            { name: 'USSS', value: 'GOV' }
        ))
    .addStringOption(opt => opt.setName('ник').setDescription('Ваш текущий ник').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
    const passport = interaction.options.getString('паспорт', true);
    const currentRank = interaction.options.getInteger('ранг', true);
    const targetFrac = interaction.options.getString('фракция', true);
    const member = interaction.member as GuildMember;
    const nickname = interaction.options.getString('ник', true);
    
    const existingTransfer = await TransfersRepository.retrieveTransferData(passport);
    if (existingTransfer) {
        return interaction.reply({
            content: 'У Вас уже имеется заявление, ожидайте его рассмотрения.\nПри задержке рассмотрения обратитесь к кураторам фракции.',
            flags: MessageFlags.Ephemeral
        });
    }

    return await showFactionSelectMenu(interaction, passport, currentRank, targetFrac, member, nickname);
}