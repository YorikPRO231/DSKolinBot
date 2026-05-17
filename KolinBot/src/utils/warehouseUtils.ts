export interface ItemData {
    vehicle: number,
    family: number,
    inventory: number,
    apartment: number,
    house: number,
    faction: number,
    sold: number,
    status: string,
    serial: string | undefined,
    name: string
    location: string,
    totalLeak: number,
    customWarehouse: number,
    traded: number
}

export interface LogLine {
    date: string;
    type: string;
    action: string;
}

export class WarehouseData {
    items: ItemData[] = []
    status: string = 'Processing'
    name: string | undefined;
    surname: string | undefined;
    passport: string | undefined;
}

const factionPrefixes = ['LSPD', 'FIB', 'LSSD', 'MAY', 'PRIS', 'ARMY']
const weaponNames = ["Бита", "Резиновая дубинка", "Пистолет", "Тяжелый пистолет", "Кольт", "Револьвер", "Старинный пистолет", "AP пистолет",
    "Pump Shotgun", "Pump Shotgun", "Pump Shotgun MK2", "Combat Shotgun", "Assault Shotgun", "Heavy Shotgun", "Tactical SMG", "Assault SMG",
    "Micro SMG", "SMG", "SMG-MK2", "Carbine Rifle", "Service Carbine", "Battle Rifle", "Military Rifle", "Compact Rifle", "Gusenberg Sweeper",
    "Тазер", "Сигнальная ракетница", "Дымовой гранатомет", "Коктейль Молотова", "Обрез", "Special Rifle", "Assault Rifle", "Special Rifle",
    "Assault Rifle", "Carbine Rifle"]
const stackableItems = ["7.62mm", "5.56mm", "11.43mm", "11.43mm", "12mm", "7.62mm", "5.56mm", "Аптечка", "Аптечка ПП",
    "Аптечка EMS", "Бинты", "Анальгетик", "Боевой стимулятор", "Броня", "Стаб-пак", "SPANK", "Косяк", "Материалы",]

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
            location: 'Unknown',
            status: 'Processing',
            name: name,
            totalLeak: 0
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
                'Квартира', 'Дом', 'Фракционный склад', 'Арендованный склад', 'Посылка'].includes(line.type)) {
                const m = line.action.match(count_patterns[0])
                if (m) {
                    actionQuantity = parseInt(m[1])
                }
            } else if (['Семья', 'Трейд с участниками фракции', 'Трейд'].includes(line.type)) {
                const m = line.action.match(count_patterns[1])
                if (m) {
                    actionQuantity = parseInt(m[1])
                }
            }

            if (actionQuantity === 0) {
                return errorWarehouse(`Couldnt get quantity from ${line.type} ${line.action}`)
            }
        }
        let sign = 0;
        if (line.action.toLowerCase().match('берет|забрал|получил') || line.type === 'Фракционный крафт') {
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
                item.sold += sign * actionQuantity
                break;
            case 'Арендованный склад':
                item.customWarehouse += sign * actionQuantity
                break;
            case 'Посылка':
                item.inventory += sign * actionQuantity
                break;
            case 'Трейд':
                if (sign == 1) { // ignoring income
                    item.traded += sign * actionQuantity
                    item.location = 'Передано'
                }
                break;
        }
        item.location = line.type;
    }
    for (const [_, item] of data.entries()) {
        let itemsLost = 0;
        if (item.vehicle > 0) {
            itemsLost += item.vehicle;
        }
        if (item.family > 0) {
            itemsLost += item.family
        }
        if (item.apartment > 0) {
            itemsLost += item.apartment
        }
        if (item.house > 0) {
            itemsLost += item.house;
        }
        if (item.sold > 0) {
            itemsLost += item.sold
        }
        if (item.customWarehouse > 0) {
            itemsLost += item.customWarehouse
        }
        if (item.traded > 0) {
            itemsLost += item.traded
        }
        if (item.sold > 0 || (item.faction < 0 && itemsLost > 0)) {
            item.status = 'LEAK'
            report.status = 'LEAKS'
            item.totalLeak = item.sold
            if (item.faction < 0) {
                item.totalLeak -= item.faction
            }
            if (item.inventory > 0) {
                item.totalLeak = Math.max(0, item.totalLeak - item.inventory)
            }
            report.items.push(item)
        }
    }
    if (report.items.length === 0) {
        report.status = 'CLEAN'
    }
    return report;
}
