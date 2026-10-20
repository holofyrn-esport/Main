const BRAND = require("../config/brand");
const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require("discord.js");

const { loadRosters } = require("../utils/rosterData");

function ensureTeamStatuses(event, teams) {
  if (!event.teamStatuses) {
    event.teamStatuses = {};
  }

  for (const team of teams) {
    if (!event.teamStatuses[team.id]) {
      event.teamStatuses[team.id] = "not-signed-up";
    }
  }

  return event.teamStatuses;
}

function getStatusText(status) {
  if (status === "signed-up") {
    return "🟢 Signed up";
  }

  if (status === "not-participating") {
    return "🔴 Not participating";
  }

  return "⚪ Not signed up";
}

function buildCaptainDashboardEmbed(
  data,
  selectedEventId = null,
  selectedTeamId = null
) {
  const rosterData = loadRosters();
  const teams = rosterData.teams || [];

  // Sort tournaments from earliest to latest.
  const cutoffDate = new Date();
cutoffDate.setHours(0, 0, 0, 0);
cutoffDate.setDate(cutoffDate.getDate() - 2);

const activeEvents = [...(data.events || [])]
  .filter(event => {
    if (!event.date) return true;

    const eventDate = new Date(`${event.date}T00:00:00`);
    eventDate.setHours(0, 0, 0, 0);

    return eventDate >= cutoffDate;
  })
  .sort((a, b) => {
    const timeA =
      a.time && a.time.toUpperCase() !== "TBD"
        ? a.time.padStart(5, "0")
        : "99:99";

    const timeB =
      b.time && b.time.toUpperCase() !== "TBD"
        ? b.time.padStart(5, "0")
        : "99:99";

    return `${a.date} ${timeA}`.localeCompare(
      `${b.date} ${timeB}`
    );
  });

  if (!activeEvents.length) {
    return {
      embed: new EmbedBuilder()
        .setTitle("Captain Tournament Dashboard")
        .setColor(BRAND.color)
        .setDescription("There are currently no active tournaments.")
        .setFooter({
          text: "HoloFyrn Esports • Captain Dashboard"
        }),

      components: []
    };
  }

  const selectedEvent =
    activeEvents.find(event => event.id === selectedEventId) ||
    activeEvents[0];

  const statuses = ensureTeamStatuses(selectedEvent, teams);

  const selectedTeam =
    teams.find(team => team.id === selectedTeamId) || null;

  const teamLines = teams.map(team => {
    const displayName = team.shortName || team.name;
    const statusText = getStatusText(statuses[team.id]);

    return `**${displayName}:** ${statusText}`;
  });

  const descriptionLines = [
    `**Date:** ${selectedEvent.date}`,
    `**Time:** ${selectedEvent.time || "TBD"}${
      selectedEvent.timezone
        ? ` ${selectedEvent.timezone}`
        : ""
    }`,
    selectedEvent.region
      ? `**Region:** ${selectedEvent.region}`
      : null,
    selectedEvent.format
      ? `**Format:** ${selectedEvent.format}`
      : null,
    selectedEvent.prize
      ? `**Prize Pool:** ${selectedEvent.prize}`
      : null,
    "",
    ...teamLines,
    "",
    selectedTeam
      ? `Editing: **${selectedTeam.shortName || selectedTeam.name}**`
      : "Select a team below to change its status."
  ].filter(line => line !== null);

  const embed = new EmbedBuilder()
    .setTitle(selectedEvent.name)
    .setColor(BRAND.color)
    .setDescription(descriptionLines.join("\n"))
    .setFooter({
      text: `Tournament ID: ${selectedEvent.id} • HoloFyrn Esports`
    });

  // Display the tournament image in the dashboard.
  if (
    typeof selectedEvent.imageUrl === "string" &&
    selectedEvent.imageUrl.startsWith("http")
  ) {
    embed.setImage(selectedEvent.imageUrl);
  }

  const eventMenu = new StringSelectMenuBuilder()
    .setCustomId("captain_dashboard_select_event")
    .setPlaceholder("Select a tournament")
    .addOptions(
      activeEvents.slice(0, 25).map(event => ({
        label: event.name.slice(0, 100),
        description: `${event.date} • ${event.time || "TBD"} ${
          event.timezone || ""
        }`.trim().slice(0, 100),
        value: event.id,
        default: event.id === selectedEvent.id
      }))
    );

  const eventRow = new ActionRowBuilder().addComponents(eventMenu);

  const components = [eventRow];

  if (teams.length) {
    const teamMenu = new StringSelectMenuBuilder()
      .setCustomId(
        `captain_dashboard_select_team_${selectedEvent.id}`
      )
      .setPlaceholder("Select a team")
      .addOptions(
        teams.slice(0, 25).map(team => ({
          label: (team.shortName || team.name).slice(0, 100),
          description: `Current status: ${getStatusText(
            statuses[team.id]
          )}`.slice(0, 100),
          value: team.id,
          default: team.id === selectedTeamId
        }))
      );

    const teamRow = new ActionRowBuilder().addComponents(teamMenu);
    components.push(teamRow);
  }

  if (selectedTeam) {
    const currentStatus =
      statuses[selectedTeam.id] || "not-signed-up";

    const statusMenu = new StringSelectMenuBuilder()
      .setCustomId(
        `captain_dashboard_status_${selectedEvent.id}_${selectedTeam.id}`
      )
      .setPlaceholder("Choose the new status")
      .addOptions(
        {
          label: "Signed up",
          description: "The team is registered for this tournament.",
          value: "signed-up",
          default: currentStatus === "signed-up"
        },
        {
          label: "Not signed up",
          description: "The team has not registered yet.",
          value: "not-signed-up",
          default: currentStatus === "not-signed-up"
        },
        {
          label: "Not participating",
          description: "The team will not enter this tournament.",
          value: "not-participating",
          default: currentStatus === "not-participating"
        }
      );

    const statusRow = new ActionRowBuilder().addComponents(statusMenu);
    components.push(statusRow);
  }

  return {
    embed,
    components,
    selectedEvent,
    selectedTeam
  };
}

module.exports = {
  buildCaptainDashboardEmbed,
  ensureTeamStatuses,
  getStatusText
};