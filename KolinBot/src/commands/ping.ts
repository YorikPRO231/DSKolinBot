import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Отвечает Pong!');

export async function execute(interaction: CommandInteraction) {
    await interaction.reply(`🏓 Понг! Задержка: ${Math.round(interaction.client.ws.ping)}ms`);
}