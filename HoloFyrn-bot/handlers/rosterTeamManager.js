const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');
const crypto = require('crypto');

const {
  loadRosters,
  saveRosters,
  findTeamByUuid,
  refreshRosterMessage
} = require('../utils/rosterData');

const { buildRosterEmbed } = require('../embeds/rosterEmbed');
const { parseAverageMmr } = require('../utils/rosterMmr');

function allowed(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}


function normalizeLogoUrl(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed || trimmed.toLowerCase() === 'clear') {
    return '';
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeEmojiId(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed || trimmed.toLowerCase() === 'clear') {
    return '';
  }

  return /^\d{15,25}$/.test(trimmed)
    ? trimmed
    : null;
}

async function resolveGuildEmoji(interaction, emojiId) {
  if (!emojiId || !interaction.guild) {
    return null;
  }

  try {
    return (
      interaction.guild.emojis.cache.get(emojiId) ||
      await interaction.guild.emojis.fetch(emojiId)
    );
  } catch {
    return null;
  }
}

function reindexTeams(data) {
  data.teams.forEach((team, index) => {
    team.displayOrder = index + 1;
  });
}

function moveTeam(data, uuid, position) {
  const index = data.teams.findIndex(team => team.uuid === uuid);
  if (index === -1) return;
  const [team] = data.teams.splice(index, 1);
  const target = Math.max(0, Math.min(position - 1, data.teams.length));
  data.teams.splice(target, 0, team);
  reindexTeams(data);
}

function parsePosition(value, max) {
  const number = Number(String(value || '').trim());
  if (!Number.isInteger(number)) return null;
  return Math.max(1, Math.min(number, Math.max(max, 1)));
}

function selectRow(customId, placeholder, data) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(data.teams.slice(0, 25).map(team => ({
        label: team.name.slice(0, 100),
        description: `${team.players.length} player(s) • Position ${team.displayOrder}`.slice(0, 100),
        value: team.uuid
      })))
  );
}

function roleSelectRow(customId, placeholder, interaction) {
  const roles = interaction.guild.roles.cache
    .filter(role =>
      role.id !== interaction.guild.id &&
      !role.managed
    )
    .sort((a, b) => b.position - a.position)
    .first(25);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        roles.map(role => ({
          label: role.name.slice(0, 100),
          value: role.id,
          description: `Role ID: ${role.id}`.slice(0, 100)
        }))
      )
  );
}

function tryoutRoleRow(teamUuid, interaction) {
  return roleSelectRow(
    `roster_team_tryout_role_select:${teamUuid}`,
    'Choose the role accepted players should receive',
    interaction
  );
}

function captainRoleRow(teamUuid, interaction) {
  return roleSelectRow(
    `roster_team_captain_role_select:${teamUuid}`,
    'Choose the captain role allowed to review this team',
    interaction
  );
}


function addModal() {
  const modal = new ModalBuilder()
    .setCustomId('roster_team_add_modal')
    .setTitle('Add Roster Team');

  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder()
      .setCustomId('team_name').setLabel('Full team name').setPlaceholder('HoloFyrn Esports Elite')
      .setRequired(true).setMaxLength(100).setStyle(TextInputStyle.Short)),
    new ActionRowBuilder().addComponents(new TextInputBuilder()
      .setCustomId('team_short_name').setLabel('Short display name').setPlaceholder('HoloFyrn Elite')
      .setRequired(true).setMaxLength(50).setStyle(TextInputStyle.Short)),
    new ActionRowBuilder().addComponents(new TextInputBuilder()
      .setCustomId('team_id').setLabel('Permanent internal ID').setPlaceholder('elite')
      .setRequired(true).setMaxLength(40).setStyle(TextInputStyle.Short)),
    new ActionRowBuilder().addComponents(new TextInputBuilder()
      .setCustomId('team_position').setLabel('Display position').setPlaceholder('1')
      .setRequired(true).setMaxLength(3).setStyle(TextInputStyle.Short)),
    new ActionRowBuilder().addComponents(new TextInputBuilder()
      .setCustomId('team_logo_url').setLabel('Team logo image URL (optional)')
      .setPlaceholder('https://.../logo.png')
      .setRequired(false).setMaxLength(1000).setStyle(TextInputStyle.Short))
  );

  return modal;
}


