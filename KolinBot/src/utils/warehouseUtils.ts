export interface ItemData {
    soldPrice: number;
    vehicle: number,
    family: number,
    inventory: number,
    apartment: number,
    house: number,
    faction: number,
    sold: number,
    lot: number,
    status: string,
    serial: string | undefined,
    name: string
    location: string,
    totalLeak: number,
    customWarehouse: number,
    traded: number,
    camper: number,
}

export interface ItemGroup {
    name: string;
    soldAmount: number;
    soldPrice: number;
    traded: number;
    camper: number;
    vehicle: number;
    family: number;
    apartment: number;
    house: number;
    faction: number;
    customWarehouse: number;
    lot: number;
}

export interface LogLine {
    date: string;
    type: string;
    action: string;
}

export class WarehouseData {
    items: ItemData[] = []
    groups: Map<string, ItemGroup> = new Map<string, ItemGroup>()
    status: string = 'Processing'
    name: string | undefined;
    surname: string | undefined;
    passport: string | undefined;

    pushGroup(
        name: string,
        totalLeak: number,
        type: "sold" | "traded" | "camper" | "vehicle" | "family" | "apartment" | "house" | "faction" | "customWarehouse" | "lot",
        price?: number
    ) {
        if (!this.groups.has(name)) {
            this.groups.set(name, {
                    apartment: 0,
                    camper: 0,
                    customWarehouse: 0,
                    faction: 0,
                    family: 0,
                    house: 0,
                    traded: 0,
                    vehicle: 0,
                    lot: 0,
                    name: name,
                    soldAmount: 0,
                    soldPrice: 0,
                }
            )
        }
        const group = this.groups.get(name)!;
        switch (type) {
            case 'sold':
                if (price) {
                    group.soldAmount += totalLeak;
                    group.soldPrice += price;
                }
                break;
            case 'traded':
            case 'camper':
            case 'vehicle':
            case 'family':
            case 'apartment':
            case 'house':
            case 'faction':
            case "lot":
            case 'customWarehouse':
                group[type] += totalLeak;
                break;
        }
    }
}


const factionPrefixes = ['LSPD', 'FIB', 'LSSD', 'MAY', 'PRIS', 'ARMY']
const weaponNames = ["Бита", "Резиновая дубинка", "Пистолет", "Тяжелый пистолет", "Кольт", "Револьвер", "Старинный пистолет", "AP пистолет",
    "Pump Shotgun", "Pump Shotgun MK2", 'Pump Shothun', "Combat Shotgun", "Assault Shotgun", "Heavy Shotgun", "Tactical SMG", "Assault SMG",
    "Micro SMG", "SMG", "SMG-MK2", "Carbine Rifle", "Service Carbine", "Battle Rifle", "Military Rifle", "Compact Rifle", "Gusenberg Sweeper",
    "Тазер", "Сигнальная ракетница", "Дымовой гранатомет", "Обрез", "Special Rifle", "Assault Rifle",
    "Assault Rifle"]
const stackableItems = ["7.62mm", "5.56mm", "11.43mm", "12mm", "7.62mm", "5.56mm", "Аптечка", "Аптечка ПП",
    "Аптечка EMS", "Бинты", "Анальгетик", "Боевой стимулятор", "Броня", "Стаб-пак", "SPANK", "Косяк", "Материалы",
    'Коктейль Молотова', "Бумбокс", "Бургер", "Записка", "Канистра с бензином", "Кола", "Набор для костра", "Овощной салат", "Овощной смузи", "Палатка", "Пицца", 'Рагу', "Ремонтный набор",
    "Фонарик"
]

const weaponsPattern = weaponNames.join('|')
const factionsPattern = factionPrefixes.join('|')

const faction_pattern = `(${weaponsPattern}) \\(((${factionsPattern})([0-9]+))\\)`
const crime_pattern = `(${weaponsPattern}) \\(([0-9]+X+)\\)`
const stackablePattern = `(${stackableItems.join('|')})`

