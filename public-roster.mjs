export function rosterRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'manager' || value === 'team manager') return 'manager';
  if (value === 'coach' || value === 'assistant coach') return 'coach';
  if (['sub', 'substitute', 'reserve'].includes(value)) return 'sub';
  return 'player';
}

const order = {player: 0, sub: 1, coach: 2, manager: 3};

export function sortedRoster(players) {
  return players.map((player, index) => ({player, index}))
    .sort((a, b) => order[rosterRole(a.player.role)] - order[rosterRole(b.player.role)] || a.index - b.index)
    .map(item => item.player);
}
