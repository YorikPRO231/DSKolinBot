import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { exportSecurityAlertsMany, getSecurityAccess } from '../../../databases/sqlite';
import axios from 'axios';

export const data = new SlashCommandBuilder()
    .setName("бот-чит")
    .setDescription("[Security] Добавление новых подозрительных игроков")
    .addAttachmentOption(option => 
        option.setName("лог-файл")
            .setDescription("Файл логов (.txt)")
            .setRequired(true)
    );

const ACTION_MAP: Record<string, string> = {
    'Работа в порту': 'Бот: Порт',
    'Работа на стройке': 'Бот: Стройка',
    'Дайверы': 'Бот: Дайвер',
    'Охотники': 'Бот: Охота'
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export async function execute(inter: ChatInputCommandInteraction) {

    const securityLevel = getSecurityAccess(inter.user.id);
        if (securityLevel !== 'yes') {
            return inter.reply({ 
                content: '❌ У вас нет доступа к этой команде!', 
                flags: MessageFlags.Ephemeral
            });
        }

    await inter.deferReply();

    

    const attachment = inter.options.getAttachment("лог-файл")!;

    if (!attachment.contentType?.includes('text/plain') && !attachment.name?.endsWith('.txt')) {
        return inter.editReply("❌ Пожалуйста, загрузите текстовый файл (.txt)");
    }

    if (attachment.size > MAX_FILE_SIZE) {
        return inter.editReply("❌ Файл слишком большой. Максимальный размер: 2 МБ.");
    }

    try {
        const response = await axios.get(attachment.url, { responseType: 'text' });
        const fileContent: string = response.data;
        
        const alerts = parseLogs(fileContent);

        if (alerts.length === 0) {
            return inter.editReply("⚠ В файле не найдено подходящих данных для импорта.");
        }

        exportSecurityAlertsMany(inter.user.id, alerts.map(a => ({
            suspect: a.suspect,
            action: a.suspected_action,
            data: a.work_data,
            originalDate: a.originalDate
        })));

        const uniqueSuspects = new Set(alerts.map(a => a.suspect)).size;

        await inter.editReply(
            `✅ **Импорт завершен!**\n` +
            `* Обработано строк: **${alerts.length}**\n` +
            `* Уникальных игроков: **${uniqueSuspects}**\n\n` +
            `*Все повторные нарушения были автоматически объединены.*`
        );
    } catch (e) {
        console.error(e);
        await inter.editReply("❌ Произошла ошибка при загрузке или обработке файла.");
    }
}

function parseLogs(content: string) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 20);
    const result: any[] = [];

    for (const line of lines) {
        const segments = line.split(/\t|\s{2,}/); 
        
        if (segments.length < 4) continue;

        // [0] Дата/Время, [1] Действие, [2] Игрок [ID], [3] Данные по работе, [4] Статус
        const [timestamp, actionRaw, playerRaw, workDataRaw] = segments;

        let originalDate = null;
        if (timestamp && timestamp.match(/\d{2}\.\d{2}\.\d{4},\s\d{2}:\d{2}:\d{2}/)) {
            const [datePart, timePart] = timestamp.split(', ');
            const [day, month, year] = datePart.split('.');
            originalDate = `${year}-${month}-${day} ${timePart}`;
        }

        const suspectedAction = ACTION_MAP[actionRaw] || actionRaw;

        const idMatch = playerRaw.match(/\[(\d+)\]/);
        if (!idMatch) continue;

        const workData = workDataRaw.replace(/(Открыт|Закрыт)$/i, '').trim();

        result.push({
            suspect: idMatch[1], 
            suspected_action: suspectedAction,
            work_data: workData || 'Нет данных',
            originalDate: originalDate,
            timeStamp: timestamp
        });
    }
    return result;
}