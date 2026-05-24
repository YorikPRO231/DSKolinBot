import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel,} from "discord.js";
import { PatchesRepository } from "../../databases/index";
import {generatePatch, getFaction} from "../../utils/utilsState";
import { getStateHighRoles, getSystemChannel, getSystemRole, getDetectives } from "../../config/settings-loader";

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
        .setName("отдел")
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
  const detectivesHighRoles = getSystemRole('detectives_high');
  const allAllowedRoles = [...stateHighRoles, ...detectivesHighRoles];

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
    const position = inter.options.getString("отдел", true).trim();

  const faction = getFaction(inter.guild?.id, inter.guild?.name);
  if (!faction) {
    return inter.reply({
      content:
        "❌ **Ошибка:** Не удалось определить фракцию. Убедитесь, что команда выполняется на сервере фракции.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const detectives = getDetectives();
  const isDetectiveFaction = Object.values(detectives).some(
    (info) => info.discord_id === inter.guild?.id,
  );
  const level = isDetectiveFaction ? 'detective' : 'casual'
  await inter.deferReply();

  const patch = generatePatch(
    faction.abbreviation,
    position,
    name,
    surname,
    passport,
    level
  );

  try {
    PatchesRepository.pushPlayerId(passport, nickname, userID.id, faction.abbreviation, patch);

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
      const govPatchLogChannelId = getSystemChannel('gov_patch_log');
      
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
        govPatchLogChannelId,
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