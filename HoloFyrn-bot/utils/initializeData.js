const fs = require("fs");
const path = require("path");

const dataDirectory = path.join(
  __dirname,
  "..",
  "data"
);

const seedDirectory = path.join(
  __dirname,
  "..",
  "seed-data"
);

const files = [
  "rosters.json",
  "tournaments.json",
  "tickets.json",
  "tryouts.json"
];

function initializeDataFiles() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, {
      recursive: true
    });
  }

  for (const file of files) {
    const destinationPath = path.join(
      dataDirectory,
      file
    );

    const seedPath = path.join(
      seedDirectory,
      file
    );

    if (fs.existsSync(destinationPath)) {
      continue;
    }

    if (!fs.existsSync(seedPath)) {
      throw new Error(
        `Missing seed file: ${seedPath}`
      );
    }

    fs.copyFileSync(
      seedPath,
      destinationPath
    );

    console.log(
      `Initialized data/${file}`
    );
  }
}

module.exports = {
  initializeDataFiles
};