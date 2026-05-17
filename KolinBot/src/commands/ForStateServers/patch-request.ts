import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import {DETECTIVES_INFO} from "../../utils/constants/fractions";
import {getFaction} from "../../utils/utilsState";
import {POSITIONS_STATE_INFO} from "../../utils/config";

export const data = new SlashCommandBuilder()
    .setName("запрос-нашивки")
    .setDescription("Оформить самостоятельный запрос нашивки. Запрос может одобрить старший состав.")
    .addIntegerOption((opt) =>
        opt
            .setName("паспорт")
            .setDescription("Номер паспорта игрока (от 1 до 999999)")
            .setRequired(true),
    )
    .addStringOption((opt) =>
        opt
            .setName("отдел")
            .setDescription("Ваш отдел или должность (Пример: FPB, D. Head FPB)")
            .setRequired(true),
    )
    .addStringOption((opt) =>
        opt
            .setName("ник")
            .setDescription('Ваш ник в формате "Имя Фамилия"')
            .setRequired(true),
    )

export async function execute(inter: ChatInputCommandInteraction) {
    const userID = inter.user;
    const nickname = inter.options.getString("ник", true).trim();

    const nameParts = nickname.split(/\s+/);
    if (nameParts.length !== 2 || nameParts.some((part) => part.length === 0)) {
        return inter.reply({
            content:
                "❌ **Ошибка:** Ник должен содержать ровно два слова (Имя и Фамилия), разделенных пробелом.\nПример: `John Doe`",
            flags: MessageFlags.Ephemeral,
        });
    }
    const [name, surname] = nameParts;
    const nameRegex = /^[a-zA-Z\-']+$/;
    if (!nameRegex.test(name) || !nameRegex.test(surname)) {
        return inter.reply({
            content:
                "❌ **Ошибка:** Имя и фамилия могут содержать только буквы, дефисы и апострофы.",
            flags: MessageFlags.Ephemeral,
        });
    }

    const passport = inter.options.getInteger("паспорт", true);
    const position = inter.options.getString("отдел", true).trim();

    const faction = getFaction(inter.guild?.id, inter.guild?.name);
    if (!faction) {
        return inter.reply({
            content:
                "❌ **Ошибка:** Не удалось определить фракцию. Убедитесь, что команда выполняется на сервере фракции.",
            flags: MessageFlags.Ephemeral,
        });
    }
    const factionState = POSITIONS_STATE_INFO[faction.abbreviation];

    if (!['DD', 'DB', 'CID'].includes(faction.abbreviation)) {
        // FIXME: ПРОВЕРЬ, НЕ ТЕСТИЛ
        if (!factionState || !factionState.compiled_positions?.includes(position)) {
            return inter.reply({
                content: `❌ **Ошибка:** Неверно указан отдел. Доступные Вам отделы: ${factionState?.positions || 'Список пуст'}`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
    const isDetectiveFaction = Object.values(DETECTIVES_INFO).some(
        (info) => info.discord_id === inter.guild?.id,
    );
    const level = isDetectiveFaction ? 'detective' : 'casual'
    await inter.deferReply();
    try {
        const embed = new EmbedBuilder()
            .setColor(level === "detective" ? Colors.DarkerGrey : Colors.DarkPurple)
            .setTitle(`${faction.fullName} | Запрос на получение нашивки`)
            .setDescription(
                `Сотрудник ${inter.user} запрашивает выдачу нашивки.`
            )
            .addFields(
                { name: "Сотрудник", value: ` ${userID}`, inline: true },
                { name: "Имя Фамилия", value: `${name}_${surname}`, inline: true},
                { name: "Паспорт", value: `${passport}`, inline: true },
                {name: 'Позиция', value: `${position}`, inline: true},
                {
                    name: "Тип",
                    value: level === "detective" ? "Детективная" : "Обычная",
                    inline: true,
                },
                {
                    name: "Дата",
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                    inline: false,
                },
            )
            .setTimestamp()
            .setFooter({ text: `ID: ${userID.id} | Паспорт: ${passport}` });
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`patchreq_${inter.user.id}_${position}_${name}_${surname}_${passport}`)
                .setLabel('Выдать нашивку')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('patchreq_deny')
                .setLabel('Отказ в выдаче')
                .setStyle(ButtonStyle.Danger)
        );
        await inter.editReply({
            content: `${userID}`,
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error("Ошибка при создании запроса на получение нашивки:", error);
        await inter.editReply({
            content:
                "❌ **Критическая ошибка:** Не удалось сохранить нашивку. Попробуйте позже или обратитесь к администратору.",
        });
    }
}
