const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require("discord.js");

const {
  loadRosters,
  saveRosters,
  findTeam,
  findPlayer,
  refreshRosterMessage
} = require("../utils/rosterData");

const {
  buildRosterEmbed
} = require("../embeds/rosterEmbed");

const {
  notifyPlayerAdded,
  notifyPlayerRemoved,
  notifyPlayerMoved
} = require("../utils/rosterNotifications");

function getSortedTeams(data) {
  return [...(data.teams || [])].sort(
    (a, b) =>
      Number(a.displayOrder || 999) -
        Number(b.displayOrder || 999) ||
      a.name.localeCompare(b.name)
  );
}

function getAllPlayers(data) {
  const entries = [];

  for (const team of getSortedTeams(data)) {
    for (const player of team.players || []) {
      entries.push({
        team,
        player
      });
    }
  }

  return entries;
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildTeamAutocomplete(data, focusedValue) {
  const search = normalize(focusedValue);

  return getSortedTeams(data)
    .filter(team => {
      if (!search) return true;

      return (
        normalize(team.name).includes(search) ||
        normalize(team.shortName).includes(search) ||
        normalize(team.id).includes(search)
      );
    })
    .slice(0, 25)
    .map(team => ({
      name:
        `${team.displayOrder}. ${team.name}`.slice(0, 100),
      value: team.id
    }));
}

function buildPlayerAutocomplete(
  data,
  focusedValue,
  selectedTeamInput = null
) {
  const search = normalize(focusedValue);

  let entries = getAllPlayers(data);

  if (selectedTeamInput) {
    const selectedTeam = findTeam(
      data,
      selectedTeamInput
    );

    if (selectedTeam) {
      entries = entries.filter(
        entry =>
          entry.team.uuid ===
          selectedTeam.uuid
      );
    }
  }

  return entries
    .filter(({ player, team }) => {
      if (!search) return true;

      return (
        normalize(player.name).includes(search) ||
        normalize(team.name).includes(search)
      );
    })
    .slice(0, 25)
    .map(({ player, team }) => ({
      name:
        `${player.name} — ${team.shortName || team.name}`.slice(
          0,
          100
        ),
      value: player.uuid
    }));
}

async function refreshRoster(
  interaction,
  data
) {
  return refreshRosterMessage(
    interaction.client,
    data,
    buildRosterEmbed
  );
}

function ephemeral(content) {
  return {
    content,
    flags:
      MessageFlags.Ephemeral
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("player")
    .setDescription(
      "Manage HoloFyrn roster players."
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    )

    .addSubcommand(sub =>
      sub
        .setName("reposition")
        .setDescription(
          "Change a player's position inside a team."
        )
        .addStringOption(option =>
          option
            .setName("team")
            .setDescription("Team")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription("Player name")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption(option =>
          option
            .setName("position")
            .setDescription(
              "New position (1 = top)"
            )
            .setRequired(true)
            .setMinValue(1)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a player.")
        .addStringOption(option =>
          option
            .setName("team")
            .setDescription("Team")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription(
              "Discord user"
            )
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription(
              "Display/player name"
            )
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("country")
            .setDescription(
              "Flag emoji, example 🇭🇺"
            )
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("role")
            .setDescription("Role")
            .setRequired(true)
            .addChoices(
              {
                name: "Player",
                value: "Player"
              },
              {
                name: "Captain",
                value: "Captain"
              },
              {
                name: "Sub",
                value: "Sub"
              },
              {
                name: "Coach",
                value: "Coach"
              },
              {
                name: "Manager",
                value: "Manager"
              }
            )
        )
        .addStringOption(option =>
          option
            .setName("tracker")
            .setDescription(
              "Rocket League Tracker link"
            )
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName("liquipedia")
            .setDescription(
              "Liquipedia link, optional"
            )
            .setRequired(false)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription(
          "Remove a player."
        )
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription("Player name")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("move")
        .setDescription(
          "Move a player to another team."
        )
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription("Player name")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option
            .setName("team")
            .setDescription("New team")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription(
          "Edit a player."
        )
        .addStringOption(option =>
          option
            .setName("name")
            .setDescription(
              "Current player name"
            )
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription(
              "New Discord user"
            )
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName("newname")
            .setDescription(
              "New player name"
            )
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName("country")
            .setDescription(
              "New flag emoji"
            )
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName("tracker")
            .setDescription(
              "New tracker link"
            )
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName("liquipedia")
            .setDescription(
              "New Liquipedia link"
            )
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName("remove_tracker")
            .setDescription("Remove the current Tracker link")
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName("remove_liquipedia")
            .setDescription("Remove the current Liquipedia link")
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName("role")
            .setDescription("New role")
            .setRequired(false)
            .addChoices(
              {
                name: "Player",
                value: "Player"
              },
              {
                name: "Captain",
                value: "Captain"
              },
              {
                name: "Sub",
                value: "Sub"
              },
              {
                name: "Coach",
                value: "Coach"
              },
              {
                name: "Manager",
                value: "Manager"
              }
            )
        )
    ),

  async autocomplete(interaction) {
    const data = loadRosters();

    const focused =
      interaction.options.getFocused(true);

    const subcommand =
      interaction.options.getSubcommand();

    let choices = [];

    if (focused.name === "team") {
      choices = buildTeamAutocomplete(
        data,
        focused.value
      );
    }

    if (focused.name === "name") {
      const selectedTeam =
        subcommand === "reposition"
          ? interaction.options.getString(
              "team"
            )
          : null;

      choices = buildPlayerAutocomplete(
        data,
        focused.value,
        selectedTeam
      );
    }

    try {
      await interaction.respond(choices);
    } catch (error) {
      console.error(
        "Player autocomplete failed:",
        error
      );
    }
  },

  async execute(interaction) {
    const subcommand =
      interaction.options.getSubcommand();

    const data = loadRosters();

    if (subcommand === "add") {
      const team = findTeam(
        data,
        interaction.options.getString(
          "team"
        )
      );

      const user =
        interaction.options.getUser(
          "user"
        );

      const name =
        interaction.options
          .getString("name")
          .trim();

      if (!team) {
        return interaction.reply(
          ephemeral(
            "❌ Team not found. Select a team from the autocomplete list."
          )
        );
      }

      const alreadyInThisTeam =
        team.players.find(
          player =>
            normalize(player.name) ===
            normalize(name)
        );

      if (alreadyInThisTeam) {
        return interaction.reply(
          ephemeral(
            "❌ This player already exists in this team."
          )
        );
      }

      team.players.push({
        uuid: require("crypto").randomUUID(),
        name,
        discordId: user.id,
        country:
          interaction.options.getString(
            "country"
          ),
        role:
          interaction.options.getString(
            "role"
          ),
        tracker:
          interaction.options.getString(
            "tracker"
          ),
        liquipedia:
          interaction.options.getString(
            "liquipedia"
          ) || ""
      });

      const saved =
        saveRosters(data);

      const result =
        await refreshRoster(
          interaction,
          saved
        );

      await notifyPlayerAdded(
        interaction.client,
        user.id,
        team.name,
        interaction.user
      );

      const warning =
        result.updated
          ? ""
          : "\n⚠️ Player saved, but the roster embed could not be refreshed automatically.";

      return interaction.reply(
        ephemeral(
          `✅ Added **${name}** to **${team.name}**.${warning}`
        )
      );
    }

    if (subcommand === "remove") {
      const name =
        interaction.options.getString(
          "name"
        );

      const result =
        findPlayer(data, name);

      if (!result) {
        return interaction.reply(
          ephemeral(
            "❌ Player not found."
          )
        );
      }

      result.team.players =
        result.team.players.filter(
          player => player.uuid !== result.player.uuid
        );

      const saved =
        saveRosters(data);

      const refresh =
        await refreshRoster(
          interaction,
          saved
        );
      
      await notifyPlayerRemoved(
        interaction.client,
        result.player.discordId,
        result.team.name,
        interaction.user
      );

      const warning =
        refresh.updated
          ? ""
          : "\n⚠️ Player removed, but the roster embed could not be refreshed automatically.";

      return interaction.reply(
        ephemeral(
          `✅ Removed **${result.player.name}** from **${result.team.name}**.${warning}`
        )
      );
    }

    if (subcommand === "move") {
      const name =
        interaction.options.getString(
          "name"
        );

      const result =
        findPlayer(data, name);

      const newTeam =
        findTeam(
          data,
          interaction.options.getString(
            "team"
          )
        );

      if (!result) {
        return interaction.reply(
          ephemeral(
            "❌ Player not found."
          )
        );
      }

      if (!newTeam) {
        return interaction.reply(
          ephemeral(
            "❌ New team not found. Select a team from the autocomplete list."
          )
        );
      }

      if (
        (result.team.uuid && newTeam.uuid &&
          result.team.uuid === newTeam.uuid) ||
        result.team.id === newTeam.id
      ) {
        return interaction.reply(
          ephemeral(
            `❌ **${result.player.name}** is already in **${newTeam.name}**.`
          )
        );
      }

      const duplicate =
        newTeam.players.some(
          player =>
            normalize(player.name) ===
            normalize(result.player.name)
        );

      if (duplicate) {
        return interaction.reply(
          ephemeral(
            `❌ **${newTeam.name}** already contains a player named **${result.player.name}**.`
          )
        );
      }

      await interaction.deferReply({
        flags: MessageFlags.Ephemeral
      });

      result.team.players =
        result.team.players.filter(
          player => player.uuid !== result.player.uuid
        );

      newTeam.players.push(
        result.player
      );

      const oldTeamName =
        result.team.name;

      const saved =
        saveRosters(data);

      const refresh =
        await refreshRoster(
          interaction,
          saved
        );

      await notifyPlayerMoved(
        interaction.client,
        result.player.discordId,
        result.team.name,
        newTeam.name,
        interaction.user
      );

      const warning =
        refresh.updated
          ? ""
          : "\n⚠️ Player moved, but the roster embed could not be refreshed automatically.";

      return interaction.editReply(
        `✅ Moved **${result.player.name}** from **${oldTeamName}** to **${newTeam.name}**.${warning}`
      );
    }

    if (
      subcommand === "reposition"
    ) {
      const team =
        findTeam(
          data,
          interaction.options.getString(
            "team"
          )
        );

      const name =
        interaction.options.getString(
          "name"
        );

      const position =
        interaction.options.getInteger(
          "position"
        );

      if (!team) {
        return interaction.reply(
          ephemeral(
            "❌ Team not found. Select a team from the autocomplete list."
          )
        );
      }

      const currentIndex =
        team.players.findIndex(
          player =>
            player.uuid === name ||
            normalize(player.name) === normalize(name)
        );

      if (currentIndex === -1) {
        return interaction.reply(
          ephemeral(
            "❌ Player not found in this team."
          )
        );
      }

      const [player] =
        team.players.splice(
          currentIndex,
          1
        );

      const newIndex = Math.max(
        0,
        Math.min(
          position - 1,
          team.players.length
        )
      );

      team.players.splice(
        newIndex,
        0,
        player
      );

      const saved =
        saveRosters(data);

      const refresh =
        await refreshRoster(
          interaction,
          saved
        );

      const actualPosition =
        newIndex + 1;

      const warning =
        refresh.updated
          ? ""
          : "\n⚠️ Player repositioned, but the roster embed could not be refreshed automatically.";

      return interaction.reply(
        ephemeral(
          `✅ **${player.name}** moved to position **${actualPosition}** in **${team.name}**.${warning}`
        )
      );
    }

    if (subcommand === "edit") {
      const name =
        interaction.options.getString(
          "name"
        );

      const result =
        findPlayer(data, name);

      if (!result) {
        return interaction.reply(
          ephemeral(
            "❌ Player not found."
          )
        );
      }

      const user =
        interaction.options.getUser(
          "user"
        );

      const newName =
        interaction.options.getString(
          "newname"
        );

      const country =
        interaction.options.getString(
          "country"
        );

      const tracker =
        interaction.options.getString(
          "tracker"
        );

      const liquipedia =
        interaction.options.getString(
          "liquipedia"
        );

      const role =
        interaction.options.getString(
          "role"
        );

      const removeTracker =
        interaction.options.getBoolean("remove_tracker") === true;

      const removeLiquipedia =
        interaction.options.getBoolean("remove_liquipedia") === true;

      if (newName) {
        const duplicate =
          result.team.players.some(
            player =>
              player !== result.player &&
              normalize(player.name) ===
                normalize(newName)
          );

        if (duplicate) {
          return interaction.reply(
            ephemeral(
              `❌ **${result.team.name}** already contains a player named **${newName}**.`
            )
          );
        }
      }

      if (user) {
        result.player.discordId =
          user.id;
      }

      if (newName) {
        result.player.name =
          newName.trim();
      }

      if (country) {
        result.player.country =
          country;
      }

      if (removeTracker) {
        result.player.tracker = null;
      } else if (tracker !== null) {
        result.player.tracker = tracker.trim() || null;
      }

      if (removeLiquipedia) {
        result.player.liquipedia = "";
      } else if (liquipedia !== null) {
        result.player.liquipedia = liquipedia.trim();
      }

      if (role) {
        result.player.role =
          role;
      }

      const saved =
        saveRosters(data);

      const refresh =
        await refreshRoster(
          interaction,
          saved
        );

      const warning =
        refresh.updated
          ? ""
          : "\n⚠️ Player updated, but the roster embed could not be refreshed automatically.";

      return interaction.reply(
        ephemeral(
          `✅ Updated **${result.player.name}** in **${result.team.name}**.${warning}`
        )
      );
    }
  }
};