function averageMmrModal(team) {
  const input = new TextInputBuilder()
    .setCustomId('team_average_mmr')
    .setLabel('Average MMR')
    .setPlaceholder('e.g. 1965 (type clear to remove)')
    .setRequired(false)
    .setMaxLength(10)
    .setStyle(TextInputStyle.Short);

  if (team.averageMmr !== null && team.averageMmr !== undefined) {
    input.setValue(String(team.averageMmr));
  }

  return new ModalBuilder()
    .setCustomId(`roster_team_mmr_modal:${team.uuid}`)
    .setTitle('Edit Average MMR')
    .addComponents(new ActionRowBuilder().addComponents(input));
}

function editModal(team) {
  const modal = new ModalBuilder()
    .setCustomId(`roster_team_edit_modal:${team.uuid}`)
    .setTitle('Edit Roster Team');

  const logoInput = new TextInputBuilder()
    .setCustomId('team_logo_url')
    .setLabel('Team logo image URL')
    .setPlaceholder('https://.../logo.png • leave empty to remove')
    .setRequired(false)
    .setMaxLength(1000)
    .setStyle(TextInputStyle.Short);

  if (team.logoUrl) {
    logoInput.setValue(String(team.logoUrl).slice(0, 1000));
  }

  const emojiInput = new TextInputBuilder()
    .setCustomId('team_logo_emoji_id')
    .setLabel('Team logo emoji ID')
    .setPlaceholder('Right-click emoji → Copy ID')
    .setRequired(false)
    .setMaxLength(25)
    .setStyle(TextInputStyle.Short);

  if (team.logoEmojiId) {
    emojiInput.setValue(String(team.logoEmojiId).slice(0, 25));
  }

  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder()
      .setCustomId('team_name').setLabel('Full team name').setValue(team.name.slice(0, 100))
      .setRequired(true).setMaxLength(100).setStyle(TextInputStyle.Short)),
    new ActionRowBuilder().addComponents(new TextInputBuilder()
      .setCustomId('team_short_name').setLabel('Short display name').setValue(team.shortName.slice(0, 50))
      .setRequired(true).setMaxLength(50).setStyle(TextInputStyle.Short)),
    new ActionRowBuilder().addComponents(new TextInputBuilder()
      .setCustomId('team_position').setLabel('Display position').setValue(String(team.displayOrder))
      .setRequired(true).setMaxLength(3).setStyle(TextInputStyle.Short)),
    new ActionRowBuilder().addComponents(logoInput),
    new ActionRowBuilder().addComponents(emojiInput)
  );

  return modal;
}

async function finish(interaction, data, message) {
  const saved = saveRosters(data);
  const result = await refreshRosterMessage(interaction.client, saved, buildRosterEmbed);
  await interaction.editReply({
    content: message + (result.updated ? '' : '\n\n⚠️ Data saved, but the roster embed could not refresh automatically.'),
    components: [],
    embeds: []
  });
}

