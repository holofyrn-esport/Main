export function todayInBudapest(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function matchesForNextDay(matches, today = todayInBudapest()) {
  const future = (Array.isArray(matches) ? matches : [])
    .filter(match => /^\d{4}-\d{2}-\d{2}$/.test(match?.date || '') && match.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  return future.filter(match => match.date === future[0]?.date);
}
