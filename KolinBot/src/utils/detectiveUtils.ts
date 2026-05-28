import {
    ActionRowBuilder,
    APIEmbed,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Client,
    Colors,
    EmbedBuilder,
    GuildMember,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
    NewsChannel,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
    ThreadChannel
} from "discord.js";
import {InfiltrationsRepository, PatchesRepository} from "../databases";
import {getSystemChannel, getSystemRole, loadSettings} from "../config/settings-loader";
import {generatePatch, getFaction} from "./utilsState";

type SendableChannel = TextChannel | NewsChannel | ThreadChannel;

interface IInfiltration {
    detectiveid: string;
    detectivefaction: string;
    oldnickname: string;
    newnickname: string;
    passport: string;
    faction: string;
}

interface CustomIdData {
    detectivesChannel: string;
    detectiveId: string;
    stage: 'gov' | 'admins';
    messageId?: string;
    answerMessageId?: string;
}

function parseCustomId(customId: string): CustomIdData {
    const [, detectivesChannel, detectiveId, stage, messageId, answerMessageId] = customId.split("_");
    return { 
        detectivesChannel, 
        detectiveId, 
        stage: stage as 'gov' | 'admins', 
        messageId, 
        answerMessageId 
    };
}

function getHighRole(faction: string): string {
    const detectives = loadSettings().detectives;
    return detectives[faction]?.high_role_id || 'nn';
}

async function fetchChannel<T = SendableChannel>(client: Client, channelId: string): Promise<T | null> {
    try {
        const channel = await client.channels.fetch(channelId);
        return (channel && 'send' in channel) ? (channel as unknown as T) : null;
    } catch {
        return null;
    }
}

async function safeReply(inter: ButtonInteraction | ModalSubmitInteraction, message: string) {
    if (!inter.replied && !inter.deferred) {
        await inter.reply({ content: message, flags: MessageFlags.Ephemeral });
    }
}

export async function handleButton(inter: ButtonInteraction, member: GuildMember) {
    const customId = inter.customId;

    if (customId.startsWith("apr_") || customId === 'pdr') {
        return handlePatchRequest(inter, member);
    }

    if (customId.startsWith("dnames")) {
        const data = parseCustomId(customId);
        const infiltration = await InfiltrationsRepository.retrieveInfiltration(data.detectiveId) as IInfiltration | undefined;

        if (!infiltration) {
            return safeReply(inter, '❌ Данные внедрения не найдены в базе данных.');
        }

        switch (data.stage) {
            case 'gov':
                return handleGovStage(inter);
            case 'admins':
                return handleAdminsStage(inter, member, infiltration, data);
            default:
                return safeReply(inter, 'Неизвестная стадия обработки.');
        }
    }
}

function hasPatchPermission(member: GuildMember, guildId: string): boolean {
    const memberRoleIds = new Set(member.roles.cache.map(r => r.id));
    const config = loadSettings();
    
    for (const [, detectiveInfo] of Object.entries(config.detectives)) {
        if (detectiveInfo.discord_id === guildId) {
            return memberRoleIds.has(detectiveInfo.high_role_id);
        }
    }
    
    for (const [, factionInfo] of Object.entries(config.factions)) {
        if (factionInfo.discord_id === guildId) {
            return factionInfo.roles.high.some(roleId => memberRoleIds.has(roleId));
        }
    }
    
    return false;
}

