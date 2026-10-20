const {
  loadTournaments,
  saveTournaments
} = require("../utils/tournamentData");

const { loadRosters } = require("../utils/rosterData");

const {
  buildCaptainDashboardEmbed,
  ensureTeamStatuses
} = require("../embeds/captainDashboardEmbed");

async function handleCaptainDashboardSelect(interaction) {
  const data = loadTournaments();
  const rosterData = loadRosters();
  const teams = rosterData.teams || [];

  if (
    interaction.customId ===
    "captain_dashboard_select_event"
  ) {
    const selectedEventId = interaction.values[0];

    const dashboard = buildCaptainDashboardEmbed(
      data,
      selectedEventId
    );

    await interaction.update({
      embeds: [dashboard.embed],
      components: dashboard.components
    });

    return;
  }

  if (
    interaction.customId.startsWith(
      "captain_dashboard_select_team_"
    )
  ) {
    const selectedEventId =
      interaction.customId.replace(
        "captain_dashboard_select_team_",
        ""
      );

    const selectedTeamId = interaction.values[0];

    const dashboard = buildCaptainDashboardEmbed(
      data,
      selectedEventId,
      selectedTeamId
    );

    await interaction.update({
      embeds: [dashboard.embed],
      components: dashboard.components
    });

    return;
  }

  if (
    interaction.customId.startsWith(
      "captain_dashboard_status_"
    )
  ) {
    const identifier = interaction.customId.replace(
      "captain_dashboard_status_",
      ""
    );

    const separatorIndex = identifier.lastIndexOf("_");

    const selectedEventId = identifier.slice(
      0,
      separatorIndex
    );

    const selectedTeamId = identifier.slice(
      separatorIndex + 1
    );

    const newStatus = interaction.values[0];

    const event = data.events.find(
      item => item.id === selectedEventId
    );

    if (!event) {
      return interaction.reply({
        content: "Tournament not found.",
        ephemeral: true
      });
    }

    const team = teams.find(
      item => item.id === selectedTeamId
    );

    if (!team) {
      return interaction.reply({
        content: "Team not found.",
        ephemeral: true
      });
    }

    const statuses = ensureTeamStatuses(event, teams);
    statuses[selectedTeamId] = newStatus;

    saveTournaments(data);

    const dashboard = buildCaptainDashboardEmbed(
      data,
      selectedEventId,
      selectedTeamId
    );

    await interaction.update({
      embeds: [dashboard.embed],
      components: dashboard.components
    });
  }
}

module.exports = {
  handleCaptainDashboardSelect
};