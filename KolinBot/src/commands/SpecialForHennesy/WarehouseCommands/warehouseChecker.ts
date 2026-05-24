import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextChannel,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import { AdminsRepository, WarehouseRepository } from '../../../databases/index';
import { getFactionByKey } from "../../../config/settings-loader";
import axios from "axios";
import {analyzeLogData, formReportData, WarehouseData} from "../../../utils/warehouseUtils";
import * as logger from "../../../logging";
import {ButtonStyle, ComponentType} from "discord-api-types/v10";
import {PUNISHMENT_TYPES} from "../../../utils/constants/punishments";

const FRACTION_TYPES = {
    MM: "MM", RM: "RM", LCN: "LCN", YAK: "YAK", AM: "AM",
    LSPD: "LSPD", LSSD: "LSSD", FIB: "FIB", GOV: "GOV",
    ARMY: "ARMY", SASPA: "SASPA", FAM: "FAM", MG: "MG-13",
    LSV: "LSV", ESB: "ESB", BSG: "BSG", WN: "WN"
} as const;

type FractionType = keyof typeof FRACTION_TYPES;

export const data = new SlashCommandBuilder()
    .setName("проверить-склад")
    .setDescription("Анализ логов и фиксация нарушения")
    .addAttachmentOption(option => option.setName("лог-файл").setDescription("Файл логов").setRequired(true))
    .addStringOption(option => option.setName("фракция").setDescription("Фракция игрока").setRequired(true)
        .addChoices(
            {name: "Мексиканская мафия", value: FRACTION_TYPES.MM},
            {name: "Русская мафия", value: FRACTION_TYPES.RM},
            {name: "Итальянская мафия", value: FRACTION_TYPES.LCN},
            {name: "Японская мафия", value: FRACTION_TYPES.YAK},
            {name: "Армянская мафия", value: FRACTION_TYPES.AM},
            {name: "LSPD", value: FRACTION_TYPES.LSPD},
            {name: "LSSD", value: FRACTION_TYPES.LSSD},
            {name: "FIB", value: FRACTION_TYPES.FIB},
            {name: "GOV", value: FRACTION_TYPES.GOV},
            {name: "ARMY", value: FRACTION_TYPES.ARMY},
            {name: "SASPA", value: FRACTION_TYPES.SASPA},
            {name: "The Families", value: FRACTION_TYPES.FAM},
            {name: "Los Santos Vagos", value: FRACTION_TYPES.LSV},
            {name: "East Side Ballas", value: FRACTION_TYPES.ESB},
            {name: "Marabunta Grande", value: FRACTION_TYPES.MG},
            {name: "Bloods Street Gang", value: FRACTION_TYPES.BSG}
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function getAdminDisplayName(inter: ChatInputCommandInteraction): string {
    const member = inter.guild?.members.cache.get(inter.user.id);
    return member?.nickname || inter.user.globalName || inter.user.displayName || inter.user.username;
}

function getFactionLabel(factionKey: FractionType): string {
    const faction = getFactionByKey(factionKey);
    return faction?.label || factionKey;
}

export async function execute(inter: ChatInputCommandInteraction) {
    const adminSurname = AdminsRepository.getAdminSurname(inter.user.id);
    const adminDisplayName = getAdminDisplayName(inter);
    if (!adminSurname) {
        return inter.reply({content: "Вы не зарегистрированы!", flags: [MessageFlags.Ephemeral]});
    }
    await inter.deferReply();
    const faction = inter.options.getString("фракция") as FractionType;
    const attachment = inter.options.getAttachment("лог-файл", true);
    try {
        const response = await axios.get(attachment.url, {responseType: 'text'});
        const fileContent = response.data;
        const report = analyzeLogData(fileContent)
        if (report.status != 'LEAKS' && report.status != 'CLEAN' || !report.passport) {
            return inter.editReply({content: `Не удалось проверить файл: ${report.status}.`})
        }
        const parsed = formReportData(report);
        const files = [new AttachmentBuilder(Buffer.from(parsed[0], 'utf-8'), {name: `report_${report.passport}.txt`})];
        const embed = new EmbedBuilder().setTitle(`Проверка склада ${faction} | Blackberry`)
            .setDescription(`\`\`\`${parsed[1]}\`\`\``).setColor(Colors.Purple)
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`warehouse_deny`)
                .setLabel('Нет нарушений')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('warehouse_accept')
                .setLabel('Зафиксировать нарушение')
                .setStyle(ButtonStyle.Danger)
        );
        const message = await inter.editReply({
            content: `<@${inter.user.id}>`,
            embeds: [embed],
            files,
            components: [row]
        });
        if (report.status === 'CLEAN') {
            return;
        }
        await handleWarehouseButtons(message, report.passport, inter.user.id, faction, adminSurname, adminDisplayName, report)
    } catch (e) {
        return logger.logError(inter.client, e as Error, 'Обработка склада v2')
    }
}