async function handlePatchRequest(inter: ButtonInteraction, member: GuildMember) {
    const customId = inter.customId;
    const guildId = inter.guild?.id;

    if (!guildId || !hasPatchPermission(member, guildId)) {
        return safeReply(inter, '❌ **Ошибка:** У вас нет прав на выдачу нашивок.');
    }

    if (customId === "pdr") {
        const originalMessage = inter.message;
        const embed = originalMessage.embeds[0];
        const edited = new EmbedBuilder()
            .setFields(embed.fields)
            .setDescription(embed.description)
            .setColor(Colors.DarkRed)
            .setTitle(embed.title)
            .setTimestamp()
            .setFooter({text: `Выдача отказана ${inter.user.id} ${member.displayName}`});
        
        await originalMessage.edit({ embeds: [edited], components: [] });
        return safeReply(inter, '❌ В выдаче нашивки отказано.');
    }

    let requestData;
    try {
        const jsonString = customId.replace('apr_', '');
        requestData = JSON.parse(jsonString);
    } catch (error) {
        console.error("Ошибка парсинга данных запроса:", error);
        return safeReply(inter, '❌ **Ошибка:** Некорректные данные запроса.');
    }

    const { 
        u: requesterId, 
        p: position, 
        n: name, 
        s: surname, 
        pp: passport 
    } = requestData;

    if (!requesterId || !position || !name || !surname || !passport) {
        return safeReply(inter, '❌ **Ошибка:** Неполные данные запроса.');
    }

    const config = loadSettings();
    const isDetectiveFaction = Object.values(config.detectives).some(
        (info) => info.discord_id === inter.guild?.id,
    );
    const faction = getFaction(inter.guild?.id, inter.guild?.name);

    if (!faction) {
        return safeReply(inter, '❌ **Ошибка:** Не удалось определить фракцию.');
    }

    const level = isDetectiveFaction ? "detective" : "casual";
    const patch = await generatePatch(
        faction.abbreviation,
        position,
        name,
        surname,
        passport,
        level,
    );

    const logChannel = await fetchChannel(inter.client, faction.logChannel);
    if (!logChannel) {
        return safeReply(inter, '❌ **Ошибка:** Не удалось определить канал логов нашивок.');
    }

    await PatchesRepository.pushPlayerId(passport, `${name} ${surname}`, requesterId, faction.abbreviation, patch);

    const embedLog = new EmbedBuilder()
        .setColor(level === "detective" ? 0xff4654 : 0x2b2d31)
        .setTitle(`${faction.fullName} | Лог нашивок`)
        .setDescription(
            `Сотрудник ${inter.user} выдал новую нашивку для <@${requesterId}>\n\n` +
            `\`\`\`/do На груди закреплена нашивка: ${patch}\`\`\``,
        )
        .addFields(
            { name: "Сотрудник", value: `<@${requesterId}>`, inline: true },
            { name: "Паспорт", value: `${passport}`, inline: true },
            { name: "Тип", value: level === "detective" ? "Детективная" : "Обычная", inline: true },
            { name: "Дата", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
        )
        .setTimestamp()
        .setFooter({ text: `ID: ${requesterId} | Паспорт: ${passport}` });

    await logChannel.send({ embeds: [embedLog], content: `<@${requesterId}>` });

    if (level !== "detective") {
        const govPatchLogChannelId = getSystemChannel('gov_patch_log');
        
        const embedGov = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle(`${faction.fullName} | Лог нашивок`)
            .setDescription(
                `Сотрудник ${faction.abbreviation} ${inter.user} выдал новую нашивку для <@${requesterId}>\n\n` +
                `\`\`\`/do На груди закреплена нашивка: ${patch}\`\`\``,
            )
            .addFields(
                { name: "Сотрудник", value: `<@${requesterId}>`, inline: true },
                { name: "Паспорт", value: `${passport}`, inline: true },
                { name: "Тип", value: "Обычная", inline: true },
                { name: "Дата", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
            )
            .setTimestamp()
            .setFooter({ text: `ID: ${requesterId} | Паспорт: ${passport}` });

        const govLog = inter.client.channels.cache.get(govPatchLogChannelId) as TextChannel;
        if (govLog) {
            await govLog.send({ embeds: [embedGov] });
        }
    }

    const originalMessage = inter.message;
    const embed = originalMessage.embeds[0];
    const edited = new EmbedBuilder()
        .setFields(embed.fields)
        .setDescription(embed.description)
        .setColor(Colors.Green)
        .setTitle(embed.title)
        .setTimestamp()
        .setFooter({text: `Произведена выдача ${inter.user.id} ${member.displayName}`});

    await originalMessage.edit({ embeds: [edited], components: [] });
    return safeReply(inter, '✅ Нашивка выдана игроку.');
}


async function handleGovStage(inter: ButtonInteraction) {
    const modal = new ModalBuilder()
        .setCustomId(`${inter.customId}_${inter.message.id}`)
        .setTitle("Реквизиты для оплаты");

    const passportInput = new TextInputBuilder()
        .setCustomId("passport")
        .setLabel("Номер счета (паспорт)")
        .setPlaceholder("Куда переводить 30.000$")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(10)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(passportInput));
    await inter.showModal(modal);
}

async function handleAdminsStage(
    inter: ButtonInteraction, 
    member: GuildMember, 
    infiltration: IInfiltration, 
    data: CustomIdData
) {
    const adminNicknameLogsChannelId = getSystemChannel('admin_nickname_logs');
    const adminChannel = await fetchChannel(inter.client, adminNicknameLogsChannelId);
    if (adminChannel) {
        const adminEmbed = new EmbedBuilder()
            .setTitle(`Запрос на смену имени | ${infiltration.detectivefaction}`)
            .setColor(Colors.Blue)
            .setDescription(`Команда для исполнения:\n\`\`\`bash\noffforce_rename ${infiltration.passport} Внедрение\`\`\``)
            .addFields(
                { name: 'Кем одобрено', value: `${member.displayName} (${member.id})`, inline: true },
                { name: 'Новый ник', value: infiltration.newnickname, inline: true }
            )
            .setTimestamp();
        
        await adminChannel.send({ content: "<@&796471733057880174>", embeds: [adminEmbed] });
    }

    const highRole = getHighRole(infiltration.detectivefaction);
    const answerChannel = await fetchChannel(inter.client, data.detectivesChannel);

    if (answerChannel && highRole !== 'nn') {
        const playersEmbed = new EmbedBuilder()
            .setTitle("Заявление одобрено")
            .setColor(Colors.Green)
            .setDescription(`Одобрена смена ника для <@${infiltration.detectiveid}>. Ожидайте смены данных в штате.`)
            .addFields(
                { name: 'Старый ник', value: infiltration.oldnickname, inline: true },
                { name: 'Новый ник', value: infiltration.newnickname, inline: true },
                { name: 'Паспорт', value: infiltration.passport, inline: true }
            )
            .setTimestamp();

        await answerChannel.send({ content: `<@&${highRole}>`, embeds: [playersEmbed] });

        if (data.answerMessageId) {
            await answerChannel.messages.fetch(data.answerMessageId).then(m => m.delete()).catch(() => null);
        }
    }

    const oldEmbed = inter.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(oldEmbed as APIEmbed)
        .setTitle("Заявление исполнено")
        .setColor(Colors.Green)
        .setDescription(`**Статус:** Одобрено и передано администрации\n**Ответственный:** <@${member.id}>`)
        .setTimestamp();

    await inter.message.edit({ components: [], embeds: [updatedEmbed], content: '' });
    return safeReply(inter, 'Успешно: Логи отправлены, статус обновлен.');
}

export async function handleModal(inter: ModalSubmitInteraction, member: GuildMember) {
    const billingPassport = inter.fields.getTextInputValue('passport');
    const data = parseCustomId(inter.customId);

    const infiltration = await InfiltrationsRepository.retrieveInfiltration(data.detectiveId) as IInfiltration | undefined;
    if (!infiltration) return safeReply(inter, '❌ Внедренец не найден в БД.');

    const govNicknameRequestsChannelId = getSystemChannel('gov_nickname_requests');
    const answerChannel = await fetchChannel(inter.client, data.detectivesChannel);
    const govChannel = await fetchChannel(inter.client, govNicknameRequestsChannelId);

    if (!answerChannel || !govChannel) {
        return safeReply(inter, '❌ Ошибка: каналы не найдены.');
    }

    const highRole = getHighRole(infiltration.detectivefaction);
    const billEmbed = new EmbedBuilder()
        .setTitle("Уведомление Правительства")
        .setColor(Colors.Gold)
        .setDescription(
            `Для проведения процедуры внедрения необходимо оплатить государственную пошлину в размере **30.000$**.\n\n` +
            `**Способы оплаты:**\n` +
            `1. Переводом на номер паспорта: \`${billingPassport}\` (учитывайте комиссию)\n` +
            `2. Лично в руки сотруднику: ${member.displayName} (<@${member.id}>)`
        )
        .addFields(
            { name: 'Цель', value: `Смена ника: ${infiltration.oldnickname} -> ${infiltration.newnickname}`, inline: false },
            { name: 'Фракция внедрения', value: infiltration.faction, inline: true }
        )
        .setFooter({ text: "GTA 5 Blackberry | Government" })
        .setTimestamp();

    const answerMessage = await answerChannel.send({ 
        content: `<@&${highRole}> получены реквизиты для оплаты.`, 
        embeds: [billEmbed] 
    });

    const originalMessage = await govChannel.messages.fetch(data.messageId!).catch(() => null);
    if (!originalMessage) return safeReply(inter, '❌ Оригинальное сообщение в GOV не найдено.');

    const govNicknameRequestsRoles = getSystemRole('gov_nickname_requests');
    
    const adminButton = new ButtonBuilder()
        .setCustomId(`dnames_${data.detectivesChannel}_${data.detectiveId}_admins_${data.messageId}_${answerMessage.id}`)
        .setLabel('Оплачено (Одобрить)')
        .setStyle(ButtonStyle.Success);

    const mentions = govNicknameRequestsRoles.map(id => `<@&${id}>`).join(' ');
    const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0] as APIEmbed)
        .setColor(Colors.Yellow)
        .setDescription(`**Статус:** Ожидание оплаты\n**Выставил счет:** <@${member.id}>`)
        .setTimestamp();

    await originalMessage.edit({ 
        embeds: [updatedEmbed], 
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(adminButton)], 
        content: `${mentions}\nВыставлен счет на оплату.` 
    });

    return safeReply(inter, 'Реквизиты успешно отправлены детективам.');
}