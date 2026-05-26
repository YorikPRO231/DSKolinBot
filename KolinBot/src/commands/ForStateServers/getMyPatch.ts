import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';
import { PatchesRepository } from '../../databases/index';
import type { StatePatch } from '../../databases';

export const factions = ['LSPD', 'LSSD', 'FIB', 'ARMY', 'SASPA', 'GOV'];


export const data = new SlashCommandBuilder()
    .setName("моя-нашивка")
    .setDescription('Просмотр всех ваших нашивок');

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply({flags: MessageFlags.Ephemeral});
    
    const sp = PatchesRepository.getSelfPatches(inter.user.id);
    
    if (!sp || sp.length === 0) {
        return inter.editReply({content: 'У вас нет ни одной нашивки.'});
    }
    
    const patches = sp.map((p: StatePatch, index: number) => 
        `**${index + 1}.** ${p.username}\n\`\`\`${p.patch}\`\`\`\nПаспорт: \`${p.passport}\``
    ).join('\n\n');
    
    const colors = [0x5865F2, 0x57F287, 0xFEE75C, 0xEB459E, 0xED4245];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const embed = new EmbedBuilder()
        .setColor(randomColor)
        .setAuthor({
            name: inter.user.displayName,
            iconURL: inter.user.displayAvatarURL()
        })
        .setTitle('Ваши нашивки')
        .setDescription(patches)
        .setFooter({text: `Всего: ${sp.length}`})
        .setTimestamp();
    
    return inter.editReply({embeds: [embed]});
}