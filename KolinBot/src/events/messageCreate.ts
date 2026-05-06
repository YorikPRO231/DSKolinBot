import { Events, Message, EmbedBuilder, Colors } from 'discord.js';
import { ADMINS_SERVER_ID } from "../utils/config"

export const name = Events.MessageCreate;

const ALLOWED_CHANNEL_ID = "1316831634376364055"

export async function execute(message: Message) {
    if (!ADMINS_SERVER_ID.includes(message.guild?.id || '')) return;

    if (message.channel.id !== ALLOWED_CHANNEL_ID) return;
    
    if (message.author.bot || !message.reference || !message.reference.messageId) return;

    try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);

        if (repliedMessage.author.id === message.client.user?.id && repliedMessage.embeds.length > 0) {
            const embed = repliedMessage.embeds[0];
            const footerText = embed.footer?.text || "";
            const userIdMatch = footerText.match(/User ID: (\d+)/);

            if (userIdMatch) {
                const userId = userIdMatch[1];
                const targetUser = await message.client.users.fetch(userId).catch(() => null);
                const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
                const displayName = member?.nickname || message.author.displayName || message.author.username;
                
                if (!targetUser) {
                    await message.react('❌');
                    return;
                }

                const attachments = Array.from(message.attachments.values());

                let requestDetails = "";
                if (embed.fields && embed.fields.length > 0) {
                    const descriptionField = embed.fields.find(f => f.name === 'Описание');
                    if (descriptionField) {
                        requestDetails = descriptionField.value;
                    }
                }

                if (!requestDetails && embed.description) {
                    requestDetails = embed.description;
                }

                if (!requestDetails) {
                    requestDetails = "Без описания";
                }

                const adminResponse = message.content || (attachments.length > 0 ? "Файлы во вложении" : "Без текста");

                const responseEmbed = new EmbedBuilder()
                    .setColor(Colors.Orange)
                    .setTitle('Ответ старшего администратора')
                    .setAuthor({ name: displayName, iconURL: message.author.displayAvatarURL() })
                    .addFields(
                        { name: 'Ответ', value: adminResponse.length > 1024 ? adminResponse.slice(0, 1021) + '...' : adminResponse },
                        { name: 'Ваш запрос', value: requestDetails.length > 1024 ? requestDetails.slice(0, 1021) + '...' : requestDetails }
                    )
                    .setFooter({ text: `ID пользователя: ${message.author.id}` })
                    .setTimestamp();

                await targetUser.send({ 
                    embeds: [responseEmbed],
                    files: attachments.map(a => ({ attachment: a.url, name: a.name }))
                });

                await message.react('✅');
                await repliedMessage.react('✅');
                
                const updatedEmbed = EmbedBuilder.from(repliedMessage.embeds[0])
                    .setFooter({ text: `Обработано: ${member?.nickname || message.author.username}` });
                await repliedMessage.edit({ embeds: [updatedEmbed] });
            }
        }
    } catch (error) {
        console.error('Ошибка пересылки:', error);
        await message.react('❌').catch(() => {});
    }
}