const PUNISHMENT_CONFIG = {
    iban: {type: PUNISHMENT_TYPES.IBAN, name: "IBAN", needsDuration: false},
    warnban: {type: PUNISHMENT_TYPES.WARN_BAN, name: "Бан + Варн", needsDuration: true, durationUnit: "дн."},
    ban: {type: PUNISHMENT_TYPES.BAN, name: "Бан", needsDuration: true, durationUnit: "дн."},
    warn: {type: PUNISHMENT_TYPES.WARN, name: "Варн", needsDuration: false},
    jail: {type: PUNISHMENT_TYPES.AJAIL, name: "Деморган", needsDuration: true, durationUnit: "мин."},
    curator: {type: PUNISHMENT_TYPES.WARN, name: "Выговор от куратора", needsDuration: false, isCuratorReprimand: true}
};

const FRACTION_GROUPS = {
    MAFIA: [FRACTION_TYPES.MM, FRACTION_TYPES.RM, FRACTION_TYPES.LCN, FRACTION_TYPES.YAK, FRACTION_TYPES.AM] as FractionType[],
    GANG: [FRACTION_TYPES.FAM, FRACTION_TYPES.LSV, FRACTION_TYPES.ESB, FRACTION_TYPES.MG, FRACTION_TYPES.BSG] as FractionType[],
    STATE: [FRACTION_TYPES.LSPD, FRACTION_TYPES.LSSD, FRACTION_TYPES.FIB, FRACTION_TYPES.GOV, FRACTION_TYPES.ARMY, FRACTION_TYPES.SASPA] as FractionType[]
};

export async function handleWarehouseButtons(
    message: any,
    passport: string,
    userid: string,
    faction: FractionType,
    adminSurname: string,
    adminDisplayName: string,
    report: WarehouseData) {
    let finished = false;
    const collector = message.createMessageComponentCollector({componentType: ComponentType.Button, time: 600000});
    collector.on('collect', async (btnInter: ButtonInteraction) => {
        if (btnInter.user.id !== userid) {
            return btnInter.reply({content: "Недостаточно доступа!", flags: [MessageFlags.Ephemeral]});
        }

        if (finished) {
            return btnInter.reply({
                content: "Срок использования истек, либо взаимодействие уже было произведено!",
                flags: [MessageFlags.Ephemeral]
            });
        }

        if (btnInter.customId === 'warehouse_deny') {
            finished = true;
            collector.stop();
            await btnInter.update({content: "✅ Проверка завершена: Нарушений не обнаружено.", components: []});
            return;
        }

        if (btnInter.customId === 'warehouse_accept') {
            finished = true;
            collector.stop();
            await btnInter.update({components: []});
            await preparePunishment(btnInter, passport, faction, adminSurname, adminDisplayName, report);
        }
    });
}


