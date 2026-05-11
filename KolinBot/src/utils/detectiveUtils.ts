import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Colors,
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
    TextBasedChannel,
    TextInputBuilder,
    TextInputStyle,
    TextChannel,
    NewsChannel,
    ThreadChannel
} from "discord.js";
import {retrieveInfiltration} from "../databases/sqlite";
import {GOV_NICKNAME_REQUESTS_CHANNEL_ID, GOV_NICKNAME_REQUESTS_ROLES_ID, ADMIN_NICKNAME_LOGS_CHANNEL_ID} from "./config";
import {DETECTIVES_INFO} from "./constants/fractions";

type FactionType = keyof typeof DETECTIVES_INFO;
type SendableChannel = TextChannel | NewsChannel | ThreadChannel;

function parseCustomId(customId: string): { 
    detectivesChannel: string; 
    detectiveId: string; 
    stage: string; 
    messageId?: string;
    answerMessageId?: string;
} {
    const parts = customId.split("_");
    return {
        detectivesChannel: parts[1],
        detectiveId: parts[2],
        stage: parts[3],
        messageId: parts[4],
        answerMessageId: parts[5]
    };
}

function getHighRole(faction: string): string {
    if (faction in DETECTIVES_INFO) {
        return DETECTIVES_INFO[faction as FactionType].high_role_id;
    }
    return 'nn';
}

function isSendableChannel(channel: any): channel is SendableChannel {
    return channel && typeof channel.send === 'function';
}

async function fetchSendableChannel(client: any, channelId: string): Promise<SendableChannel | null> {
    try {
        const channel = await client.channels.fetch(channelId);
        return isSendableChannel(channel) ? channel : null;
    } catch {
        return null;
    }
}

async function safeReply(inter: ButtonInteraction | ModalSubmitInteraction, message: string): Promise<void> {
    try {
        if (!inter.replied && !inter.deferred) {
            await inter.reply({ content: message, flags: MessageFlags.Ephemeral });
        }
    } catch (error) {
        console.error('Failed to send reply:', error);
    }
}


export async function handleButton(inter: ButtonInteraction, member: GuildMember) {
    const { detectiveId, detectivesChannel, stage } = parseCustomId(inter.customId);
    
    const infiltrationData = retrieveInfiltration(detectiveId);
    if (!infiltrationData) {
        return safeReply(inter, 'Не удалось получить данные по данному заявлению. Сообщите администрации.');
    }

    if (stage === 'gov') {
        await handleGovStage(inter);
    } else if (stage === 'admins') {
        await handleAdminsStage(inter, member, infiltrationData, detectivesChannel);
    } else {
        return safeReply(inter, 'Неизвестная стадия обработки.');
    }
}

async function handleGovStage(inter: ButtonInteraction) {
    const modal = new ModalBuilder()
        .setCustomId(`${inter.customId}_${inter.message.id}`)
        .setTitle("Реквизиты для оплаты");

    const passportInput = new TextInputBuilder()
        .setCustomId("passport")
        .setLabel("Ваш паспорт")
        .setPlaceholder("Впишите паспорт, куда следует оплатить операцию")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(10)
        .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(passportInput);
    modal.addComponents(row);

    await inter.showModal(modal);
}

