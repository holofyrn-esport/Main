const BRAND = require("../config/brand");
const { EmbedBuilder } = require("discord.js");
const { formatAverageMmr } = require("../utils/rosterMmr");

function getRoleTag(role) {
  if (role === "Captain") return " (C)";
  if (role === "Sub") return " (S)";
  if (role === "Coach") return " (Coach)";
  if (role === "Manager") return " (Manager)";
  return "";
}

// The URL text counts toward Discord's 6000-char message limit, so drop the
// optional "/overview" tail (tracker.network redirects there automatically).
function compactTrackerUrl(url) {
  return String(url).trim().replace(/\/overview\/?$/i, "").replace(/\/+$/, "");
}

function buildPlayerLine(player) {
  const roleTag = getRoleTag(player.role);
  const mention = player.discordId ? `<@${player.discordId}>` : player.name;

  const parts = [
    `${player.country || ""} ${player.name ? `**${player.name}**` : "**Unknown**"}${roleTag}`,
    mention
  ];

  if (player.tracker) parts.push(`[📈 Tracker](${compactTrackerUrl(player.tracker)})`);
  if (player.liquipedia) parts.push(`[📖 Liquipedia](${player.liquipedia})`);

  return parts.join(" | ");
}

function splitText(text, maxLength = 1000) {
  const lines = text.split("\n");
  const chunks = [];
  let current = "";

  for (const line of lines) {
    if ((current + "\n" + line).length > maxLength) {
      chunks.push(current || line);
      current = "";
    }

    current += current ? `\n${line}` : line;
  }

  if (current) chunks.push(current);
  return chunks;
}

function getTeamLogoEmoji(team) {
  if (!team.logoEmojiId || !team.logoEmojiName) {
    return "";
  }

  const prefix = team.logoEmojiAnimated ? "a" : "";

  return `<${prefix ? "a" : ""}:${team.logoEmojiName}:${team.logoEmojiId}> `;
}

// Discord limits: 6000 chars total per MESSAGE (all embeds combined),
// 1024 chars per field value, 256 per field name, 25 fields per embed.
// The roster is kept in ONE embed/message whenever it fits. Only if it can't
// fit is it split, one embed per message, with the banner on the last one.
const PAGE_CHAR_LIMIT = 5900;
const MAX_FIELDS_PER_PAGE = 25;
const FIELD_VALUE_LIMIT = 1000;

function buildTeamFields(team) {
  const playersText = team.players.length
    ? team.players.map(buildPlayerLine).join("\n")
    : "*No players listed.*";

  // Place team MMR directly below its last player, before the separator.
  const chunks = splitText(`${playersText}\n${formatAverageMmr(team.averageMmr)}`, FIELD_VALUE_LIMIT);

  return chunks.map((chunk, index) => ({
    name: index === 0
      ? `━━━━━━━━━━━━━━━━━━━━━━\n${getTeamLogoEmoji(team)}${team.name.toUpperCase()}`.slice(0, 256)
      : "\u200B",
    value: (chunk || "*No players listed.*").slice(0, 1024),
    inline: false
  }));
}

const fieldSize = f => f.name.length + f.value.length;

function buildRosterEmbeds(data) {
  const headerText = "**Official active Rocket League rosters.**";
  const footerText = `${BRAND.name} • Roster System`;

  // Worst-case overhead: header on the first page, footer on the last.
  // Reserving both everywhere is slightly conservative but always safe.
  const overhead = BRAND.rosterTitle.length + headerText.length + footerText.length;

  const pages = [{ fields: [], size: overhead }];
  const current = () => pages[pages.length - 1];
  const newPage = () => pages.push({ fields: [], size: footerText.length });

  for (const team of data.teams) {
    const fields = buildTeamFields(team);
    const teamSize = fields.reduce((sum, f) => sum + fieldSize(f), 0);

    // Keep a team together on one page when it fits; otherwise start a fresh page.
    if (
      current().fields.length > 0 &&
      (current().size + teamSize > PAGE_CHAR_LIMIT ||
        current().fields.length + fields.length > MAX_FIELDS_PER_PAGE)
    ) {
      newPage();
    }

    for (const field of fields) {
      const size = fieldSize(field);
      if (
        current().fields.length > 0 &&
        (current().size + size > PAGE_CHAR_LIMIT ||
          current().fields.length >= MAX_FIELDS_PER_PAGE)
      ) {
        newPage();
      }
      current().fields.push(field);
      current().size += size;
    }
  }

  return pages.map((page, index) => {
    const embed = new EmbedBuilder().setColor(BRAND.color);
    const isFirst = index === 0;

    if (isFirst) {
      embed.setAuthor(
        BRAND.logoUrl
          ? { name: BRAND.rosterTitle, iconURL: BRAND.logoUrl }
          : { name: BRAND.rosterTitle }
      );
      embed.setDescription(headerText);
    }

    if (page.fields.length) embed.addFields(page.fields);

    return embed;
  });
}

// Bottom panel: banner image on its own embed, with the footer + timestamp.
// An image-only embed adds almost nothing to the 6000-char message limit.
function buildBannerEmbed() {
  const embed = new EmbedBuilder()
    .setColor(BRAND.color)
    .setImage(`attachment://${BRAND.rosterBannerFileName}`)
    .setFooter(
      BRAND.logoUrl
        ? { text: `${BRAND.name} • Roster System`, iconURL: BRAND.logoUrl }
        : { text: `${BRAND.name} • Roster System` }
    )
    .setTimestamp();
  return embed;
}

// Returns an array of messages; each message is an array of embeds.
// The banner panel is always the last embed of the last message.
function buildRosterMessages(data) {
  const messages = buildRosterEmbeds(data).map(embed => [embed]);
  messages[messages.length - 1].push(buildBannerEmbed());
  return messages;
}

// Backwards-compatible: returns only the first text embed.
function buildRosterEmbed(data) {
  return buildRosterEmbeds(data)[0];
}

module.exports = { buildRosterEmbed, buildRosterEmbeds, buildBannerEmbed, buildRosterMessages };
