export function rosterRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'manager' || value === 'team manager') return 'manager';
  if (value === 'coach' || value === 'assistant coach') return 'coach';
  if (['sub', 'substitute', 'reserve'].includes(value)) return 'sub';
  return 'player';
}

const order = {player: 0, sub: 1, coach: 2, manager: 3};

export function sortedRoster(players, team) {
  const hasCustomOrder = players.some(player => Number.isInteger(player.rosterOrder?.[team]) && player.rosterOrder[team] >= 0);
  return players.map((player, index) => ({player, index}))
    .sort((a, b) => {
      const rank = p => Number.isInteger(p.rosterOrder?.[team]) && p.rosterOrder[team] >= 0 ? p.rosterOrder[team] : Number.MAX_SAFE_INTEGER;
      const coachGroup = p => String(p.role || '').toLowerCase() === 'coach' ? 1 : 0;
      return (hasCustomOrder ? coachGroup(a.player) - coachGroup(b.player) : 0) || rank(a.player) - rank(b.player) || order[rosterRole(a.player.role)] - order[rosterRole(b.player.role)] || a.index - b.index;
    })
    .map(item => item.player);
}
