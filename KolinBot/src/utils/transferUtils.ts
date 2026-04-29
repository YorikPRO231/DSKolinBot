import { 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    GuildMember,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    ModalBuilder,
    TextInputStyle
} from 'discord.js';
import { TRANSFER_LOG_CHANNEL_ID } from './config';

const transferTable: Record<string, Record<string, { new: number, min: number, max: number }[]>> = {
    "FIB": {
        "NG": [{ 'new': 2, 'min': 6, 'max': 6 }, { 'new': 3, 'min': 7, 'max': 9 }, { 'new': 4, 'min': 10, 'max': 12 }, { 'new': 5, 'min': 13, 'max': 14 }],
        "LSPD": [{ 'new': 2, 'min': 5, 'max': 5 }, {'new': 3,'min': 6,'max': 8 }, { 'new': 4, 'min': 9, 'max': 11 }, { 'new': 5, 'min': 12, 'max': 13 }],
        "LSSD": [{ 'new': 2, 'min': 4, 'max': 4 }, {'new': 3,'min': 5,'max': 6 }, { 'new': 4, 'min': 7, 'max': 7 }, { 'new': 5, 'min': 8, 'max': 9 }],
        "SASPA": [{ 'new': 2, 'min': 7, 'max': 7 }, { 'new': 3, 'min': 8, 'max': 8 }, { 'new': 4, 'min': 9, 'max': 12 }],
        "USSS": [{ 'new': 2, 'min': 8, 'max': 8 }, { 'new': 3, 'min': 10, 'max': 12 }, { 'new': 4, 'min': 16, 'max': 18 }]
    },
    "LSPD": {
        "NG": [{ 'new': 2, 'min': 6, 'max': 6 }, { 'new': 3, 'min': 7, 'max': 7 }, { 'new': 4, 'min': 8, 'max': 8 }, { 'new': 5, 'min': 9, 'max': 9 }, { 'new': 6, 'min': 10, 'max': 10 }, { 'new': 7, 'min': 11, 'max': 12 }, { 'new': 8, 'min': 13, 'max': 13 }, { 'new': 9, 'min': 14, 'max': 15 }],
        "FIB": [{ 'new': 5, 'min': 4, 'max': 4 }, { 'new': 6, 'min': 5, 'max': 5 }, { 'new': 7, 'min': 7, 'max': 7 }, { 'new': 8, 'min': 8, 'max': 8 }, { 'new': 9, 'min': 9, 'max': 10 }],
        "LSSD": [{ 'new': 5, 'min': 4, 'max': 4 }, { 'new': 6, 'min': 5, 'max': 5 }, { 'new': 8, 'min': 7, 'max': 8 }, { 'new': 9, 'min': 9, 'max': 10 }],
        "SASPA": [{ 'new': 4, 'min': 7, 'max': 9 }, { 'new': 6, 'min': 10, 'max': 12 }],
        "USSS": [{ 'new': 2, 'min': 8, 'max': 8 }, { 'new': 3, 'min': 10, 'max': 12 }, { 'new': 4, 'min': 16, 'max': 18 }]
    },
    "LSSD": {
        "NG": [{ 'new': 2, 'min': 6, 'max': 6 }, { 'new': 3, 'min': 7, 'max': 7 }, { 'new': 4, 'min': 8, 'max': 9 }, { 'new': 5, 'min': 10, 'max': 10 }, { 'new': 6, 'min': 11, 'max': 13 }, { 'new': 7, 'min': 14, 'max': 15 }],
        "LSPD": [{ 'new': 3, 'min': 4, 'max': 4 }, { 'new': 4, 'min': 5, 'max': 5 }, { 'new': 6, 'min': 10, 'max': 11 }, { 'new': 7, 'min': 12, 'max': 14 }],
        "FIB": [{ 'new': 3, 'min': 3, 'max': 3 }, { 'new': 4, 'min': 4, 'max': 4 }, { 'new': 5, 'min': 5, 'max': 5 }, { 'new': 6, 'min': 7, 'max': 8 }, { 'new': 7, 'min': 9, 'max': 10 }],
        "SASPA": [{ 'new': 3, 'min': 7, 'max': 9 }, { 'new': 4, 'min': 10, 'max': 12 }],
        "USSS": [{ 'new': 2, 'min': 8, 'max': 8 }, { 'new': 3, 'min': 10, 'max': 12 }, { 'new': 4, 'min': 16, 'max': 18 }]
    },
    "NG": {
        "LSSD": [{ 'new': 3, 'min': 4, 'max': 4 }, { 'new': 6, 'min': 5, 'max': 5 }, { 'new': 7, 'min': 6, 'max': 6 }, { 'new': 8, 'min': 7, 'max': 7 }, { 'new': 11, 'min': 8, 'max': 9 }, { 'new': 12, 'min': 10, 'max': 10 }],
        "LSPD": [{ 'new': 3, 'min': 6, 'max': 6 }, { 'new': 6, 'min': 7, 'max': 7 }, { 'new': 7, 'min': 8, 'max': 8 }, { 'new': 8, 'min': 9, 'max': 9 }, { 'new': 9, 'min': 10, 'max': 10 }, { 'new': 10, 'min': 11, 'max': 11 }, { 'new': 11, 'min': 12, 'max': 13 }, { 'new': 12, 'min': 14, 'max': 14 }],
        "FIB": [{ 'new': 5, 'min': 4, 'max': 4 }, { 'new': 6, 'min': 5, 'max': 5 }, { 'new': 9, 'min': 7, 'max': 7 }, { 'new': 11, 'min': 8, 'max': 8 }, { 'new': 12, 'min': 9, 'max': 10 }],
        "SASPA": [{ 'new': 3, 'min': 7, 'max': 9 }, { 'new': 4, 'min': 10, 'max': 12 }],
        "USSS": [{ 'new': 2, 'min': 8, 'max': 8 }, { 'new': 3, 'min': 12, 'max': 18 }]
    },
    "SASPA": {
        "LSSD": [{ 'new': 3, 'min': 4, 'max': 4 }, { 'new': 4, 'min': 5, 'max': 5 }, { 'new': 5, 'min': 6, 'max': 6 }, { 'new': 6, 'min': 7, 'max': 7 }, { 'new': 9, 'min': 8, 'max': 10 }],
        "LSPD": [{ 'new': 3, 'min': 4, 'max': 4 }, { 'new': 4, 'min': 5, 'max': 6 }, { 'new': 5, 'min': 7, 'max': 7 }, { 'new': 6, 'min': 8, 'max': 8 }, { 'new': 7, 'min': 9, 'max': 9 }, { 'new': 8, 'min': 10, 'max': 11 }, { 'new': 9, 'min': 12, 'max': 14 }],
        "FIB": [{ 'new': 5, 'min': 3, 'max': 3 }, { 'new': 6, 'min': 4, 'max': 4 }, { 'new': 7, 'min': 5, 'max': 5 }, { 'new': 8, 'min': 7, 'max': 7 }, { 'new': 9, 'min': 8, 'max': 10 }],
        "NG": [{ 'new': 3, 'min': 5, 'max': 6 }, { 'new': 4, 'min': 7, 'max': 7 }, { 'new': 5, 'min': 8, 'max': 8 }, { 'new': 6, 'min': 9, 'max': 9 }, { 'new': 7, 'min': 10, 'max': 10 }, { 'new': 8, 'min': 11, 'max': 12 }, { 'new': 9, 'min': 13, 'max': 15 }],
        "USSS": [{ 'new': 4, 'min': 8, 'max': 8 }, { 'new': 5, 'min': 12, 'max': 12 }, { 'new': 6, 'min': 16, 'max': 16 }, { 'new': 7, 'min': 18, 'max': 18 }]
    },
    "USSS": {
        "NG": [{ 'new': 8, 'min': 6, 'max': 8 }, { 'new': 10, 'min': 9, 'max': 11 }, { 'new': 12, 'min': 12, 'max': 15 }],
        "LSPD": [{ 'new': 8, 'min': 4, 'max': 7 }, { 'new': 10, 'min': 8, 'max': 10 }, { 'new': 12, 'min': 11, 'max': 14 }],
        "FIB": [{ 'new': 8, 'min': 3, 'max': 4 }, { 'new': 10, 'min': 5, 'max': 5 }, { 'new': 12, 'min': 7, 'max': 10 }],
        "SASPA": [{ 'new': 8, 'min': 4, 'max': 6 }, { 'new': 10, 'min': 7, 'max': 9 }, { 'new': 12, 'min': 10, 'max': 12 }],
        "LSSD": [{ 'new': 8, 'min': 4, 'max': 4 }, { 'new': 10, 'min': 5, 'max': 6 }, { 'new': 12, 'min': 7, 'max': 10 }]
    }
};