async function preparePunishment(
    btnInter: ButtonInteraction,
    passport: string,
    faction: FractionType,
    adminSurname: string,
    adminDisplayName: string,
    report: WarehouseData) {
    const isStateFraction = FRACTION_GROUPS.STATE.includes(faction);

    const selectOptions = [
        {label: 'Бан', description: 'Обычный бан аккаунта', value: 'ban'},
        {label: 'IBAN', description: 'Перманентный бан', value: 'iban'},
        {label: 'Варн', description: 'Предупреждение', value: 'warn'},
        {label: 'Бан + Варн', description: 'Бан и предупреждение одновременно', value: 'warnban'},
        {label: 'Деморган', description: 'Деморган', value: 'jail'},
        {label: 'Деморган + Варн', description: "Деморган и варн одновременно", value: 'jailwarn'}
    ];

    if (isStateFraction) {
        selectOptions.push({
            label: 'Выговор от куратора',
            description: 'Предупреждение с требованием вернуть имущество',
            value: 'curator'
        });
    }

    const punishmentSelect = new StringSelectMenuBuilder()
        .setCustomId('punish_type_select')
        .setPlaceholder('Выберите тип наказания')
        .addOptions(selectOptions);
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(punishmentSelect);
    const selectMsg = await btnInter.followUp({
        content: `**Выберите тип наказания для #${passport}**\nФракция: ${getFactionLabel(faction)}`,
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });
    const collector = selectMsg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000
    });
    collector.on('collect', async (selectInter: StringSelectMenuInteraction) => {
        if (selectInter.user.id !== btnInter.user.id) {
            return btnInter.reply({content: "Недостаточно доступа!", flags: [MessageFlags.Ephemeral]});
        }
        const punishmentType = selectInter.values[0];
        const config = PUNISHMENT_CONFIG[punishmentType as keyof typeof PUNISHMENT_CONFIG];
        if (!config.needsDuration) {
            await selectInter.update({components: []});
            await processPunishment(selectInter, passport, faction, adminSurname, adminDisplayName, punishmentType, null, report);
            return;
        }
        const modal = new ModalBuilder()
            .setCustomId(`duration_modal_${passport}_${punishmentType}`)
            .setTitle(`Срок наказания`);
        const durationInput = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel(punishmentType === 'jail' ? 'Срок в минутах' : 'Срок в днях')
            .setPlaceholder(punishmentType === 'jail' ? '100' : '30')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(3);
        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
        );
        await selectInter.showModal(modal);
        const submitted = await selectInter.awaitModalSubmit({time: 60000}).catch(() => null);
        if (submitted) {
            const duration = submitted.fields.getTextInputValue('duration');
            await submitted.reply({content: "⏳ Обработка...", flags: [MessageFlags.Ephemeral]});
            await processPunishment(submitted, passport, faction, adminSurname, adminDisplayName, punishmentType, duration, report);
            await selectMsg.delete().catch(() => {
            });
        }
    })
}



