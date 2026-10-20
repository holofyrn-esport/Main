const fs = require("fs");
const path = require("path");

const {
  createTournamentBackup
} = require("./tournamentBackup");

const tournamentPath = path.join(
  __dirname,
  "..",
  "data",
  "tournaments.json"
);

function loadTournaments() {
  if (!fs.existsSync(tournamentPath)) {
    return {
      lftMessageId: null,
      lftChannelId: null,
      captainDashboardMessageId: null,
      captainDashboardChannelId: null,
      events: []
    };
  }

  return JSON.parse(
    fs.readFileSync(tournamentPath, "utf8")
  );
}

function saveTournaments(data, reason = "update") {
  const newContent = JSON.stringify(data, null, 2);

  let currentContent = "";

  if (fs.existsSync(tournamentPath)) {
    currentContent = fs.readFileSync(
      tournamentPath,
      "utf8"
    );
  }

  // Do nothing if there was no actual change.
  if (currentContent === newContent) {
    return;
  }

  // Save the previous version before overwriting it.
  if (currentContent) {
    createTournamentBackup(reason);
  }

  fs.writeFileSync(
    tournamentPath,
    newContent
  );
}

function generateTournamentId(data) {
  const usedNumbers = (data.events || []).map(event => {
    const match = String(event.id || "").match(/^T-(\d+)$/);
    return match ? Number(match[1]) : 0;
  });

  const highestNumber = usedNumbers.length
    ? Math.max(...usedNumbers)
    : 0;

  return `T-${String(highestNumber + 1).padStart(3, "0")}`;
}

function findTournament(data, tournamentId) {
  return (data.events || []).find(
    event => event.id === tournamentId
  );
}

function removeOldTournaments(data) {
  // Do not permanently delete old tournaments.
  // Dashboards can filter them visually instead.
  return data;
}

module.exports = {
  loadTournaments,
  saveTournaments,
  generateTournamentId,
  findTournament,
  removeOldTournaments
};