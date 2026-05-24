import {AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';
import {POSITIONS_STATE_INFO} from "../../utils/config";
import {MessageFlags} from "discord-api-types/v10";

function getFactionFromName(guildName?: string): string | null {
    if (!guildName) return null;

    const cleanName = guildName.replace("GTA 5 RP | ", "").trim();

    for (const faction of Object.keys(POSITIONS_STATE_INFO)) {
        if (cleanName.includes(faction)) {
            return faction;
        }
    }

    return null;
}

export const data = new SlashCommandBuilder()
    .setName("уволиться")
    .setDescription("Оформить заявление на увольнение")
    .addStringOption(option =>
        option.setName('отдел')
            .setDescription('Ваш текущий отдел или должность')
            .setRequired(true)
            .setAutocomplete(true))
    .addStringOption(option =>
        option.setName('паспорт')
            .setDescription('Паспорт')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('причина')
            .setDescription('Причина увольнения')
            .setRequired(true))

export async function autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const faction = getFactionFromName(interaction.guild?.name);

    if (!faction) {
        await interaction.respond([]);
        return;
    }

    const factionState =
        POSITIONS_STATE_INFO[faction as keyof typeof POSITIONS_STATE_INFO];

    if (!factionState || !factionState.compiled_positions) {
        await interaction.respond([]);
        return;
    }

    const choices = factionState.compiled_positions;
    const filtered = choices.filter((choice) =>
        choice.toLowerCase().includes(focusedValue.toLowerCase()),
    );

    await interaction.respond(
        filtered.slice(0, 25).map((choice) => ({name: choice, value: choice})),
    );
}


export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({flags: MessageFlags.Ephemeral});
    try {
        const target = interaction.options.getString('отдел', true);
        const staticId = interaction.options.getString('паспорт', true);
        const reason = interaction.options.getString('причина', true);


    } catch (error) {
        console.error('Ошибка в команде:', error);
        await interaction.editReply({content: '❌ Произошла ошибка при выполнении команды.'});
    }
}