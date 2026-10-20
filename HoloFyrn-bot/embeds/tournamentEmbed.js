const BRAND = require("../config/brand");

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const {
  createTournamentTimestamp
} = require("../utils/tournamentTime");

function buildTournamentEmbed(event) {
  const timestamp =
    event.timestamp ||
    createTournamentTimestamp(
      event.date,
      event.time,
      event.timezone
    );

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${event.name}`)
    .setColor(BRAND.color)
    .addFields(
      {
        name: "📅 Date & Time",
        value: timestamp
          ? `**<t:${timestamp}:F>**`
          : `**${event.date} • ${event.time || "TBD"} ${event.timezone || ""}**`,
        inline: false
      },
      {
        name: "⏳ Starts",
        value: timestamp
          ? `**<t:${timestamp}:R>**`
          : "**TBD**",
        inline: true
      },
      {
        name: "🎮 Format",
        value: `**${event.format}**`,
        inline: false
      }
    );

  if (event.region) {
    embed.addFields({
      name: "🌍 Region",
      value: `**${event.region}**`,
      inline: false
    });
  }

  if (event.rank) {
    embed.addFields({
      name: "🏅 Rank",
      value: `**${event.rank}**`,
      inline: false
    });
  }

  if (event.prize) {
    embed.addFields({
      name: "💰 Prize",
      value: `**${event.prize}**`,
      inline: false
    });
  }

  embed.addFields({
    name: "🔗 Registration",
    value: `[**Register here**](${event.registration})`,
    inline: false
  });

  if (event.notes) {
    embed.addFields({
      name: "📝 Notes",
      value: event.notes,
      inline: false
    });
  }

  if (event.imageUrl) {
    embed.setImage(event.imageUrl);
  }

  embed
    .setFooter({
      text: `Tournament ID: ${event.id} • HoloFyrn Esports`
    })
    .setTimestamp();

  return embed;
}

function buildTournamentButtons(event) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tournament_lft_${event.id}`)
      .setLabel("Find me a teammate")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔎")
  );
}

module.exports = {
  buildTournamentEmbed,
  buildTournamentButtons
};