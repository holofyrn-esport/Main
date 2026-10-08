import {todayInBudapest} from '../public-matches.mjs';

// Only these fields are copied into the Firestore document read by the website.
export function publicHoloFyrnData(data = {}) {
  const rows = value => Array.isArray(value) ? value : [];
  const str = value => typeof value === 'string' ? value.trim() : '';
  const publicTeamName = value => str(value).replace(/Noctiq\s+eSports\s+Academy/gi, 'HoloFyrn Academy').replace(/Noctiq\s+Esports/gi, 'HoloFyrn Esports').replace(/Noctiq/gi, 'HoloFyrn');
  const teams = rows(data.managerV8?.teams);
  const knownTeams = [
    {id:'main',name:'HoloFyrn Esports'},
    {id:'academy',name:'HoloFyrn Academy'},
    {id:'rls',name:'HoloFyrn Esports RLS'},
    {id:'rls-academy',name:'Rls HoloFyrn Academy'},
    {id:'rls-eldr',name:'Rls HoloFyrn Eldr'},
    {id:'shadows',name:'HoloFyrn Shadows'},
    {id:'vanguards',name:'Holofyrn Vanguards'},
    ...teams,
  ];
  const players = rows(data.players).filter(player => str(player.name || player.rlName)).map(player => ({
    name: str(player.name || player.rlName).slice(0, 100),
    team: str(player.teamId || player.team || 'main').slice(0, 80),
    teamIds: [...new Set((rows(player.teamIds).length ? player.teamIds : [player.teamId || player.team || 'main']).map(id => str(id).slice(0, 80)).filter(Boolean))],
    rosterOrder: Object.fromEntries(Object.entries(player.rosterOrder || {}).filter(([team, position]) => team.length <= 80 && Number.isInteger(position) && position >= 0)),
    teamRoles: Object.fromEntries(Object.entries(player.teamRoles || {}).filter(([team, role]) => team.length <= 80 && typeof role === 'string').map(([team, role]) => [team, str(role).slice(0, 80)])),
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
  const teamName = id => publicTeamName(knownTeams.find(team => team.id === id)?.name);
  const knownNames = new Set(knownTeams.map(team => publicTeamName(team.name)));
  const upcomingMatches = [];
  for (const item of rows(data.managerV8?.matches)) {
    const date=str(item.date).slice(0,10),home=teamName(str(item.teamId||'main')),away=str(item.opponent),title=publicTeamName(item.competition);
    if(!home||!away||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<todayInBudapest()||!['league','tournament'].includes(str(item.type).toLowerCase()))continue;
    upcomingMatches.push({date,time:/^\d{2}:\d{2}$/.test(str(item.time))?str(item.time):'',home:home.slice(0,100),away:away.slice(0,100),title:title.slice(0,100),type:str(item.type).toLowerCase()==='league'?'League':'Tournament'});
  }
  for (const game of rows(data.managerV8?.leagueGames)) {
    const home = publicTeamName(game.home), away = publicTeamName(game.away), date = str(game.date).slice(0, 10);
    if (game.played || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !home || !away || (!knownNames.has(home) && !knownNames.has(away))) continue;
    const league = rows(data.managerV8?.leagues).find(item=>str(item.id)===str(game.leagueId));
    upcomingMatches.push({date, time:/^\d{2}:\d{2}$/.test(str(game.time))?str(game.time):'', home:home.slice(0, 100), away:away.slice(0, 100), type:'League', title:publicTeamName(league?.name).slice(0,100)});
  }
  for (const scrim of rows(data.scrims)) {
    const home = teamName(str(scrim.teamId));
    const away = str(scrim.opponent);
    const dateTime = str(scrim.dateTime);
    const date = dateTime.slice(0, 10);
    if (!home || !away || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    upcomingMatches.push({date, time:/^\d{2}:\d{2}$/.test(dateTime.slice(11, 16)) ? dateTime.slice(11, 16) : '', home:home.slice(0, 100), away:away.slice(0, 100), type:'Scrim'});
  }
  for (const item of rows(data.tournaments)) {
    const parts=dateParts(item),date=parts.date,time=(str(item.dateTime).includes('T')||item.startsAtUtc||item.time)?parts.time:'',home=teamName(str(item.teamId)),title=publicTeamName(item.name||'Tournament');
    if(!home||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<todayInBudapest())continue;
    upcomingMatches.push({date,time:/^\d{2}:\d{2}$/.test(time)?time:'',home:home.slice(0,100),away:'',title:title.slice(0,100),type:'Tournament'});
  }
  for (const item of rows(data.events)) {
    const type=str(item.type),parts=dateParts(item),date=parts.date;
    if(!/^(league match|match|tournament)$/i.test(type)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<todayInBudapest())continue;
    const home=teamName(str(item.teamId||'main')),away=str(item.opponent||item.away||''),title=publicTeamName(item.title||type);
    upcomingMatches.push({date,time:/^\d{2}:\d{2}$/.test(parts.time)?parts.time:'',home:home.slice(0,100),away:away.slice(0,100),title:title.slice(0,100),type:/league/i.test(type)?'League':'Tournament'});
  }
  for (const item of rows(data.results)) {
    const date=dateParts(item).date, type=str(item.managerType||item.type), opponent=str(item.opponent), title=str(item.title||item.event);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<todayInBudapest()||!opponent||!(/league|match|tournament/i.test(type)))continue;
    const home=teamName(str(item.teamId||item.team||'main'));
    upcomingMatches.push({date,time:/^\d{2}:\d{2}$/.test(str(item.dateTime).slice(11,16))?str(item.dateTime).slice(11,16):'',home:home.slice(0,100),away:opponent.slice(0,100),title:title.slice(0,100),type:/league/i.test(type)?'League':'Tournament'});
  }
  const news = rows(data.managerV8?.news).filter(item => item.status === 'published' && str(item.title) && str(item.summary)).map(item => ({
    id:str(item.id).slice(0,100), title:str(item.title).slice(0,140), category:str(item.category || 'NEWS').slice(0,40),
    summary:str(item.summary).slice(0,280), body:str(item.body).slice(0,8000), imageUrl:/^(https:\/\/|\/assets\/)/i.test(str(item.imageUrl)) ? str(item.imageUrl).slice(0,2048) : '', publishedAt:str(item.publishedAt).slice(0,32),
    ctaLabel:str(item.ctaLabel || (item.id === 'site-rocket-league-teams' ? 'Explore Teams' : '')).slice(0,60),
    ctaUrl:/^#\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/?$/.test(str(item.ctaUrl || (item.id === 'site-rocket-league-teams' ? '#/teams/' : ''))) || /^https:\/\/[^\s]+$/i.test(str(item.ctaUrl)) ? str(item.ctaUrl || '#/teams/').slice(0,2048) : '',
  }));
  const staff = rows(data.managerV8?.staff).filter(item => str(item.name) && str(item.role)).map(item => ({
    id:str(item.id).slice(0,100), name:str(item.name).slice(0,80), role:str(item.role).slice(0,120),
    imageUrl:/^(https:\/\/|assets\/)/i.test(str(item.imageUrl)) ? str(item.imageUrl).slice(0,500) : '',
    profileUrl:/^#\/staff\/(?:member\/)?[a-z0-9-]+\/$/i.test(str(item.profileUrl)) ? str(item.profileUrl).slice(0,160) : '',
    bio:str(item.bio).slice(0,2000),
  }));
  return {players,results,upcomingMatches,news,staff};
}