const KNOWN_FACTIONS = ['FIB', 'LSPD', 'LSSD', 'SASPA', 'NG', 'USSS', 'GOV', 'EMS', 'JUDGE', 'LAWYER'];

function getFactionsFromRoles(member: GuildMember): string[] {
    const factions: string[] = [];
    
    for (const [, role] of member.roles.cache) {
        const roleName = role.name.toUpperCase();
        for (const faction of KNOWN_FACTIONS) {
            if (roleName.includes(faction) && !factions.includes(faction)) {
                factions.push(faction);
            }
        }
    }
    
    return factions;
}

function isLeaderOfFaction(member: GuildMember, faction: string): boolean {
    const factionLower = faction.toLowerCase();
    
    let hasLeaderRole = false;
    let hasFactionRole = false;
    
    for (const [, role] of member.roles.cache) {
        const roleName = role.name.toLowerCase();
        
        if (/лидер|leader|зам|deputy|глава|head/i.test(roleName)) {
            hasLeaderRole = true;
        }
        
        if (roleName.includes(factionLower)) {
            hasFactionRole = true;
        }
        
        if (hasLeaderRole && hasFactionRole) {
            return true;
        }
    }
    
    return false;
}

function userHasFactionPermission(member: GuildMember, faction: string): boolean {
    const factions = getFactionsFromRoles(member);
    
    if (factions.includes(faction.toUpperCase())) {
        return isLeaderOfFaction(member, faction);
    }
    
    return false;
}

