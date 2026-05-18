import { Events, Interaction } from "discord.js";
import { 
  handleSlashCommand, 
  handleButtonInteraction, 
  handleSelectMenuInteraction, 
  handleModalInteraction 
} from "../utils/interactionHandlers";

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
  if (interaction.isChatInputCommand()) return await handleSlashCommand(interaction);
  if (interaction.isButton()) return await handleButtonInteraction(interaction);
  if (interaction.isStringSelectMenu()) return await handleSelectMenuInteraction(interaction);
  if (interaction.isModalSubmit()) return await handleModalInteraction(interaction);
  if (interaction.isAutocomplete()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (command && command.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(error);
      }
    }
  }
}