import { 
    EmbedBuilder, 
    ChatInputCommandInteraction, 
    SlashCommandBuilder,
    ChannelType,
    TextChannel
} from 'discord.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

const TARGET_CHANNEL_ID = process.env.MP_REQUEST_CHANNEL_ID || ""

export const data = new SlashCommandBuilder()
    .setName("запрос-мп")
    .setDescription("Универсальный запрос на выдачу для МП")
    .addStringOption(option =>
        option.setName("тип")
            .setDescription("Тип мероприятия")
            .setRequired(true)
            .addChoices(
                { name: 'Форумное', value: 'forum' },
                { name: 'Мероприятие для граждан', value: 'manual' }
            ))
    .addStringOption(option =>
        option.setName("контент")
            .setDescription("Вставьте текст запроса или ссылку")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("id")
            .setDescription("Ваш ID в игре")
            .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const type = interaction.options.getString("тип");
    const content = interaction.options.getString("контент") || "";
    const gameId = interaction.options.getString("id");

    const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(`${interaction.guild?.name} | Запрос на МП`)
        .setTimestamp()
        .addFields(
            { name: 'Запросил:', value: interaction.user.toString(), inline: true },
            { name: 'ID:', value: `\`${gameId}\``, inline: true }
        );

    let textToParse = content;

    // --- ЛОГИКА ФОРУМА ---
    if (type === 'forum' && content.startsWith('http')) {
        try {
            const response = await axios.get(content, { 
                timeout: 7000, 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/110.0.0.0' } 
            });
            const $ = cheerio.load(response.data);
            
            let forumText = "";
            $('.bbWrapper').each((i, el) => {
                forumText += $(el).text() + "\n";
            });

            const keywords = [/Требование к администрации/gi, /Запрос к администрации/gi];
            let startIndex = -1;

            for (const kw of keywords) {
                const match = kw.exec(forumText);
                if (match) {
                    startIndex = match.index;
                    break;
                }
            }

            if (startIndex !== -1) {
                textToParse = forumText.substring(startIndex);
            } else {
                textToParse = forumText; 
            }

        } catch (error) {
            return interaction.editReply("❌ Не удалось загрузить страницу форума. Проверьте ссылку.");
        }
    }

    if (type === 'forum') {
        const vehicles = parseData(textToParse, 'vehicle');
        const skins = parseData(textToParse, 'skin');

        if (vehicles.length > 0 || skins.length > 0) {
            if (vehicles.length > 0) {
                const vList = vehicles.map(v => `• **${v.name}** (\`${v.hash}\`) — ${v.count} шт.`).join('\n');
                embed.addFields({ name: 'Транспорт:', value: vList.slice(0, 1024) });
            }
            if (skins.length > 0) {
                const sList = skins.map(s => `• **${s.name}** — ${s.count} шт.`).join('\n');
                embed.addFields({ name: 'Скины:', value: sList.slice(0, 1024) });
            }
            embed.setDescription(content.startsWith('http') ? `Спарсено по [ссылке](${content})` : "Данные извлечены из текста");
        } else {
            embed.setDescription("⚠️ Не удалось найти технику или скины.");
            const debugText = textToParse.replace(/\s+/g, ' ').substring(0, 250);
            embed.addFields({ name: 'Бот проанализировал текст:', value: `\`\`\`${debugText}...\`\`\`` });
        }
    } else {
        embed.addFields({ name: '📝 Ручной ввод:', value: content.slice(0, 1024) });
    }

    const targetChannel = interaction.client.channels.cache.get(TARGET_CHANNEL_ID) as TextChannel;
    if (!targetChannel) return interaction.editReply("❌ Канал логов не найден.");

    try {
        await targetChannel.send({ embeds: [embed] });
        await interaction.editReply(`✅ Запрос отправлен администрации.`);
    } catch (e) {
        await interaction.editReply("❌ Ошибка при отправке.");
    }
}

function parseData(text: string, type: 'vehicle' | 'skin') {
    const results = [];
    
    const cleanText = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');

    if (type === 'vehicle') {
        const vRegex = /(\d+)\s*(?:шт|ед|машин|авто)?.*? (?:Имя|Name|Название)[:\s-]*([\w\d_-]+).*?(?:Хэш|Хеш|Hash|0x)[:\s-]*(0x[\w\d]+)/gi;
        
        let match;
        while ((match = vRegex.exec(cleanText)) !== null) {
            results.push({
                count: match[1],
                name: match[2],
                hash: match[3]
            });
        }
    } else {
        const sRegex = /(?:Выдать\s+)?(?:скин|skin).*?(?:Имя|Name|Название)[:\s-]*([\w\d_-]+)/gi;
        
        let match;
        while ((match = sRegex.exec(cleanText)) !== null) {
            const contextBefore = cleanText.substring(Math.max(0, match.index - 15), match.index);
            const countMatch = contextBefore.match(/(\d+)/);
            
            const finalCount = countMatch ? countMatch[1] : "1";

            results.push({
                count: finalCount,
                name: match[1]
            });
        }
    }
    
    return results;
}