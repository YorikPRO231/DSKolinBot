import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, TextChannel,} from "discord.js";
import {PUNISHMENT_ADMINS_CHANNEL_ID} from "../../utils/config";


export const data = new SlashCommandBuilder()
    .setName("потeряшки")
    .setDescription("Найти потеряшки в выдаче наказаний")


export async function execute(inter: ChatInputCommandInteraction) {
    const channel = await inter.client.channels.fetch(PUNISHMENT_ADMINS_CHANNEL_ID).catch(() => null) as TextChannel | null
    if (!channel) {
        return inter.reply({
            content: `Не удалось определить канал выдачи наказаний. <#${PUNISHMENT_ADMINS_CHANNEL_ID}>. `,
            flags: MessageFlags.Ephemeral
        })
    }
    await inter.deferReply({flags: MessageFlags.Ephemeral});
    const messages = (await channel.messages.fetch({limit: 100})).filter(m => m.reactions.cache.size == 0 && !m.author.bot)
    if (messages.size === 0) {
        return inter.reply({content: 'Потеряшек нет, все выдано!', flags: MessageFlags.Ephemeral})
    }
    const promises = messages.map(m => channel.send(`${m.url}`));
    await inter.editReply({content: `Найдено ${messages.size} потеряшек. Отправляем ссылки..`})
    await Promise.all(promises);
    await channel.send({content: 'Проверка окончена! Все потеряшки найдены!'})
    return inter.editReply({content: `Проверка окончена! Выведено ${messages.size} потеряшек.`})
}