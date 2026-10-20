const fs = require('fs');
const path = require('path');
const BRAND = require('../config/brand');
const crypto = require('crypto');
const { normalizeAverageMmr } = require('./rosterMmr');

const rosterPath = path.join(__dirname, '..', 'data', 'rosters.json');

function normalizeRosterData(data = {}) {
  if (!Array.isArray(data.teams)) data.teams = [];

  data.teams = data.teams.map((team, index) => ({
    ...team,
    uuid: team.uuid || crypto.randomUUID(),
    id: String(team.id || `team-${index + 1}`).trim().toLowerCase(),
    name: String(team.name || `Team ${index + 1}`).trim(),
    shortName: String(team.shortName || team.name || `Team ${index + 1}`).trim(),
    averageMmr: normalizeAverageMmr(team.averageMmr),
    displayOrder: Number.isInteger(Number(team.displayOrder))
      ? Number(team.displayOrder)
      : index + 1,
    players: (Array.isArray(team.players) ? team.players : []).map(player => ({
      ...player,
      uuid: player.uuid || crypto.randomUUID()
    }))
  }));

  data.teams.sort((a, b) =>
    a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)
  );

  data.teams.forEach((team, index) => {
    team.displayOrder = index + 1;
  });

  return data;
}

function loadRosters() {
  const data = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const normalized = normalizeRosterData(data);
  saveRosters(normalized);
  return normalized;
}

function saveRosters(data) {
  const normalized = normalizeRosterData(data);
  fs.writeFileSync(rosterPath, JSON.stringify(normalized, null, 2));
  return normalized;
}

function findTeam(data, input) {
  if (!input) return null;
  const value = String(input).toLowerCase();
  return data.teams.find(team =>
    team.uuid.toLowerCase() === value ||
    team.id.toLowerCase() === value ||
    team.name.toLowerCase() === value ||
    team.shortName.toLowerCase() === value ||
    team.name.toLowerCase().includes(value)
  ) || null;
}

function findTeamByUuid(data, uuid) {
  return data.teams.find(team => team.uuid === uuid) || null;
}

function findPlayer(data, playerInput) {
  const raw = String(playerInput || '').trim();
  const input = raw.toLowerCase();

  // Autocomplete now returns a permanent player UUID. This makes duplicate
  // display names safe across different teams. Keep the name fallback so old
  // manually typed commands still work when the name is unique/first match.
  for (const team of data.teams) {
    const player = team.players.find(p => String(p.uuid || '') === raw);
    if (player) return { team, player };
  }

  for (const team of data.teams) {
    const player = team.players.find(p =>
      String(p.name || '').toLowerCase() === input
    );
    if (player) return { team, player };
  }
  return null;
}

async function refreshRosterMessage(client, data) {
  // Lazy require avoids any circular-import issues.
  const { buildRosterMessages } = require('../embeds/rosterEmbed');

  if (!data.messageId || !data.channelId) {
    return { updated: false, reason: 'missing_message' };
  }

  try {
    const channel = await client.channels.fetch(data.channelId);
    const embeds = buildRosterMessages(data); // array of embed-arrays, banner panel last
    const lastIndex = embeds.length - 1;

    // The banner panel is the last embed of the LAST message, so the file is
    // uploaded with the last message. `attachments: []` clears old copies so
    // the file never piles up on repeated refreshes.
    const payloadFor = index => ({
      embeds: embeds[index],
      attachments: [],
      ...(index === lastIndex
        ? { files: [{ attachment: BRAND.rosterBannerPath, name: BRAND.rosterBannerFileName }] }
        : {})
    });

    const mainMessage = await channel.messages.fetch(data.messageId);
    await mainMessage.edit(payloadFor(0));

    // Extra messages only exist when the roster is too big for one message.
    const oldExtraIds = Array.isArray(data.extraMessageIds) ? data.extraMessageIds : [];
    const existing = [];
    let extrasIntact = true;

    for (const id of oldExtraIds) {
      try {
        existing.push(await channel.messages.fetch(id));
      } catch {
        extrasIntact = false;
      }
    }

    // If any extra message vanished, rebuild all extras so the order stays correct.
    let reusable = existing;
    if (!extrasIntact) {
      await Promise.all(existing.map(m => m.delete().catch(() => {})));
      reusable = [];
    }

    const newExtraIds = [];
    for (let i = 1; i < embeds.length; i++) {
      const message = reusable[i - 1];
      if (message) {
        await message.edit(payloadFor(i));
        newExtraIds.push(message.id);
      } else {
        const sent = await channel.send(payloadFor(i));
        newExtraIds.push(sent.id);
      }
    }

    // Delete leftover extra messages if the roster shrank back to fewer messages.
    for (const message of reusable.slice(embeds.length - 1)) {
      await message.delete().catch(() => {});
    }

    const changed = JSON.stringify(oldExtraIds) !== JSON.stringify(newExtraIds);
    data.extraMessageIds = newExtraIds;
    if (changed) saveRosters(data);

    return { updated: true };
  } catch (error) {
    console.error('Failed to refresh roster message:', error);
    return { updated: false, reason: 'refresh_failed' };
  }
}

module.exports = {
  loadRosters,
  saveRosters,
  findTeam,
  findTeamByUuid,
  findPlayer,
  normalizeRosterData,
  refreshRosterMessage
};
