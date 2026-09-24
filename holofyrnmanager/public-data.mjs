// Only these fields are copied into the Firestore document read by the website.
export function publicHoloFyrnData(data = {}) {
  const rows = value => Array.isArray(value) ? value : [];
  const str = value => typeof value === 'string' ? value.trim() : '';
  const teams = rows(data.managerV8?.teams);
  const knownTeams = [
    {id:'main',name:'HoloFyrn Esports'},
    {id:'academy',name:'HoloFyrn Academy'},
    {id:'rls',name:'HoloFyrn Esports RLS'},
    {id:'rls-academy',name:'Rls HoloFyrn Academy'},
    {id:'rls-eldr',name:'Rls HoloFyrn Eldr'},
    ...teams,
  ];
  const players = rows(data.players).filter(player => str(player.name || player.rlName)).map(player => ({
    name: str(player.name || player.rlName).slice(0, 100),
    team: str(player.teamId || player.team || 'main').slice(0, 80),
    role: str(player.position || player.role).slice(0, 80),
    bio: str(player.publicBio || player.bio).slice(0, 1000),
  }));
  const results = rows(data.results).filter(row => str(row.title || row.event)).map(row => ({
    team: str(row.teamId || row.team || 'main').slice(0, 80),
    type: row.managerType === 'league' || row.type === 'League match' ? 'league' : 'tournament',
    date: str(row.dateTime || row.date).slice(0, 10),
    event: str(row.title || row.event).slice(0, 150),
    stage: str(row.stage).slice(0, 80),
    placement: str(row.placement || row.score).slice(0, 80),
  }));
  for (const game of rows(data.managerV8?.leagueGames)) {
    if (!game.played || !str(game.home) || !str(game.away)) continue;
    const home = Number(game.homeSeries), away = Number(game.awaySeries);
    if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
    for (const team of knownTeams.filter(item => item.name === game.home || item.name === game.away)) {
      results.push({team:team.id,type:'league',date:str(game.date).slice(0,10),event:`${game.home} vs ${game.away}`.slice(0,150),stage:'',placement:`${home}–${away}`});
    }
  }
  return {players,results};
}
