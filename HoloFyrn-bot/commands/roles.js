const BRAND = require("../config/brand");
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require("discord.js");

const ANNOUNCEMENT_ROLE_ID = process.env.ANNOUNCEMENT_ROLE_ID;

function panel(title, description, customId, label, emoji) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle(`${emoji} ${title}`)
    .setDescription(description);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setEmoji(emoji)
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function buildTournamentPanel() {
  return panel(
    "Tournament Notifications",
    "Receive a notification whenever a new Rocket League tournament is posted.\n\nUse the button below to add or remove the **Tournament** role.",
    "self_role_tournament",
    "Get / Remove Tournament Role",
    "🏆"
  );
}

function buildFreeAgentPanel() {
  return panel(
    "Free Agent",
    "Looking for a team or interested in joining a HoloFyrn roster?\n\nThe **FA | Free Agent** role lets you:\n• Register for HoloFyrn tryouts\n• Be visible to team captains\n• Show that you are currently looking for a team\n\nAfter receiving the role, head to **#fa-tryout-registration** and submit your application.\n\nUse the button below to add or remove the role.",
    "self_role_free_agent",
    "Get / Remove Free Agent Role",
    "🎮"
  );
}

function buildAnnouncementPanel() {
  return panel(
    "Announcements",
    "Stay updated with important HoloFyrn Esports announcements.\n\nUse the button below to add or remove the **Announcements** role.",
    "self_role_announcements",
    "Get / Remove Announcements Role",
    "📢"
  );
}

function buildGiveawayPanel() {
  return panel(
    "Giveaways",
    "Get notified when HoloFyrn Esports runs a new giveaway.\n\nUse the button below to add or remove the **Giveaway** role.",
    "self_role_giveaway",
    "Get / Remove Giveaway Role",
    "🎁"
  );
}

async function giveAnnouncementsToEveryone(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const role = await interaction.guild.roles.fetch(ANNOUNCEMENT_ROLE_ID);

  if (!role) {
    return interaction.editReply("❌ I could not find the Announcements role.");
  }

  if (!role.editable) {
    return interaction.editReply(
      "❌ I cannot manage the Announcements role. Move my bot role above it first."
    );
  }

  let members;
  try {
    members = await interaction.guild.members.fetch();
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return interaction.editReply(
      "❌ I could not fetch all server members. Enable **Server Members Intent** for the bot in the Discord Developer Portal."
    );
  }

  const targets = members.filter(
    member =>
      !member.user.bot &&
      !member.roles.cache.has(ANNOUNCEMENT_ROLE_ID)
  );

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const member of targets.values()) {
    if (member.id === interaction.guild.ownerId) {
      skipped++;
      continue;
    }

    try {
      await member.roles.add(
        ANNOUNCEMENT_ROLE_ID,
        `Announcements role mass assignment by ${interaction.user.tag}`
      );
      added++;
    } catch (error) {
      failed++;
      console.error(
        `Could not add Announcements role to ${member.user.tag}:`,
        error.message
      );
    }
  }

  return interaction.editReply(
    `✅ Announcements role assignment finished.\n\n` +
    `**Added:** ${added}\n` +
    `**Skipped:** ${skipped}\n` +
    `**Failed:** ${failed}`
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roles")
    .setDescription("Manage the server self-role panels")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("setup").setDescription("Post all self-role panels")
    )
    .addSubcommand(sub =>
      sub
        .setName("give-announcements")
        .setDescription("Give the Announcements role to all current non-bot members")
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used inside a server.",
        flags: MessageFlags.Ephemeral
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "give-announcements") {
      return giveAnnouncementsToEveryone(interaction);
    }

    if (!interaction.channel?.isTextBased()) {
      return interaction.reply({
        content: "❌ Please use this command in a text channel.",
        flags: MessageFlags.Ephemeral
      });
    }

    const missing = [];
    if (!process.env.TOURNAMENT_ROLE_ID) missing.push("TOURNAMENT_ROLE_ID");
    if (!process.env.FA_ROLE_ID) missing.push("FA_ROLE_ID");

    if (missing.length) {
      return interaction.reply({
        content:
          "❌ These Railway variables are missing:\n" +
          missing.map(name => `• \`${name}\``).join("\n"),
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await interaction.channel.send(buildTournamentPanel());
      await interaction.channel.send(buildFreeAgentPanel());
      await interaction.channel.send(buildAnnouncementPanel());
      await interaction.channel.send(buildGiveawayPanel());

      await interaction.editReply(
        `✅ Tournament, Free Agent, Announcements and Giveaway role panels were posted in <#${interaction.channel.id}>.`
      );
    } catch (error) {
      console.error("Role panel setup error:", error);
      await interaction.editReply(
        "❌ I could not post the role panels. Check the bot's channel permissions."
      );
    }
  }
};
