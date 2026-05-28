import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';
import { PatchesRepository } from '../../databases/index';

export const factions = ['GOV'];

export const data = new SlashCommandBuilder()
    .setName("поиск-discordid")
    .setDescription("Поиск нашивки по DiscordID")
    .addStringOption(opt => opt
        .setName('discord-id')
        .setDescription('Поиск по Discord-ID')
        .setRequired(true))


export async function execute(inter: ChatInputCommandInteraction) {
    const allowedRoles = ['673463283600064555', '673463284480999424', '709377580452675584'];
    const allowedUserId = '1429367223373533285';

     const memberRoles = inter.member?.roles;
    const hasAllowedRole = memberRoles && 'cache' in memberRoles 
        ? (memberRoles as any).cache.some((role: any) => allowedRoles.includes(role.id))
        : false;
    
    if (!hasAllowedRole && inter.user.id !== allowedUserId) {
        await inter.reply({
            content: 'У вас нет прав для использования этой команды.\nИспользовать эту команду могут только администраторы.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }


    const discordId = inter.options.getString('discord-id', true);
    
    const patches = await PatchesRepository.getPatchByDiscord(discordId.toString());
    
    if (patches.length === 0) {
        await inter.reply({
            content: `Нашивки для Discord ID \`${discordId}\` не найдены.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`Результаты поиска по Discord ID: ${discordId}`)
        .setDescription(`Найдено нашивок: **${patches.length}**`)
        .setTimestamp();
    
    patches.forEach((patch, index) => {
        embed.addFields({
            name: `Нашивка #${index + 1} — ${patch.patch}`,
            value: [
                `**Пользователь:** ${patch.username}`,
                `**Passport:** ${patch.passport}`,
                `**Фракция:** ${patch.faction}`,
                `**Создана:** ${new Date(patch.created_at).toLocaleString('ru-RU')}`,
                patch.history ? `**История:** ${patch.history}` : null
            ].filter(Boolean).join('\n'),
            inline: false
        });
    });
    
    await inter.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
    });
}