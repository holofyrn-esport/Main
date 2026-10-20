const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require("discord.js");

const {
  loadTournaments,
  saveTournaments,
  generateTournamentId,
  removeOldTournaments
} = require("../utils/tournamentData");

const {
  buildTournamentEmbed,
  buildTournamentButtons
} = require("../embeds/tournamentEmbed");

const { buildLftEmbed } = require("../embeds/lftEmbed");

const {
  createTournamentTimestamp
} = require("../utils/tournamentTime");

const {
  createTournamentCopy,
  validateTournamentCopy
} = require("../utils/tournamentCopy");

const { copyOriginalTournamentImage } = require("../utils/tournamentImage");

async function refreshLftMessage(client, data) {
  if (!process.env.LFT_CHANNEL_ID) return;

  const channel = await client.channels.fetch(process.env.LFT_CHANNEL_ID);
  if (!channel) return;

  if (data.lftMessageId) {
    try {
      const message = await channel.messages.fetch(data.lftMessageId);
      await message.edit({
        embeds: [buildLftEmbed(data)]
      });
      return;
    } catch (error) {
      console.log("Could not update existing LFT message:", error.message);
    }
  }

  const message = await channel.send({
    embeds: [buildLftEmbed(data)]
  });

  data.lftMessageId = message.id;
  data.lftChannelId = channel.id;
  saveTournaments(data);
}

async function updateTournamentMessage(client, event, newPicture = null) {
  if (!event.channelId || !event.messageId) {
    throw new Error("The tournament has no saved announcement message.");
  }

  const channel = await client.channels.fetch(event.channelId);
  const message = await channel.messages.fetch(event.messageId);
  const embed = buildTournamentEmbed(event);

  if (newPicture) {
    // Re-upload the replacement image to the tournament announcement itself.
    // Clearing attachments removes the old image so it cannot appear above the embed.
    embed.setImage(`attachment://${newPicture.name}`);

    const editedMessage = await message.edit({
      embeds: [embed],
      components: [buildTournamentButtons(event)],
      attachments: [],
      files: [newPicture]
    });

    const uploadedPicture = editedMessage.attachments.first();
    if (uploadedPicture) {
      event.imageUrl = uploadedPicture.url;
    }

    return;
  }

  await message.edit({
    embeds: [embed],
    components: [buildTournamentButtons(event)]
  });
}

// Use the exact same posting path for new announcements and copied ones:
// identical role ping, embed, button and permanent attachment URL handling.
async function sendTournamentAnnouncement(interaction, event, picture) {
  const tournamentRoleId = process.env.TOURNAMENT_ROLE_ID;
  const embed = buildTournamentEmbed(event);

  if (picture) {
    embed.setImage(`attachment://${picture.name}`);
  }

  const message = await interaction.channel.send({
    content: tournamentRoleId ? `<@&${tournamentRoleId}>` : undefined,
    allowedMentions: tournamentRoleId
      ? { roles: [tournamentRoleId] }
      : { parse: [] },
    embeds: [embed],
    components: [buildTournamentButtons(event)],
    files: picture ? [picture] : []
  });

  if (picture) {
    const uploadedPicture = message.attachments.first();
    if (uploadedPicture) event.imageUrl = uploadedPicture.url;
  }

  event.messageId = message.id;
  return message;
}