async function handleRosterTeamInteraction(interaction) {
  const relevant =
    (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) &&
    interaction.customId.startsWith('roster_team_');

  if (!relevant) return false;

  if (!allowed(interaction)) {
    await interaction.reply({
      content: '❌ You need Administrator permission to manage roster teams.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.customId === 'roster_team_add' && interaction.isButton()) {
    await interaction.showModal(addModal());
    return true;
  }

  if (interaction.customId === 'roster_team_edit' && interaction.isButton()) {
    const data = loadRosters();
    if (!data.teams.length) {
      await interaction.reply({ content: '❌ There are no teams to edit.', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({
        content: 'Select the team you want to edit:',
        components: [selectRow('roster_team_edit_select', 'Choose a team', data)],
        flags: MessageFlags.Ephemeral
      });
    }
    return true;
  }

  if (interaction.customId === 'roster_team_mmr' && interaction.isButton()) {
    const data = loadRosters();
    if (!data.teams.length) {
      await interaction.reply({ content: '❌ There are no teams to edit.', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({
        content: 'Select the team whose Average MMR you want to change:',
        components: [selectRow('roster_team_mmr_select', 'Choose a team', data)],
        flags: MessageFlags.Ephemeral
      });
    }
    return true;
  }

  if (interaction.customId === 'roster_team_mmr_select' && interaction.isStringSelectMenu()) {
    const team = findTeamByUuid(loadRosters(), interaction.values[0]);
    if (!team) {
      await interaction.reply({ content: '❌ That team could not be found.', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.showModal(averageMmrModal(team));
    }
    return true;
  }

  if (interaction.customId.startsWith('roster_team_mmr_modal:') && interaction.isModalSubmit()) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const data = loadRosters();
    const team = findTeamByUuid(data, interaction.customId.split(':')[1]);
    if (!team) return interaction.editReply({ content: '❌ That team no longer exists.' });

    const parsed = parseAverageMmr(interaction.fields.getTextInputValue('team_average_mmr'));
    if (!parsed.valid) return interaction.editReply({ content: `❌ ${parsed.error}` });

    team.averageMmr = parsed.value;
    await finish(interaction, data,
      `✅ **${team.name}** Average MMR ${parsed.value === null ? 'removed' : `set to **${parsed.value}**`}.`
    );
    return true;
  }

  if (interaction.customId === 'roster_team_tryout_role' && interaction.isButton()) {
    const data = loadRosters();

    if (!data.teams.length) {
      await interaction.reply({
        content: '❌ There are no teams to configure.',
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.reply({
        content: 'Select the team whose accepted applicants should receive a tryout role:',
        components: [
          selectRow(
            'roster_team_tryout_role_team_select',
            'Choose a team',
            data
          )
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (
    interaction.customId === 'roster_team_tryout_role_team_select' &&
    interaction.isStringSelectMenu()
  ) {
    const team = findTeamByUuid(
      loadRosters(),
      interaction.values[0]
    );

    if (!team) {
      await interaction.reply({
        content: '❌ That team could not be found.',
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.update({
        content:
          `Choose the tryout role for **${team.name}**.\n\n` +
          'When an application for this team is accepted, the applicant will receive this role.',
        components: [tryoutRoleRow(team.uuid, interaction)]
      });
    }

    return true;
  }

  if (
    interaction.customId.startsWith('roster_team_tryout_role_select:') &&
    interaction.isStringSelectMenu()
  ) {
    await interaction.deferUpdate();

    const data = loadRosters();
    const teamUuid = interaction.customId.split(':')[1];
    const team = findTeamByUuid(data, teamUuid);

    if (!team) {
      await interaction.editReply({
        content: '❌ That team no longer exists.',
        components: []
      });
      return true;
    }

    const roleId = interaction.values[0];
    const role =
      interaction.guild.roles.cache.get(roleId) ||
      await interaction.guild.roles.fetch(roleId).catch(() => null);

    if (!role) {
      await interaction.editReply({
        content: '❌ I could not find that role.',
        components: []
      });
      return true;
    }

    team.tryoutRoleId = role.id;

    await finish(
      interaction,
      data,
      `✅ Tryout role for **${team.name}** set to ${role}.`
    );

    return true;
  }

  if (interaction.customId === 'roster_team_captain_role' && interaction.isButton()) {
    const data = loadRosters();

    if (!data.teams.length) {
      await interaction.reply({
        content: '❌ There are no teams to configure.',
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.reply({
        content: 'Select the team whose captain role you want to configure:',
        components: [
          selectRow(
            'roster_team_captain_role_team_select',
            'Choose a team',
            data
          )
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (
    interaction.customId === 'roster_team_captain_role_team_select' &&
    interaction.isStringSelectMenu()
  ) {
    const team = findTeamByUuid(
      loadRosters(),
      interaction.values[0]
    );

    if (!team) {
      await interaction.reply({
        content: '❌ That team could not be found.',
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.update({
        content:
          `Choose the captain role for **${team.name}**.\n\n` +
          'Members with this role can review tryout applications for this team.',
        components: [captainRoleRow(team.uuid, interaction)]
      });
    }

    return true;
  }

  if (
    interaction.customId.startsWith('roster_team_captain_role_select:') &&
    interaction.isStringSelectMenu()
  ) {
    await interaction.deferUpdate();

    const data = loadRosters();
    const teamUuid = interaction.customId.split(':')[1];
    const team = findTeamByUuid(data, teamUuid);

    if (!team) {
      await interaction.editReply({
        content: '❌ That team no longer exists.',
        components: []
      });
      return true;
    }

    const roleId = interaction.values[0];
    const role =
      interaction.guild.roles.cache.get(roleId) ||
      await interaction.guild.roles.fetch(roleId).catch(() => null);

    if (!role) {
      await interaction.editReply({
        content: '❌ I could not find that role.',
        components: []
      });
      return true;
    }

    team.captainRoleId = role.id;

    await finish(
      interaction,
      data,
      `✅ Captain role for **${team.name}** set to ${role}.`
    );

    return true;
  }

  if (interaction.customId === 'roster_team_remove' && interaction.isButton()) {
    const data = loadRosters();
    if (!data.teams.length) {
      await interaction.reply({ content: '❌ There are no teams to remove.', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({
        content: 'Select the team you want to remove:',
        components: [selectRow('roster_team_remove_select', 'Choose a team', data)],
        flags: MessageFlags.Ephemeral
      });
    }
    return true;
  }

  if (interaction.customId === 'roster_team_add_modal' && interaction.isModalSubmit()) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const data = loadRosters();
    const name = interaction.fields.getTextInputValue('team_name').trim();
    const shortName = interaction.fields.getTextInputValue('team_short_name').trim();
    const id = slugify(interaction.fields.getTextInputValue('team_id'));
    const position = parsePosition(interaction.fields.getTextInputValue('team_position'), data.teams.length + 1);
    const logoUrl = normalizeLogoUrl(
      interaction.fields.getTextInputValue('team_logo_url')
    );

    if (!id) return interaction.editReply({ content: '❌ Invalid internal ID.' });
    if (data.teams.some(team => team.id.toLowerCase() === id.toLowerCase())) {
      return interaction.editReply({ content: `❌ A team with internal ID **${id}** already exists.` });
    }
    if (!position) return interaction.editReply({ content: '❌ Display position must be a whole number.' });
    if (logoUrl === null) {
      return interaction.editReply({ content: '❌ The logo must be a valid http/https image URL.' });
    }

    const team = {
      uuid: crypto.randomUUID(),
      id,
      name,
      shortName,
      displayOrder: data.teams.length + 1,
      logoUrl,
      logoEmojiId: null,
      logoEmojiName: null,
      logoEmojiManaged: false,
      averageMmr: null,
      players: []
    };

    data.teams.push(team);
    moveTeam(data, team.uuid, position);

    await finish(
      interaction,
      data,
      `✅ **${name}** was added at position **${team.displayOrder}**.\n\nYou can add its custom logo emoji later through **Edit Team**.`
    );
    return true;
  }

  if (interaction.customId === 'roster_team_edit_select' && interaction.isStringSelectMenu()) {
    const team = findTeamByUuid(loadRosters(), interaction.values[0]);
    if (!team) {
      await interaction.reply({ content: '❌ That team could not be found.', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.showModal(editModal(team));
    }
    return true;
  }

  if (interaction.customId.startsWith('roster_team_edit_modal:') && interaction.isModalSubmit()) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const data = loadRosters();
    const team = findTeamByUuid(data, interaction.customId.split(':')[1]);
    if (!team) return interaction.editReply({ content: '❌ That team no longer exists.' });

    const position = parsePosition(
      interaction.fields.getTextInputValue('team_position'),
      data.teams.length
    );

    if (!position) {
      return interaction.editReply({
        content: '❌ Display position must be a whole number.'
      });
    }

    const logoUrl = normalizeLogoUrl(
      interaction.fields.getTextInputValue('team_logo_url')
    );

    if (logoUrl === null) {
      return interaction.editReply({
        content: '❌ The logo must be a valid http/https image URL.'
      });
    }

    const logoEmojiId = normalizeEmojiId(
      interaction.fields.getTextInputValue('team_logo_emoji_id')
    );

    if (logoEmojiId === null) {
      return interaction.editReply({
        content: '❌ The emoji ID must contain only the numeric Discord emoji ID.'
      });
    }

    let resolvedEmoji = null;

    if (logoEmojiId) {
      resolvedEmoji = await resolveGuildEmoji(
        interaction,
        logoEmojiId
      );

      if (!resolvedEmoji) {
        return interaction.editReply({
          content:
            '❌ I cannot find that emoji in this Discord server. ' +
            'Make sure you copied the ID of a custom emoji from this server, then try again.'
        });
      }
    }

    team.name = interaction.fields.getTextInputValue('team_name').trim();
    team.shortName = interaction.fields.getTextInputValue('team_short_name').trim();
    team.logoUrl = logoUrl;
    team.logoEmojiId = resolvedEmoji ? resolvedEmoji.id : null;
    team.logoEmojiName = resolvedEmoji ? resolvedEmoji.name : null;
    team.logoEmojiAnimated = resolvedEmoji ? Boolean(resolvedEmoji.animated) : false;
    team.logoEmojiManaged = false;

    moveTeam(data, team.uuid, position);

    await finish(
      interaction,
      data,
      `✅ **${team.name}** was updated and moved to position **${team.displayOrder}**.` +
      (team.logoEmojiId
        ? `\n\n✅ Team emoji saved: ${resolvedEmoji.toString()}`
        : '\n\nℹ️ No custom team emoji is currently set.')
    );
    return true;
  }

  if (interaction.customId === 'roster_team_remove_select' && interaction.isStringSelectMenu()) {
    const data = loadRosters();
    const team = findTeamByUuid(data, interaction.values[0]);
    if (!team) {
      await interaction.update({ content: '❌ That team could not be found.', components: [] });
      return true;
    }
    if (team.players.length) {
      await interaction.update({
        content: `❌ **${team.name}** still has **${team.players.length} player(s)**. Move or remove them first.`,
        components: []
      });
      return true;
    }

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('⚠️ Confirm Team Removal')
      .setDescription(`Remove **${team.name}**?\n\nInternal ID: \`${team.id}\``);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`roster_team_remove_confirm:${team.uuid}`)
        .setLabel('Remove Team').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('roster_team_remove_cancel')
        .setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ content: '', embeds: [embed], components: [row] });
    return true;
  }

  if (interaction.customId.startsWith('roster_team_remove_confirm:') && interaction.isButton()) {
    await interaction.deferUpdate();
    const data = loadRosters();
    const uuid = interaction.customId.split(':')[1];
    const team = findTeamByUuid(data, uuid);
    if (!team) {
      await interaction.editReply({ content: '❌ That team no longer exists.', embeds: [], components: [] });
      return true;
    }
    if (team.players.length) {
      await interaction.editReply({ content: `❌ **${team.name}** now has players, so it was not removed.`, embeds: [], components: [] });
      return true;
    }
    data.teams = data.teams.filter(item => item.uuid !== uuid);
    reindexTeams(data);
    const saved = saveRosters(data);
    const result = await refreshRosterMessage(interaction.client, saved, buildRosterEmbed);
    await interaction.editReply({
      content: `✅ **${team.name}** was removed.` + (result.updated ? '' : '\n\n⚠️ The roster embed could not refresh automatically.'),
      embeds: [],
      components: []
    });
    return true;
  }

  if (interaction.customId === 'roster_team_remove_cancel' && interaction.isButton()) {
    await interaction.update({ content: '✅ Team removal cancelled.', embeds: [], components: [] });
    return true;
  }

  return false;
}

module.exports = { handleRosterTeamInteraction };
