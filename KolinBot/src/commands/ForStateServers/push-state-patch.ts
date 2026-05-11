import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { generateUniqueDigits, pushPlayerId } from "../../databases/sqlite";
import {
  GOV_PATCH_LOG_CHANNEL_ID,
  getStateHighRoles,
} from "../../utils/config";
import { DETECTIVES_INFO } from "../../utils/constants/fractions";

export const data = new SlashCommandBuilder()
  .setName("новая-нашивка")
  .setDescription("Выдать новую нашивку игроку")
  .addUserOption((opt) =>
    opt
      .setName("игрок")
      .setDescription("Игрок, который получает новую нашивку")
      .setRequired(true),
  )
  .addIntegerOption((opt) =>
    opt
      .setName("паспорт")
      .setDescription("Номер паспорта игрока (от 1 до 999999)")
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("позиция")
      .setDescription("Отдел или должность игрока (Пример: FPB, D. Head FPB)")
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("ник")
      .setDescription('Ник игрока в формате "Имя Фамилия"')
      .setRequired(true),
  )

export async function execute(inter: ChatInputCommandInteraction) {
  const userID = inter.options.getUser("игрок", true);
  const nickname = inter.options.getString("ник", true).trim();
  const member = inter.member as any;
  const stateHighRoles = getStateHighRoles();
  const additionalRoles = ["934191153077702716", "956223490439122967", "956232563771465821"];
  const allAllowedRoles = [...stateHighRoles, ...additionalRoles];

  const hasRole = member?.roles?.cache?.some((r: any) =>
    allAllowedRoles.includes(r.id),
  );
  if (!hasRole) {
    return inter.reply({
      content:
        "❌ **Ошибка:** Создание новых нашивок возможно только при наличии роли старшего состава или специальных ролей.",
      flags: MessageFlags.Ephemeral,
    });
  }

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
  const position = inter.options.getString("позиция", true).trim();

  const faction = getFaction(inter.guild?.id, inter.guild?.name);
  if (!faction) {
    return inter.reply({
      content:
        "❌ **Ошибка:** Не удалось определить фракцию. Убедитесь, что команда выполняется на сервере фракции.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const isDetectiveFaction = Object.values(DETECTIVES_INFO).some(
    (info) => info.discord_id === inter.guild?.id,
  );
  const level = isDetectiveFaction ? 'detective' : 'casual'
  await inter.deferReply();

  const patch = generatePatch(
    faction.abbreviation,
    position,
    nickname,
    name,
    surname,
    passport,
    level,
  );

  try {
    pushPlayerId(passport, nickname, userID.id, faction.abbreviation, patch);

    const embed = new EmbedBuilder()
      .setColor(level === "detective" ? 0xff4654 : 0x2b2d31)
      .setTitle(`${faction.fullName} | Лог нашивок`)
      .setDescription(
        `Сотрудник ${inter.user} выдал новую нашивку для ${userID}\n\n` +
          `\`\`\`/do На груди закреплена нашивка: ${patch}\`\`\``,
      )
      .addFields(
        { name: "Сотрудник", value: `${userID}`, inline: true },
        { name: "Паспорт", value: `${passport}`, inline: true },
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

    if (level !== "detective") {
      const embedGov = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(`${faction.fullName} | Лог нашивок`)
        .setDescription(
          `Сотрудник ${faction.abbreviation} ${inter.user} выдал новую нашивку для ${userID}\n\n` +
            `\`\`\`/do На груди закреплена нашивка: ${patch}\`\`\``,
        )
        .addFields(
          { name: "Сотрудник", value: `${userID}`, inline: true },
          { name: "Паспорт", value: `${passport}`, inline: true },
          { name: "Тип", value: "Обычная", inline: true },
          {
            name: "Дата",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false,
          },
        )
        .setTimestamp()
        .setFooter({ text: `ID: ${userID.id} | Паспорт: ${passport}` });

      const gov_log = inter.client.channels.cache.get(
        GOV_PATCH_LOG_CHANNEL_ID,
      ) as TextChannel;
      if (gov_log) {
        await gov_log.send({ embeds: [embedGov] });
      }
    }

    await inter.editReply({
      content: `${userID}`,
      embeds: [embed],
    });
  } catch (error) {
    console.error("Ошибка при сохранении нашивки:", error);
    await inter.editReply({
      content:
        "❌ **Критическая ошибка:** Не удалось сохранить нашивку. Попробуйте позже или обратитесь к администратору.",
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
  level: string,
): string {
  const randomDigits = generateUniqueDigits(passport, faction);

  const detectiveDepartmentToFaction: Record<string, string> = {
    CID: "FIB",
    DB: "LSPD",
    DD: "LSSD",
  };

  if (level === "detective") {
    return `[${detectiveDepartmentToFaction[faction]} | ${faction} | ${randomDigits}].`;
  }

  return `[${faction} | ${position} | ${name[0].toUpperCase()}${surname[0].toUpperCase()}${randomDigits}].`;
}

function getFaction(
  guildId: string | undefined,
  guildName: string | undefined,
): { abbreviation: string; fullName: string } | undefined {
  if (!guildId) return undefined;

  for (const [abbr, info] of Object.entries(DETECTIVES_INFO)) {
    if (info.discord_id === guildId) {
      return {
        abbreviation: abbr,
        fullName: `${abbr} | Blackberry`,
      };
    }
  }

  if (guildName) {
    let factionAbbr = guildName.replace(/^GTA 5 RP\s*\|\s*/, "").trim();

    const factionMapping: Record<string, string> = {
      Government: "USSS",
    };

    if (factionMapping[factionAbbr]) {
      factionAbbr = factionMapping[factionAbbr];
    }

    if (factionAbbr) {
      return {
        abbreviation: factionAbbr,
        fullName: `GTA 5 RP | ${factionAbbr}`,
      };
    }
  }

  return undefined;
}