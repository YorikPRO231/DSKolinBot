import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder
} from 'discord.js';
import {getAdminSurname} from '../../../databases/sqlite';
import {FRACTION_TYPES, FractionType} from "../../../utils/constants/fractions";
import axios from "axios";
import {analyzeLogData, WarehouseData} from "../../../utils/warehouseUtils";
import {logError} from "../../../logger";

export const data = new SlashCommandBuilder()
    .setName("warehouse-check")
    .setDescription("Проверить склад [test]")
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


export async function execute(inter: ChatInputCommandInteraction) {
    const adminSurname = getAdminSurname(inter.user.id);

    if (!adminSurname) {
        return inter.reply({content: "Вы не зарегистрированы!", flags: [MessageFlags.Ephemeral]});
    }
    await inter.deferReply();
    const fraction = inter.options.getString("фракция") as FractionType;
    const attachment = inter.options.getAttachment("лог-файл", true);
    try {
        const response = await axios.get(attachment.url, {responseType: 'text'});
        const fileContent = response.data;
        const report = analyzeLogData(fileContent)
        if (report.status != 'LEAKS' && report.status != 'CLEAN') {
            return inter.editReply({content: `Не удалось проверить файл: ${report.status}.`})
        }
        const parsed = formReportData(report);
        const files = [new AttachmentBuilder(Buffer.from(parsed[0], 'utf-8'), {name: `report_${report.passport}.txt`})];
        const embed = new EmbedBuilder().setTitle(`Проверка склада ${fraction} | Blackberry`)
            .setDescription(`\`\`\`${parsed[1]}\`\`\``).setColor(Colors.Purple)
        return inter.editReply({content: `<@${inter.user.id}>`, embeds: [embed], files});
    } catch (e) {
        return logError(inter.client, e as Error, 'Обработка склада v2')
    }
}


export function formReportData(report: WarehouseData): [string, string] {
    let data = `${report.name}_${report.surname} ${report.passport}\nStatus: ${report.status}\nИнформация о нарушениях:\n`
    let footer = `Итоговая сводка по нарушению: \n`
    const vehicle = []
    const family = []
    const apartment = []
    const house = []
    const customWarehouse = []
    const sold = []
    const traded = []
    data += '----------------------------\n'
    for (const item of report.items) {
        let cur = '';
        cur += `${item.name}` + (item.serial ? `(${item.serial})` : '') + ` ${item.location}\n`
        cur += `Всего потеряно: ${item.totalLeak}, взято с фракции ${-item.faction}\n`
        if (item.inventory) {
            cur += `Инвентарь: ${item.inventory}, `
        }
        if (item.vehicle) {
            cur += `Машина: ${item.vehicle}, `;
        }
        if (item.location === 'Транспорт') {
            vehicle.push(`${item.name}` + (item.serial ? `(${item.serial})` : '') + `, ${item.totalLeak} шт\n`)
        }
        if (item.family) {
            cur += `Семья: ${item.family}, `;
        }
        if (item.location === 'Семья') {
            family.push(`${item.name}` + (item.serial ? `(${item.serial})` : '') + `, ${item.totalLeak} шт\n`)
        }
        if (item.apartment) {
            cur += `Квартира: ${item.apartment}, `;
        }
        if (item.location === 'Квартира') {
            apartment.push(`${item.name}` + (item.serial ? `(${item.serial})` : '') + `, ${item.totalLeak} шт\n`)
        }
        if (item.house) {
            cur += `Дом: ${item.house}, `;
        }
        if (item.location === 'Дом') {
            house.push(`${item.name}` + (item.serial ? `(${item.serial})` : '') + `, ${item.totalLeak} шт\n`)
        }
        if (item.customWarehouse) {
            cur += `Арендованный склад: ${item.customWarehouse}`;
        }
        if (item.location === 'Арендованный склад') {
            customWarehouse.push(`${item.name}` + (item.serial ? `(${item.serial})` : '') + `, ${item.totalLeak} шт\n`)
        }
        if (item.sold) {
            cur += `Продано: ${item.sold}, `;
        }
        if (item.location === 'DarkVito') {
            sold.push(`${item.name}` + (item.serial ? `(${item.serial})` : '') + `, ${item.totalLeak} шт\n`)
        }
        if (item.traded) {
            cur += `Передано: ${item.traded}, `;
        }
        if (item.traded > 0) {
            customWarehouse.push(`${item.name}` + (item.serial ? `(${item.serial})` : '') + `, ${item.totalLeak} шт\n`)
        }
        if (item.location === 'Передано') {
            traded.push(`${item.name}` + (item.serial ? `(${item.serial})` : '') + `, ${item.totalLeak} шт\n`)
        }
        cur += '\n----------------------------\n'
        data += cur
        footer += `${item.name}` + (item.serial ? `(${item.serial})` : '') + `, ${item.totalLeak} шт, ${item.location}\n`
    }
    data += footer
    let second = ''
    if (vehicle.length > 0) {
        second += 'В личном Т/С:\n'
        for (const item of vehicle) {
            second += item;
        }
        second += '\n'
    }
    if (family.length > 0) {
        second += 'В организации:\n'
        for (const item of family) {
            second += item;
        }
        second += '\n'
    }
    if (apartment.length > 0) {
        second += 'В квартире:\n'
        for (const item of apartment) {
            second += item;
        }
        second += '\n'
    }
    if (house.length > 0) {
        second += 'В доме:\n'
        for (const item of house) {
            second += item;
        }
        second += '\n'
    }
    if (customWarehouse.length > 0) {
        second += 'В своем складе:\n'
        for (const item of customWarehouse) {
            second += item;
        }
        second += '\n'
    }
    if (sold.length > 0) {
        second += 'Продано DarkVito:\n'
        for (const item of sold) {
            second += item;
        }
        second += '\n'
    }
    if (traded.length > 0) {
        second += 'Передано:\n'
        for (const item of traded) {
            second += item;
        }
        second += '\n'
    }
    return [data, second];
}