function optionalEditValue(value, currentValue) {
  if (value === null) return currentValue;

  if (value.trim().toLowerCase() === "clear") {
    return "";
  }

  return value;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tournament")
    .setDescription("Manage tournament announcements.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(sub =>
      sub
        .setName("post")
        .setDescription("Post a tournament announcement.")

        .addStringOption(option =>
          option
            .setName("name")
            .setDescription("Tournament name")
            .setRequired(true)
        )

        .addStringOption(option =>
          option
            .setName("date")
            .setDescription("Date in YYYY-MM-DD format")
            .setRequired(true)
        )

        .addStringOption(option =>
          option
            .setName("time")
            .setDescription("Time, for example 18:30 or TBD")
            .setRequired(true)
        )
.addStringOption(option =>
  option
    .setName("timezone")
    .setDescription("Timezone, for example CEST, UTC+2 or EST")
    .setRequired(true)
)

        .addStringOption(option =>
          option
            .setName("format")
            .setDescription("Tournament format")
            .setRequired(true)
            .addChoices(
              { name: "3v3", value: "3v3" },
              { name: "2v2", value: "2v2" },
              { name: "1v1", value: "1v1" },
              { name: "Extra Modes", value: "Extra Modes" },
              { name: "Draft", value: "Draft" }
            )
        )

        .addStringOption(option =>
          option
            .setName("registration")
            .setDescription("Registration website or Discord link")
            .setRequired(true)
        )

        .addStringOption(option =>
          option
            .setName("region")
            .setDescription("Region, for example EU, NA or Worldwide")
            .setRequired(false)
        )

        .addStringOption(option =>
          option
            .setName("rank")
            .setDescription("Rank requirement, optional")
            .setRequired(false)
        )

        .addStringOption(option =>
          option
            .setName("prize")
            .setDescription("Prize, optional")
            .setRequired(false)
        )

        .addStringOption(option =>
          option
            .setName("notes")
            .setDescription("Additional notes, optional")
            .setRequired(false)
        )
.addAttachmentOption(option =>
  option
    .setName("picture")
    .setDescription("Optional tournament picture or banner")
    .setRequired(false)
)
    )

    .addSubcommand(sub =>
      sub
        .setName("copy")
        .setDescription("Copy a tournament, change any details, and post a new announcement.")
        .addStringOption(option => option
          .setName("event")
          .setDescription("Existing tournament to copy")
          .setRequired(true)
          .setAutocomplete(true))
        .addStringOption(option => option
          .setName("date")
          .setDescription("New date (YYYY-MM-DD), or leave unchanged"))
        .addStringOption(option => option
          .setName("name")
          .setDescription("New tournament name, or leave unchanged"))
        .addStringOption(option => option
          .setName("time")
          .setDescription("New time (HH:MM or TBD), or leave unchanged"))
        .addStringOption(option => option
          .setName("timezone")
          .setDescription("New timezone (CEST, CET, UTC+2, etc.)"))
        .addStringOption(option => option
          .setName("format")
          .setDescription("New tournament format")
          .addChoices(
            { name: "3v3", value: "3v3" },
            { name: "2v2", value: "2v2" },
            { name: "1v1", value: "1v1" },
            { name: "Extra Modes", value: "Extra Modes" },
            { name: "Draft", value: "Draft" }
          ))
        .addStringOption(option => option
          .setName("registration")
          .setDescription("New registration link"))
        .addStringOption(option => option
          .setName("region")
          .setDescription('New region, or "clear" to remove it'))
        .addStringOption(option => option
          .setName("rank")
          .setDescription('New rank requirement, or "clear" to remove it'))
        .addStringOption(option => option
          .setName("prize")
          .setDescription('New prize pool, or "clear" to remove it'))
        .addStringOption(option => option
          .setName("notes")
          .setDescription('New notes, or "clear" to remove them'))
        .addAttachmentOption(option => option
          .setName("picture")
          .setDescription("Replace the original tournament banner"))
        .addBooleanOption(option => option
          .setName("remove_picture")
          .setDescription("Remove the inherited banner instead of copying it"))
    )

    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Edit an existing tournament.")

        .addStringOption(option =>
          option
            .setName("event")
            .setDescription("Choose the tournament to edit")
            .setRequired(true)
            .setAutocomplete(true)
        )
.addStringOption(option =>
  option
    .setName("timezone")
    .setDescription("New timezone")
    .setRequired(false)
)

.addAttachmentOption(option =>
  option
    .setName("picture")
    .setDescription("Upload a new tournament picture")
    .setRequired(false)
)
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription("New tournament name")
            .setRequired(false)
        )

        .addStringOption(option =>
          option
            .setName("date")
            .setDescription("New date in YYYY-MM-DD format")
            .setRequired(false)
        )

        .addStringOption(option =>
          option
            .setName("time")
            .setDescription("New time, for example 18:30 or TBD")
            .setRequired(false)
        )

        .addStringOption(option =>
          option
            .setName("format")
            .setDescription("New tournament format")
            .setRequired(false)
            .addChoices(
              { name: "3v3", value: "3v3" },
              { name: "2v2", value: "2v2" },
              { name: "1v1", value: "1v1" },
              { name: "Extra Modes", value: "Extra Modes" },
              { name: "Draft", value: "Draft" }
            )
        )

        .addStringOption(option =>
          option
            .setName("registration")
            .setDescription("New registration link")
            .setRequired(false)
        )

        .addStringOption(option =>
          option
            .setName("region")
            .setDescription('New region, or type "clear" to remove it')
            .setRequired(false)
        )

        .addStringOption(option =>
          option
            .setName("rank")
            .setDescription('New rank requirement, or type "clear"')
            .setRequired(false)
        )

        .addStringOption(option =>
          option
            .setName("prize")
            .setDescription('New prize, or type "clear"')
            .setRequired(false)
        )

        .addStringOption(option =>
          option
            .setName("notes")
            .setDescription('New notes, or type "clear"')
            .setRequired(false)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Delete a tournament.")

        .addStringOption(option =>
          option
            .setName("event")
            .setDescription("Choose the tournament to delete")
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focusedText = interaction.options.getFocused().toLowerCase();
    const subcommand = interaction.options.getSubcommand();
    const data = loadTournaments();

    // Show recent events first for copy/edit; Discord limits autocomplete
    // to 25 options. Search by name, date or tournament ID.
    const eventPool = subcommand === "edit"
      ? data.events.slice(-15).reverse()
      : subcommand === "copy"
        ? [...data.events].reverse()
        : data.events;

    const choices = eventPool
      .filter(event => {
        return (
          event.name.toLowerCase().includes(focusedText) ||
          event.date.includes(focusedText) ||
          event.id.toLowerCase().includes(focusedText)
        );
      })
      .slice(0, subcommand === "edit" ? 15 : 25)
      .map(event => ({
        name: `${event.name} • ${event.date} ${event.time || "TBD"} • ${event.id}`.slice(0, 100),
        value: event.id
      }));

    await interaction.respond(choices);
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "post") {
      // Acknowledge the slash command immediately so Discord does not time out
      // while the tournament message, attachment, backup, and LFT embed are processed.
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      let data = loadTournaments();
      data = removeOldTournaments(data);

      const picture = interaction.options.getAttachment("picture");

      const event = {
        id: generateTournamentId(data),
        name: interaction.options.getString("name"),
        date: interaction.options.getString("date"),
        time: interaction.options.getString("time"),
        timezone: interaction.options.getString("timezone"),
        format: interaction.options.getString("format"),
        registration: interaction.options.getString("registration"),
        region: interaction.options.getString("region") || "",
        rank: interaction.options.getString("rank") || "",
        prize: interaction.options.getString("prize") || "",
        notes: interaction.options.getString("notes") || "",
        imageUrl: "",
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        messageId: null,
        lookingForTeam: []
      };

      event.timestamp =
        createTournamentTimestamp(
          event.date,
          event.time,
          event.timezone
        );

      await sendTournamentAnnouncement(interaction, event, picture);
      data.events.push(event);

      saveTournaments(data);
      await refreshLftMessage(interaction.client, data);

      return interaction.editReply({
        content: `✅ Tournament posted. ID: **${event.id}**`
      });
    }

    if (subcommand === "copy") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const data = loadTournaments();
      const originalId = interaction.options.getString("event");
      const original = data.events.find(item => item.id === originalId);

      if (!original) {
        return interaction.editReply("❌ Tournament not found. Select an existing tournament.");
      }

      const picture = interaction.options.getAttachment("picture");
      const removePicture = interaction.options.getBoolean("remove_picture") === true;

      if (picture && removePicture) {
        return interaction.editReply(
          "❌ Choose either `picture` to replace the banner or `remove_picture:true` to remove it."
        );
      }

      const overrides = {};
      for (const field of [
        "name", "date", "time", "timezone", "format", "registration",
        "region", "rank", "prize", "notes"
      ]) {
        overrides[field] = interaction.options.getString(field);
      }
      overrides.picture = picture;
      overrides.remove_picture = removePicture;

      const event = createTournamentCopy(
        original,
        overrides,
        generateTournamentId(data),
        interaction.guild.id,
        interaction.channel.id
      );

      const validationError = validateTournamentCopy(event);
      if (validationError) {
        return interaction.editReply(`❌ ${validationError}`);
      }

      let banner = picture;
      if (!picture && !removePicture && original.imageUrl) {
        try {
          banner = await copyOriginalTournamentImage(interaction.client, original);
        } catch (error) {
          return interaction.editReply(`❌ ${error.message}`);
        }
      }

      try {
        await sendTournamentAnnouncement(interaction, event, banner);
      } catch (error) {
        console.error("Could not post copied tournament:", error);
        return interaction.editReply(
          "❌ Could not post the copied tournament. Check my channel and attachment permissions."
        );
      }

      data.events.push(event);
      saveTournaments(data, `copy-${original.id}-to-${event.id}`);

      try {
        await refreshLftMessage(interaction.client, data);
      } catch (error) {
        console.warn("Copied tournament posted, but LFT refresh failed:", error);
        return interaction.editReply(
          `✅ Copied **${original.name}** to **${event.name}** (ID: **${event.id}**). ` +
          "⚠️ The LFT overview could not be refreshed."
        );
      }

      return interaction.editReply(
        `✅ Copied **${original.name}** to **${event.name}**. ` +
        `New ID: **${event.id}**. The original tournament is unchanged.`
      );
    }

    if (subcommand === "edit") {
      const eventId = interaction.options.getString("event");
      const data = loadTournaments();

      const event = data.events.find(item => item.id === eventId);

      if (!event) {
        return interaction.reply({
          content: "❌ Tournament not found.",
          ephemeral: true
        });
      }

     const name = interaction.options.getString("name");
const date = interaction.options.getString("date");
const time = interaction.options.getString("time");
const timezone = interaction.options.getString("timezone");
const picture = interaction.options.getAttachment("picture");
const format = interaction.options.getString("format");
      const registration = interaction.options.getString("registration");
      const region = interaction.options.getString("region");
      const rank = interaction.options.getString("rank");
      const prize = interaction.options.getString("prize");
      const notes = interaction.options.getString("notes");

     const hasChanges = [
  name,
  date,
  time,
  timezone,
  picture,
  format,
  registration,
  region,
  rank,
  prize,
  notes
].some(value => value !== null);

      if (!hasChanges) {
        return interaction.reply({
          content: "❌ You must provide at least one field to edit.",
          ephemeral: true
        });
      }

      if (name !== null) event.name = name;
      if (date !== null) event.date = date;
      if (time !== null) event.time = time;
      if (timezone !== null) event.timezone = timezone;

      if (
        date !== null ||
        time !== null ||
        timezone !== null
      ) {
        event.timestamp =
          createTournamentTimestamp(
            event.date,
            event.time,
            event.timezone
          );
      }

      if (format !== null) event.format = format;
      if (registration !== null) event.registration = registration;

      event.region = optionalEditValue(region, event.region || "");
      event.rank = optionalEditValue(rank, event.rank || "");
      event.prize = optionalEditValue(prize, event.prize || "");
      event.notes = optionalEditValue(notes, event.notes || "");

      saveTournaments(data);

      try {
        await updateTournamentMessage(interaction.client, event, picture);
        // Save again because replacing the image updates event.imageUrl to the
        // URL of the new attachment on the announcement message.
        if (picture) saveTournaments(data);
      } catch (error) {
        console.log("Could not update tournament announcement:", error.message);

        return interaction.reply({
          content:
            "⚠️ The data was saved, but the original tournament message could not be updated. It may have been deleted.",
          ephemeral: true
        });
      }

      await refreshLftMessage(interaction.client, data);

      return interaction.reply({
        content: `✅ Updated **${event.name}**.`,
        ephemeral: true
      });
    }

    if (subcommand === "delete") {
      const eventId = interaction.options.getString("event");
      const data = loadTournaments();

      const eventIndex = data.events.findIndex(
        event => event.id === eventId
      );

      if (eventIndex === -1) {
        return interaction.reply({
          content: "❌ Tournament not found.",
          ephemeral: true
        });
      }

      const event = data.events[eventIndex];

      try {
        const channel = await interaction.client.channels.fetch(
          event.channelId
        );

        const message = await channel.messages.fetch(event.messageId);
        await message.delete();
      } catch (error) {
        console.log(
          "Could not delete tournament announcement:",
          error.message
        );
      }

      data.events.splice(eventIndex, 1);
      saveTournaments(data);

      await refreshLftMessage(interaction.client, data);

      return interaction.reply({
        content: `✅ Deleted **${event.name}**.`,
        ephemeral: true
      });
    }
  }
};