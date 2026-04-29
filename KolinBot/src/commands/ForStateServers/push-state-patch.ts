import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel} from 'discord.js';
import {generateUniqueDigits, pushPlayerId} from "../../databases/sqlite";
import {GOV_PATCH_LOG_CHANNEL_ID, STATE_HIGH_MEMBER_ROLES_ID} from "../../utils/config";

export const data = new SlashCommandBuilder()
    .setName("новая-нашивка")
    .setDescription("Выдать новую нашивку игроку")
    .addUserOption(opt => opt
        .setName('игрок')
        .setDescription('Игрок, который получает новую нашивку')
        .setRequired(true))
    .addIntegerOption(opt => opt
        .setName('паспорт')
        .setDescription('Номер паспорта игрока (от 1 до 999999)')
        .setRequired(true))
    .addStringOption(opt => opt
        .setName('позиция')
        .setDescription('Отдел или должность игрока (Пример: FPB, D. Head FPB)')
        .setRequired(true))
    .addStringOption(opt => opt
        .setName('ник')
        .setDescription('Ник игрока в формате "Имя Фамилия"')
        .setRequired(true))
    .addStringOption(opt => opt
        .setName('засекреченность')
        .setDescription('Уровень засекреченности нашивки')
        .setRequired(true)
        .addChoices(
            {name: 'Засекреченная', value: 'secret'},
            {name: 'Обычная', value: 'casual'}
        ));


export async function execute(inter: ChatInputCommandInteraction) {
    const userID = inter.options.getUser('игрок', true);
    const nickname = inter.options.getString('ник', true).trim();
    const member = inter.member as any;
    const hasRole = member?.roles?.cache?.some((r: any) => STATE_HIGH_MEMBER_ROLES_ID.includes(r.id));
    if (!hasRole) {
        return inter.reply({
            content: '❌ **Ошибка:** Создание новых нашивок возможно только при наличии роли старшего состава.',
            flags: MessageFlags.Ephemeral
        });
    }

    // Проверка формата ника
    const nameParts = nickname.split(/\s+/);
    if (nameParts.length !== 2 || nameParts.some(part => part.length === 0)) {
        return inter.reply({
            content: '❌ **Ошибка:** Ник должен содержать ровно два слова (Имя и Фамилия), разделенных пробелом.\nПример: `John Doe`',
            flags: MessageFlags.Ephemeral
        });
    }
    inter.client.guilds.cache.get('')?.members.fetch()
    const [name, surname] = nameParts;
    
    const nameRegex = /^[a-zA-Z\-']+$/;
    if (!nameRegex.test(name) || !nameRegex.test(surname)) {
        return inter.reply({
            content: '❌ **Ошибка:** Имя и фамилия могут содержать только буквы, дефисы и апострофы.',
            flags: MessageFlags.Ephemeral
        });
    }
    
    const passport = inter.options.getInteger('паспорт', true);
    const position = inter.options.getString('позиция', true).trim();
    const level = inter.options.getString('засекреченность', true);
    
    const faction = getFaction(inter.guild?.name);
    if (!faction) {
        return inter.reply({
            content: '❌ **Ошибка:** Не удалось определить фракцию. Убедитесь, что команда выполняется на сервере фракции.',
            flags: MessageFlags.Ephemeral
        });
    }
    
    await inter.deferReply();
    
    const patch = generatePatch(faction, position, nickname, name, surname, passport, level);
    
    try {
        pushPlayerId(passport, nickname, userID.id, faction, patch);

        const embed = new EmbedBuilder()
            .setColor(level === 'secret' ? 0xFF4654 : 0x2B2D31)
            .setTitle(`${inter.guild?.name} | Лог нашивок`)
            .setDescription(
        `Сотрудник ${inter.user} выдал новую нашивку для ${userID}\n\n` +
        `\`\`\`/do На груди закреплена нашивка: ${patch}\`\`\``
            )
            .addFields(
                { name: 'Сотрудник', value: `${userID}`, inline: true },
                { name: 'Паспорт', value: `${passport}`, inline: true },
                { name: 'Тип', value: level === 'secret' ? 'Засекреченная' : 'Обычная', inline: true },
                { name: 'Дата', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `ID: ${userID.id} | Паспорт: ${passport}` });

        const embedGov = new EmbedBuilder()
            .setColor(level === 'secret' ? 0xFF4654 : 0x2B2D31)
            .setTitle(`${inter.guild?.name} | Лог нашивок`)
            .setDescription(
                `Сотрудник ${faction} ${inter.user} выдал новую нашивку для ${userID}\n\n` +
                `\`\`\`/do На груди закреплена нашивка: ${patch}\`\`\``
            )
            .addFields(
                { name: 'Сотрудник', value: `${userID}`, inline: true },
                { name: 'Паспорт', value: `${passport}`, inline: true },
                { name: 'Тип', value: level === 'secret' ? 'Засекреченная' : 'Обычная', inline: true },
                { name: 'Дата', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `ID: ${userID.id} | Паспорт: ${passport}` });
        const gov_log = inter.client.channels.cache.get(GOV_PATCH_LOG_CHANNEL_ID) as TextChannel
        await gov_log.send({embeds:[embedGov]})
        await inter.editReply({
            content: `${userID}`,
            embeds: [embed]
        });
        
    } catch (error) {
        console.error('Ошибка при сохранении нашивки:', error);
        await inter.editReply({
            content: '❌ **Критическая ошибка:** Не удалось сохранить нашивку. Попробуйте позже или обратитесь к администратору.'
        });
    }
}

function generatePatch(
    faction: string, 
    position: string, 
    fullNickname: string,
    name: string, 
    surname: string, 
    passport: number, 
    level: string
): string {
    if (level === 'secret') {
    const randomDigits = generateUniqueDigits(passport, faction);
    return `[${faction} | ${position} | ${name[0].toUpperCase()}${surname[0].toUpperCase()}${randomDigits}]`;
}
    return `[${faction} | ${position} | ${fullNickname}]`;
}

function getFaction(guild: string | undefined): string | undefined {
    if (!guild) return undefined;
    return guild.replace(/^GTA 5 RP\s*\|\s*/, '').trim();
}