async function processPunishment(
    inter: StringSelectMenuInteraction | ModalSubmitInteraction,
    passport: string,
    faction: FractionType,
    adminSurname: string,
    adminDisplayName: string,
    punishmentType: string,
    duration: string | null,
    report: WarehouseData) {
    const config = PUNISHMENT_CONFIG[punishmentType as keyof typeof PUNISHMENT_CONFIG];
    if (punishmentType === 'curator') {
        let curatorText = `discord ${passport}\n`
        let storage = ''
        let footer = ''
        for (const item of report.items) {
            if (item.vehicle && !storage.includes('машине')) {
                storage += 'машине, '
            }
            if (item.family && !storage.includes('семье')) {
                storage += 'семье, '
            }
            if (item.apartment && !storage.includes('квартире')) {
                storage += 'квартире, '
            }
            if (item.house && !storage.includes('доме')) {
                storage += 'доме, '
            }
            if (item.customWarehouse && !storage.includes('арендованном складе')) {
                storage += 'арендованном складе, '
            }
            if (item.sold && !storage.includes('DarkVito')) {
                storage += 'DarkVito, '
            }
            if (item.traded && !storage.includes('передано')) {
                storage += 'передано, '
            }
            footer += `${item.name}` + (item.serial ? `(${item.serial})` : '') + `, ${item.totalLeak} шт, ${item.location}\n`
        }
        curatorText += `Хранение гос. имущества в ${storage.trim().slice(0, -1)}\n`
        curatorText += `\\\`\\\`\\\`\n${footer}\n\\\`\\\`\\\`\n`
        curatorText += '24 часа на возврат указанных предметов фракции (игрокам/склад)\n\\*\\*1/1 - next warn\\*\\*\n'
        const curatorEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setDescription(curatorText);
        WarehouseRepository.registerDrain(inter.user.id, passport, config.type, report, '-');
        if ('editReply' in inter && typeof inter.editReply === 'function') {
            return inter.editReply({
                content: 'Ниже приведен готовый выговор куратора',
                embeds: [curatorEmbed]
            });
        } else {
            return inter.reply({embeds: [curatorEmbed]});
        }
    }
    let commandText: string, durationText: string;
    switch (punishmentType) {
        case 'iban':
            commandText = `offiban ${passport} Слив склада ${faction} // by ${adminSurname}`;
            durationText = `Перманентно`;
            break;
        case 'warnban':
            const days = duration || "30";
            commandText = `offban ${passport} ${days} Слив склада ${faction} // by ${adminSurname}\noffwarn ${passport} Слив склада ${faction} // by ${adminSurname}`;
            durationText = `${days} дн. + варн`;
            break;
        case 'ban':
            const banDays = duration || "30";
            commandText = `offban ${passport} ${banDays} Слив склада ${faction} // by ${adminSurname}`;
            durationText = `${banDays} дн.`;
            break;
        case 'warn':
            commandText = `offwarn ${passport} Слив склада ${faction} // by ${adminSurname}`;
            durationText = "1 варн";
            break;
        case 'jail':
            const mins = duration || "100";
            commandText = `offprison ${passport} ${mins} Слив склада ${faction} // by ${adminSurname}`;
            durationText = `${mins} мин.`;
            break;
        case 'jailwarn':
            const minutes = duration || "100";
            commandText = `offprison ${passport} ${minutes} Слив склада ${faction} // by ${adminSurname}\noffwarn ${passport} Слив склада ${faction} // by ${adminSurname}`;
            durationText = `${minutes} мин. + варн`;
            break;
        default:
            commandText = `offban ${passport} 30 Слив склада ${faction} // by ${adminSurname}`;
            durationText = `30 дн.`;
    }
    const responseContent = `✅ Нарушение зарегистрировано: **${adminDisplayName}**\nНаказание: ${config.name} ${durationText}\n\n**Команда:**\n\`${commandText}\``;

    WarehouseRepository.registerDrain(inter.user.id, passport, config.type, report, durationText);
    const group = getFractionGroup(faction);
    const channelId = LOG_CHANNEL_IDS[group]
    const channel = inter.client.channels.cache.get(channelId) as TextChannel | undefined
    if (channelId === 'NS' || !channel) {
        return logger.logError(inter.client, new Error('Warehouse channel ID not found'), 'Обработка склада V2')
    }

    const embed = new EmbedBuilder().setColor(Colors.Gold).setDescription(`\`\`\`\n${formReportData(report)[1]}\`\`\``)
    await channel.send({embeds: [embed], content: `Администратор ${adminDisplayName}\nИгрок: ${passport}\nФракция: ${faction}\nНаказание: ${config.name} ${durationText}`})

    if ('editReply' in inter && typeof inter.editReply === 'function') {
        await inter.editReply({content: responseContent});
    } else {
        await inter.followUp({content: responseContent, flags: [MessageFlags.Ephemeral]});
    }
}

const LOG_CHANNEL_IDS = {
    MAFIA: "1316831636532232300",
    GANG: "1316848781529972778",
    STATE: "1507071654134812825",
    DEFAULT: "NS"
};


function getFractionGroup(fraction: FractionType): keyof typeof FRACTION_GROUPS | 'DEFAULT' {
    for (const [group, fractions] of Object.entries(FRACTION_GROUPS)) {
        if (fractions.includes(fraction)) {
            return group as keyof typeof FRACTION_GROUPS;
        }
    }
    return 'DEFAULT';
}