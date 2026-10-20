const BRAND = require("../config/brand");
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const { loadTickets, saveTickets } = require("../utils/ticketData");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage HoloFyrn verification tickets.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Create the rank verification ticket panel.")
    )

    .addSubcommand(sub =>
      sub
        .setName("close")
        .setDescription("Close the current verification ticket.")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      const embed = new EmbedBuilder()
        .setTitle("🎫 HoloFyrn Rank Verification")
        .setColor(BRAND.color)
        .setDescription(
          "Need your Rocket League rank verified?\n\nClick the button below to open a private verification ticket."
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_open_verification")
          .setLabel("Open Verification Ticket")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🎫")
      );

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content: "✅ Ticket panel created.",
        ephemeral: true
      });
    }

    if (subcommand === "close") {
      const data = loadTickets();

      const ticket = data.tickets.find(
        t => t.channelId === interaction.channel.id && t.status === "open"
      );

      if (!ticket) {
        return interaction.reply({
          content: "❌ This channel is not an open ticket.",
          ephemeral: true
        });
      }

      ticket.status = "closed";
      saveTickets(data);

      await interaction.reply({
        content: "✅ Ticket closed. This channel will be deleted in 5 seconds.",
        ephemeral: true
      });

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch {
          console.log("Could not delete ticket channel.");
        }
      }, 5000);
    }
  }
};