const BRAND = require("../config/brand");
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");

const {
  loadTickets,
  saveTickets,
  getNextTicketId
} = require("../utils/ticketData");

function cleanName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12) || "user";
}

async function handleTicketOpen(interaction) {
  const data = loadTickets();

  const existingTicket = data.tickets.find(
    ticket => ticket.userId === interaction.user.id && ticket.status === "open"
  );

  if (existingTicket) {
    return interaction.reply({
      content: `❌ You already have an open ticket: <#${existingTicket.channelId}>`,
      ephemeral: true
    });
  }

  const ticketId = getNextTicketId(data);
  const username = cleanName(interaction.user.username);
  const cleanId = ticketId.replace("V-", "");
  const channelName = `verify-${cleanId}-${username}`;

  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: process.env.TICKET_CATEGORY_ID || null,
    permissionOverwrites: [
      {
        id: interaction.guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels
        ]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      },
      {
        id: process.env.STAFF_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages
        ]
      }
    ]
  });

  data.tickets.push({
    id: ticketId,
    userId: interaction.user.id,
    channelId: channel.id,
    status: "open"
  });

  saveTickets(data);

  const embed = new EmbedBuilder()
    .setTitle("🎫 HoloFyrn Rank Verification")
    .setColor(BRAND.color)
    .setDescription(
      `Hello <@${interaction.user.id}> 👋\n\nPlease send your **RLTracker** to verify your rank.`
    )
    .setFooter({ text: `Ticket ID: ${ticketId}` })
    .setTimestamp();

  await channel.send({
    content: `<@${interaction.user.id}>`,
    embeds: [embed]
  });

  return interaction.reply({
    content: `✅ Verification ticket created: <#${channel.id}>`,
    ephemeral: true
  });
}

module.exports = { handleTicketOpen };