export async function createTransferRequest(
    interaction: ChatInputCommandInteraction | any,
    passport: string,
    currentRank: number,
    targetFrac: string,
    currentFrac: string,
    member: GuildMember
) {
    if (['LSSD', 'FIB', 'LSPD'].includes(currentFrac) && currentRank === 6) {
        const msg = `Перевод с 6 ранга из ${currentFrac} запрещен.`;
        return await sendResponse(interaction, msg, true);
    }

    const options = transferTable[targetFrac]?.[currentFrac];
    const mapping = options?.find((m: any) => currentRank >= m.min && currentRank <= m.max);

    if (!mapping) {
        const msg = "Перевод для данного ранга/фракции не предусмотрен таблицей.";
        return await sendResponse(interaction, msg, true);
    }

    const guild = interaction.guild || member.guild;
    if (!guild) {
        const msg = "Ошибка: не удалось получить сервер.";
        return await sendResponse(interaction, msg, true);
    }

    const leaderMentions = findLeaders(guild, currentFrac, targetFrac);

    const embed = new EmbedBuilder()
        .setTitle('Заявление на перевод')
        .setColor('#dda01b')
        .setDescription(
            `**Сотрудник:** <@${interaction.user.id}> [${passport}]\n` +
            `**Из ${currentFrac} [${currentRank}] -> в ${targetFrac} [${mapping.new}]**\n\n` +
            `──────────────────────────────────────────\n` +
            `**Руководство:** ${leaderMentions}`
        )
        .addFields({
            name: 'Согласование',
            value: `${currentFrac}: ожидание | ${targetFrac}: ожидание`
        });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`tr_approve_${currentFrac}_${targetFrac}`)
            .setLabel('Одобрить')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`tr_deny_${currentFrac}_${targetFrac}`)
            .setLabel('Отклонить')
            .setStyle(ButtonStyle.Danger)
    );

    const logChannel = interaction.guild?.channels.cache.get(TRANSFER_LOG_CHANNEL_ID);

    if (logChannel?.isTextBased()) {
        await logChannel.send({ embeds: [embed], components: [buttons] });
        await sendResponse(interaction, `Заявление отправлено в канал <#${TRANSFER_LOG_CHANNEL_ID}>`, true);
    } else {
        await sendResponse(interaction, "Ошибка: Канал для заявок не найден.", true);
    }
}

