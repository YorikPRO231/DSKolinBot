import {ChatInputCommandInteraction, SlashCommandBuilder} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName("clear-invite")
    .setDescription('[Admin] Очистка всех приглашений на сервере');

export async function execute(inter: ChatInputCommandInteraction) {
    await inter.deferReply();

    const invites = await inter.guild?.invites.fetch();
    invites?.forEach(invite => {
        invite.delete(`Очистка администраором ${inter.user.username}`)
    })

    return inter.editReply({content: `Очищено ${invites?.size} приглашений с сервера!`})
}