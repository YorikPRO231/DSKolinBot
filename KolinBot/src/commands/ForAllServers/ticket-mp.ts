import {
    EmbedBuilder,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalSubmitInteraction,
    TextChannel,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} from 'discord.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

const TARGET_CHANNEL_ID = process.env.MP_REQUEST_CHANNEL_ID || "";

interface VehicleData {
    name: string;
    hash?: string;
    count: number;
}

export const data = new SlashCommandBuilder()
    .setName("запрос-мп")
    .setDescription("Универсальный запрос на выдачу для МП");

export async function execute(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('mpRequestModal')
        .setTitle('Запрос на выдачу MP');

    const typeInput = new TextInputBuilder()
        .setCustomId('type')
        .setLabel('Тип мероприятия (forum или manual)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('forum или manual')
        .setRequired(true);

    const contentInput = new TextInputBuilder()
        .setCustomId('content')
        .setLabel('Текст запроса или ссылка на форум')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Вставьте текст запроса или ссылку на форум...')
        .setRequired(true);

    const idInput = new TextInputBuilder()
        .setCustomId('gameId')
        .setLabel('Ваш ID в игре')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите ваш игровой ID')
        .setRequired(true);

    const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(typeInput);
    const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput);
    const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(idInput);

    modal.addComponents(firstRow, secondRow, thirdRow);

    await interaction.showModal(modal);

    const filter = (i: ModalSubmitInteraction) => i.customId === 'mpRequestModal' && i.user.id === interaction.user.id;
    const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 300000 }).catch(() => null);
    
    if (!modalInteraction) return;

    const type = modalInteraction.fields.getTextInputValue('type').toLowerCase();
    let content = modalInteraction.fields.getTextInputValue('content');
    const gameId = modalInteraction.fields.getTextInputValue('gameId');

    await modalInteraction.deferReply({ flags: 64 });

    let vehicles: VehicleData[] = [];
    let sourceText = content;

    if (type === 'forum' && content.startsWith('http')) {
        await modalInteraction.editReply("Загрузка данных с форума...");
        
        try {
            const forumText = await Promise.race([
                fetchForumContent(content),
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
            ]);
            
            if (!forumText || forumText.length < 50) {
                await modalInteraction.editReply("Не удалось загрузить форум. Используйте ручной ввод.");
                return;
            }
            
            sourceText = forumText;
            vehicles = parseVehicles(forumText);
            
        } catch (error) {
            await modalInteraction.editReply("Ошибка загрузки форума. Используйте ручной ввод.");
            return;
        }
    } else {
        vehicles = parseVehicles(content);
    }

    const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(`${modalInteraction.guild?.name || 'Discord'} | Запрос на МП`)
        .setTimestamp()
        .addFields(
            { name: 'Запросил', value: modalInteraction.user.toString(), inline: true },
            { name: 'ID', value: `\`${gameId}\``, inline: true },
            { name: 'Тип', value: type === 'forum' ? 'Форумный' : 'Ручной ввод', inline: true }
        );

    if (vehicles.length > 0) {
        const vehicleList = vehicles.map(v => `${v.name} - ${v.count} шт`).join('\n');
        embed.addFields({ name: `Транспорт (${vehicles.length})`, value: vehicleList.slice(0, 1024) });
    } else {
        embed.setDescription("Не удалось распознать транспорт");
        const preview = sourceText.length > 500 ? sourceText.substring(0, 500) + '...' : sourceText;
        embed.addFields({ name: 'Исходный текст', value: `\`\`\`\n${preview}\n\`\`\`` });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('send')
            .setLabel('Отправить')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Отмена')
            .setStyle(ButtonStyle.Danger)
    );

    const previewMessage = await modalInteraction.editReply({
        embeds: [embed],
        components: [row]
    });

    const buttonFilter = (i: any) => i.user.id === interaction.user.id;
    const collector = previewMessage.createMessageComponentCollector({ 
        componentType: ComponentType.Button,
        time: 60000, 
        max: 1 
    });
    
    collector.on('collect', async (buttonInteraction: any) => {
        if (buttonInteraction.customId === 'send') {
            const targetChannel = interaction.client.channels.cache.get(TARGET_CHANNEL_ID) as TextChannel;
            if (targetChannel) {
                await targetChannel.send({ embeds: [embed] });
                await buttonInteraction.update({ content: "Запрос отправлен администрации.", embeds: [], components: [] });
            } else {
                await buttonInteraction.update({ content: "Канал не найден.", embeds: [], components: [] });
            }
        } else if (buttonInteraction.customId === 'cancel') {
            await buttonInteraction.update({ content: "Отправка отменена.", embeds: [], components: [] });
        }
    });
    
    collector.on('end', async () => {
        if (previewMessage.components.length > 0) {
            await modalInteraction.editReply({ components: [] }).catch(() => {});
        }
    });
}

async function fetchForumContent(url: string): Promise<string> {
    const response = await axios.get(url, { 
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    const $ = cheerio.load(response.data);
    let forumText = "";
    
    $('.bbWrapper, .message-content, .post-content').each((i, el) => {
        forumText += $(el).text() + "\n";
    });
    
    return forumText;
}

function parseVehicles(text: string): VehicleData[] {
    const vehicles: VehicleData[] = [];
    
    const patterns = [
        /(?:Заспавнить|Выдать|Добавить)\s+(?:модель\s+)?(?:машины|авто|транспорта)?:\s*([A-Za-z0-9_]+)\s+(\d+)\s*(?:штук|шт|единиц)/gi,
        /([A-Za-z0-9_]+)\s+-\s+(\d+)\s*(?:шт|штук)/gi,
        /(\d+)\s*(?:шт|штук)\s+([A-Za-z0-9_]+)/gi,
    ];
    
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            let name = '', count = 1;
            
            if (match[1] && match[2] && !isNaN(parseInt(match[2]))) {
                name = match[1];
                count = parseInt(match[2]);
            } else if (match[1] && match[2] && !isNaN(parseInt(match[1]))) {
                name = match[2];
                count = parseInt(match[1]);
            }
            
            if (name && !vehicles.some(v => v.name === name)) {
                vehicles.push({ name, count });
            }
        }
    }
    
    if (vehicles.length === 0) {
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
            const match = line.trim().match(/^([A-Za-z0-9_]{3,})$/);
            if (match && !match[1].match(/^(в|на|с|по|из|за|и)$/i)) {
                vehicles.push({ name: match[1], count: 1 });
            }
        }
    }
    
    return vehicles;
}