export async function showFactionSelectMenu(
    interaction: ChatInputCommandInteraction,
    passport: string,
    currentRank: number,
    targetFrac: string,
    member: GuildMember
) {
    const factions = getFactionsFromRoles(member);
    
    if (factions.length === 0) {
        return await interaction.reply({
            content: "Не удалось определить вашу фракцию по ролям. Обратитесь к администратору.",
            ephemeral: true
        });
    }

    if (factions.length === 1) {
        await createTransferRequest(
            interaction,
            passport,
            currentRank,
            targetFrac,
            factions[0],
            member
        );
        return;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_transfer_${passport}_${currentRank}_${targetFrac}`)
        .setPlaceholder('Выберите фракцию');

    for (const faction of factions.slice(0, 25)) {
        selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(faction)
                .setDescription(`Перевод из ${faction}`)
                .setValue(faction)
        );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
        content: "У вас несколько фракций. Выберите из какой переводитесь:",
        components: [row],
        ephemeral: true
    });
}

export async function handleTransferSelect(
    interaction: any,
    member: GuildMember
) {
    const parts = interaction.customId.split("_");
    const passport = parts[2];
    const currentRank = parseInt(parts[3]);
    const targetFrac = parts.slice(4).join("_");
    
    const selectedFrac = interaction.values[0];
    
    const disabledMenu = new StringSelectMenuBuilder()
        .setCustomId('disabled')
        .setPlaceholder(selectedFrac)
        .setDisabled(true)
        .addOptions([
            new StringSelectMenuOptionBuilder()
                .setLabel(selectedFrac)
                .setValue(selectedFrac)
        ]);

    const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);
    
    await interaction.update({
        content: `Выбрана фракция: ${selectedFrac}. Создаю заявку...`,
        components: [disabledRow]
    });
    
    await createTransferRequest(
        interaction, 
        passport, 
        currentRank, 
        targetFrac, 
        selectedFrac, 
        member
    );
}

export async function handleApproveButton(
    interaction: any,
    member: GuildMember
) {
    const oldEmbed = interaction.message.embeds[0];
    if (!oldEmbed) return;

    const parts = interaction.customId.split("_");
    const fromFrac = parts[2];
    const toFrac = parts[3];

    const hasFromFactionPerm = userHasFactionPermission(member, fromFrac);
    const hasToFactionPerm = userHasFactionPermission(member, toFrac);

    if (!hasFromFactionPerm && !hasToFactionPerm) {
        const userRoles = member.roles.cache
            .filter((role: any) => role.name !== '@everyone')
            .map((role: any) => role.name)
            .join(', ');
            
        return interaction.reply({
            content: `У вас нет прав на одобрение перевода.\n` +
                     `Требуется роль лидера ${fromFrac} или ${toFrac}\n` +
                     `Ваши роли: ${userRoles || 'нет ролей'}`,
            ephemeral: true
        });
    }

    if (hasFromFactionPerm && hasToFactionPerm) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`approve_as_${interaction.customId}`)
            .setPlaceholder('От какой фракции одобряете?')
            .addOptions([
                new StringSelectMenuOptionBuilder()
                    .setLabel(fromFrac)
                    .setDescription(`Одобрить от ${fromFrac}`)
                    .setValue(fromFrac),
                new StringSelectMenuOptionBuilder()
                    .setLabel(toFrac)
                    .setDescription(`Одобрить от ${toFrac}`)
                    .setValue(toFrac)
            ]);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        return interaction.reply({
            content: "Вы лидер обеих фракций. Выберите от какой одобряете:",
            components: [row],
            ephemeral: true
        });
    }

    const userFrac = hasFromFactionPerm ? fromFrac : toFrac;
    await processApproval(interaction, oldEmbed, fromFrac, toFrac, userFrac, member);
}

export async function handleApproveSelect(
    interaction: any,
    member: GuildMember
) {
    const originalCustomId = interaction.customId.replace("approve_as_", "");
    const selectedFrac = interaction.values[0];
    
    if (!userHasFactionPermission(member, selectedFrac)) {
        const disabledMenu = new StringSelectMenuBuilder()
            .setCustomId('disabled')
            .setPlaceholder('Выберите фракцию')
            .setDisabled(true)
            .addOptions([
                new StringSelectMenuOptionBuilder()
                    .setLabel('Нет доступа')
                    .setValue('none')
            ]);

        const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);
        
        return interaction.update({ 
            content: `Ошибка: у вас нет прав лидера фракции ${selectedFrac}`, 
            components: [disabledRow]
        });
    }
    
    const channel = interaction.client.channels.cache.get(interaction.channelId);
    const originalMessage = await channel?.messages.fetch(interaction.message.reference?.messageId || interaction.message.id);
    const embed = originalMessage?.embeds[0] || interaction.message.embeds[0];

    if (!embed) {
        const disabledMenu = new StringSelectMenuBuilder()
            .setCustomId('disabled')
            .setPlaceholder('Выберите фракцию')
            .setDisabled(true)
            .addOptions([
                new StringSelectMenuOptionBuilder()
                    .setLabel('Ошибка')
                    .setValue('none')
            ]);

        const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);
        
        return interaction.update({ 
            content: "Ошибка: не удалось найти заявку", 
            components: [disabledRow]
        });
    }

    const parts = originalCustomId.split("_");
    const fromFrac = parts[2];
    const toFrac = parts[3];

    await processApproval(interaction, embed, fromFrac, toFrac, selectedFrac, member);
}

export async function handleDenyButton(interaction: any, member: GuildMember) {
    const oldEmbed = interaction.message.embeds[0];
    if (!oldEmbed) return;

    const parts = interaction.customId.split("_");
    const fromFrac = parts[2];
    const toFrac = parts[3];

    const hasFromFactionPerm = userHasFactionPermission(member, fromFrac);
    const hasToFactionPerm = userHasFactionPermission(member, toFrac);

    if (!hasFromFactionPerm && !hasToFactionPerm) {
        return interaction.reply({
            content: `У вас нет прав на отклонение перевода. Требуется роль лидера ${fromFrac} или ${toFrac}`,
            ephemeral: true
        });
    }

    const statusField = oldEmbed.fields?.find((f: any) => f.name === 'Согласование');
    if (statusField) {
        const parts = statusField.value.split(' | ');
        if (parts.length === 2 && parts[0].includes('одобрено') && parts[1].includes('одобрено')) {
            return interaction.reply({
                content: "Перевод уже полностью одобрен",
                ephemeral: true
            });
        }
    }

    const modal = new ModalBuilder()
        .setCustomId(`deny_modal_${interaction.customId.replace("tr_deny_", "")}`)
        .setTitle("Причина отказа");

    const reasonInput = new TextInputBuilder()
        .setCustomId("reason_text")
        .setLabel("Причина отказа")
        .setPlaceholder("Опишите причину отказа")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

export async function handleDenyModal(
    interaction: any,
    member: GuildMember
) {
    const reason = interaction.fields.getTextInputValue("reason_text");

    const channel = interaction.client.channels.cache.get(interaction.channelId);
    const originalMessage = await channel?.messages.fetch(interaction.message?.reference?.messageId || interaction.message?.id);
    const oldEmbed = originalMessage?.embeds[0] || interaction.message?.embeds[0];
    
    if (oldEmbed) {
        const newEmbed = EmbedBuilder.from(oldEmbed)
            .setColor("#e74c3c")
            .setFields({
                name: 'Статус',
                value: `Отклонено: ${member.displayName}\nПричина: ${reason}`
            });

        if (originalMessage) {
            await originalMessage.edit({ embeds: [newEmbed], components: [] });
        }
        
        await interaction.update({ 
            content: "Перевод отклонен", 
            components: [] 
        });
    }
}

function findLeaders(guild: any, ...factions: string[]): string {
    const leaders: string[] = [];
    
    for (const faction of factions) {
        const factionLeaders = guild?.members.cache.filter((m: GuildMember) => 
            isLeaderOfFaction(m, faction)
        );
        
        if (factionLeaders) {
            for (const [id] of factionLeaders) {
                if (!leaders.includes(id)) {
                    leaders.push(id);
                }
            }
        }
    }
    
    return leaders.length > 0 ? leaders.map((id: string) => `<@${id}>`).join(' ') : "Не найдено";
}

async function processApproval(
    interaction: any,
    oldEmbed: any,
    fromFrac: string,
    toFrac: string,
    userFrac: string,
    member: GuildMember
) {
    if (!userHasFactionPermission(member, userFrac)) {
        const disabledMenu = new StringSelectMenuBuilder()
            .setCustomId('disabled')
            .setPlaceholder('Выберите фракцию')
            .setDisabled(true)
            .addOptions([
                new StringSelectMenuOptionBuilder()
                    .setLabel('Нет доступа')
                    .setValue('none')
            ]);

        const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);
        
        if (interaction.isStringSelectMenu?.()) {
            return interaction.update({ 
                content: `У вас нет прав лидера фракции ${userFrac}.`, 
                components: [disabledRow]
            });
        }
        return interaction.reply({ content: `У вас нет прав лидера фракции ${userFrac}.`, ephemeral: true });
    }

    const statusField = oldEmbed.fields?.find((f: any) => f.name === 'Согласование');
    if (!statusField) return;

    const statusValue = statusField.value;
    const fromApproved = statusValue.includes(`${fromFrac}: одобрено`);
    const toApproved = statusValue.includes(`${toFrac}: одобрено`);

    if ((userFrac === fromFrac && fromApproved) || (userFrac === toFrac && toApproved)) {
        if (interaction.isStringSelectMenu?.()) {
            const disabledMenu = new StringSelectMenuBuilder()
                .setCustomId('disabled')
                .setPlaceholder('Выберите фракцию')
                .setDisabled(true)
                .addOptions([
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Уже одобрено')
                        .setValue('none')
                ]);

            const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);
            
            return interaction.update({ 
                content: `Фракция ${userFrac} уже одобрила перевод`, 
                components: [disabledRow]
            });
        }
        return interaction.reply({ content: `Фракция ${userFrac} уже одобрила перевод`, ephemeral: true });
    }

    const newFromApproved = userFrac === fromFrac ? true : fromApproved;
    const newToApproved = userFrac === toFrac ? true : toApproved;

    const newStatusValue = `${fromFrac}: ${newFromApproved ? 'одобрено' : 'ожидание'} | ${toFrac}: ${newToApproved ? 'одобрено' : 'ожидание'}`;

    const newEmbed = EmbedBuilder.from(oldEmbed)
        .setFields({ name: 'Согласование', value: newStatusValue });

    if (newFromApproved && newToApproved) {
        newEmbed.setColor('#2ecc71');
        newEmbed.setTitle('Заявление на перевод (Одобрено)');
        
        const channel = interaction.client.channels.cache.get(interaction.channelId);
        const originalMessage = await channel?.messages.fetch(interaction.message?.reference?.messageId || interaction.message?.id);
        
        if (originalMessage) {
            await originalMessage.edit({ embeds: [newEmbed], components: [] });
        }
        
        if (interaction.isStringSelectMenu?.()) {
            await interaction.update({ content: "Перевод полностью одобрен!", components: [] });
        } else {
            await interaction.update({ embeds: [newEmbed], components: [] });
        }
    } else {
        const channel = interaction.client.channels.cache.get(interaction.channelId);
        const originalMessage = await channel?.messages.fetch(interaction.message?.reference?.messageId || interaction.message?.id);
        
        if (originalMessage) {
            await originalMessage.edit({ embeds: [newEmbed] });
        }
        
        if (interaction.isStringSelectMenu?.()) {
            await interaction.update({ content: `Одобрено от фракции ${userFrac}`, components: [] });
        } else {
            await interaction.update({ embeds: [newEmbed] });
        }
    }
}

async function sendResponse(interaction: any, message: string, ephemeral: boolean) {
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ content: message, components: [] });
        } else {
            await interaction.reply({ content: message, ephemeral });
        }
    } catch (error) {
        console.error("Ошибка отправки ответа:", error);
    }
}