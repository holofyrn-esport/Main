const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const {
  loadTournaments,
  saveTournaments
} = require("../utils/tournamentData");

const {
  buildCaptainDashboardEmbed
} = require("../embeds/captainDashboardEmbed");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("captain-dashboard")
    .setDescription("Manage the captain tournament dashboard.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Create the captain tournament dashboard in this channel.")
    )
    .addSubcommand(sub =>
      sub
        .setName("refresh")
        .setDescription("Refresh the captain tournament dashboard.")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const data = loadTournaments();

    if (subcommand === "setup") {
      const dashboard = buildCaptainDashboardEmbed(data);

      const message = await interaction.channel.send({
        embeds: [dashboard.embed],
        components: dashboard.components
      });

      data.captainDashboardMessageId = message.id;
      data.captainDashboardChannelId = interaction.channel.id;

      saveTournaments(data);

      return interaction.reply({
        content: "✅ Captain tournament dashboard created.",
        ephemeral: true
      });
    }

    if (subcommand === "refresh") {
      if (
        !data.captainDashboardMessageId ||
        !data.captainDashboardChannelId
      ) {
        return interaction.reply({
          content:
            "❌ No captain dashboard has been set up yet. Use `/captain-dashboard setup` first.",
          ephemeral: true
        });
      }

      const channel = await interaction.client.channels.fetch(
        data.captainDashboardChannelId
      );

      const message = await channel.messages.fetch(
        data.captainDashboardMessageId
      );

      const dashboard = buildCaptainDashboardEmbed(data);

      await message.edit({
        embeds: [dashboard.embed],
        components: dashboard.components
      });

      return interaction.reply({
        content: "✅ Captain tournament dashboard refreshed.",
        ephemeral: true
      });
    }
  }
};