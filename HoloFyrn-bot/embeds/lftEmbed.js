const BRAND = require("../config/brand");
const { EmbedBuilder } = require("discord.js");

const LFT_TIME_ZONE =
  process.env.LFT_TIME_ZONE ||
  "Europe/Budapest";

function getTodayDateString() {
  const parts =
    new Intl.DateTimeFormat("en-CA", {
      timeZone: LFT_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

  const getPart = type =>
    parts.find(
      part => part.type === type
    )?.value;

  return [
    getPart("year"),
    getPart("month"),
    getPart("day")
  ].join("-");
}

function formatDate(date) {
  return String(date || "")
    .replaceAll("-", ".");
}

function normalizeTime(time) {
  const value =
    String(time || "")
      .trim();

  if (
    !value ||
    value.toUpperCase() === "TBD"
  ) {
    return "99:99";
  }

  const match =
    value.match(
      /^(\d{1,2}):(\d{2})$/
    );

  if (!match) {
    return "99:98";
  }

  return `${match[1].padStart(
    2,
    "0"
  )}:${match[2]}`;
}

function isActiveTournament(event) {
  if (!event?.date) {
    return false;
  }

  // Today's events stay visible for the full day.
  return (
    String(event.date) >=
    getTodayDateString()
  );
}

function sortActiveEvents(events) {
  return [...events]
    .filter(isActiveTournament)
    .sort((a, b) => {
      const dateOrder =
        String(a.date).localeCompare(
          String(b.date)
        );

      if (dateOrder !== 0) {
        return dateOrder;
      }

      const timeOrder =
        normalizeTime(
          a.time
        ).localeCompare(
          normalizeTime(b.time)
        );

      if (timeOrder !== 0) {
        return timeOrder;
      }

      return String(
        a.name || ""
      ).localeCompare(
        String(b.name || "")
      );
    });
}

function buildLftEmbed(data) {
  const activeEvents =
    sortActiveEvents(
      data.events || []
    );

  const embed =
    new EmbedBuilder()
      .setTitle(
        "🔎 Looking For Tournament Teammates"
      )
      .setColor(BRAND.color)
      .setDescription(
        "Players who clicked **Find me a teammate**."
      )
      .setFooter({
        text:
          "HoloFyrn Esports • Tournament LFT System"
      })
      .setTimestamp();

  if (!activeEvents.length) {
    embed.addFields({
      name:
        "No active tournament LFTs",
      value:
        "Nobody is currently looking for teammates."
    });

    return embed;
  }

  for (
    const event of activeEvents
  ) {
    const lookingForTeam =
      Array.isArray(
        event.lookingForTeam
      )
        ? event.lookingForTeam
        : [];

    const players =
      lookingForTeam.length
        ? lookingForTeam
            .map(
              id => `• <@${id}>`
            )
            .join("\n")
        : "Nobody yet.";

    const tournamentUrl =
      event.guildId &&
      event.channelId &&
      event.messageId
        ? `https://discord.com/channels/${event.guildId}/${event.channelId}/${event.messageId}`
        : null;

    const tournamentName =
      tournamentUrl
        ? `[${event.name}](${tournamentUrl})`
        : event.name;

    embed.addFields({
      name:
        `${tournamentName} event at ` +
        `${formatDate(event.date)} ` +
        `${event.time || "TBD"}`,
      value:
        `**LFT:**\n${players}`,
      inline: false
    });
  }

  return embed;
}

module.exports = {
  buildLftEmbed,
  getTodayDateString,
  isActiveTournament,
  sortActiveEvents
};
