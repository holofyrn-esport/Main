const BRAND = require("../config/brand");
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');

const {
  loadRosters,
  saveRosters,
  findTeam,
  refreshRosterMessage
} = require('../utils/rosterData');

const { buildRosterEmbed, buildRosterMessages } = require('../embeds/rosterEmbed');
const { parseAverageMmr } = require('../utils/rosterMmr');

function buildManagementPanel(data) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.color)
    .setTitle('🛠️ Roster Team Management')
    .setDescription([
      'Create, edit, reorder, remove, and configure roster teams.',
      '',
      `**Teams:** ${data.teams.length}`,
      `**Players:** ${data.teams.reduce((sum, team) => sum + team.players.length, 0)}`,
      '',
      'Internal team IDs remain permanent after creation so other bot systems do not break.'
    ].join('\n'));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('roster_team_add')
      .setLabel('Add Team')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('roster_team_edit')
      .setLabel('Edit Team')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('roster_team_remove')
      .setLabel('Remove Team')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('roster_team_tryout_role')
      .setLabel('Tryout Role')
      .setEmoji('🎟️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('roster_team_captain_role')
      .setLabel('Captain Role')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Secondary)
  );

  const mmrRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('roster_team_mmr')
      .setLabel('Average MMR')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row, mmrRow] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Manage the HoloFyrn roster embed.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('setup').setDescription('Create a new official roster embed in this channel.'))
    .addSubcommand(sub => sub.setName('refresh').setDescription('Refresh the existing roster embed.'))
    .addSubcommand(sub => sub.setName('manage').setDescription('Open the roster team management dashboard.'))
    .addSubcommand(sub => sub
      .setName('mmr')
      .setDescription('Set or clear the displayed average MMR for a roster team.')
      .addStringOption(option => option
        .setName('team')
        .setDescription('Team to update')
        .setRequired(true)
        .setAutocomplete(true))
      .addStringOption(option => option
        .setName('value')
        .setDescription('Whole-number MMR (e.g. 1965), or clear')
        .setRequired(true))),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const teams = loadRosters().teams
      .filter(team =>
        team.name.toLowerCase().includes(focused) ||
        team.id.toLowerCase().includes(focused)
      )
      .slice(0, 25)
      .map(team => ({ name: team.name.slice(0, 100), value: team.id }));
    await interaction.respond(teams);
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const data = loadRosters();

    if (subcommand === 'mmr') {
      const team = findTeam(data, interaction.options.getString('team', true));
      if (!team) return interaction.reply({
        content: '❌ Team not found. Select a team from autocomplete.',
        flags: MessageFlags.Ephemeral
      });

      const parsed = parseAverageMmr(interaction.options.getString('value', true));
      if (!parsed.valid) return interaction.reply({
        content: `❌ ${parsed.error}`,
        flags: MessageFlags.Ephemeral
      });

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      team.averageMmr = parsed.value;
      const saved = saveRosters(data);
      const refreshed = await refreshRosterMessage(interaction.client, saved, buildRosterEmbed);
      return interaction.editReply({
        content: `✅ **${team.name}** Average MMR ${parsed.value === null ? 'removed' : `set to **${parsed.value}**`}.` +
          (refreshed.updated ? '' : '\n⚠️ Saved, but the roster message could not refresh; try `/roster refresh`.')
      });
    }

    if (subcommand === 'setup') {
      const embeds = buildRosterMessages(data);
      const sentIds = [];
      for (let i = 0; i < embeds.length; i++) {
        // Banner is at the bottom of the last embed, so upload the file with it.
        const sent = await interaction.channel.send({
          embeds: embeds[i],
          ...(i === embeds.length - 1
            ? { files: [{ attachment: BRAND.rosterBannerPath, name: BRAND.rosterBannerFileName }] }
            : {})
        });
        sentIds.push(sent.id);
      }
      const message = { id: sentIds[0] };
      const extraMessageIds = sentIds.slice(1);
      data.extraMessageIds = extraMessageIds;
      data.messageId = message.id;
      data.channelId = interaction.channel.id;
      saveRosters(data);
      return interaction.reply({
        content: '✅ New roster embed created in this channel and saved.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (subcommand === 'refresh') {
      const result = await refreshRosterMessage(interaction.client, data, buildRosterEmbed);
      return interaction.reply({
        content: result.updated
          ? '✅ Roster embed refreshed.'
          : '❌ The saved roster message could not be refreshed. Use `/roster setup` if needed.',
        flags: MessageFlags.Ephemeral
      });
    }

    return interaction.reply({
      ...buildManagementPanel(data),
      flags: MessageFlags.Ephemeral
    });
  }
};