const count_patterns = ['([0-9]+) шт', 'x([0-9]+)']

function readLogFile(logData: string) {
    const lines = logData.split('\n')
    const userPattern = /(\w+)_(\w+) \[(\d+)]/
    const userMatch = lines[0].match(userPattern)
    if (!userMatch || lines.length <= 2) {
        return null;
    }
    const name = userMatch[1]
    const surname = userMatch[2]
    const passport = userMatch[3]
    const logs: LogLine[] = [];
    for (const line of lines.slice(2)) {
        const parts = line.split('","').map(s => s.replace(/"/g, ''));
        logs.push({action: parts[2], date: parts[0], type: parts[1]})
    }
    return {name: name, surname: surname, passport: passport, logLines: logs.reverse()};
}

function errorWarehouse(reason: string) {
    const data = new WarehouseData();
    data.status = reason;
    return data;
}

export function analyzeLogData(logData: string): WarehouseData {
    const logs = readLogFile(logData);
    if (!logs) {
        return errorWarehouse('Couldnt read logs from file');
    }
    const data: Map<string, ItemData> = new Map;

    function getItem(name: string, id: string): ItemData {
        if (data.has(name + ' ' + id)) {
            return <ItemData>data.get(name + ' ' + id);
        }
        const d: ItemData = {
            vehicle: 0,
            apartment: 0,
            faction: 0,
            family: 0,
            customWarehouse: 0,
            traded: 0,
            serial: id,
            house: 0,
            sold: 0,
            inventory: 0,
            camper: 0,
            location: 'Unknown',
            status: 'Processing',
            name: name,
            totalLeak: 0,
            soldPrice: 0,
            lot: 0
        };
        data.set(name + ' ' + id, d)
        return d
    }

    const report: WarehouseData = new WarehouseData();
    report.name = logs.name;
    report.surname = logs.surname;
    report.passport = logs.passport
    for (const line of logs.logLines) {
        const factionMatch = line.action.match(faction_pattern)
        const crimeMatch = line.action.match(crime_pattern)
        const stackableMatch = line.action.match(stackablePattern)
        if (!factionMatch && !crimeMatch && !stackableMatch) {
            return errorWarehouse(`Couldnt match string ${line.type} ${line.action}`)
        }
        let itemName: string = 'UNKNOWN'
        let itemSerial: string = 'UNKNOWN'
        if (factionMatch) {
            itemName = factionMatch[1]
            itemSerial = factionMatch[2]
        } else if (crimeMatch) {
            itemName = crimeMatch[1]
            itemSerial = crimeMatch[2]
        } else if (stackableMatch) {
            itemName = stackableMatch[1];
            itemSerial = ''
        } else {
            return errorWarehouse(`Couldnt match item from ${line.type} ${line.action}`)
        }
        const item = getItem(itemName, itemSerial);
        let actionQuantity = 0;
        if (crimeMatch || factionMatch) {
            actionQuantity = 1;
        } else if (stackableMatch) {    
            if (['Фракционный транспорт', 'Транспорт', 'Фракционный бот', 'Фракционный крафт',
                'Квартира', 'Дом', 'Фракционный склад', 'Арендованный склад', 'Посылка', 'Шкаф кемпера'].includes(line.type)) {
                const m = line.action.match(count_patterns[0])
                if (m) {
                    actionQuantity = parseInt(m[1])
                }
            } else if (['Семья', 'Трейд с участниками фракции', 'Трейд'].includes(line.type)) {
                const m = line.action.match(count_patterns[1])
                if (m) {
                    actionQuantity = parseInt(m[1])
                }
            } else if (line.type === 'DarkVito') {
                const m = [...line.action.matchAll(/([0-9]+) шт/g)]
                actionQuantity = m[0] ? Number(m[0][1]) : 0;
                const soldQuantity = m[1] ? Number(m[1][1]) : 0;
                item.sold += soldQuantity;
            }

            if (actionQuantity === 0) {
                return errorWarehouse(`Couldnt get quantity from ${line.type} ${line.action}`)
            }
        }
        let sign = 0;
        if (line.type === 'Посылка') {
            sign = -1
        } else if (line.action.toLowerCase().match('берет|забрал|получил') || line.type === 'Фракционный крафт') {
            sign = -1
        } else if (line.action.toLowerCase().match('положил|кладет|передал')) {
            sign = 1
        } else if (line.type === 'DarkVito') {
            sign = 1
        } else if (line.type === 'Трейд с участниками фракции' || line.type === 'Трейд') {
            if (line.action.includes('получил')) {
                sign = -1
            } else if (line.action.includes('передал')) {
                sign = 1
            }
        } else {
            return errorWarehouse(`Couldnt read operation for ${line.type} ${line.action}`)
        }

        item.inventory -= sign * actionQuantity
        switch (line.type) {
            case 'Квартира':
                item.apartment += sign * actionQuantity
                break;
            case 'Семья':
                item.family += sign * actionQuantity
                break;
            case 'Транспорт':
                item.vehicle += sign * actionQuantity
                break;
            case 'Фракционный склад':
            case 'Фракционный транспорт':
            case 'Фракционный бот':
            case 'Трейд с участниками фракции':
                item.faction += sign * actionQuantity
                break;
            case 'Дом':
                item.house += sign * actionQuantity
                break;
            case 'DarkVito':
                item.lot += sign * actionQuantity
                const mappedLine = line.action.replaceAll(/(?<=\d),(?=\d)/g, '');
                const amountMatch = mappedLine.match(/за \$(\d+)/)
                item.soldPrice += amountMatch ? Number(amountMatch[1]) : 0;
                if (mappedLine.includes('из машины')) {
                    item.vehicle -= actionQuantity
                    item.inventory += actionQuantity
                }
                break;
            case 'Арендованный склад':
                item.customWarehouse += sign * actionQuantity
                break;
            case 'Посылка':
                break;
            case 'Трейд':
                item.traded += sign * actionQuantity
                break;
            case 'Шкаф кемпера':
                item.camper += sign * actionQuantity
                break;
        }
        item.location = line.type;
    }
    for (const [_, item] of data.entries()) {
        let itemsLost = 0;
        let mx = 0;
        if (item.vehicle > 0) {
            itemsLost += item.vehicle;
            mx = item.vehicle;
            item.location = 'Машина'
            report.pushGroup(item.name, item.vehicle, 'vehicle')
        }
        if (item.family > 0) {
            itemsLost += item.family
            report.pushGroup(item.name, item.family, 'family')
            if (item.family > mx) {
                mx = item.family
                item.location = 'Семья'
            }
        }
        if (item.apartment > 0) {
            itemsLost += item.apartment
            report.pushGroup(item.name, item.apartment, 'apartment')
            if (item.apartment > mx) {
                mx = item.apartment
                item.location = 'Квартира'
            }
        }
        if (item.house > 0) {
            itemsLost += item.house;
            report.pushGroup(item.name, item.house, 'house')
            if (item.house > mx) {
                mx = item.house
                item.location = 'Дом'
            }
        }
        if (item.customWarehouse > 0) {
            itemsLost += item.customWarehouse
            report.pushGroup(item.name, item.customWarehouse, 'customWarehouse')
            if (item.customWarehouse > mx) {
                mx = item.customWarehouse;
                item.location = 'Арендованный склад'
            }
        }
        if (item.traded > 0) {
            itemsLost += item.traded
            report.pushGroup(item.name, item.traded, 'traded')
            if (item.traded > mx) {
                mx = item.traded
                item.location = 'Передано'
            }
        }
        if (item.lot - item.sold > 0) {
            itemsLost += item.lot - item.sold
            report.pushGroup(item.name, item.lot - item.sold, 'lot')
            if (item.lot - item.sold > mx) {
                mx = item.lot - item.sold
                item.location = 'Выставлено'
            }
        }
        if (item.sold > 0) {
            itemsLost += item.sold
            report.pushGroup(item.name, item.sold, 'sold', item.soldPrice)
            item.location = 'Продано'
        }
        if (item.sold > 0 || item.lot > 0 || (item.faction < 0 && itemsLost > 0)) {
            item.status = 'LEAK'
            report.status = 'LEAKS'
            item.totalLeak = itemsLost
            report.items.push(item)
        }
    }
    if (report.items.length === 0) {
        report.status = 'CLEAN'
    }
    return report;
}

export function formReportData(report: WarehouseData): [string, string] {
    let data = `──────────────────────────────────────────────────\n${report.name}_${report.surname} ${report.passport}\nStatus: ${report.status}\nИнформация о нарушениях:\n`
    data += '──────────────────────────────────────────────────\n'
    for (const item of report.items) {
        let cur = '';
        cur += `${item.name}` + (item.serial ? `(${item.serial})` : '') + `, Скопление обнаружено в: ${item.location}\n`
        cur += `    Взято с фракции предметов: ${-item.faction}\n    `
        if (item.inventory) {
            cur += `Инвентарь: ${item.inventory}, `
        }
        if (item.vehicle) {
            cur += `Машина: ${item.vehicle}, `;
        }
        if (item.family) {
            cur += `Семья: ${item.family}, `;
        }
        if (item.apartment) {
            cur += `Квартира: ${item.apartment}, `;
        }
        if (item.house) {
            cur += `Дом: ${item.house}, `;
        }
        if (item.customWarehouse) {
            cur += `Арендованный склад: ${item.customWarehouse}, `;
        }
        if (item.sold) {
            cur += `Продано DarkVito: ${item.sold} на ${item.soldPrice}$, `;
        }
        if (item.lot) {
            cur += `Выставлено на DarkVito: ${item.lot}, `;
        }
        if (item.traded) {
            const st = item.traded > 0 ? 'Передано' : 'Получено'
            cur += `${st}: ${Math.abs(item.traded)}, `;
        }
        cur += '\n──────────────────────────────────────────────────\n'
        data += cur
    }
    let second = '──────────────────────────────────────────────────\n';
    let vehicle = 'В машинах:\n';
    let sold = 'Продажи DarkVito:\n';
    let lot = 'Выставлено DarkVito:\n';
    let traded = 'Передано кому-то:\n';
    let camper = 'В кемпере:\n';
    let family = 'В семье:\n';
    let apartment = 'В квартире:\n';
    let house = 'В доме:\n';
    let faction = 'С фракции:\n';
    let customWarehouse = 'На своем складе:\n';
    for (let [_, group] of report.groups) {
        if (group.soldAmount > 0) {
            sold += `  ${group.name} ${group.soldAmount} шт. за ${group.soldPrice}$\n`
        }
        const stats = {vehicle, lot, traded, camper, family, apartment, house, customWarehouse};
        const keys = Object.keys(stats) as Array<keyof typeof stats>;
        for (const key of keys) {
            const value = group[key];
            if (value > 0) {
                stats[key] += `  ${group.name} ${value} шт.\n`;
            }
        }
        ({vehicle, lot, traded, camper, family, apartment, house, customWarehouse} = stats);
    }
    const stats = {vehicle, lot, sold, traded, camper, family, apartment, house, customWarehouse};
    for (let statsKey in stats) {
        const x = stats[statsKey as 'vehicle' | 'lot' | 'traded' | 'camper' | 'family' | 'apartment' | 'house' | 'customWarehouse' | 'sold'];
        if (x.trim().length > 0) {
            second += x + '\n'
        }
    }
    return [data, second];
}