async function handleAdminsStage(
    inter: ButtonInteraction, 
    member: GuildMember, 
    infiltrationData: any, 
    detectivesChannel: string
) {
    const { answerMessageId } = parseCustomId(inter.customId);
    
    const adminChannel = await fetchSendableChannel(inter.client, ADMIN_NICKNAME_LOGS_CHANNEL_ID);
    
    const adminEmbed = new EmbedBuilder()
        .setTitle(`Запрос на смену имени ${infiltrationData.detectivefaction}`)
        .setDescription(`Требуется выдача бесплатной смены ника:\n\`\`\`\noffforce_rename ${infiltrationData.passport} Внедрение\`\`\``)
        .setFooter({ text: `Одобрено GOV: ${member.displayName} ${member.id}` })
        .setTimestamp();

    if (adminChannel) {
        await adminChannel.send({ embeds: [adminEmbed], content: "<@&796471733057880174>"});
    }

    const playersEmbed = new EmbedBuilder()
        .setTitle("Одобренное заявление")
        .setDescription(`Одобренная смена имени для <@${infiltrationData.detectiveid}>. Ожидайте смены паспортных данных.`)
        .addFields(
            { name: 'Старый ник', value: infiltrationData.oldnickname, inline: true },
            { name: 'Новый ник', value: infiltrationData.newnickname, inline: true },
            { name: 'Паспорт', value: infiltrationData.passport, inline: true }
        )
        .setColor(Colors.Green)
        .setTimestamp();

    const highRole = getHighRole(infiltrationData.detectivefaction);
    const answerChannel = await fetchSendableChannel(inter.client, detectivesChannel);

    if (highRole === 'nn' || !answerChannel) {
        return safeReply(inter, 'Не удалось одобрить заявление. Обратитесь к администрации.');
    }

    await answerChannel.send({ content: `<@&${highRole}>`, embeds: [playersEmbed] });

    if (answerMessageId) {
        try {
            const messageToDelete = await answerChannel.messages.fetch(answerMessageId);
            await messageToDelete.delete();
        } catch {}
    }

    const originalEmbed = inter.message.embeds[0];
    if (originalEmbed) {
        const updatedEmbed = new EmbedBuilder()
            .setTitle(originalEmbed.title ?? 'Заявление')
            .setColor(Colors.Green)
            .setFields(originalEmbed.fields)
            .setDescription(`Одобрено <@${member.user.id}> ${member.displayName}`)
            .setTimestamp();

        await inter.message.edit({ components: [], embeds: [updatedEmbed], content: '' });
    }

    return safeReply(inter, 'Заявление одобрено.');
}

export async function handleModal(inter: ModalSubmitInteraction, member: GuildMember) {
    const passport = inter.fields.getTextInputValue('passport');
    const { messageId, detectivesChannel, detectiveId } = parseCustomId(inter.customId);

    const govChannel = await fetchSendableChannel(inter.client, GOV_NICKNAME_REQUESTS_CHANNEL_ID);
    if (!govChannel || !messageId) {
        return safeReply(inter, 'Не удалось обнаружить оригинальное сообщение.');
    }

    let originalMessage;
    try {
        originalMessage = await govChannel.messages.fetch(messageId);
    } catch {
        return safeReply(inter, 'Не удалось найти оригинальное сообщение.');
    }

    const answerChannel = await fetchSendableChannel(inter.client, detectivesChannel);
    if (!answerChannel) {
        return safeReply(inter, 'Не удалось отправить сообщение в детективный дискорд.');
    }

    const infiltration = retrieveInfiltration(detectiveId);
    if (!infiltration) {
        return safeReply(inter, 'Не удалось обнаружить указанного внедренца в базе данных.');
    }

    const answerEmbed = new EmbedBuilder()
        .setTitle("Уведомление от правительства | GTA 5 Blackberry")
        .setDescription(
            `Для продолжения работы по заявлению необходимо провести оплату 30.000$.\n` +
            `Оплата переводом возможна по паспорту ${passport} (с комиссией), ` +
            `либо связавшись лично с ${member.displayName}`
        )
        .addFields(
            { name: 'Старый ник', value: infiltration.oldnickname, inline: true },
            { name: 'Новый ник', value: infiltration.newnickname, inline: true },
            { name: 'Фракция', value: infiltration.faction, inline: true }
        )
        .setColor(Colors.DarkRed)
        .setTimestamp();

    const highRole = getHighRole(infiltration.detectivefaction);
    const answerMessage = await answerChannel.send({ 
        content: `<@&${highRole}> получило информацию для продолжения внедрения`, 
        embeds: [answerEmbed] 
    });

    const adminButton = new ButtonBuilder()
        .setCustomId(`dnames_${detectivesChannel}_${detectiveId}_admins_${messageId}_${answerMessage.id}`)
        .setLabel('Одобрить')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(adminButton);
    
    const mentions = GOV_NICKNAME_REQUESTS_ROLES_ID.map(id => `<@&${id}>`).join(' ');
    const originalEmbed = inter.message?.embeds?.[0];
    
    if (originalEmbed) {
        const updatedEmbed = new EmbedBuilder()
            .setTitle(originalEmbed.title ?? 'Заявление')
            .setColor(Colors.Yellow)
            .setFields(originalEmbed.fields)
            .setDescription(`На рассмотрении <@${member.user.id}> ${member.displayName}`)
            .setTimestamp();

        await originalMessage.edit({ 
            embeds: [updatedEmbed], 
            components: [row], 
            content: `${mentions}\nОжидается оплата.` 
        });
    }

    return safeReply(inter, 'Информация отправлена в дискорд детективов с уведомлением!');
}