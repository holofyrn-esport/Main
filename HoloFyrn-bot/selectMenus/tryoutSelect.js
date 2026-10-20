const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags
} = require("discord.js");

const {
    getAvailableTryoutTeams,
    getTryoutTeam
} = require("../utils/tryoutTeams");

const {
    loadTryouts,
    findPendingApplication
} = require("../utils/tryoutData");

async function handleTryoutSelect(interaction) {
    if (!interaction.isStringSelectMenu()) {
        return false;
    }

    if (
        interaction.customId !==
        "tryout_team_select"
    ) {
        return false;
    }

    const teamId = interaction.values[0];
    const team = getTryoutTeam(teamId);

    const availableTeams =
        getAvailableTryoutTeams();

    const teamIsAvailable =
        availableTeams.some(
            availableTeam =>
                availableTeam.id === teamId
        );

    if (!team || !teamIsAvailable) {
        await interaction.reply({
            content:
                "❌ This team is no longer available for tryout applications.",
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    const tryoutData = loadTryouts();

    const existingApplication =
        findPendingApplication(
            tryoutData,
            interaction.user.id,
            teamId
        );

    if (existingApplication) {
        await interaction.reply({
            content:
                `❌ You already have a pending application for **${team.label}**.`,
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId(
            `tryout_application:${teamId}`
        )
        .setTitle("HoloFyrn Tryout Application");

    const playerName =
        new TextInputBuilder()
            .setCustomId("player_name")
            .setLabel("Player name")
            .setPlaceholder(
                "Your Rocket League player name"
            )
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(32);

    const age =
        new TextInputBuilder()
            .setCustomId("age")
            .setLabel("Age")
            .setPlaceholder("Example: 17")
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(3);

    const tracker =
        new TextInputBuilder()
            .setCustomId("tracker")
            .setLabel("Rocket League Tracker URL")
            .setPlaceholder(
                "https://rocketleague.tracker.network/..."
            )
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(400);

    const location =
        new TextInputBuilder()
            .setCustomId("location")
            .setLabel("Country of birth and residence")
            .setPlaceholder(
                "Born in Hungary, currently living in Austria"
            )
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(150);

    const availability =
        new TextInputBuilder()
            .setCustomId("availability")
            .setLabel("Availability")
            .setPlaceholder(
                "Weekdays after 18:00, weekends most of the day..."
            )
            .setRequired(true)
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            playerName
        ),
        new ActionRowBuilder().addComponents(
            age
        ),
        new ActionRowBuilder().addComponents(
            tracker
        ),
        new ActionRowBuilder().addComponents(
            location
        ),
        new ActionRowBuilder().addComponents(
            availability
        )
    );

    await interaction.showModal(modal);

    return true;
}

module.exports = {
    handleTryoutSelect
};