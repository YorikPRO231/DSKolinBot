import { Events, Message, EmbedBuilder, Colors } from 'discord.js';

export const name = Events.MessageCreate;

export async function execute(message: Message) {
    if (message.author.bot || !message.reference || !message.reference.messageId) return;

    try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);

        if (repliedMessage.author.id === message.client.user?.id && repliedMessage.embeds.length > 0) {
            const embed = repliedMessage.embeds[0];
            const footerText = embed.footer?.text || "";
            const userIdMatch = footerText.match(/User ID: (\d+)/);

            if (userIdMatch) {
                const userId = userIdMatch[1];
                const targetUser = await message.client.user?.client.users.fetch(userId);
                const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
                const displayName = member?.nickname || message.author.displayName || message.author.username;
                if (!targetUser) return;

                const attachments = Array.from(message.attachments.values());

                const dmEmbed = new EmbedBuilder()
                    .setColor(0x2B2D31)
                    .setAuthor({ 
                        name: `Старший администратор ${displayName} ответил вам:`, 
                        iconURL: message.author.displayAvatarURL() 
                    })
                    .setDescription(message.content || (attachments.length > 0 ? "(Прикрепленные файлы ниже)" : "Сообщение без текста"))
                    .setFooter({ text: 'Blackberry Management System' })
                    .setColor(Colors.Orange)
                    .setTimestamp();

                const imageAttachment = attachments.find(a => a.contentType?.startsWith('image/'));
                if (imageAttachment) {
                    dmEmbed.setImage(imageAttachment.url);
                }

                await targetUser.send({ 
                    embeds: [dmEmbed],
                    files: attachments.map(a => ({ attachment: a.url, name: a.name })) 
                });

                await message.react('✅');
                await repliedMessage.react('✅');
                const newEmbed = EmbedBuilder.from(repliedMessage.embeds[0])
                 .setFooter({text: `Обработано: ${member?.nickname} `})
                await repliedMessage.edit({ embeds: [newEmbed] });
            }
        }
    } catch (error) {
        console.error('Ошибка пересылки:', error);
        await message.react('❌');
    }
}