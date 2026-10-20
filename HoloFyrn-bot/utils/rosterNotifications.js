const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags
} = require("discord.js");

const BRAND = require("../config/brand");

async function sendRosterNotification(
  client,
  discordId,
  container
) {
  if (!discordId) {
    console.warn(
      "Roster notification skipped: player has no Discord ID."
    );
    return false;
  }

  try {
    const user =
      await client.users.fetch(discordId);

    await user.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });

    return true;
  } catch (error) {
    console.warn(
      `Could not send roster DM to ${discordId}:`,
      error.message
    );

    return false;
  }
}

function buildRosterCard({
  type,
  description,
  details,
  updatedBy
}) {
  let accentColor = BRAND.color;
  let title = "Roster Update";

  if (type === "added") {
    accentColor = 0x2ecc71;
    title = "✅ Roster Update — Added";
  }

  if (type === "removed") {
    accentColor = 0xe74c3c;
    title = "❌ Roster Update — Removed";
  }

  if (type === "moved") {
    accentColor = 0xf1c40f;
    title = "↔️ Roster Update — Team Change";
  }

  const updatedByText = updatedBy
    ? `<@${updatedBy.id}>`
    : "Unknown";

  const date = new Intl.DateTimeFormat(
    "en-GB"
  ).format(new Date());

  return new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${title}\n\n${description}`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${details}\n\n` +
        `**UPDATED BY**\n${updatedByText}`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# HOLOFYRN ESPORTS • ROSTER MANAGEMENT • ${date}`
      )
    );
}

async function notifyPlayerAdded(
  client,
  discordId,
  teamName,
  updatedBy
) {
  const container = buildRosterCard({
    type: "added",
    description:
      `You have been added to **${teamName}**.`,
    details:
      `**TEAM**\n${teamName}`,
    updatedBy
  });

  return sendRosterNotification(
    client,
    discordId,
    container
  );
}

async function notifyPlayerRemoved(
  client,
  discordId,
  teamName,
  updatedBy
) {
  const container = buildRosterCard({
    type: "removed",
    description:
      `You have been removed from **${teamName}**.`,
    details:
      `**TEAM**\n${teamName}`,
    updatedBy
  });

  return sendRosterNotification(
    client,
    discordId,
    container
  );
}

async function notifyPlayerMoved(
  client,
  discordId,
  oldTeamName,
  newTeamName,
  updatedBy
) {
  const container = buildRosterCard({
    type: "moved",
    description:
      `You have been moved from **${oldTeamName}** to **${newTeamName}**.`,
    details:
      `**PREVIOUS TEAM**\n${oldTeamName}\n\n` +
      `**NEW TEAM**\n${newTeamName}`,
    updatedBy
  });

  return sendRosterNotification(
    client,
    discordId,
    container
  );
}

module.exports = {
  notifyPlayerAdded,
  notifyPlayerRemoved,
  notifyPlayerMoved
};