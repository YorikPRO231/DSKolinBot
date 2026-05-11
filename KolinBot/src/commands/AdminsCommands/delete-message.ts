import { 
    ChatInputCommandInteraction, 
    MessageFlags, 
    SlashCommandBuilder,
    TextChannel,
    NewsChannel,
    ThreadChannel
} from "discord.js";

type SendableChannel = TextChannel | NewsChannel | ThreadChannel;

function isSendableChannel(channel: unknown): channel is SendableChannel {
    return channel instanceof TextChannel || 
           channel instanceof NewsChannel || 
           channel instanceof ThreadChannel;
}

const ALLOWED_USER_ID = "1429367223373533285";

export const data = new SlashCommandBuilder()
    .setName("delete-message")
    .setDescription("Удалить сообщение по ID")
    .addStringOption(opt => 
        opt.setName('channel_id')
            .setDescription('ID канала')
            .setRequired(true)
    )
    .addStringOption(opt => 
        opt.setName('message_id')
            .setDescription('ID сообщения')
            .setRequired(true)
    );

export async function execute(inter: ChatInputCommandInteraction) {
    if (inter.user.id !== ALLOWED_USER_ID) {
        return inter.reply({
            content: 'У вас нет прав на использование этой команды.',
            flags: MessageFlags.Ephemeral
        });
    }

    const channelId = inter.options.getString('channel_id', true);
    const messageId = inter.options.getString('message_id', true);

    try {
        const channel = await inter.client.channels.fetch(channelId);
        
        if (!channel || !isSendableChannel(channel)) {
            return inter.reply({
                content: 'Не удалось найти указанный канал.',
                flags: MessageFlags.Ephemeral
            });
        }

        const message = await channel.messages.fetch(messageId);
        
        if (!message) {
            return inter.reply({
                content: 'Не удалось найти указанное сообщение.',
                flags: MessageFlags.Ephemeral
            });
        }

        await message.delete();
        
        return inter.reply({
            content: `Сообщение ${messageId} успешно удалено из канала ${channelId}.`,
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        return inter.reply({
            content: 'Не удалось удалить сообщение. Проверьте правильность ID.',
            flags: MessageFlags.Ephemeral
        });
    }
}