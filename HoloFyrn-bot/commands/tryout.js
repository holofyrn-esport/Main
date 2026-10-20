const BRAND = require("../config/brand");
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const {
    loadTryouts,
    saveTryouts
} = require("../utils/tryoutData");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tryout")
        .setDescription("Manage the HoloFyrn tryout panel.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("setup")
                .setDescription(
                    "Create or refresh the tryout application panel."
                )
        ),

    async execute(interaction) {
        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand !== "setup") {
            return;
        }

        const tryoutData = loadTryouts();

        const embed = new EmbedBuilder()
            .setColor(BRAND.color)
            .setTitle("🎮 HoloFyrn Esports Tryouts")
            .setDescription(
                [
                    "Interested in joining **HoloFyrn Esports**?",
                    "",
                    "Click the button below to submit a tryout application.",
                    "",
                    "After choosing a team, you will fill out a short application.",
                    "",
                    "Applications are reviewed by our staff and captains.",
                    "",
                    "**Good luck!**"
                ].join("\n")
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("tryout_apply")
                    .setLabel("Apply")
                    .setEmoji("📝")
                    .setStyle(ButtonStyle.Primary)
            );

        if (
            tryoutData.panelChannelId &&
            tryoutData.panelMessageId
        ) {
            try {
                const existingChannel =
                    await interaction.client.channels.fetch(
                        tryoutData.panelChannelId
                    );

                const existingMessage =
                    await existingChannel.messages.fetch(
                        tryoutData.panelMessageId
                    );

                await existingMessage.edit({
                    embeds: [embed],
                    components: [row]
                });

                return interaction.reply({
                    content: "✅ Tryout panel updated.",
                    ephemeral: true
                });
            } catch (error) {
                console.log(
                    "Could not update the existing tryout panel. Creating a new one.",
                    error.message
                );
            }
        }

        const message =
            await interaction.channel.send({
                embeds: [embed],
                components: [row]
            });

        tryoutData.panelMessageId = message.id;
        tryoutData.panelChannelId =
            interaction.channel.id;

        saveTryouts(tryoutData);

        return interaction.reply({
            content: "✅ Tryout panel created.",
            ephemeral: true
        });
    }
};