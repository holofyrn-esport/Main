function parseUtcOffset(timezone) {
  const value = String(timezone || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  const namedOffsets = {
    UTC: 0,
    GMT: 0,

    CET: 60,
    CEST: 120,

    EET: 120,
    EEST: 180,

    EST: -300,
    EDT: -240,

    CST: -360,
    CDT: -300,

    MST: -420,
    MDT: -360,

    PST: -480,
    PDT: -420
  };

  if (Object.prototype.hasOwnProperty.call(namedOffsets, value)) {
    return namedOffsets[value];
  }

  const match = value.match(
    /^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$/
  );

  if (!match) {
    return null;
  }

  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || 0);

  if (
    hours > 14 ||
    minutes > 59
  ) {
    return null;
  }

  return sign * ((hours * 60) + minutes);
}

function createTournamentTimestamp(date, time, timezone) {
  if (!date || !time) {
    return null;
  }

  if (
    String(time).trim().toUpperCase() === "TBD"
  ) {
    return null;
  }

  const dateMatch = String(date)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  const timeMatch = String(time)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const offsetMinutes =
    parseUtcOffset(timezone);

  if (offsetMinutes === null) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  const utcMilliseconds =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute
    ) - (offsetMinutes * 60 * 1000);

  const parsedDate =
    new Date(utcMilliseconds);

  if (
    Number.isNaN(parsedDate.getTime())
  ) {
    return null;
  }

  return Math.floor(
    parsedDate.getTime() / 1000
  );
}

module.exports = {
  parseUtcOffset,
  createTournamentTimestamp
};