const {
  MessageFlags,
  PermissionFlagsBits
} = require("discord.js");

const ROLE_CONFIG = {
  self_role_tournament: {
    envName: "TOURNAMENT_ROLE_ID",
    displayName: "Tournament",
    addedMessage:
      "✅ The **Tournament** role has been added. You will now be notified about new tournaments.",
    removedMessage:
      "✅ The **Tournament** role has been removed. You will no longer receive tournament notifications."
  },

  self_role_free_agent: {
    envName: "FA_ROLE_ID",
    displayName: "FA | Free Agent",
    addedMessage:
      "✅ The **FA | Free Agent** role has been added.\n\nHead over to **#fa-tryout-registration** to submit your tryout application.",
    removedMessage:
      "✅ The **FA | Free Agent** role has been removed."
  },

  self_role_announcements: {
    envName: "ANNOUNCEMENT_ROLE_ID",
    displayName: "Announcements",
    addedMessage:
      "✅ The **Announcements** role has been added. You will now receive important HoloFyrn announcements.",
    removedMessage:
      "✅ The **Announcements** role has been removed."
  },

  self_role_giveaway: {
    envName: "GIVEAWAY_ROLE_ID",
    displayName: "Giveaway",
    addedMessage:
      "✅ The **Giveaway** role has been added. You will now be notified about HoloFyrn giveaways.",
    removedMessage:
      "✅ The **Giveaway** role has been removed."
  }
};

async function handleSelfRoleButton(interaction) {
  if (!interaction.isButton()) return false;

  const config = ROLE_CONFIG[interaction.customId];
  if (!config) return false;

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.editReply(
      "❌ This button can only be used inside the server."
    );
    return true;
  }

  const roleId =
    config.roleId ||
    (config.envName ? process.env[config.envName] : null);

  if (!roleId) {
    await interaction.editReply(
      `❌ The **${config.displayName}** role has not been configured.`
    );
    return true;
  }

  const botMember = interaction.guild.members.me;

  if (
    !botMember ||
    !botMember.permissions.has(PermissionFlagsBits.ManageRoles)
  ) {
    await interaction.editReply(
      "❌ I need the **Manage Roles** permission before I can give self-roles."
    );
    return true;
  }

  let role;
  try {
    role =
      interaction.guild.roles.cache.get(roleId) ||
      await interaction.guild.roles.fetch(roleId);
  } catch (error) {
    console.error(`Could not fetch ${config.displayName} role:`, error);
  }

  if (!role) {
    await interaction.editReply(
      `❌ I could not find the configured **${config.displayName}** role.`
    );
    return true;
  }

  if (!role.editable) {
    await interaction.editReply(
      `❌ I cannot manage the **${role.name}** role. Move my bot role above it in the server role list.`
    );
    return true;
  }

  let member;
  try {
    member = await interaction.guild.members.fetch(interaction.user.id);
  } catch (error) {
    console.error("Could not fetch self-role member:", error);
    await interaction.editReply(
      "❌ I could not access your server member information."
    );
    return true;
  }

  const alreadyHasRole = member.roles.cache.has(role.id);

  try {
    if (alreadyHasRole) {
      await member.roles.remove(
        role,
        `Self-role removed by ${interaction.user.tag}`
      );
      await interaction.editReply(config.removedMessage);
    } else {
      await member.roles.add(
        role,
        `Self-role requested by ${interaction.user.tag}`
      );
      await interaction.editReply(config.addedMessage);
    }
  } catch (error) {
    console.error(`Failed to toggle ${config.displayName} role:`, error);

    const ownerMessage =
      member.id === interaction.guild.ownerId
        ? " Discord does not allow the bot to manage the server owner's roles."
        : "";

    await interaction.editReply(
      `❌ I could not update the **${role.name}** role.${ownerMessage} Make sure my bot role is above this role and has **Manage Roles**.`
    );
  }

  return true;
}

module.exports = {
  handleSelfRoleButton
};
