const fs = require("fs");
const path = require("path");

const tryoutPath = path.join(
  __dirname,
  "..",
  "data",
  "tryouts.json"
);

function getDefaultTryoutData() {
  return {
    lastId: 0,
    panelMessageId: null,
    panelChannelId: null,
    applications: []
  };
}

function ensureTryoutDataShape(data) {
  const safeData =
    data && typeof data === "object"
      ? data
      : getDefaultTryoutData();

  if (!Number.isInteger(safeData.lastId)) {
    safeData.lastId = 0;
  }

  if (!Array.isArray(safeData.applications)) {
    safeData.applications = [];
  }

  if (!Object.prototype.hasOwnProperty.call(
    safeData,
    "panelMessageId"
  )) {
    safeData.panelMessageId = null;
  }

  if (!Object.prototype.hasOwnProperty.call(
    safeData,
    "panelChannelId"
  )) {
    safeData.panelChannelId = null;
  }

  return safeData;
}

function loadTryouts() {
  if (!fs.existsSync(tryoutPath)) {
    const defaultData = getDefaultTryoutData();
    saveTryouts(defaultData);
    return defaultData;
  }

  try {
    const content = fs
      .readFileSync(tryoutPath, "utf8")
      .trim();

    if (!content) {
      const defaultData = getDefaultTryoutData();
      saveTryouts(defaultData);
      return defaultData;
    }

    return ensureTryoutDataShape(
      JSON.parse(content)
    );
  } catch (error) {
    console.error(
      "❌ Failed to load tryouts.json:",
      error
    );

    return getDefaultTryoutData();
  }
}

function saveTryouts(data) {
  const safeData = ensureTryoutDataShape(data);

  fs.mkdirSync(
    path.dirname(tryoutPath),
    { recursive: true }
  );

  fs.writeFileSync(
    tryoutPath,
    JSON.stringify(safeData, null, 2),
    "utf8"
  );
}

function generateTryoutId(data) {
  data.lastId += 1;

  return `A-${String(data.lastId).padStart(
    3,
    "0"
  )}`;
}

function findTryout(data, applicationId) {
  return data.applications.find(
    application =>
      application.id === applicationId
  );
}

function findPendingApplication(
  data,
  userId,
  teamId
) {
  return data.applications.find(
    application =>
      application.userId === userId &&
      application.teamId === teamId &&
      application.status === "pending"
  );
}

module.exports = {
  loadTryouts,
  saveTryouts,
  generateTryoutId,
  findTryout,
  findPendingApplication
};