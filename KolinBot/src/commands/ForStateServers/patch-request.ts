import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { DETECTIVES_INFO } from "../../utils/constants/fractions";
import { POSITIONS_STATE_INFO } from "../../utils/config";

const EXCLUDED_BRANCHES_FOR_ALL_POSITIONS = ["PA", "A", "FNA", "SA"];

function getFactionFromName(guildName?: string): string | null {
  if (!guildName) return null;

  const cleanName = guildName.replace("GTA 5 RP | ", "").trim();

  for (const faction of Object.keys(POSITIONS_STATE_INFO)) {
    if (cleanName.includes(faction)) {
      return faction;
    }
  }

  return null;
}

function generateCompiledPositions(
  branches: string[],
  positions: string[],
): string[] {
  const compiled: string[] = [];

  const globalLeadershipPositions = [
    "Director",
    "Deputy Director",
    "Chief",
    "Deputy Chief",
    "Sheriff",
    "Deputy Sheriff",
    "Warden",
    "Deputy Warden",
    "General",
    "L. Gen.",
    "Adv. Gen.",
    "Commandant",
  ];

  for (const branch of branches) {
    if (EXCLUDED_BRANCHES_FOR_ALL_POSITIONS.includes(branch)) {
      compiled.push(branch);
      continue;
    }

    compiled.push(branch);

    for (const position of positions) {
      if (globalLeadershipPositions.includes(position)) {
        if (!compiled.includes(position)) {
          compiled.push(position);
        }
        continue;
      }

      if (
        position === "Inst." ||
        position === "Inst" ||
        position === "St" ||
        position === "S." ||
        position === "St."
      ) {
        compiled.push(`${position} ${branch}`);
      } else if (position === "D. Head") {
        compiled.push(`${position} ${branch}`);
      } else if (position === "Head") {
        compiled.push(`${position} ${branch}`);
      } else {
        compiled.push(`${position} ${branch}`);
      }
    }
  }

  for (const pos of globalLeadershipPositions) {
    if (positions.includes(pos) && !compiled.includes(pos)) {
      compiled.push(pos);
    }
  }

  return [...new Set(compiled)].sort();
}

for (const faction in POSITIONS_STATE_INFO) {
  const info =
    POSITIONS_STATE_INFO[faction as keyof typeof POSITIONS_STATE_INFO];
  info.compiled_positions = generateCompiledPositions(
    info.branches,
    info.positions,
  );
}

export const data = new SlashCommandBuilder()
  .setName("запрос-нашивки")
  .setDescription(
    "Оформить самостоятельный запрос нашивки. Запрос может одобрить старший состав.",
  )
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
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("ник")
      .setDescription('Ваш ник в формате "Имя Фамилия"')
      .setRequired(true),
  );

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused();
  const faction = getFactionFromName(interaction.guild?.name);

  if (!faction) {
    await interaction.respond([]);
    return;
  }

  const factionState =
    POSITIONS_STATE_INFO[faction as keyof typeof POSITIONS_STATE_INFO];

  if (!factionState || !factionState.compiled_positions) {
    await interaction.respond([]);
    return;
  }

  const choices = factionState.compiled_positions;
  const filtered = choices.filter((choice) =>
    choice.toLowerCase().includes(focusedValue.toLowerCase()),
  );

  await interaction.respond(
    filtered.slice(0, 25).map((choice) => ({ name: choice, value: choice })),
  );
}

export async function execute(inter: ChatInputCommandInteraction) {
  const userID = inter.user;
  const nickname = inter.options.getString("ник", true).trim();

  const nameParts = nickname.split(/\s+/);
  if (nameParts.length !== 2 || nameParts.some((part) => part.length === 0)) {
    return inter.reply({
      content:
        "**Ошибка:** Ник должен содержать ровно два слова (Имя и Фамилия), разделенных пробелом.\nПример: `John Doe`",
      flags: MessageFlags.Ephemeral,
    });
  }
  const [name, surname] = nameParts;
  const nameRegex = /^[a-zA-Z\-']+$/;
  if (!nameRegex.test(name) || !nameRegex.test(surname)) {
    return inter.reply({
      content:
        "**Ошибка:** Имя и фамилия могут содержать только буквы, дефисы и апострофы.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const passport = inter.options.getInteger("паспорт", true);
  let position = inter.options.getString("отдел", true).trim();

  const faction = getFactionFromName(inter.guild?.name);

  if (!faction) {
    return inter.reply({
      content:
        "**Ошибка:** Не удалось определить фракцию. Убедитесь, что команда выполняется на сервере фракции.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const factionState =
    POSITIONS_STATE_INFO[faction as keyof typeof POSITIONS_STATE_INFO];
  if (!factionState.compiled_positions.includes(position)) {
    const possibleMatch = factionState.compiled_positions.find(
      (p) =>
        p.toLowerCase() === position.toLowerCase() ||
        p.toLowerCase().includes(position.toLowerCase()),
    );

    if (possibleMatch) {
      position = possibleMatch;
    } else {
      return inter.reply({
        content: `**Ошибка:** Должность "${position}" не найдена. Используйте автодополнение для выбора.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  const isDetectiveFaction = Object.values(DETECTIVES_INFO).some(
    (info) => info.discord_id === inter.guild?.id,
  );
  const level = isDetectiveFaction ? "detective" : "casual";
  await inter.deferReply();

  try {
    const embed = new EmbedBuilder()
      .setColor(level === "detective" ? Colors.DarkerGrey : Colors.DarkPurple)
      .setTitle(`${inter.guild?.name} | Запрос на получение нашивки`)
      .setDescription(`Сотрудник ${inter.user} запрашивает выдачу нашивки.`)
      .addFields(
        { name: "Сотрудник", value: `${userID}`, inline: true },
        { name: "Имя Фамилия", value: `${name} ${surname}`, inline: true },
        { name: "Паспорт", value: `${passport}`, inline: true },
        { name: "Позиция", value: `${position}`, inline: true },
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

    const customData = JSON.stringify({
    u: inter.user.id,      // userId
    p: position,           // position
    n: name,               // name
    s: surname,            // surname
    pp: passport           // passport
});

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
        .setCustomId(`patchreq_approve_${customData}`)
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
      components: [row],
    });
  } catch (error) {
    console.error("Ошибка при создании запроса на получение нашивки:", error);
    await inter.editReply({
      content:
        "**Критическая ошибка:** Не удалось создать запрос. Попробуйте позже или обратитесь к администратору.",
    });
  }
}
