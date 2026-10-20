const { createTournamentTimestamp, parseUtcOffset } = require("./tournamentTime");

// Only announcement fields are copied. Message IDs, LFT players and other
// per-tournament state must never be inherited by the new event.
const COPY_FIELDS = [
  "name", "date", "time", "timezone", "format", "registration",
  "region", "rank", "prize", "notes"
];

const CLEARABLE_FIELDS = new Set(["region", "rank", "prize", "notes"]);
const FORMATS = new Set(["3v3", "2v2", "1v1", "Extra Modes", "Draft"]);

function createTournamentCopy(source, overrides, id, guildId, channelId) {
  const event = {};

  for (const field of COPY_FIELDS) {
    const changed = overrides[field];
    const inherited = source[field] ?? "";

    if (changed === null || changed === undefined) {
      event[field] = inherited;
    } else if (
      CLEARABLE_FIELDS.has(field) &&
      String(changed).trim().toLowerCase() === "clear"
    ) {
      event[field] = "";
    } else {
      event[field] = changed;
    }
  }

  event.id = id;
  event.imageUrl = overrides.remove_picture || overrides.picture
    ? ""
    : (source.imageUrl || "");
  event.guildId = guildId;
  event.channelId = channelId;
  event.messageId = null;
  event.lookingForTeam = [];
  event.timestamp = createTournamentTimestamp(event.date, event.time, event.timezone);

  return event;
}

function isValidDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 100 || month < 1 || month > 12 || day < 1) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function validateTournamentCopy(event) {
  if (!event.name?.trim()) return "Tournament name is missing. Set `name`.";
  if (!isValidDate(event.date)) return "Use a valid `date` in YYYY-MM-DD format.";
  if (!/^(TBD|(?:[01]?\d|2[0-3]):[0-5]\d)$/i.test(event.time || "")) {
    return "Use `time` as HH:MM (24-hour clock) or TBD.";
  }
  if (parseUtcOffset(event.timezone) === null) {
    return "Invalid `timezone`. Use CEST, CET, UTC+2, EST, etc.";
  }
  if (!FORMATS.has(event.format)) {
    return "Invalid tournament `format`. Choose one of the available formats.";
  }
  if (!/^https?:\/\/\S+$/i.test(event.registration || "")) {
    return "A valid http(s) `registration` link is required.";
  }
  if (event.name.length > 250) return "Tournament `name` is too long.";
  if (event.notes?.length > 4000) return "Tournament `notes` are too long.";
  return null;
}

module.exports = {
  createTournamentCopy,
  validateTournamentCopy,
  isValidDate
};
