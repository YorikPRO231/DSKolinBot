import {GuildMember, MessageFlags} from "discord.js";
import {
  handleApproveButton,
  handleApproveSelect,
  handleDenyButton,
  handleDenyModal,
  handleTransferSelect
} from "./transferUtils";
import {handleButton, handleModal} from "./detectiveUtils";


import {handleAdminRegistration, handleNickKick, handleTwinkKick} from "./adminUtils";


export async function handleSlashCommand(interaction: any) {
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return console.log(`Команда ${interaction.commandName} не найдена`);

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : "Ошибка выполнения команды";
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  }
}

export async function handleButtonInteraction(interaction: any) {
  const member = interaction.member as GuildMember;
  const { customId } = interaction;

  if (customId.startsWith("twink_")) return handleTwinkKick(interaction);
  if (customId.startsWith("tr_approve_")) return handleApproveButton(interaction, member);
  if (customId.startsWith("tr_deny_")) return handleDenyButton(interaction, member);
  if (customId.startsWith("dnames")) return handleButton(interaction, member);
  if (customId.startsWith("patchreq")) return handleButton(interaction, member);
  if (customId.startsWith('nicknames')) return handleNickKick(interaction, member);
}

export async function handleSelectMenuInteraction(interaction: any) {
  const member = interaction.member as GuildMember;
  if (interaction.customId.startsWith("select_transfer_")) return handleTransferSelect(interaction, member);
  if (interaction.customId.startsWith("approve_as_")) return handleApproveSelect(interaction, member);
}

export async function handleModalInteraction(interaction: any) {
  const member = interaction.member as GuildMember;
  if (interaction.customId === "admin_registration") return handleAdminRegistration(interaction);
  if (interaction.customId.startsWith("deny_modal_")) return handleDenyModal(interaction, member);
  if (interaction.customId.startsWith("dnames_")) return handleModal(interaction, member);
}