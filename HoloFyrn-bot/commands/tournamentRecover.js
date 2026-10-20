const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require("discord.js");

const {
  loadTournaments,
  saveTournaments,
  generateTournamentId
} = require("../utils/tournamentData");

function cleanFieldName(name) {
  return String(name || "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .toLowerCase();
}

function cleanValue(value) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .trim();
}

function getField(embed, wantedName) {
  const wanted = wantedName.toLowerCase();

  const field = embed.fields?.find(item =>
    cleanFieldName(item.name).includes(wanted)
  );

  return field ? cleanValue(field.value) : "";
}

function extractRegistrationUrl(value) {
  const markdownMatch = String(value || "").match(
    /\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/
  );

  if (markdownMatch) {
    return markdownMatch[1];
  }

  const plainMatch = String(value || "").match(
    /https?:\/\/\S+/
  );

  return plainMatch ? plainMatch[0] : "";
}

function extractTournamentId(embed, data) {
  const footerText = embed.footer?.text || "";

  const match = footerText.match(/Tournament ID:\s*(T-\d+)/i);

  if (match) {
    return match[1].toUpperCase();
  }

  return generateTournamentId(data);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tournament-recover")
    .setDescription("Recover an existing tournament announcement into the database.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("The Discord message ID of the tournament announcement")
        .setRequired(true)
    )

    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Tournament channel; leave empty to use the current channel")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral
    });

    const messageId = interaction.options.getString("message");
    const selectedChannel =
      interaction.options.getChannel("channel") ||
      interaction.channel;

    if (!selectedChannel?.isTextBased()) {
      return interaction.editReply(
        "❌ The selected channel is not a text channel."
      );
    }

    let tournamentMessage;

    try {
      tournamentMessage =
        await selectedChannel.messages.fetch(messageId);
    } catch (error) {
      console.error("Tournament recovery fetch failed:", error);

      return interaction.editReply(
        "❌ I could not find that message. Check the message ID and channel."
      );
    }

    const embed = tournamentMessage.embeds?.[0];

    if (!embed) {
      return interaction.editReply(
        "❌ That message does not contain a tournament embed."
      );
    }

    const data = loadTournaments();

    if (!Array.isArray(data.events)) {
      data.events = [];
    }

    let tournamentId = extractTournamentId(embed, data);

if (data.events.some(e => e.id === tournamentId)) {
    tournamentId = generateTournamentId(data);
}

    const duplicateMessage = data.events.find(
      event => event.messageId === tournamentMessage.id
    );

    if (duplicateMessage) {
      return interaction.editReply(
        `❌ This announcement is already stored as **${duplicateMessage.name}**.`
      );
    }

    const duplicateId = data.events.find(
      event => event.id === tournamentId
    );

    if (duplicateId) {
      return interaction.editReply(
        `❌ Tournament ID **${tournamentId}** is already used by **${duplicateId.name}**.`
      );
    }

    const registrationValue = getField(
      embed,
      "registration"
    );

    const recoveredEvent = {
      id: tournamentId,
      name: String(embed.title || "Recovered Tournament")
        .replace(/^🏆\s*/, "")
        .trim(),

      date: getField(embed, "date"),
      time: getField(embed, "time") || "TBD",
      timezone: getField(embed, "timezone"),
      format: getField(embed, "format"),
      registration: extractRegistrationUrl(
        registrationValue
      ),
      region: getField(embed, "region"),
      rank: getField(embed, "rank"),
      prize:
        getField(embed, "prize pool") ||
        getField(embed, "prize"),
      notes: getField(embed, "notes"),

      imageUrl:
        embed.image?.url ||
        tournamentMessage.attachments.first()?.url ||
        "",

      channelId: selectedChannel.id,
      messageId: tournamentMessage.id,
      lookingForTeam: [],
      teamStatuses: {}
    };

    data.events.push(recoveredEvent);

    saveTournaments(
      data,
      `recover-${recoveredEvent.id}`
    );

    return interaction.editReply(
      [
        `✅ Recovered **${recoveredEvent.name}** as **${recoveredEvent.id}**.`,
        `Date: ${recoveredEvent.date || "missing"}`,
        `Time: ${recoveredEvent.time}${
          recoveredEvent.timezone
            ? ` ${recoveredEvent.timezone}`
            : ""
        }`,
        `Image: ${
          recoveredEvent.imageUrl ? "found" : "not found"
        }`
      ].join("\n")
    );
  }
};