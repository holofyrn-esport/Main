export {sortedRoster, teamRole} from '../public-roster.mjs?v=20260930-team-roles';
// Compatibility boundary: existing Noctiq records remain the source of truth.
export const defaultTeams = [
  { id: 'main', name: 'HoloFyrn Esports', code: 'Main roster' },
  { id: 'academy', name: 'HoloFyrn Academy', code: 'Academy' },
  { id: 'rls', name: 'HoloFyrn Esports RLS', code: 'RLS' },
  { id: 'rls-academy', name: 'Rls HoloFyrn Academy', code: 'RLS Academy' },
  { id: 'rls-eldr', name: 'Rls HoloFyrn Eldr', code: 'RLS Eldr' },
  { id: 'shadows', name: 'HoloFyrn Shadows', code: 'Shadows' },
  { id: 'vanguards', name: 'Holofyrn Vanguards', code: 'Vanguards' },
];
export const defaultStaff = [
  {id:'kenz',name:'Kenz',role:'President',imageUrl:'assets/KenzStaff-1200.webp',profileUrl:'#/staff/kenz/'},
  {id:'zemsta',name:'Zemsta',role:'Vice President of IT',imageUrl:'assets/ZemstaStaff.png',profileUrl:'#/staff/zemsta/'},
  {id:'qex',name:'Qex',role:'General Vice-President',imageUrl:'assets/QexStaff.png',profileUrl:'#/staff/qex/'},
  {id:'metalhub',name:'Metalhub',role:'Event Manager and Organizer',imageUrl:'assets/MetalStaff.png',profileUrl:'#/staff/metalhub/'},
  {id:'bensai',name:'Bensai',role:'Financial Manager',imageUrl:'assets/BensaiStaff.png',profileUrl:'#/staff/bensai/'},
  {id:'tobba',name:'Tobba',role:'Social Media Manager',imageUrl:'',profileUrl:'#/staff/tobba/'},
  {id:'bigv',name:'BigV',role:'Secretary',imageUrl:'assets/BigVStaff.png',profileUrl:'#/staff/bigv/'},
  {id:'vortex',name:'Vortex',role:'Head of Design',imageUrl:'assets/VortexStaff.png',profileUrl:'#/staff/vortex/'},
];
// League team names also occur as seed-map keys and in playoff fixtures.
function rebrand(value) {
  if (typeof value === 'string') return value.replace(/Noctiq\s+eSports\s+Academy/gi, 'HoloFyrn Academy').replace(/Noctiq\s+Esports/gi, 'HoloFyrn Esports').replace(/Noctiq/g, 'HoloFyrn');
  if (Array.isArray(value)) return value.map(rebrand);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [rebrand(key), rebrand(item)]));
  return value;
}
export const sharedKeys = ['players', 'results', 'events', 'availability', 'leagues', 'leagueGames', 'goals', 'news', 'notifications', 'users', 'staff', 'matches'];
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
const str = value => value == null ? '' : String(value);
const num = value => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const list = value => Array.isArray(value) ? value : [];
const playerTeams = p => [...new Set((list(p.teamIds).length ? p.teamIds : [p.teamId || p.team || 'main']).map(str).filter(Boolean))];
function dateParts(row) {
  if (row.startsAtUtc) {
    const date = new Date(row.startsAtUtc);
    if (!Number.isNaN(+date)) return { date: localDate(date), time: `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}` };
  }
  const [date, time] = str(row.dateTime || row.date).split('T');
  return { date, time: (time || row.time || '20:00').slice(0,5) };
}
export function fromDatabase(data = {}, profiles = [], uid = '') {
  const users = (profiles.length ? profiles : list(data.users)).map(u => {
    const {password, ...safe} = u;
    return { ...safe, id: str(u.id), displayName: u.name || u.displayName || u.username || 'Player', role: str(u.role || 'Player').toLowerCase(), roleLabel: u.role || 'Player', linkedPlayerId: u.playerId ? str(u.playerId) : (u.linkedPlayerId ? str(u.linkedPlayerId) : null), avatarData: u.avatarData || '' };
  });
  const players = list(data.players).map(p => {
    const account = users.find(u => u.linkedPlayerId === str(p.id) || (p.authUid && (u.authUid === p.authUid || u.id === p.authUid)) || (p.userId && u.id === p.userId));
    if (account) account.linkedPlayerId = str(p.id);
    return { id: str(p.id), accountId: account?.id || p.accountId || null, team: playerTeams(p)[0] || 'main', teamIds: playerTeams(p), rosterOrder: p.rosterOrder || {}, teamRoles: p.teamRoles || {}, name: p.name || p.rlName || '', rl: p.rlName || p.rl || '', discord: p.discord || '', role: p.position || p.role || 'Player', m1: num(p.peak1s), m2: num(p.peak2s || p.mmr), m3: num(p.peak3s), tracker: p.profileLink || '', bio: p.publicBio || p.about || '', private: p.notes || '' };
  });
  const events = list(data.events).map(e => ({
    id: str(e.id), title: e.title || '', ...dateParts(e), duration: Number(e.durationMinutes || 60), type: e.type || 'Meeting', priority: ['low','normal','high','urgent'].includes(e.priority)?e.priority:'normal',
    creatorUserId: e.creatorUserId || e.createdBy || '', hiddenFromAdmins: !!e.hiddenFromAdmins,
    invitedTeamIds: e.invitedTeamIds || (e.targetType !== 'player' && e.teamId ? e.teamId === 'both' ? defaultTeams.map(t=>t.id) : [e.teamId] : []),
    invitedUserIds: e.invitedUserIds || users.filter(u=>e.playerId && u.linkedPlayerId===str(e.playerId)).map(u=>u.id),
    directInvitedUserIds: e.directInvitedUserIds || e.invitedUserIds || [],
  }));
  // Calendar entries owned by the existing specialist tools stay linked to those tools.
  for (const [key, type] of [['scrims','Scrim'], ['tournaments','Tournament'], ['tryouts','Tryout']]) {
    for (const e of list(data[key])) events.push({id:`${key}:${e.id}`, source:key, title:e.title || e.name || `Scrim vs ${e.opponent || 'TBA'}`, ...dateParts(e), duration:Number(e.durationMinutes || 60), type, creatorUserId:e.creatorUserId || '', invitedTeamIds:e.teamId === 'both' ? defaultTeams.map(t=>t.id) : [e.teamId || 'main'], invitedUserIds:[], hiddenFromAdmins:false});
  }
  const extension = data.managerV8 || {};
  return {
    currentUserId: users.find(u=>u.authUid===uid || u.id===uid)?.id || uid,
    teams: [...defaultTeams.map(t=>({...list(extension.teams).find(saved=>saved.id===t.id),...t})), ...list(extension.teams).filter(t=>t.id!=='synq'&&!defaultTeams.some(known=>known.id===t.id)).map(rebrand)], users, players, events, staff: Array.isArray(extension.staff) ? extension.staff : structuredClone(defaultStaff), matches: list(extension.matches),
    results: list(data.results).map(r=>({id:str(r.id), team:r.teamId || 'main', type:r.managerType || (r.type === 'League match' ? 'league' : 'tournament'), date:dateParts(r).date, event:r.title || r.event || '', stage:r.stage || '', placement:r.placement || r.score || '', prizeMoney:Number(r.prizeEur || r.prizeMoney || 0), result:r.result || 'pending', ...(r.leagueId != null ? {leagueId:r.leagueId} : {})})),
    availability: list(data.availability).map(a=>({id:str(a.id), playerId:str(a.playerId), date:a.date || '', from:a.startTime || a.from || '', until:a.endTime || a.until || '', status:a.status || 'Available'})),
    leagues: rebrand(list(extension.leagues).map(l=>({...l,playoffs:l.playoffs||{rounds:[]}}))), leagueGames: rebrand(list(extension.leagueGames)), goals: list(extension.goals).map(g=>({...g,progress:Math.max(0,Math.min(100,Number(g.progress)||0)),mode:g.mode||'percent',status:g.status||'active'})), news: list(extension.news), notifications: list(extension.notifications),
  };
}
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function changesBetween(before, after) {
  const changes = {};
  for (const key of sharedKeys) {
    const old = new Map(list(before[key]).map(r=>[str(r.id),r]));
    const next = new Map(list(after[key]).map(r=>[str(r.id),r]));
    const changed = [];
    for (const [id, row] of next) if (!equal(old.get(id),row)) changed.push({id, before:old.get(id) || null, after:structuredClone(row)});
    for (const [id, row] of old) if (!next.has(id)) changed.push({id, before:structuredClone(row), after:null});
    if (changed.length) changes[key] = changed;
  }
  return changes;
}
export function applyChanges(rows, changes = []) {
  const result = structuredClone(rows || []);
  for (const change of changes) {
    const index = result.findIndex(r=>str(r.id)===change.id);
    const current = index < 0 ? null : result[index];
    if (!change.after) {
      if (current && !equal(current,change.before)) throw new Error('This record was changed by another user. Reload and try again.');
      if (index>=0) result.splice(index,1);
    } else if (!change.before) {
      if (current && !equal(current,change.after)) throw new Error('A record with this ID already exists. Reload and try again.');
      if (!current) result.push(change.after);
    } else {
      if (!current) throw new Error('This record was deleted by another user. Reload and try again.');
      for (const key of new Set([...Object.keys(change.before), ...Object.keys(change.after)])) {
        if (equal(change.before[key],change.after[key])) continue;
        if (!equal(current[key],change.before[key]) && !equal(current[key],change.after[key])) throw new Error('This field was changed by another user. Reload and try again.');
        if (change.after[key] === undefined) delete current[key]; else current[key] = change.after[key];
      }
    }
  }
  return result;
}
export function validateChanges(changes, user, players) {
  if (!user || user.approved === false) throw new Error('Your account does not have access.');
  const admin = user.role === 'admin';
    const staff = admin || ['coach','manager','captain'].includes(user.role) || user.canEdit || user.coachAccess || user.managerAccess;
  for (const [key, items] of Object.entries(changes)) for (const c of items) {
    const row = c.after || c.before;
    if (key === 'leagues' && !c.after && !admin) throw new Error('Administrator access required to delete a league.');
    if (key === 'users') {
      if (!c.after || !c.before) throw new Error('Use account management to create or disable accounts.');
      if (!admin) {
        const allowed = ['displayName','initials','discord','discordUrl','instagramUrl','xUrl','tiktokUrl','bio','avatarData','avatarScale','avatarX','avatarY'];
        if (row.id !== user.id || Object.keys({...c.before,...c.after}).some(k=>!allowed.includes(k) && !equal(c.before[k],c.after[k]))) throw new Error('You may only edit your own profile.');
      }
    } else if (key === 'players' && !admin) throw new Error('Administrator access required.');
    else if (key === 'staff') {
      if (!admin) throw new Error('Administrator access required to manage staff.');
      if (c.after && (!c.after.name?.trim() || !c.after.role?.trim())) throw new Error('Staff needs a name and role.');
      if (c.after && (c.after.imageUrl && !(/^(https:\/\/|assets\/)[^\s<>"']{1,500}$/i.test(c.after.imageUrl)))) throw new Error('Use an HTTPS image URL or a site assets path.');
      if (c.after && (c.after.profileUrl && !/^#\/staff\/(?:member\/)?[a-z0-9-]+\/$/i.test(c.after.profileUrl))) throw new Error('Staff profile links must use a valid staff page path.');
      if (c.after && (c.after.bio && (typeof c.after.bio !== 'string' || c.after.bio.length > 2000))) throw new Error('Staff introductions must be 2,000 characters or fewer.');
    }
    else if (key === 'matches') {
      if (!staff) throw new Error('Staff access required to manage matches.');
      if (c.after && (!['league','tournament'].includes(c.after.type) || !c.after.competition?.trim() || !c.after.teamId || !c.after.date || !/^\d{2}:\d{2}$/.test(c.after.time || '') || !c.after.opponent?.trim())) throw new Error('Choose a match type and complete the competition, team, opponent, date and time.');
      if (c.after && (c.after.competition.length > 120 || c.after.opponent.length > 100 || (c.after.notes||'').length > 1000)) throw new Error('Match details exceed the allowed length.');
      if (c.after?.twitchUrl && (typeof c.after.twitchUrl !== 'string' || c.after.twitchUrl.length > 500 || !/^https:\/\/(?:www\.|m\.)?twitch\.tv\/[A-Za-z0-9_/-]+(?:[?#][^\s<>"']*)?$/i.test(c.after.twitchUrl))) throw new Error('Use a valid HTTPS Twitch link.');
    }
    else if (['results','leagues','leagueGames'].includes(key) && !staff) throw new Error('Staff access required.');
    else if (key === 'goals') {
      if (!(admin || ['coach','manager'].includes(user.role) || user.coachAccess || user.managerAccess)) throw new Error('Admin, coach or manager access required.');
      if (c.after && (!c.after.title?.trim() || !c.after.teamId || !c.after.dueDate)) throw new Error('A goal needs a title, team and target date.');
    }
    else if (key === 'news') {
      if (!(admin || user.role === 'socials')) throw new Error('Administrator or socials access required to manage news.');
      if (c.after && (!c.after.title?.trim() || !c.after.summary?.trim() || !c.after.body?.trim())) throw new Error('News needs a title, summary and article text.');
      if (c.after && ((c.after.imageUrl && (typeof c.after.imageUrl !== 'string' || c.after.imageUrl.length > 2048 || !/^https:\/\//i.test(c.after.imageUrl))) || (c.after.imagePath && (typeof c.after.imagePath !== 'string' || !/^news\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(c.after.imagePath))))) throw new Error('News images must use a valid HTTPS storage URL and image path.');
      if (c.after && ((Boolean(c.after.ctaLabel) !== Boolean(c.after.ctaUrl)) || (c.after.ctaLabel && (typeof c.after.ctaLabel !== 'string' || c.after.ctaLabel.length > 60)) || (c.after.ctaUrl && (typeof c.after.ctaUrl !== 'string' || c.after.ctaUrl.length > 2048 || !(/^#\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/?$/.test(c.after.ctaUrl) || /^https:\/\/[^\s]+$/i.test(c.after.ctaUrl)))))) throw new Error('News buttons need a label and a valid internal page or HTTPS link.');
    }
    else if (key === 'availability') {
      if (!staff && [c.before,c.after].filter(Boolean).some(a=>players.find(p=>str(p.id)===str(a.playerId))?.accountId !== user.id)) throw new Error('You may only edit your own availability.');
      if (c.after && (!row.playerId || !row.date || !row.from || row.from>=row.until)) throw new Error('Check the availability date and time range.');
    } else if (key === 'events') {
      if (row.source) throw new Error('Edit this entry in Training & team tools.');
      if (!admin && [c.before,c.after].filter(Boolean).some(e=>e.creatorUserId!==user.id)) throw new Error('You may only edit your own calendar entries.');
      if (c.after && (!row.title.trim() || !row.date || !row.time)) throw new Error('An event needs a title, date and time.');
    } else if (key === 'notifications' && c.before && !admin && c.before.userId!==user.id) throw new Error('You may only edit your own notifications.');
  }
}
export function toDatabase(data, profiles, uid, changes) {
  const latest = fromDatabase(data,profiles,uid);
  validateChanges(changes,latest.users.find(u=>u.id===latest.currentUserId),latest.players);
  const next = {...latest};
  for (const [key, items] of Object.entries(changes)) next[key] = applyChanges(latest[key],items);
  // Cascade against the latest transaction snapshot, including newly added games.
  const deletedLeagues = new Set((changes.leagues || []).filter(c=>!c.after).map(c=>str(c.id)));
  if (deletedLeagues.size) {
    next.leagueGames = next.leagueGames.filter(g=>!deletedLeagues.has(str(g.leagueId)));
    next.results = next.results.filter(r=>!deletedLeagues.has(str(r.leagueId)));
  }
  const patch = {};
  const preserve = (key, rows, convert) => rows.map(row=>{
    const original=list(data[key]).find(r=>str(r.id)===str(row.id));
    return original && !changes[key]?.some(c=>c.id===str(row.id)) ? original : {...original,...convert(row)};
  });
  if (changes.players) patch.players = preserve('players',next.players,p=>({id:p.id,name:p.name,rlName:p.rl,discord:p.discord,teamId:playerTeams(p)[0] || 'main',teamIds:playerTeams(p),rosterOrder:p.rosterOrder || {},teamRoles:p.teamRoles || {},position:p.teamRoles?.[playerTeams(p)[0]] || p.role,peak1s:p.m1??'',peak2s:p.m2??'',peak3s:p.m3??'',profileLink:p.tracker,publicBio:p.bio,notes:p.private,userId:p.accountId || '',authUid:next.users.find(u=>u.id===p.accountId)?.authUid || p.accountId || ''}));
  if (changes.results || deletedLeagues.size) patch.results = preserve('results',next.results,r=>({id:r.id,teamId:r.team,managerType:r.type,type:list(data.results).find(x=>str(x.id)===r.id)?.type || (r.type==='league'?'Match':'Tournament'),dateTime:r.date+'T12:00',title:r.event,stage:r.stage,placement:r.placement,prizeEur:r.prizeMoney,result:r.result,...(r.leagueId!=null?{leagueId:r.leagueId}:{})}));
  if (changes.availability) patch.availability = preserve('availability',next.availability,a=>({id:a.id,playerId:a.playerId,teamId:next.players.find(p=>p.id===a.playerId)?.team || 'main',date:a.date,startTime:a.from,endTime:a.until,status:a.status || 'Available'}));
  if (changes.events) patch.events = preserve('events',next.events.filter(e=>!e.source),e=>({id:e.id,title:e.title,dateTime:`${e.date}T${e.time}`,startsAtUtc:new Date(`${e.date}T${e.time}`).toISOString(),durationMinutes:e.duration,type:e.type,priority:e.priority || 'normal',creatorUserId:e.creatorUserId,invitedTeamIds:e.invitedTeamIds,invitedUserIds:e.invitedUserIds,directInvitedUserIds:e.directInvitedUserIds || [],hiddenFromAdmins:e.hiddenFromAdmins,teamId:e.invitedTeamIds[0] || '',targetType:e.invitedTeamIds.length?'team':'player'}));
  if (['leagues','leagueGames','goals','news','notifications','staff','matches'].some(k=>changes[k])) patch.managerV8 = {...data.managerV8, ...Object.fromEntries(['leagues','leagueGames','goals','news','notifications','staff','matches'].filter(k=>changes[k]).map(k=>[k,next[k]])), ...(changes.news ? {newsInitialized:true} : {})};
  const userWrites = [];
  const affectedUserIds = new Set([...(changes.users || []).map(c=>c.id), ...(changes.players || []).flatMap(c=>[c.before?.accountId,c.after?.accountId]).filter(Boolean)]);
  for (const id of affectedUserIds) {
    const u = next.users.find(u=>u.id===id);
    if (!u) continue;
    const original = profiles.find(p=>str(p.id)===id) || list(data.users).find(p=>str(p.id)===id) || {};
    const {password, ...profile} = original;
    const linkedPlayer=next.players.find(p=>p.id===u.linkedPlayerId);
    userWrites.push({...profile,id:u.id,authUid:profile.authUid || u.id,name:u.displayName,username:u.username || '',role:u.role[0].toUpperCase()+u.role.slice(1),teamId:linkedPlayer?.team || (u.role==='player'?'':u.teamId || ''),teamIds:linkedPlayer?playerTeams(linkedPlayer):(u.teamIds?.length?u.teamIds:(u.teamId?[u.teamId]:[])),playerId:linkedPlayer?.id || '',linkedPlayerId:linkedPlayer?.id || null,approved:u.approved!==false,discord:u.discord || '',discordUrl:u.discordUrl || '',instagramUrl:u.instagramUrl || '',xUrl:u.xUrl || '',tiktokUrl:u.tiktokUrl || '',bio:u.bio || '',avatarData:u.avatarData || '',avatarScale:Number(u.avatarScale || 1),avatarX:Number(u.avatarX || 0),avatarY:Number(u.avatarY || 0)});
  }
  // Users live in users/{uid}; do not copy avatars into the shared 1 MiB document.
  return {patch,userWrites};
}
