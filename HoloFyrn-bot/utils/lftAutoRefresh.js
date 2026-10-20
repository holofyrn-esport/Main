const {
  refreshLftMessage
} = require("../buttons/tournamentLft");

function startLftAutoRefresh(client) {
  const refresh = async () => {
    try {
      await refreshLftMessage(
        client
      );
    } catch (error) {
      console.error(
        "Automatic LFT refresh failed:",
        error
      );
    }
  };

  // Refresh immediately when the bot is ready.
  refresh();

  // Then refresh every hour.
  const interval =
    setInterval(
      refresh,
      60 * 60 * 1000
    );

  // Do not keep Node alive only for this timer.
  if (
    typeof interval.unref ===
    "function"
  ) {
    interval.unref();
  }

  console.log(
    "✅ Automatic hourly LFT refresh started."
  );
}

module.exports = {
  startLftAutoRefresh
};
