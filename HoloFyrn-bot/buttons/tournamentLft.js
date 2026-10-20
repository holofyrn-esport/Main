const {
  loadTournaments,
  saveTournaments
} = require("../utils/tournamentData");

const {
  buildLftEmbed,
  isActiveTournament
} = require("../embeds/lftEmbed");

function clearExpiredLftPlayers(data) {
  let changed = false;

  for (
    const event of data.events || []
  ) {
    if (
      !isActiveTournament(event) &&
      Array.isArray(
        event.lookingForTeam
      ) &&
      event.lookingForTeam.length
    ) {
      event.lookingForTeam = [];
      changed = true;
    }
  }

  return changed;
}

async function refreshLftMessage(
  client,
  suppliedData = null
) {
  const data =
    suppliedData ||
    loadTournaments();

  if (!Array.isArray(data.events)) {
    data.events = [];
  }

  const cleared =
    clearExpiredLftPlayers(data);

  const channelId =
    process.env.LFT_CHANNEL_ID ||
    data.lftChannelId;

  if (!channelId) {
    console.log(
      "Missing LFT_CHANNEL_ID and no saved LFT channel."
    );
    return false;
  }

  let channel;

  try {
    channel =
      await client.channels.fetch(
        channelId
      );
  } catch (error) {
    console.error(
      "Could not fetch LFT channel:",
      error
    );
    return false;
  }

  if (!channel?.isTextBased()) {
    console.log(
      "Configured LFT channel is not text-based."
    );
    return false;
  }

  if (data.lftMessageId) {
    try {
      const message =
        await channel.messages.fetch(
          data.lftMessageId
        );

      await message.edit({
        embeds: [
          buildLftEmbed(data)
        ]
      });

      if (cleared) {
        saveTournaments(
          data,
          "clear-expired-lft"
        );
      }

      console.log(
        "✅ LFT message refreshed."
      );

      return true;
    } catch (error) {
      console.log(
        "Saved LFT message could not be edited. Creating a new one."
      );
    }
  }

  try {
    const message =
      await channel.send({
        embeds: [
          buildLftEmbed(data)
        ]
      });

    data.lftMessageId =
      message.id;

    data.lftChannelId =
      channel.id;

    saveTournaments(
      data,
      "create-lft-message"
    );

    console.log(
      "✅ New LFT message created."
    );

    return true;
  } catch (error) {
    console.error(
      "Could not create LFT message:",
      error
    );

    return false;
  }
}

async function handleTournamentLft(
  interaction
) {
  const eventId =
    interaction.customId.replace(
      "tournament_lft_",
      ""
    );

  const data =
    loadTournaments();

  const event =
    (data.events || []).find(
      item => item.id === eventId
    );

  if (!event) {
    return interaction.reply({
      content:
        "❌ This tournament no longer exists.",
      ephemeral: true
    });
  }

  if (!isActiveTournament(event)) {
    await refreshLftMessage(
      interaction.client,
      data
    );

    return interaction.reply({
      content:
        "❌ This tournament has already passed.",
      ephemeral: true
    });
  }

  if (
    !Array.isArray(
      event.lookingForTeam
    )
  ) {
    event.lookingForTeam = [];
  }

  const userId =
    interaction.user.id;

  const alreadyListed =
    event.lookingForTeam.includes(
      userId
    );

  if (alreadyListed) {
    event.lookingForTeam =
      event.lookingForTeam.filter(
        id => id !== userId
      );
  } else {
    event.lookingForTeam.push(
      userId
    );
  }

  saveTournaments(
    data,
    alreadyListed
      ? `lft-remove-${event.id}`
      : `lft-add-${event.id}`
  );

  await refreshLftMessage(
    interaction.client,
    data
  );

  return interaction.reply({
    content: alreadyListed
      ? "✅ Removed you from the tournament LFT list."
      : "✅ Added you to the tournament LFT list.",
    ephemeral: true
  });
}

module.exports = {
  handleTournamentLft,
  refreshLftMessage,
  clearExpiredLftPlayers
};
