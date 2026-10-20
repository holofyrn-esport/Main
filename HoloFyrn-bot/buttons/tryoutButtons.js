const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    MessageFlags
} = require("discord.js");

const {
    getAvailableTryoutTeams
} = require("../utils/tryoutTeams");

async function handleTryoutButton(interaction) {
    if (!interaction.isButton()) {
        return false;
    }

    if (interaction.customId !== "tryout_apply") {
        return false;
    }

    const freeAgentRoleId =
        process.env.FA_ROLE_ID;

    if (!freeAgentRoleId) {
        await interaction.reply({
            content:
                "❌ The Free Agent role has not been configured. Please contact a staff member.",
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    if (
        !interaction.member.roles.cache.has(
            freeAgentRoleId
        )
    ) {
        await interaction.reply({
            content:
                "❌ You need the **Free Agent** role before submitting a tryout application.",
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    const availableTeams =
        getAvailableTryoutTeams();

    if (availableTeams.length === 0) {
        await interaction.reply({
            content:
                "❌ No eligible tryout teams could be found in the roster database. Please contact staff.",
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    const teamSelect =
        new StringSelectMenuBuilder()
            .setCustomId("tryout_team_select")
            .setPlaceholder(
                "Choose the team you want to apply for"
            )
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                await Promise.all(
                    availableTeams.map(async team => {
                        const option = {
                            label: team.label,
                            description: team.description,
                            value: team.id
                        };

                        if (
                            team.logoEmojiId &&
                            interaction.guild
                        ) {
                            try {
                                const emoji =
                                    interaction.guild.emojis.cache.get(
                                        team.logoEmojiId
                                    ) ||
                                    await interaction.guild.emojis.fetch(
                                        team.logoEmojiId
                                    );

                                if (emoji) {
                                    option.emoji = {
                                        id: emoji.id,
                                        name: emoji.name,
                                        animated: Boolean(
                                            emoji.animated
                                        )
                                    };
                                }
                            } catch {
                                console.log(
                                    `Skipping unavailable tryout emoji ${team.logoEmojiId} for ${team.label}.`
                                );
                            }
                        }

                        return option;
                    })
                )
            );

    const row =
        new ActionRowBuilder().addComponents(
            teamSelect
        );

    await interaction.reply({
        content:
            "## HoloFyrn Tryout Application\nSelect the roster you would like to apply for:",
        components: [row],
        flags: MessageFlags.Ephemeral
    });

    return true;
}

module.exports = {
    handleTryoutButton
};