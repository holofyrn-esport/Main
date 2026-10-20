const fs = require("fs");
const path = require("path");

const dataPath = path.join(
  __dirname,
  "..",
  "data",
  "tournaments.json"
);

const backupDirectory = path.join(
  __dirname,
  "..",
  "data",
  "backups"
);

const MAX_BACKUPS = 20;

function createTournamentBackup(reason = "update") {
  try {
    if (!fs.existsSync(dataPath)) {
      console.log("Tournament backup skipped: tournaments.json not found.");
      return;
    }

    if (!fs.existsSync(backupDirectory)) {
      fs.mkdirSync(backupDirectory, {
        recursive: true
      });
    }

    const now = new Date();

    const timestamp = now
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\./g, "-");

    const safeReason = reason
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .slice(0, 40);

    const backupName =
      `tournaments-${timestamp}-${safeReason}.json`;

    const backupPath = path.join(
      backupDirectory,
      backupName
    );

    fs.copyFileSync(dataPath, backupPath);

    console.log(`✅ Tournament backup created: ${backupName}`);

    removeOldBackups();
  } catch (error) {
    console.error(
      "❌ Tournament backup failed:",
      error.message
    );
  }
}

function removeOldBackups() {
  const backups = fs
    .readdirSync(backupDirectory)
    .filter(file =>
      file.startsWith("tournaments-") &&
      file.endsWith(".json")
    )
    .map(file => {
      const filePath = path.join(
        backupDirectory,
        file
      );

      return {
        name: file,
        path: filePath,
        modified: fs.statSync(filePath).mtimeMs
      };
    })
    .sort((a, b) => b.modified - a.modified);

  const oldBackups = backups.slice(MAX_BACKUPS);

  for (const backup of oldBackups) {
    fs.unlinkSync(backup.path);

    console.log(
      `🗑️ Removed old tournament backup: ${backup.name}`
    );
  }
}

module.exports = {
  createTournamentBackup
};