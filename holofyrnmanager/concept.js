const EVENT_PRIORITIES={low:'Low',normal:'Normal',high:'High',urgent:'Urgent'};
function eventPriority(e){return Object.hasOwn(EVENT_PRIORITIES,e?.priority)?e.priority:'normal';}
function priorityBadge(e){const level=eventPriority(e);return `<span class="priority-badge priority-${level}">${EVENT_PRIORITIES[level]}</span>`;}
const PROFILE_SOCIALS = [
  {key:'discordUrl',id:'discord-url',icon:'discord',label:'Discord',placeholder:'https://discord.gg/...'},
  {key:'instagramUrl',id:'instagram',icon:'instagram',label:'Instagram',placeholder:'https://instagram.com/...'},
  {key:'xUrl',id:'x',icon:'x',label:'X / Twitter',placeholder:'https://x.com/...'},
  {key:'tiktokUrl',id:'tiktok',icon:'tiktok',label:'TikTok',placeholder:'https://www.tiktok.com/@...'}
];
function socialIcon(icon){return `<img class="social-icon" src="assets/social/${icon}.svg" width="18" height="18" alt="" aria-hidden="true">`;}
function profileSocialLinks(u){return PROFILE_SOCIALS.filter(s=>safeUrl(u[s.key])).map(s=>`<a class="btn small social-link" href="${esc(safeUrl(u[s.key]))}" target="_blank" rel="noopener noreferrer">${socialIcon(s.icon)}${s.label} &#8599;</a>`).join('');}
function profileSocialFields(u){return PROFILE_SOCIALS.map(s=>`<div class="field"><label class="social-label" for="profile-${s.id}">${socialIcon(s.icon)}${s.label} link</label><input id="profile-${s.id}" class="input" type="url" placeholder="${s.placeholder}" value="${esc(u[s.key]||'')}"></div>`).join('');}
// Imported from the user-supplied V8.2 design; Firebase services are in connected.js.
const TRACKER_HOME = 'https://rocketleague.tracker.network/';

const seed = emptyState();

const NAV_SECTIONS = [
  { label:'', items:[['overview','Overview']] },
  { label:'Team', items:[['roster','Roster','admin'],['availability','Availability']] },
  { label:'Competition', items:[['results','Results'],['league','Leagues'],['calendar','Calendar']] },
  { label:'Management', items:[['admin','Admin','admin']] }
];
const ICONS = {overview:'⌂',roster:'👥',availability:'🗓',results:'⚔',league:'🏆',calendar:'▣',admin:'⚙'};
let state = loadState();

function loadState(){ return emptyState(); }
function save(){ return queueSave(); }

function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function isAdmin(){return currentUser().role==='admin';}
function isCoach(){return currentUser().role==='coach';}
function team(){return state.teams.find(t=>t.id===state.activeTeam)||state.teams[0];}
function playersForTeam(id=state.activeTeam){return state.players.filter(p=>p.team===id);}
function playerById(id){return state.players.find(p=>p.id==id);}
function userById(id){return state.users.find(u=>u.id===id);}
function currentPlayer(){return currentUser().linkedPlayerId?playerById(currentUser().linkedPlayerId):null;}
function dateFmt(d){return new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
function avg(vals){const a=vals.filter(Number.isFinite);return a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;}
function initials(name=''){return name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()||'?';}
function ordinal(n){const v=n%100;return n+(v>=11&&v<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th');}
function canAccess(view){return !['roster','admin'].includes(view)||isAdmin();}
function ensureAccess(){if(!canAccess(state.view))state.view='overview';}
function visibleNavSections(){return NAV_SECTIONS.map(s=>({label:s.label,items:s.items.filter(i=>i[2]!=='admin'||isAdmin())})).filter(s=>s.items.length);}
function pageLabel(){for(const s of visibleNavSections())for(const [id,label]of s.items)if(id===state.view)return label;return'Overview';}
function teamLogo(){return 'assets/holofyrn-logo.png';}
function defaultPlayoffState(){return{rounds:[]};}
function normalizeState(s){
  s.results=(s.results||[]).map(r=>({...r,prizeMoney:Number(r.prizeMoney??0)||0}));
  s.leagues=(s.leagues||[]).map(l=>({...l,playoffs:l.playoffs||defaultPlayoffState()}));
  return s;
}
function avatarMarkup(u,cls=''){

  return u.avatarData
    ? `<span class="avatar ${cls}"><img src="${esc(safeUrl(u.avatarData, true))}" alt="${esc(u.displayName)}"></span>`
    : `<span class="avatar ${cls}">${esc(u.initials||initials(u.displayName))}</span>`;
}
function roleBadge(role){return`<span class="tag ${role==='Captain'?'red':''}">${esc(role)}</span>`;}
function resultBadge(r){if(r==='win')return'<span class="tag success">WIN</span>';if(r==='loss')return'<span class="tag loss">LOSS</span>';return'<span class="tag muted-tag">—</span>';}
function unreadNotifications(){return state.notifications.filter(n=>n.userId===state.currentUserId&&!n.read);}
function currentNotifications(){return state.notifications.filter(n=>n.userId===state.currentUserId).sort((a,b)=>String(b.created || '').localeCompare(String(a.created || '')));}
function leagueFormForTeam(teamName=team().name,limit=10){return state.leagueGames.filter(g=>g.played&&(g.home===teamName||g.away===teamName)).sort((a,b)=>{if(a.date!==b.date)return b.date.localeCompare(a.date);return (b.round||0)-(a.round||0);}).slice(0,limit).map(g=>{const ours=g.home===teamName?g.homeSeries:g.awaySeries,theirs=g.home===teamName?g.awaySeries:g.homeSeries;return{...g,result:ours>theirs?'win':'loss'};});}
function linkedUserForPlayer(playerId){return state.users.find(u=>u.linkedPlayerId==playerId);}
function linkedPlayerForUser(userId){const u=userById(userId);return u?.linkedPlayerId?playerById(u.linkedPlayerId):null;}
function navButton(id,label){return`<button class="nav-btn ${state.view===id?'active':''}" data-view="${id}"><span class="nav-ico">${ICONS[id]||'•'}</span>${label}</button>`;}
function shortRoleLabel(u){if(!u)return'';if(u.role==='admin')return 'Admin';if(u.role==='coach')return 'Coach';if(u.role==='player')return 'Player';return u.roleLabel||u.role||'';}

function appShell(content){
  ensureAccess();const u=currentUser();
  return`<div class="app-shell ${state.sidebarOpen?'':'sidebar-hidden'}">
    <button class="sidebar-backdrop" id="sidebar-dismiss" aria-label="Close navigation"></button><aside class="sidebar" id="sidebar"><button class="btn sidebar-close" id="sidebar-close" aria-label="Close navigation">?</button>
      <div class="brand"><img src="${teamLogo()}"><div><div class="brand-title">HOLOFYRN</div><div class="brand-sub">Esports Management</div></div></div>
      <div class="team-switcher"><button class="team-switch-btn" id="team-switch-btn"><div class="team-switch-main"><img class="team-switch-thumb" src="${teamLogo()}"><div><div class="team-name">${esc(team().name)}</div><div class="team-code">${esc(team().code)}</div></div></div><span class="chev">⌄</span></button><div class="team-menu" id="team-menu">${state.teams.map(t=>`<div class="team-option ${t.id===state.activeTeam?'active':''}" data-team="${t.id}"><div><b>${esc(t.name)}</b><br><small>${esc(t.code)}</small></div>${t.id===state.activeTeam?'<span>✓</span>':''}</div>`).join('')}</div></div>
      ${visibleNavSections().map(s=>`<div class="nav-group">${s.label?`<div class="nav-label">${s.label}</div>`:''}<nav class="nav">${s.items.map(([id,label])=>navButton(id,label)).join('')}</nav></div>`).join('')}
      <div class="sidebar-bottom"><button class="user-switch-card" id="user-switch-btn">${avatarMarkup(u,'mini')}<span class="user-info"><span class="user-name">${esc(u.displayName)}</span><span class="user-role">${esc(u.roleLabel)}</span></span><span class="user-chip">${esc(shortRoleLabel(u))}</span></button><div class="user-menu" id="user-menu"><button class="user-option" id="account-settings">My profile</button><a class="user-option" href="classic.html">Training &amp; team tools</a></div></div>
    </aside>
    <main class="main"><header class="topbar"><div class="top-left"><button class="btn icon-btn" id="sidebar-toggle" aria-label="Toggle navigation" aria-controls="sidebar" aria-expanded="${state.sidebarOpen}">☰</button><div class="crumb">${esc(team().name)} / <strong>${esc(pageLabel())}</strong></div></div><div class="top-actions"><label class="searchbar"><span>⌕</span><input placeholder="Search..."></label><div class="notification-wrap"><button class="icon-circle" id="bell-btn">🔔${unreadNotifications().length?'<span class="dot-ping"></span>':''}</button>${notificationPanel()}</div><button class="profile-circle" id="profile-btn">${u.avatarData?`<img src="${esc(safeUrl(u.avatarData, true))}">`:esc(u.initials||initials(u.displayName))}</button><span class="sync-status" id="sync-status" role="status"></span><button class="btn small" id="logout">Log out</button></div></header><div class="content">${content}</div></main>
  </div>`;
}
function notificationPanel(){const ns=currentNotifications(),preview=ns.slice(0,6);return`<div class="notification-panel" id="notification-panel"><div class="notification-head"><div><b>Notifications</b><small>${ns.length} total</small></div><button class="link-btn" id="mark-all-read">Mark all read</button></div><div class="notification-preview-list">${preview.length?preview.map(n=>`<button class="notification-item ${n.read?'':'unread'}" data-notification="${n.id}"><span class="notification-dot"></span><span><b>${esc(n.title)}</b><small>${esc(n.text)}</small></span></button>`).join(''):'<div class="empty small-empty">No notifications.</div>'}</div><button class="notification-inbox-btn" id="open-notification-center">Open notification inbox →</button></div>`;}

function overview(){
  const me=currentPlayer(),recent=state.results.filter(r=>r.team===state.activeTeam).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5),leagueFixture=nextLeagueFixture(),events=visibleEventsForCurrentUser().filter(e=>e.date>=today()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,4),form=leagueFormForTeam(team().name,10),wins=form.filter(r=>r.result==='win').length;
  return appShell(`<section class="hero-banner"><div class="hero-copy"><div class="eyebrow">HoloFyrn Esports</div><h1 class="page-title">Good evening, ${esc(me?.name||currentUser().displayName)}.</h1><p class="page-sub">Here's what's happening with your roster.</p></div></section>
    <section class="grid stats-grid"><div class="card metric fixture-metric"><div class="metric-head"><span class="metric-ico">🗓</span>NEXT LEAGUE FIXTURE</div><div class="fixture-focus">${leagueFixture?`${esc(leagueFixture.home)} <span>vs</span> ${esc(leagueFixture.away)}`:'No fixture set'}</div><div class="metric-secondary strong-sub">${leagueFixture?`${dateFmt(leagueFixture.date)} · Round ${leagueFixture.round}`:'Add fixtures in Leagues.'}</div></div><div class="card metric"><div class="metric-head"><span class="metric-ico">📊</span>TEAM FORM</div><div class="form-strip ten-form">${form.length?form.map(r=>`<span class="form-pill ${r.result==='win'?'win':'loss'}">${r.result==='win'?'W':'L'}</span>`).join(''):'—'}</div><div class="metric-secondary">Last ${form.length} league matches</div><div class="metric-trend">${form.length?Math.round(wins/form.length*100)+'% win rate':'No data'}</div></div>${['1s PEAK','2s PEAK','3s PEAK'].map((l,i)=>`<div class="card metric compact"><div class="metric-head"><span class="metric-ico">${i+1}</span>${l}</div><div class="metric-main">${me?[me.m1,me.m2,me.m3][i]??'—':'—'}</div><div class="metric-secondary">${me?`<button class="person-link" data-player-view="${me.id}">${esc(me.name)}</button>`:'No linked player'}</div></div>`).join('')}</section>
    <section class="grid grid-bottom"><div class="card"><div class="section-head"><h3>Recent results</h3><button class="link-btn" data-view="results">View all →</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Competition</th><th>Type</th><th>Placement</th><th>Prize</th></tr></thead><tbody>${recent.length?recent.map(r=>`<tr><td>${dateFmt(r.date)}</td><td>${esc(r.event)}</td><td>${r.type==='league'?'League':'Tournament'}</td><td><b>${esc(r.placement||'—')}</b></td><td>$${Number(r.prizeMoney||0).toLocaleString()}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No results yet.</td></tr>'}</tbody></table></div></div><div class="card"><div class="section-head"><h3>Upcoming calendar</h3><button class="link-btn" data-view="calendar">View all →</button></div><div class="list-panel">${events.length?events.map(e=>`<div class="event-row priority-${eventPriority(e)}"><div class="event-date">${dateFmt(e.date)}</div><div><div>${esc(e.title)}</div><div class="event-meta">${priorityBadge(e)}</div></div><div>${esc(e.time)}</div></div>`).join(''):'<div class="empty">No visible events.</div>'}</div></div></section>`);
}
function nextLeagueFixture(){return state.leagueGames.filter(g=>!g.played&&(g.home===team().name||g.away===team().name)).sort((a,b)=>a.date.localeCompare(b.date))[0];}

function isRosterCoach(p){return String(p?.role||'').toLowerCase()==='coach';}
function roster(){const members=playersForTeam(),list=members.filter(p=>!isRosterCoach(p)),coaches=members.filter(isRosterCoach);return appShell(`<div class="page-head"><div><div class="eyebrow">Team</div><h1 class="page-title small">Roster</h1><p class="page-sub">Manage players and link every player to a web account.</p></div><button class="btn primary" id="add-player">+ Add player</button></div><div class="kpis"><div class="card kpi"><div class="label">Players</div><div class="value">${list.length}</div></div><div class="card kpi"><div class="label">Avg 1s peak</div><div class="value">${avg(list.map(p=>p.m1))||'—'}</div></div><div class="card kpi"><div class="label">Avg 2s peak</div><div class="value">${avg(list.map(p=>p.m2))||'—'}</div></div><div class="card kpi"><div class="label">Avg 3s peak</div><div class="value">${avg(list.map(p=>p.m3))||'—'}</div></div></div><div class="roster-grid">${renderRosterCards(list)}</div>${coaches.length?`<section class="coach-section"><h2>Coaches</h2><div class="roster-grid coach-list">${coaches.map(renderCoachCard).join('')}</div></section>`:''}`);}
function rosterAvatar(p){return avatarMarkup(linkedUserForPlayer(p.id)||{displayName:p.name,initials:initials(p.name)},'roster-avatar');}
function renderCoachCard(p){return `<div class="card card-pad coach-row"><div class="roster-identity">${rosterAvatar(p)}<div class="roster-identity-text"><button class="player-name person-link" data-player-view="${esc(p.id)}">${esc(p.name)}</button><div class="player-meta">Coach</div></div></div><div class="coach-discord"><b>Discord:</b> ${esc(p.discord||'—')}</div><div class="card-actions"><button class="btn small" data-player-view="${esc(p.id)}">View profile</button><button class="btn small" data-player-edit="${esc(p.id)}">Edit</button><button class="btn small danger" data-player-delete="${esc(p.id)}">Delete</button></div></div>`;}
function renderRosterCards(list){
  return list.length?list.map(p=>{const u=linkedUserForPlayer(p.id);return`<div class="card player-card"><div class="player-head roster-identity">${rosterAvatar(p)}<div class="roster-identity-text"><button class="player-name person-link" data-player-view="${p.id}">${esc(p.name)}</button><div class="player-meta">${esc(p.role)} · ${u?`Linked to <button class="inline-person" data-user-profile="${u.id}">@${esc(u.username)}</button>`:'No account linked'}</div></div></div><div class="mmr-grid"><div class="mmr"><span>1s peak</span><strong>${p.m1??'—'}</strong></div><div class="mmr"><span>2s peak</span><strong>${p.m2??'—'}</strong></div><div class="mmr"><span>3s peak</span><strong>${p.m3??'—'}</strong></div></div><div class="player-details"><div><b>Discord:</b> ${esc(p.discord||'—')}</div><div><b>RL name:</b> ${esc(p.rl||'—')}</div><div><b>Tracker:</b> <a class="tracker-link" href="${esc(safeUrl(p.tracker)||TRACKER_HOME)}" target="_blank" rel="noopener">RL Tracker Link ↗</a></div></div><div class="card-actions"><button class="btn small" data-player-view="${p.id}">View profile</button><button class="btn small" data-player-edit="${p.id}">Edit</button><button class="btn small danger" data-player-delete="${p.id}">Delete</button></div></div>`;}).join(''):'<div class="card empty">No players in this roster.</div>';
}
function availability(){
  const roster=playersForTeam(),cp=currentPlayer(),selectable=(isAdmin()||isCoach())?roster:(cp?[cp]:[]),days=weekDates(availabilityWeekStart());
  return appShell(`<div class="page-head"><div><div class="eyebrow">Team</div><h1 class="page-title small">Availability</h1><p class="page-sub">Add as many separate time windows as you need for the same day.</p></div></div><div class="card card-pad" style="margin-bottom:16px"><div class="form-grid four"><div class="field"><label>Player</label><select id="a-player" class="select">${selectable.map(p=>`<option value="${p.id}">${esc(p.name)} / ${esc(team().code)}</option>`).join('')}</select></div><div class="field"><label>Date</label><input id="a-date" class="input" type="date" value="${today()}"></div><div class="field"><label>Available from</label><input id="a-from" class="input" type="time" value="16:00"></div><div class="field"><label>Available until</label><input id="a-until" class="input" type="time" value="18:00"></div></div><div style="margin-top:12px"><button class="btn primary" id="save-availability">Add availability window</button></div></div><div class="card card-pad"><div class="week-head"><h3>${esc(team().name)} availability</h3><div class="toolbar"><button class="btn small" id="availability-prev" aria-label="Previous week">←</button><span class="tag">${dateFmt(days[0].iso)} – ${dateFmt(days[6].iso)}</span><button class="btn small" id="availability-next" aria-label="Next week">→</button></div></div><div class="week-grid">${days.map(dayAvailability).join('')}</div></div>`);
}
function weekDates(startDate){const out=[],d0=new Date(startDate+'T12:00:00');for(let i=0;i<7;i++){const d=new Date(d0);d.setDate(d0.getDate()+i);out.push({iso:d.toISOString().slice(0,10),label:d.toLocaleDateString('en-GB',{weekday:'long'})});}return out;}
function canEditAvailability(a){return isAdmin()||isCoach()||String(currentPlayer()?.id)===String(a.playerId);}
function dayAvailability(day){
  const entries=state.availability.filter(a=>a.date===day.iso&&playerById(a.playerId)?.team===state.activeTeam).sort((a,b)=>a.from.localeCompare(b.from));
  return`<div class="card day-card"><div class="day-name"><span>${esc(day.label)}</span><span class="muted-date">${esc(day.iso)}</span></div>${entries.length?entries.map(a=>`<div class="availability-block"><div><button class="availability-name person-link" data-player-view="${a.playerId}">${esc(playerById(a.playerId)?.name||'Player')}</button><br>${esc(a.from)} – ${esc(a.until)}</div>${canEditAvailability(a)?`<div class="availability-actions"><button class="mini-action" data-avail-edit="${a.id}">Edit</button><button class="mini-action danger-text" data-avail-delete="${a.id}">Delete</button></div>`:''}</div>`).join(''):'<div class="none">No availability submitted.</div>'}</div>`;
}

function results(){
  const list=state.results.filter(r=>r.team===state.activeTeam&&r.type===state.resultTab).sort((a,b)=>b.date.localeCompare(a.date));
  const label=state.resultTab==='tournament'?'Tournament Results':'League Results';
  return appShell(`<div class="page-head"><div><div class="eyebrow">Competition</div><h1 class="page-title small">Results</h1><p class="page-sub">Track placements and prize money for tournament and league finishes.</p></div>${isAdmin()?'<button class="btn primary" id="add-result">+ Add result</button>':''}</div><div class="results-tabs"><div class="segmented"><button class="seg-btn ${state.resultTab==='tournament'?'active':''}" data-result-tab="tournament">Tournament Results</button><button class="seg-btn ${state.resultTab==='league'?'active':''}" data-result-tab="league">League Results</button></div></div><div class="card"><div class="section-head"><h3>${label}</h3></div><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Competition</th><th>Stage</th><th>Placement</th><th>Prize money</th>${isAdmin()?'<th></th>':''}</tr></thead><tbody>${list.length?list.map(r=>`<tr><td>${dateFmt(r.date)}</td><td><b>${esc(r.event)}</b></td><td>${esc(r.stage||'—')}</td><td><b>${esc(r.placement||'—')}</b></td><td><b>$${Number(r.prizeMoney||0).toLocaleString()}</b></td>${isAdmin()?`<td><button class="btn small" data-result-edit="${r.id}">Edit</button> <button class="btn small danger" data-result-delete="${r.id}">Delete</button></td>`:''}</tr>`).join(''):`<tr><td colspan="${isAdmin()?6:5}" class="empty">No ${state.resultTab} results yet.</td></tr>`}</tbody></table></div></div>`);
}
function league(){
  if(state.selectedLeagueId){const l=state.leagues.find(x=>x.id==state.selectedLeagueId);if(l)return leagueDetail(l);state.selectedLeagueId=null;}
  const list=state.leagues.filter(l=>l.team===state.activeTeam);
  return appShell(`<div class="page-head"><div><div class="eyebrow">Competition</div><h1 class="page-title small">Leagues</h1><p class="page-sub">Open a league to manage standings, all matches, fixtures and scenarios.</p></div>${isAdmin()?'<button class="btn primary" id="add-league">+ Add league</button>':''}</div><div class="league-cards">${list.map(l=>`<button class="card league-card" data-league-open="${l.id}"><div><div class="league-name">${esc(l.name)}</div><div class="league-meta">${esc(l.stage)} · ${esc(l.status)} · ${l.participants.length} teams</div></div><div class="league-card-right"><span class="tag">${dateFmt(l.date)}</span><span>→</span></div></button>`).join('')}</div>`);
}
function leagueDetail(l){
  const standings=computeStandings(l),tabs=[['standings','Standings'],['matches','All matches'],['fixtures','Upcoming fixtures'],['scenario','Predictor'],['playoffs','Playoffs']];
  if(isAdmin())tabs.push(['settings','Standings setup']);
  return appShell(`<div class="page-head"><div><button class="link-btn" id="league-back">← Back to leagues</button><div class="eyebrow">${esc(l.status)}</div><h1 class="page-title small">${esc(l.name)}</h1><p class="page-sub">${esc(l.stage)} · ${l.participants.length} participants</p></div>${isAdmin()?'<div class="card-actions"><button class="btn danger" id="delete-league">Delete league</button><button class="btn" id="add-league-fixture">+ Add fixture</button><button class="btn primary" id="add-league-match">+ Add played match</button></div>':''}</div><div class="card card-pad league-tabs">${tabs.map(([id,label])=>`<button class="seg-btn ${state.leagueTab===id?'active':''}" data-league-tab="${id}">${label}</button>`).join('')}</div><div style="margin-top:16px">${leagueTabContent(l,standings)}</div>`);
}
function leagueTabContent(l,standings){
  if(state.leagueTab==='standings')return `${isAdmin()?'<div class="card-actions" style="margin-bottom:12px"><button class="btn primary" id="add-league-team">+ Add team</button></div>':''}${standingsTable(l,standings)}`;
  if(state.leagueTab==='matches')return leagueMatchesTab(l);
  if(state.leagueTab==='fixtures')return leagueFixturesTab(l);
  if(state.leagueTab==='scenario')return leagueScenarioTab(l,standings);
  if(state.leagueTab==='playoffs')return leaguePlayoffsTab(l,standings);
  return leagueSettingsTab(l);
}
function computeStandings(l,extraGames=[]){
  const rows=Object.fromEntries(l.participants.map(n=>[n,{team:n,played:0,wins:0,losses:0,points:0,seriesFor:0,seriesAgainst:0,seriesDiff:0,gameDiff:0,goalsFor:0,goalsAgainst:0,goalDiff:0}]));
  const games=[...state.leagueGames.filter(g=>g.leagueId==l.id&&g.played),...extraGames];
  for(const g of games){if(!rows[g.home]||!rows[g.away])continue;const h=rows[g.home],a=rows[g.away];h.played++;a.played++;h.seriesFor+=+g.homeSeries||0;h.seriesAgainst+=+g.awaySeries||0;a.seriesFor+=+g.awaySeries||0;a.seriesAgainst+=+g.homeSeries||0;h.goalsFor+=+g.homeGoals||0;h.goalsAgainst+=+g.awayGoals||0;a.goalsFor+=+g.awayGoals||0;a.goalsAgainst+=+g.homeGoals||0;if(g.homeSeries>g.awaySeries){h.wins++;a.losses++;h.points+=+l.config.pointsWin||0;a.points+=+l.config.pointsLoss||0;}else if(g.awaySeries>g.homeSeries){a.wins++;h.losses++;a.points+=+l.config.pointsWin||0;h.points+=+l.config.pointsLoss||0;}}
  Object.values(rows).forEach(r=>{r.seriesDiff=r.wins-r.losses;r.gameDiff=r.seriesFor-r.seriesAgainst;r.goalDiff=r.goalsFor-r.goalsAgainst;});
  const criteria=l.config.criteria||['points','seriesDiff','gameDiff'];
  return Object.values(rows).sort((a,b)=>{for(const c of criteria){if((b[c]||0)!==(a[c]||0))return(b[c]||0)-(a[c]||0);}return a.team.localeCompare(b.team);});
}
function standingsTable(l,rows){const v=l.config.visible||{};const cols=[['played','P'],['wins','W'],['losses','L'],['points','PTS'],['seriesDiff','Series +/-'],['gameDiff','Game +/-'],['goalsFor','GF'],['goalDiff','Goal +/-']].filter(([k])=>v[k]);return`<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Team</th>${cols.map(([,label])=>`<th>${label}</th>`).join('')}${isAdmin()?'<th>Teams</th>':''}</tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.team===team().name?'standings-highlight':''}"><td>${i+1}</td><td><b>${esc(r.team)}</b></td>${cols.map(([k])=>`<td>${r[k]}</td>`).join('')}${isAdmin()?`<td><div class="card-actions"><button class="btn small" data-team-edit="${l.participants.indexOf(r.team)}">Edit</button><button class="btn small danger" data-team-remove="${l.participants.indexOf(r.team)}">Delete</button></div></td>`:''}</tr>`).join('')}</tbody></table></div></div>`;}
function leagueMatchesTab(l){const games=state.leagueGames.filter(g=>g.leagueId==l.id&&g.played);const rounds=[...new Set(games.map(g=>g.round))].sort((a,b)=>b-a);return rounds.length?`<div class="round-groups">${rounds.map(round=>{const rg=games.filter(g=>g.round===round).sort((a,b)=>a.home.localeCompare(b.home));return`<section class="round-group"><div class="round-header"><div><span class="round-kicker">ROUND</span><h3>Round ${round}</h3></div><span>${dateFmt(rg[0].date)}</span></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Home</th><th>Score</th><th>Away</th>${isAdmin()?'<th></th>':''}</tr></thead><tbody>${rg.map(g=>`<tr><td>${esc(g.home)}</td><td><b>${g.homeSeries}-${g.awaySeries}</b></td><td>${esc(g.away)}</td>${isAdmin()?`<td><button class="btn small" data-league-game-edit="${g.id}">Edit</button></td>`:''}</tr>`).join('')}</tbody></table></div></div></section>`;}).join('')}</div>`:'<div class="card empty">No played matches.</div>';}
function leagueFixturesTab(l){const games=state.leagueGames.filter(g=>g.leagueId==l.id&&!g.played);const rounds=[...new Set(games.map(g=>g.round))].sort((a,b)=>a-b);return rounds.length?`<div class="round-groups">${rounds.map(round=>`<section class="round-group"><div class="round-header"><div><span class="round-kicker">UPCOMING</span><h3>Round ${round}</h3></div><span>${dateFmt(games.find(g=>g.round===round).date)}</span></div><div class="fixture-grid">${games.filter(g=>g.round===round).map(g=>`<div class="card fixture-card"><div class="fixture-vs"><b>${esc(g.home)}</b><span>VS</span><b>${esc(g.away)}</b></div>${isAdmin()?`<div class="card-actions"><button class="btn small" data-league-result="${g.id}">Enter result</button><button class="btn small" data-league-game-edit="${g.id}">Edit fixture</button></div>`:''}</div>`).join('')}</div></section>`).join('')}</div>`:'<div class="card empty">No upcoming fixtures.</div>';}
function leagueScenarioTab(l,rows){
  const own=team().name,currentRank=rows.findIndex(r=>r.team===own)+1,seeds=leagueSeeds(l),future=state.leagueGames.filter(g=>g.leagueId==l.id&&!g.played).sort((a,b)=>(a.date+a.round).localeCompare(b.date+b.round));
  return `<div class="predictor-layout">
    <div class="card card-pad predictor-main">
      <div class="predictor-title-row"><div><h3>League outcome predictor</h3><p class="page-sub">Current position: <b>#${currentRank||'—'}</b>. Set team strength seeds, override any remaining fixture, then simulate the paths to your target placement.</p></div><span class="tag">Lower seed = stronger</span></div>
      <div class="predictor-controls">
        <div class="field"><label>Target position</label><select class="select" id="scenario-target">${rows.map((_,i)=>`<option value="${i+1}">${i+1}. place</option>`).join('')}</select></div>
        <div class="predictor-actions"><button class="btn" id="learn-from-results">Use played games as new reference</button>${isAdmin()?'<button class="btn" id="save-seeds">Save seeding</button>':''}<button class="btn primary" id="calculate-scenario">Simulate possibilities</button></div>
      </div>
      <div class="seed-grid" id="seed-grid">${l.participants.map(name=>`<label class="seed-item"><span>${esc(name)}</span><input class="input seed-input" data-seed-team="${esc(name)}" type="number" step="0.1" min="0.1" value="${esc(seeds[name]??1)}"></label>`).join('')}</div>
      <div class="predictor-help">Example: seed <b>1.0</b> vs <b>1.2</b> means almost even, but 1.0 is slightly favored. A seed 1 team vs seed 4 is a much stronger favorite.</div>
      <h4 class="predictor-section-title">Remaining fixtures</h4>
      <div class="predictor-fixtures">${future.length?future.map(g=>`<div class="predictor-fixture"><div><span class="tag">R${g.round}</span><div class="predictor-fixture-teams"><b>${esc(g.home)}</b><span>vs</span><b>${esc(g.away)}</b></div><small>${dateFmt(g.date)}</small></div><select class="select fixture-prediction" data-predict-game="${g.id}"><option value="auto">Auto from seed</option><option value="h30">${esc(g.home)} 3-0</option><option value="h31">${esc(g.home)} 3-1</option><option value="h32">${esc(g.home)} 3-2</option><option value="a32">${esc(g.away)} 3-2</option><option value="a31">${esc(g.away)} 3-1</option><option value="a30">${esc(g.away)} 3-0</option></select></div>`).join(''):'<div class="empty left-empty">No remaining fixtures.</div>'}</div>
    </div>
    <div class="card card-pad predictor-output-card"><h3>Possible paths</h3><div id="scenario-output" class="scenario-output">Set your target and run the simulation. You can force outcomes such as A beating B, B beating C, or leave games on Auto.</div></div>
  </div>`;
}
function leagueSeeds(l){
  l.config=l.config||{};
  const existing=l.config.seeds||{};
  const out={};
  l.participants.forEach((name,i)=>out[name]=Number(existing[name]??(i+1)));
  return out;
}
function readPredictorSeeds(l){
  const fallback=leagueSeeds(l),out={...fallback};
  document.querySelectorAll('[data-seed-team]').forEach(inp=>{const n=Number(inp.value);if(Number.isFinite(n)&&n>0)out[inp.dataset.seedTeam]=n;});
  return out;
}
function calibratedSeedsFromPlayed(l,base){
  const adjusted={...base};
  const games=state.leagueGames.filter(g=>g.leagueId==l.id&&g.played);
  for(const g of games){
    const winner=g.homeSeries>g.awaySeries?g.home:g.away,loser=winner===g.home?g.away:g.home;
    if(adjusted[winner]==null||adjusted[loser]==null)continue;
    const expected=adjusted[winner]<=adjusted[loser];
    const margin=Math.abs((g.homeSeries||0)-(g.awaySeries||0));
    if(!expected){adjusted[winner]=Math.max(.1,adjusted[winner]*(margin>=3?.78:.84));adjusted[loser]=adjusted[loser]*(margin>=3?1.15:1.09);}else{adjusted[winner]=Math.max(.1,adjusted[winner]*(margin>=3?.97:.99));adjusted[loser]=adjusted[loser]*(margin>=3?1.03:1.01);}
  }
  const min=Math.min(...Object.values(adjusted));
  if(Number.isFinite(min)&&min>0){Object.keys(adjusted).forEach(k=>adjusted[k]=Math.round((adjusted[k]/min)*100)/100);}
  return adjusted;
}
function applySeedsToInputs(seeds){document.querySelectorAll('[data-seed-team]').forEach(inp=>{if(seeds[inp.dataset.seedTeam]!=null)inp.value=seeds[inp.dataset.seedTeam];});}
function predictionOverride(game){return document.querySelector(`[data-predict-game="${game.id}"]`)?.value||'auto';}
function makePredictedGame(game,seeds,override='auto'){
  let homeWins,hs,as;
  if(override!=='auto'){
    homeWins=override[0]==='h';hs=Number(override[1]);as=Number(override[2]);
    if(!homeWins){const tmp=hs;hs=as;as=tmp;}
  }else{
    const sh=1/Math.pow(Math.max(.1,seeds[game.home]||5),1.35),sa=1/Math.pow(Math.max(.1,seeds[game.away]||5),1.35),pHome=sh/(sh+sa);
    homeWins=Math.random()<pHome;
    const favoriteP=Math.max(pHome,1-pHome),roll=Math.random();
    const loserScore=roll<(favoriteP-.5)*.9?0:roll<.62?1:2;
    hs=homeWins?3:loserScore;as=homeWins?loserScore:3;
  }
  return {...game,played:true,homeSeries:hs,awaySeries:as,homeGoals:hs*3+Math.floor(Math.random()*4),awayGoals:as*3+Math.floor(Math.random()*4)};
}
function calculateScenario(l,target){
  const own=team().name,seeds=readPredictorSeeds(l),future=state.leagueGames.filter(g=>g.leagueId==l.id&&!g.played),runs=3500;
  if(!future.length)return'No remaining fixtures are available for prediction.';
  let success=0;const plans=new Map(),helpful=new Map();
  for(let i=0;i<runs;i++){
    const simulated=future.map(g=>makePredictedGame(g,seeds,predictionOverride(g)));
    const rows=computeStandings(l,simulated),rank=rows.findIndex(r=>r.team===own)+1;
    if(rank>0&&rank<=target){
      success++;
      const ownWins=simulated.filter(g=>(g.home===own&&g.homeSeries>g.awaySeries)||(g.away===own&&g.awaySeries>g.homeSeries)).map(g=>g.home===own?g.away:g.home).sort();
      const key=ownWins.join('|')||'No HoloFyrn win required';plans.set(key,(plans.get(key)||0)+1);
      simulated.filter(g=>g.home!==own&&g.away!==own).forEach(g=>{const winner=g.homeSeries>g.awaySeries?g.home:g.away;const key2=`${winner} over ${winner===g.home?g.away:g.home}`;helpful.set(key2,(helpful.get(key2)||0)+1);});
    }
  }
  const pct=Math.round(success/runs*100);
  if(!success)return`<div class="predictor-prob danger-panel"><b>0% simulated success</b><span>With the current seeds and forced fixture outcomes, no sampled path reaches #${target}. Change a result override or the seeds.</span></div>`;
  const topPlans=[...plans.entries()].sort((a,b)=>{const aw=a[0]==='No HoloFyrn win required'?0:a[0].split('|').length,bw=b[0]==='No HoloFyrn win required'?0:b[0].split('|').length;return aw-bw||b[1]-a[1];}).slice(0,4);
  const topHelp=[...helpful.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  return `<div class="predictor-prob"><b>${pct}% simulated chance to finish #${target} or better</b><span>Based on ${runs.toLocaleString()} simulations using your seed values and any forced results.</span></div><h4>Possible HoloFyrn paths</h4><div class="path-list">${topPlans.map(([key,count],idx)=>`<div class="path-item"><span class="path-number">${idx+1}</span><div><b>${key==='No HoloFyrn win required'?key:`Beat ${esc(key.split('|').join(' + '))}`}</b><small>Appeared in ${Math.round(count/success*100)}% of successful simulations.</small></div></div>`).join('')}</div>${topHelp.length?`<h4>Other results that often help</h4><div class="helpful-grid">${topHelp.map(([x,count])=>`<span class="tag">${esc(x)} · ${Math.round(count/success*100)}%</span>`).join('')}</div>`:''}`;
}
function leagueSettingsTab(l){if(!isAdmin())return'';const v=l.config.visible||{};const metrics=[['played','Played'],['wins','Wins'],['losses','Losses'],['points','Points'],['seriesDiff','Series diff'],['gameDiff','Game diff'],['goalsFor','Goals for'],['goalDiff','Goal diff']];const criteria=['points','seriesDiff','gameDiff','goalsFor','goalDiff','wins'];return`<div class="standings-config"><div class="card card-pad config-box"><h4>Visible columns</h4><div class="check-grid">${metrics.map(([k,lbl])=>`<label class="check-item"><input type="checkbox" data-standing-visible="${k}" ${v[k]?'checked':''}>${lbl}</label>`).join('')}</div></div><div class="card card-pad config-box"><h4>Scoring & tie-break order</h4><div class="config-row"><div class="field"><label>Win points</label><input id="cfg-win" class="input" type="number" value="${l.config.pointsWin}"></div><div class="field"><label>Loss points</label><input id="cfg-loss" class="input" type="number" value="${l.config.pointsLoss}"></div></div>${[0,1,2].map(i=>`<div class="field" style="margin-top:10px"><label>${i+1}. ranking factor</label><select class="select" data-criterion="${i}">${criteria.map(c=>`<option value="${c}" ${l.config.criteria[i]===c?'selected':''}>${c}</option>`).join('')}</select></div>`).join('')}<button class="btn primary" id="save-standing-config" style="margin-top:12px">Save standings setup</button></div></div>`;}


function ensurePlayoffs(l){if(!l.playoffs)l.playoffs=defaultPlayoffState();if(!Array.isArray(l.playoffs.rounds))l.playoffs.rounds=[];return l.playoffs;}
function leaguePlayoffsTab(l,standings){
  const po=ensurePlayoffs(l);
  return `<div class="playoff-shell"><div class="card card-pad"><div class="playoff-toolbar"><div><h3>Playoff bracket</h3><p class="page-sub">Build a fully editable bracket with custom round sizes, teams and kickoff times.</p></div>${isAdmin()?`<div class="card-actions wrap"><button class="btn" id="generate-playoffs">Generate playoffs</button><button class="btn" id="add-playoff-round">+ Add round</button></div>`:''}</div></div>${po.rounds.length?`<div class="playoff-columns">${po.rounds.map((round,idx)=>renderPlayoffRound(l,round,idx)).join('')}</div>`:`<div class="card playoff-empty">No playoff bracket generated yet.${isAdmin()?' Use “Generate playoffs” to create the structure.':''}</div>`}</div>`;
}
function renderPlayoffRound(l,round,idx){
  return `<div class="card playoff-round"><div class="playoff-round-head"><div><small>Round ${idx+1}</small><h3>${esc(round.name||`Round ${idx+1}`)}</h3></div>${isAdmin()?`<div class="card-actions"><button class="btn small" data-playoff-round-edit="${round.id}">Edit</button><button class="btn small danger" data-playoff-round-delete="${round.id}">Delete</button></div>`:''}</div>${(round.matches||[]).length?(round.matches||[]).map(m=>`<div class="playoff-match"><div class="playoff-slot"><span>${esc(m.label||'Match')}</span>${isAdmin()?`<span><button class="btn small" data-playoff-match-edit="${round.id}:${m.id}">Edit</button> <button class="btn small danger" data-playoff-match-delete="${round.id}:${m.id}">Delete</button></span>`:''}</div><div class="playoff-vs"><div class="playoff-team">${esc(m.home||'TBD')}</div><div class="playoff-team">${esc(m.away||'TBD')}</div></div><div class="playoff-time">${m.date?dateFmt(m.date):'No date'}${m.time?` · ${esc(m.time)}`:''}</div></div>`).join(''):'<div class="playoff-empty">No matches in this round yet.</div>'}${isAdmin()?`<button class="btn" data-playoff-add-match="${round.id}" style="margin-top:8px">+ Add match</button>`:''}</div>`;
}
function parsePlayoffStructure(text){
  const lines=(text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
  return lines.map((line,idx)=>{const m=line.match(/^(.*?)(?:\s*[:|-]\s*)(\d+)$/);const name=(m?m[1]:line).trim()||`Round ${idx+1}`;const count=Math.max(0,Number(m?m[2]:1)||1);return{name,count};});
}
function generatePlayoffsModal(l,standings){
  openModal('Generate playoffs', `<div class="field"><label>Rounds (one per line: Round name: number of matches)</label><textarea id="po-structure" class="textarea" rows="7">Round 1: 1
Quarterfinals: 4
Semifinals: 2
Final: 1</textarea></div><p class="profile-note">Use this for special formats too, for example a tiny play-in round followed by a larger bracket round. After generation every match remains fully editable.</p>`,()=>{
    const rounds=parsePlayoffStructure(value('po-structure'));
    const topSeeds=standings.map(r=>r.team);
    let seedIndex=0;
    l.playoffs={rounds:rounds.map((r,roundIdx)=>({id:`pr-${Date.now()}-${roundIdx}`,name:r.name,matches:Array.from({length:r.count},(_,i)=>({id:`pm-${Date.now()}-${roundIdx}-${i}`,label:`${r.name} · Match ${i+1}`,home:roundIdx===0&&topSeeds[seedIndex]?topSeeds[seedIndex++]:'',away:roundIdx===0&&topSeeds[seedIndex]?topSeeds[seedIndex++]:'',date:'',time:''}))}))};
    save();closeModal();render();toast('Playoffs generated','Bracket structure created.');
  });
}
function playoffRoundModal(l,round=null){
  openModal(round?'Edit round':'Add round', `<div class="form-grid"><div class="field"><label>Round name</label><input id="por-name" class="input" value="${esc(round?.name||'New round')}"></div></div>`,()=>{
    const obj=round||{id:`pr-${Date.now()}`,matches:[]};obj.name=value('por-name')||obj.name||'Round';
    const po=ensurePlayoffs(l); if(round){po.rounds=po.rounds.map(r=>r.id===round.id?obj:r);} else {po.rounds.push(obj);} save();closeModal();render();
  });
}
function playoffMatchModal(l,round,match=null){
  if(!isAdmin())return;
  const choices=[...new Set([...l.participants,...ensurePlayoffs(l).rounds.flatMap(r=>(r.matches||[]).flatMap(m=>[m.home,m.away])).filter(Boolean)])];
  openModal(match?'Edit playoff match':'Add playoff match', `<div class="form-grid three"><datalist id="playoff-team-options">${choices.map(t=>`<option value="${esc(t)}"></option>`).join('')}</datalist><div class="field"><label>Label</label><input id="pom-label" class="input" value="${esc(match?.label||`Match ${(round.matches?.length||0)+1}`)}"></div><div class="field"><label>Home team</label><input id="pom-home" class="input" list="playoff-team-options" placeholder="Choose or type an external team" value="${esc(match?.home||'')}"></div><div class="field"><label>Away team</label><input id="pom-away" class="input" list="playoff-team-options" placeholder="Choose or type an external team" value="${esc(match?.away||'')}"></div><div class="field"><label>Date</label><input id="pom-date" type="date" class="input" value="${esc(match?.date||'')}"></div><div class="field"><label>Time</label><input id="pom-time" type="time" class="input" value="${esc(match?.time||'')}"></div></div>`,()=>{
    const home=value('pom-home').trim(),away=value('pom-away').trim();if(home&&away&&home.toLowerCase()===away.toLowerCase()){toast('Teams must be different');return;}
    const obj=match||{id:crypto.randomUUID()};obj.label=value('pom-label')||'Match';obj.home=home;obj.away=away;obj.date=value('pom-date');obj.time=value('pom-time');
    round.matches=round.matches||[]; if(match){round.matches=round.matches.map(m=>m.id===match.id?obj:m);} else {round.matches.push(obj);} save();closeModal();render();
  });
}
function calendar(){
  const [y,m]=state.calendarCursor.split('-').map(Number),events=visibleEventsForCurrentUser();
  return appShell(`<div class="page-head"><div><div class="eyebrow">Competition</div><h1 class="page-title small">Calendar</h1><p class="page-sub">Create personal or team events, invite players or rosters, and control admin visibility.</p></div><button class="btn primary" id="add-event">+ Add calendar entry</button></div><div class="card card-pad"><div class="calendar-toolbar"><div class="card-actions"><button class="btn small" id="cal-prev">←</button><button class="btn small" id="cal-today">Back to actual</button><button class="btn small" id="cal-next">→</button></div><h3>${new Date(y,m-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</h3><span class="tag">${isAdmin()?'Admin can edit visible entries':'Personal/team calendar'}</span></div><div class="calendar-shell">${calendarGrid(y,m-1,events)}</div></div>`);
}
function eventInvitedUserIds(e){const ids=new Set(e.invitedUserIds||[]);for(const teamId of e.invitedTeamIds||[]){for(const p of playersForTeam(teamId)){if(p.accountId)ids.add(p.accountId);}}ids.add(e.creatorUserId);return[...ids];}
function isUserInvitedToEvent(e,userId){return eventInvitedUserIds(e).includes(userId);}
function visibleEventsForCurrentUser(){const u=currentUser();return state.events.filter(e=>{if(e.creatorUserId===u.id)return true;if(isUserInvitedToEvent(e,u.id))return true;if(u.role==='admin')return !e.hiddenFromAdmins;return false;});}
function calendarGrid(year,month,events){const first=new Date(year,month,1),start=(first.getDay()+6)%7,total=new Date(year,month+1,0).getDate(),prevTotal=new Date(year,month,0).getDate(),cells=[];for(let i=start-1;i>=0;i--)cells.push({day:prevTotal-i,monthOffset:-1});for(let d=1;d<=total;d++)cells.push({day:d,monthOffset:0});while(cells.length%7)cells.push({day:cells.length-total-start+1,monthOffset:1});const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];return`<div class="calendar-grid">${weekdays.map(w=>`<div class="calendar-weekday">${w}</div>`).join('')}${cells.map(c=>{const dt=new Date(year,month+c.monthOffset,c.day),iso=dt.toISOString().slice(0,10),ev=events.filter(e=>e.date===iso);return`<div class="calendar-day ${c.monthOffset?'dim':''}"><div class="calendar-number">${c.day}</div>${ev.map(e=>`<div class="calendar-event priority-${eventPriority(e)} ${e.hiddenFromAdmins?'private':''}" data-event-open="${e.id}"><div class="calendar-event-title">${esc(e.time)} ${esc(e.title)}</div><div class="calendar-event-sub">${priorityBadge(e)}</div></div>`).join('')}</div>`;}).join('')}</div>`;}

function admin(){return appShell(`<div class="page-head"><div><div class="eyebrow">Management</div><h1 class="page-title small">Admin</h1><p class="page-sub">Manage web accounts and player profile links.</p></div><button class="btn primary" id="add-account">+ Add account</button></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Account</th><th>Role</th><th>Linked player</th><th>Discord</th><th></th></tr></thead><tbody>${state.users.map(u=>`<tr><td><button class="player-mini person-row" data-user-profile="${u.id}">${avatarMarkup(u,'mini')}<div><b>${esc(u.displayName)}</b><div class="subtle">@${esc(u.username)}</div></div></button></td><td>${esc(u.roleLabel)}</td><td>${u.linkedPlayerId?`<button class="inline-person" data-player-view="${u.linkedPlayerId}">${esc(playerById(u.linkedPlayerId)?.name||'Missing')}</button>${playerById(u.linkedPlayerId)?` <button class="btn small" data-player-rename="${u.linkedPlayerId}" aria-label="Edit player profile name for ${esc(u.displayName)}">Edit name</button>`:''}`:'—'}</td><td>${esc(u.discord||'—')}</td><td><button class="btn small" data-account-edit="${u.id}">Edit</button>${u.id!==state.currentUserId?` <button class="btn small" data-account-toggle="${u.id}">${u.approved===false?'Enable':'Disable'}</button> <button class="btn small danger" data-account-delete="${u.id}">${u.deletionPending?'Retry deletion':'Delete'}</button>`:''}</td></tr>`).join('')}</tbody></table></div></div>`);}
function bindCommon(){
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(canAccess(b.dataset.view)){state.view=b.dataset.view;if(matchMedia("(max-width: 900px)").matches)state.sidebarOpen=false;state.selectedLeagueId=null;save();render();}});
  const teamBtn=document.getElementById('team-switch-btn'),teamMenu=document.getElementById('team-menu');if(teamBtn&&teamMenu)teamBtn.onclick=e=>{e.stopPropagation();teamMenu.classList.toggle('open');};document.querySelectorAll('[data-team]').forEach(x=>x.onclick=()=>{state.activeTeam=x.dataset.team;if(matchMedia("(max-width: 900px)").matches)state.sidebarOpen=false;state.selectedLeagueId=null;save();render();});
  const switchBtn=document.getElementById('user-switch-btn'),userMenu=document.getElementById('user-menu');if(switchBtn&&userMenu)switchBtn.onclick=e=>{e.stopPropagation();userMenu.classList.toggle('open');};
  for(const id of ['sidebar-close','sidebar-dismiss'])document.getElementById(id).onclick=()=>{state.sidebarOpen=false;savePreferences();render();};
  const toggle=document.getElementById('sidebar-toggle');if(toggle)toggle.onclick=()=>{state.sidebarOpen=!state.sidebarOpen;save();render();};
  const bell=document.getElementById('bell-btn'),panel=document.getElementById('notification-panel');if(bell&&panel)bell.onclick=e=>{e.stopPropagation();panel.classList.toggle('open');};document.getElementById('mark-all-read')?.addEventListener('click',e=>{e.stopPropagation();state.notifications.filter(n=>n.userId===state.currentUserId).forEach(n=>n.read=true);save();render();});document.getElementById('open-notification-center')?.addEventListener('click',e=>{e.stopPropagation();openProfileModal('notifications');});document.querySelectorAll('[data-notification]').forEach(b=>b.onclick=()=>{const n=state.notifications.find(x=>x.id==b.dataset.notification);if(n){n.read=true;if(canAccess(n.view))state.view=n.view;save();render();}});
  document.getElementById('profile-btn')?.addEventListener('click',()=>openProfileModal('profile'));
  document.querySelectorAll('[data-player-view]').forEach(b=>b.onclick=()=>viewPlayer(playerById(b.dataset.playerView)));
  document.querySelectorAll('[data-user-profile]').forEach(b=>b.onclick=()=>openUserPublicProfile(userById(b.dataset.userProfile)));
  bindConnectedActions();
  document.addEventListener('click',e=>{if(teamMenu&&!teamMenu.contains(e.target)&&!teamBtn?.contains(e.target))teamMenu.classList.remove('open');if(userMenu&&!userMenu.contains(e.target)&&!switchBtn?.contains(e.target))userMenu.classList.remove('open');if(panel&&!panel.contains(e.target)&&!bell?.contains(e.target))panel.classList.remove('open');},{once:true});
}
function bindView(){if(state.view==='roster')bindRoster();if(state.view==='availability')bindAvailability();if(state.view==='results')bindResults();if(state.view==='league')bindLeague();if(state.view==='calendar')bindCalendar();if(state.view==='admin')bindAdmin();}
function bindRoster(){document.getElementById('add-player')?.addEventListener('click',()=>playerModal());document.querySelectorAll('[data-player-edit]').forEach(b=>b.onclick=()=>playerModal(playerById(b.dataset.playerEdit)));document.querySelectorAll('[data-player-view]').forEach(b=>b.onclick=()=>viewPlayer(playerById(b.dataset.playerView)));document.querySelectorAll('[data-player-delete]').forEach(b=>b.onclick=()=>confirmModal('Delete player?','The linked account will remain but the player link will be cleared.',()=>{const p=playerById(b.dataset.playerDelete);if(p?.accountId){const u=userById(p.accountId);if(u)u.linkedPlayerId=null;}state.players=state.players.filter(p=>p.id!=b.dataset.playerDelete);save();render();}));}
function bindAvailability(){document.getElementById('save-availability')?.addEventListener('click',()=>{const playerId=value('a-player'),date=value('a-date'),from=value('a-from'),until=value('a-until');if(!playerId||!date||from>=until){toast('Invalid availability','Check player, date and time range.');return;}state.availability.push({id:crypto.randomUUID(),playerId,date,from,until});save();render();toast('Saving availability',`${from}–${until}`);});document.querySelectorAll('[data-avail-edit]').forEach(b=>b.onclick=()=>availabilityModal(state.availability.find(a=>a.id==b.dataset.availEdit)));document.querySelectorAll('[data-avail-delete]').forEach(b=>b.onclick=()=>confirmModal('Delete availability?','Remove this time window only.',()=>{state.availability=state.availability.filter(a=>a.id!=b.dataset.availDelete);save();render();}));}
function bindResults(){document.querySelectorAll('[data-result-tab]').forEach(b=>b.onclick=()=>{state.resultTab=b.dataset.resultTab;save();render();});document.getElementById('add-result')?.addEventListener('click',()=>resultModal());document.querySelectorAll('[data-result-edit]').forEach(b=>b.onclick=()=>resultModal(state.results.find(r=>r.id==b.dataset.resultEdit)));document.querySelectorAll('[data-result-delete]').forEach(b=>b.onclick=()=>confirmModal('Delete result?','Remove this result from the database.',()=>{state.results=state.results.filter(r=>r.id!=b.dataset.resultDelete);save();render();}));}

function deleteLeagueModal(l){
  if(!isAdmin())return;
  confirmModal('Delete league?', 'Permanently delete "'+l.name+'"? All its fixtures, matches, playoffs and linked results will also be deleted. This cannot be undone.',()=>{
    if(!isAdmin()||!liveReady)return;
    const belongs=row=>String(row.leagueId)===String(l.id);
    state.leagues=state.leagues.filter(row=>String(row.id)!==String(l.id));
    state.leagueGames=state.leagueGames.filter(row=>!belongs(row));
    state.results=state.results.filter(row=>!belongs(row));
    state.selectedLeagueId=null;state.leagueTab='standings';
    save();render();
  });
  document.getElementById('modal-save').classList.add('danger');
}
function leagueTeamModal(l,name=null){
  const adding=name===null;
  if(!isAdmin()||(!adding&&!l.participants.includes(name)))return;
  openModal(adding?'Add league team':'Edit league team',`<label class="field" for="league-team-name">Team name<input class="input" id="league-team-name" value="${esc(name??'')}"></label><p id="league-team-error" role="alert"></p>`,()=>{
    if(!isAdmin())return;
    const next=value('league-team-name').trim();
    if(!next||l.participants.some(t=>t!==name&&t.toLowerCase()===next.toLowerCase())){document.getElementById('league-team-error').textContent='Enter a unique team name.';return;}
    if(adding){
      l.participants.push(next);
      l.config.seeds??={};
      Object.defineProperty(l.config.seeds,next,{value:l.participants.length,writable:true,enumerable:true,configurable:true});
      save();closeModal();render();return;
    }
    l.participants=l.participants.map(t=>t===name?next:t);
    const seeds=l.config?.seeds;if(seeds&&Object.hasOwn(seeds,name)){const seed=seeds[name];delete seeds[name];Object.defineProperty(seeds,next,{value:seed,writable:true,enumerable:true,configurable:true});}
    for(const g of state.leagueGames.filter(g=>String(g.leagueId)===String(l.id)))for(const side of ['home','away'])if(g[side]===name)g[side]=next;
    for(const r of ensurePlayoffs(l).rounds)for(const m of r.matches||[])for(const side of ['home','away'])if(m[side]===name)m[side]=next;
    save();closeModal();render();
  });
}
function removeLeagueTeam(l,name){
  if(!isAdmin()||!l.participants.includes(name))return;
  confirmModal('Delete league team?',`Remove "${name}" from this league? Its league matches and fixtures will be deleted. Linked league results will be cleared because the standings change. Playoff slots containing this team will become TBD.`,()=>{
    if(!isAdmin())return;
    l.participants=l.participants.filter(t=>t!==name);
    if(l.config?.seeds)delete l.config.seeds[name];
    state.leagueGames=state.leagueGames.filter(g=>String(g.leagueId)!==String(l.id)||(g.home!==name&&g.away!==name));
    state.results=state.results.filter(r=>String(r.leagueId)!==String(l.id));
    for(const r of ensurePlayoffs(l).rounds)for(const m of r.matches||[])for(const side of ['home','away'])if(m[side]===name)m[side]='';
    save();render();
  });
  document.getElementById('modal-save').classList.add('danger');
}
function bindLeague(){
  document.querySelectorAll('[data-league-open]').forEach(b=>b.onclick=()=>{state.selectedLeagueId=b.dataset.leagueOpen;state.leagueTab='standings';save();render();});
  document.getElementById('league-back')?.addEventListener('click',()=>{state.selectedLeagueId=null;save();render();});
  document.querySelectorAll('[data-league-tab]').forEach(b=>b.onclick=()=>{state.leagueTab=b.dataset.leagueTab;save();render();});
  document.getElementById('add-league')?.addEventListener('click',leagueModal);
  const l=state.leagues.find(x=>x.id==state.selectedLeagueId);if(!l)return;
  document.getElementById('add-league-team')?.addEventListener('click',()=>leagueTeamModal(l));
  document.querySelectorAll('[data-team-edit]').forEach(b=>b.onclick=()=>leagueTeamModal(l,l.participants[Number(b.dataset.teamEdit)]));
  document.querySelectorAll('[data-team-remove]').forEach(b=>b.onclick=()=>removeLeagueTeam(l,l.participants[Number(b.dataset.teamRemove)]));
  document.getElementById('delete-league')?.addEventListener('click',()=>deleteLeagueModal(l));
  document.getElementById('add-league-fixture')?.addEventListener('click',()=>leagueGameModal(l,false));
  document.getElementById('add-league-match')?.addEventListener('click',()=>leagueGameModal(l,true));
  document.querySelectorAll('[data-league-result]').forEach(b=>b.onclick=()=>leagueResultModal(state.leagueGames.find(g=>g.id==b.dataset.leagueResult)));
  document.querySelectorAll('[data-league-game-edit]').forEach(b=>b.onclick=()=>leagueGameEditModal(l,state.leagueGames.find(g=>g.id==b.dataset.leagueGameEdit)));
  document.getElementById('learn-from-results')?.addEventListener('click',()=>{const learned=calibratedSeedsFromPlayed(l,readPredictorSeeds(l));applySeedsToInputs(learned);toast('Seeds recalibrated','Played upsets are now used as a stronger reference.');});
  document.getElementById('save-seeds')?.addEventListener('click',()=>{l.config.seeds=readPredictorSeeds(l);save();toast('Seeding saved','These values are now the league default.');});
  document.getElementById('calculate-scenario')?.addEventListener('click',()=>{document.getElementById('scenario-output').innerHTML=calculateScenario(l,+value('scenario-target'));});
  document.getElementById('save-standing-config')?.addEventListener('click',()=>{l.config.pointsWin=+value('cfg-win');l.config.pointsLoss=+value('cfg-loss');l.config.criteria=[...document.querySelectorAll('[data-criterion]')].map(s=>s.value);document.querySelectorAll('[data-standing-visible]').forEach(c=>l.config.visible[c.dataset.standingVisible]=c.checked);save();render();toast('Standings setup saved');});
  document.getElementById('generate-playoffs')?.addEventListener('click',()=>generatePlayoffsModal(l,computeStandings(l)));
  document.getElementById('add-playoff-round')?.addEventListener('click',()=>playoffRoundModal(l));
  document.querySelectorAll('[data-playoff-round-edit]').forEach(b=>b.onclick=()=>{const round=ensurePlayoffs(l).rounds.find(r=>r.id===b.dataset.playoffRoundEdit);if(round)playoffRoundModal(l,round);});
  document.querySelectorAll('[data-playoff-round-delete]').forEach(b=>b.onclick=()=>confirmModal('Delete playoff round?','This removes the round and all matches inside it.',()=>{const po=ensurePlayoffs(l);po.rounds=po.rounds.filter(r=>r.id!==b.dataset.playoffRoundDelete);save();render();}));
  document.querySelectorAll('[data-playoff-add-match]').forEach(b=>b.onclick=()=>{const round=ensurePlayoffs(l).rounds.find(r=>r.id===b.dataset.playoffAddMatch);if(round)playoffMatchModal(l,round);});
  document.querySelectorAll('[data-playoff-match-edit]').forEach(b=>b.onclick=()=>{const [roundId,matchId]=b.dataset.playoffMatchEdit.split(':');const round=ensurePlayoffs(l).rounds.find(r=>r.id===roundId);const match=round?.matches?.find(m=>m.id===matchId);if(round&&match)playoffMatchModal(l,round,match);});
  document.querySelectorAll('[data-playoff-match-delete]').forEach(b=>b.onclick=()=>confirmModal('Delete playoff match?','This removes the selected playoff match.',()=>{const [roundId,matchId]=b.dataset.playoffMatchDelete.split(':');const round=ensurePlayoffs(l).rounds.find(r=>r.id===roundId);if(round){round.matches=(round.matches||[]).filter(m=>m.id!==matchId);save();render();}}));
}
function bindCalendar(){document.getElementById('add-event')?.addEventListener('click',()=>eventModal());document.getElementById('cal-prev')?.addEventListener('click',()=>moveCalendar(-1));document.getElementById('cal-next')?.addEventListener('click',()=>moveCalendar(1));document.getElementById('cal-today')?.addEventListener('click',()=>{state.calendarCursor=today().slice(0,7);save();render();});document.querySelectorAll('[data-event-open]').forEach(b=>b.onclick=()=>eventDetailModal(state.events.find(e=>e.id==b.dataset.eventOpen)));}

function playerModal(p=null){const edit=!!p,availableUsers=state.users.filter(u=>!u.linkedPlayerId||u.id===p?.accountId);openModal(edit?'Edit player':'Add player',`<div class="form-grid three"><div class="field"><label>Name</label><input id="p-name" class="input" value="${esc(p?.name||'')}"></div><div class="field"><label>Linked web account</label><select id="p-account" class="select"><option value="">Select account...</option>${availableUsers.map(u=>`<option value="${u.id}">${esc(u.displayName)} · @${esc(u.username)} · ${esc(u.roleLabel)}</option>`).join('')}</select></div><div class="field"><label>Team</label><select id="p-team" class="select">${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>RL name</label><input id="p-rl" class="input" value="${esc(p?.rl||'')}"></div><div class="field"><label>Discord</label><input id="p-discord" class="input" value="${esc(p?.discord||'')}"></div><div class="field"><label>Role</label><select id="p-role" class="select"><option>Captain</option><option>Starter</option><option>Substitute</option><option>Reserve</option><option>Player</option><option>Coach</option></select></div><div class="field"><label>Peak 1s</label><input id="p-m1" type="number" class="input" value="${esc(p?.m1??'')}"></div><div class="field"><label>Peak 2s</label><input id="p-m2" type="number" class="input" value="${esc(p?.m2??'')}"></div><div class="field"><label>Peak 3s</label><input id="p-m3" type="number" class="input" value="${esc(p?.m3??'')}"></div><div class="field"><label>RL Tracker link</label><input id="p-tracker" class="input" value="${esc(p?.tracker||TRACKER_HOME)}"></div></div><div class="form-grid" style="margin-top:12px"><div class="field"><label>Public bio</label><textarea id="p-bio" class="textarea">${esc(p?.bio||'')}</textarea></div><div class="field"><label>Private coaching notes</label><textarea id="p-private" class="textarea">${esc(p?.private||'')}</textarea></div></div>`,()=>{const accountId=value('p-account');if(!value('p-name').trim()||!accountId){toast('Player and account required','Every player must be linked to a web account.');return;}if(p?.accountId&&p.accountId!==accountId){const old=userById(p.accountId);if(old)old.linkedPlayerId=null;}const id=p?.id||crypto.randomUUID();const obj={...p,id,accountId,team:value('p-team'),name:value('p-name').trim(),rl:value('p-role')==='Coach'?(p?.rl||''):value('p-rl')||value('p-name').trim(),discord:value('p-discord'),role:value('p-role'),m1:numberOrNull('p-m1'),m2:numberOrNull('p-m2'),m3:numberOrNull('p-m3'),tracker:value('p-role')==='Coach'?(p?.tracker||''):value('p-tracker')||TRACKER_HOME,bio:value('p-bio'),private:value('p-private')};const u=userById(accountId);if(u)u.linkedPlayerId=id;state.players=edit?state.players.map(x=>x.id===p.id?obj:x):[obj,...state.players];save();closeModal();render();toast('Saving player',obj.name);});document.getElementById('p-account').value=p?.accountId||'';document.getElementById('p-team').value=p?.team||state.activeTeam;document.getElementById('p-role').value=isRosterCoach(p)?'Coach':p?.role||'Player';const updateRoleFields=()=>{const coach=value('p-role')==='Coach';for(const id of ['p-rl','p-m1','p-m2','p-m3','p-tracker']){const input=document.getElementById(id);input.closest('.field').hidden=coach;input.disabled=coach;}};document.getElementById('p-role').addEventListener('change',updateRoleFields);updateRoleFields();}
function viewPlayer(p){
  if(!p)return;const u=linkedUserForPlayer(p.id);
  if(isRosterCoach(p)){openModal('Coach profile',`<div class="person-profile-head">${u?avatarMarkup(u,'profile-avatar'):''}<div><h2>${esc(p.name)}</h2><p>Coach</p></div></div><div class="card card-pad"><b>Discord:</b> ${esc(p.discord||'—')}</div>`,null,'Close');return;}
  openModal(`Player profile · ${p.name}`,`<div class="person-profile-head">${u?avatarMarkup(u,'profile-avatar'):`<span class="avatar profile-avatar">${esc(initials(p.name))}</span>`}<div><h2>${esc(p.name)}</h2><p>${esc(p.role)} · ${esc(state.teams.find(t=>t.id===p.team)?.name||'Team')}</p>${u?`<button class="inline-person" data-user-profile="${u.id}">@${esc(u.username)} · ${esc(u.displayName)}</button>`:''}</div></div><div class="kpis"><div class="card kpi"><div class="label">Peak 1s</div><div class="value">${p.m1??'—'}</div></div><div class="card kpi"><div class="label">Peak 2s</div><div class="value">${p.m2??'—'}</div></div><div class="card kpi"><div class="label">Peak 3s</div><div class="value">${p.m3??'—'}</div></div><div class="card kpi"><div class="label">Web account</div><div class="value small-value">${u?esc(u.username):'—'}</div></div></div><div class="card card-pad"><p><b>RL Tracker:</b> <a class="tracker-link" href="${esc(safeUrl(p.tracker)||TRACKER_HOME)}" target="_blank" rel="noopener">RL Tracker Link ↗</a></p><p><b>Discord:</b> ${esc(p.discord||'—')}</p><p>${esc(p.bio||'No public notes.')}</p></div>`,null,'Close');
  document.querySelectorAll('[data-user-profile]').forEach(b=>b.onclick=()=>{closeModal();openUserPublicProfile(userById(b.dataset.userProfile));});
}
function availabilityModal(a){openModal('Edit availability',`<div class="form-grid"><div class="field"><label>Date</label><input id="ae-date" class="input" type="date" value="${esc(a.date)}"></div><div class="field"><label>From</label><input id="ae-from" class="input" type="time" value="${esc(a.from)}"></div><div class="field"><label>Until</label><input id="ae-until" class="input" type="time" value="${esc(a.until)}"></div></div>`,()=>{if(value('ae-from')>=value('ae-until')){toast('Invalid time range');return;}a.date=value('ae-date');a.from=value('ae-from');a.until=value('ae-until');save();closeModal();render();});}

function resultModal(r=null){
  openModal(r?'Edit result':'Add result',`<div class="form-grid three"><div class="field"><label>Type</label><select id="r-type" class="select"><option value="tournament">Tournament</option><option value="league">League</option></select></div><div class="field"><label>Date</label><input id="r-date" type="date" class="input" value="${esc(r?.date||today())}"></div><div class="field"><label>Competition</label><input id="r-event" class="input" value="${esc(r?.event||'')}"></div><div class="field"><label>Stage / round</label><input id="r-stage" class="input" value="${esc(r?.stage||'')}"></div><div class="field"><label>Placement</label><input id="r-placement" class="input" placeholder="1st, 3rd-4th, 2nd after R5..." value="${esc(r?.placement||'')}"></div><div class="field"><label>Prize money ($)</label><input id="r-prize" class="input" type="number" min="0" step="1" value="${Number(r?.prizeMoney??0)}"></div></div><p class="profile-note">Results pages store placement and prize money instead of a match-score feed.</p>`,()=>{const obj={id:r?.id||crypto.randomUUID(),team:state.activeTeam,type:value('r-type'),date:value('r-date'),event:value('r-event')||'Competition',stage:value('r-stage'),result:r?.result||'pending',placement:value('r-placement')||'—',prizeMoney:Math.max(0,Number(value('r-prize')||0)||0)};state.results=r?state.results.map(x=>x.id===r.id?{...x,...obj}:x):[obj,...state.results];save();closeModal();render();});document.getElementById('r-type').value=r?.type||state.resultTab;
}
function leagueModal(){openModal('Add league',`<div class="form-grid"><div class="field"><label>Name</label><input id="l-name" class="input"></div><div class="field"><label>Start date</label><input id="l-date" type="date" class="input" value="${today()}"></div><div class="field"><label>Stage</label><input id="l-stage" class="input" value="Registration"></div><div class="field"><label>Participants (comma separated)</label><textarea id="l-participants" class="textarea">${esc(team().name)}, Opponent A, Opponent B, Opponent C</textarea></div></div>`,()=>{const participants=value('l-participants').split(',').map(x=>x.trim()).filter(Boolean);state.leagues.push({id:crypto.randomUUID(),team:state.activeTeam,name:value('l-name')||'New League',date:value('l-date'),prize:'0',stage:value('l-stage')||'Registration',status:'Upcoming',participants,config:{pointsWin:3,pointsLoss:0,criteria:['points','seriesDiff','gameDiff'],seeds:Object.fromEntries(participants.map((name,i)=>[name,i+1])),visible:{played:true,wins:true,losses:true,points:true,seriesDiff:true,gameDiff:true,goalsFor:false,goalDiff:false}},playoffs:defaultPlayoffState()});save();closeModal();render();});}
function syncLeagueResultFromGame(g,l){
  if(!g.played)return;
  const own=team().name;
  if(g.home!==own&&g.away!==own)return;
  const ours=g.home===own?g.homeSeries:g.awaySeries,theirs=g.home===own?g.awaySeries:g.homeSeries;
  const rows=computeStandings(l),rank=rows.findIndex(r=>r.team===own)+1;
  const existing=state.results.find(r=>r.sourceLeagueGameId===g.id);
  const obj={id:existing?.id||crypto.randomUUID(),sourceLeagueGameId:g.id,team:state.activeTeam,type:'league',leagueId:l.id,date:g.date,event:l.name,result:ours>theirs?'win':'loss',placement:rank?`${ordinal(rank)} after Round ${g.round}`:'—',stage:`Round ${g.round}`,prizeMoney:Number(existing?.prizeMoney??0)||0};
  state.results=existing?state.results.map(r=>r.id===existing.id?obj:r):[obj,...state.results];
}
function leagueGameModal(l,played){openModal(played?'Add played match':'Add fixture',`<div class="form-grid three"><div class="field"><label>Round</label><input id="lg-round" type="number" class="input" value="1"></div><div class="field"><label>Date</label><input id="lg-date" type="date" class="input" value="${today()}"></div><div class="field"><label>Home</label><select id="lg-home" class="select">${l.participants.map(t=>`<option>${esc(t)}</option>`).join('')}</select></div><div class="field"><label>Away</label><select id="lg-away" class="select">${l.participants.map(t=>`<option>${esc(t)}</option>`).join('')}</select></div>${played?`<div class="field"><label>Home series</label><input id="lg-hs" type="number" class="input" value="3"></div><div class="field"><label>Away series</label><input id="lg-as" type="number" class="input" value="1"></div><div class="field"><label>Home goals</label><input id="lg-hg" type="number" class="input" value="10"></div><div class="field"><label>Away goals</label><input id="lg-ag" type="number" class="input" value="7"></div>`:''}</div>`,()=>{if(value('lg-home')===value('lg-away')){toast('Teams must be different');return;}const game={id:crypto.randomUUID(),leagueId:l.id,round:+value('lg-round'),date:value('lg-date'),home:value('lg-home'),away:value('lg-away'),homeSeries:played?+value('lg-hs'):null,awaySeries:played?+value('lg-as'):null,homeGoals:played?+value('lg-hg'):null,awayGoals:played?+value('lg-ag'):null,played};state.leagueGames.push(game);if(played)syncLeagueResultFromGame(game,l);save();closeModal();render();});}
function leagueGameEditModal(l,g){openModal(g.played?'Edit played match':'Edit fixture',`<div class="form-grid three"><div class="field"><label>Round</label><input id="lge-round" type="number" class="input" value="${g.round}"></div><div class="field"><label>Date</label><input id="lge-date" type="date" class="input" value="${g.date}"></div><div class="field"><label>Home</label><select id="lge-home" class="select">${l.participants.map(t=>`<option ${t===g.home?'selected':''}>${esc(t)}</option>`).join('')}</select></div><div class="field"><label>Away</label><select id="lge-away" class="select">${l.participants.map(t=>`<option ${t===g.away?'selected':''}>${esc(t)}</option>`).join('')}</select></div><div class="field"><label>Played</label><select id="lge-played" class="select"><option value="false">No</option><option value="true">Yes</option></select></div><div class="field"><label>Home series</label><input id="lge-hs" type="number" class="input" value="${g.homeSeries??''}"></div><div class="field"><label>Away series</label><input id="lge-as" type="number" class="input" value="${g.awaySeries??''}"></div><div class="field"><label>Home goals</label><input id="lge-hg" type="number" class="input" value="${g.homeGoals??''}"></div><div class="field"><label>Away goals</label><input id="lge-ag" type="number" class="input" value="${g.awayGoals??''}"></div></div>`,()=>{g.round=+value('lge-round');g.date=value('lge-date');g.home=value('lge-home');g.away=value('lge-away');g.played=value('lge-played')==='true';g.homeSeries=numberOrNull('lge-hs');g.awaySeries=numberOrNull('lge-as');g.homeGoals=numberOrNull('lge-hg');g.awayGoals=numberOrNull('lge-ag');if(g.played)syncLeagueResultFromGame(g,l);save();closeModal();render();});document.getElementById('lge-played').value=String(g.played);}
function leagueResultModal(g){openModal(`Enter result · ${g.home} vs ${g.away}`,`<div class="form-grid"><div class="field"><label>${esc(g.home)} series</label><input id="lr-hs" type="number" class="input" value="3"></div><div class="field"><label>${esc(g.away)} series</label><input id="lr-as" type="number" class="input" value="1"></div><div class="field"><label>${esc(g.home)} goals</label><input id="lr-hg" type="number" class="input" value="10"></div><div class="field"><label>${esc(g.away)} goals</label><input id="lr-ag" type="number" class="input" value="7"></div></div>`,()=>{g.homeSeries=+value('lr-hs');g.awaySeries=+value('lr-as');g.homeGoals=+value('lr-hg');g.awayGoals=+value('lr-ag');g.played=true;const l=state.leagues.find(x=>x.id==g.leagueId);if(l)syncLeagueResultFromGame(g,l);save();closeModal();render();});}
function moveCalendar(delta){let[y,m]=state.calendarCursor.split('-').map(Number);m+=delta;if(m<1){m=12;y--;}if(m>12){m=1;y++;}state.calendarCursor=`${y}-${String(m).padStart(2,'0')}`;save();render();}
function eventDetailModal(e){
  if(!e)return;const invitedIds=eventInvitedUserIds(e),canEdit=!e.source&&(isAdmin()||e.creatorUserId===state.currentUserId),creator=userById(e.creatorUserId);
  openModal(e.title,`<div class="detail-lines"><p><b>Date:</b> ${dateFmt(e.date)} · ${esc(e.time)}</p><p><b>Priority:</b> ${priorityBadge(e)}</p><p><b>Created by:</b> ${creator?`<button class="inline-person" data-user-profile="${creator.id}">${esc(creator.displayName)}</button>`:'Unknown'}</p><div class="invite-summary">${(e.invitedTeamIds||[]).map(id=>`<span class="invite-pill">Team: ${esc(state.teams.find(t=>t.id===id)?.name||id)}</span>`).join('')}${invitedIds.map(id=>{const u=userById(id);return u?`<button class="invite-pill invite-person" data-user-profile="${u.id}">${esc(u.displayName)}</button>`:`<span class="invite-pill">${esc(id)}</span>`;}).join('')}</div>${e.hiddenFromAdmins?'<p class="profile-note">Hidden from non-invited administrators.</p>':''}</div>${canEdit?'<div class="card-actions"><button class="btn" id="event-edit">Edit</button><button class="btn danger" id="event-delete">Delete</button></div>':''}`,null,'Close');
  document.querySelectorAll('[data-user-profile]').forEach(b=>b.onclick=()=>{closeModal();openUserPublicProfile(userById(b.dataset.userProfile));});
  if(canEdit){document.getElementById('event-edit').onclick=()=>{closeModal();eventModal(e);};document.getElementById('event-delete').onclick=()=>{closeModal();confirmModal('Delete calendar entry?','This removes the event for everyone.',()=>{state.events=state.events.filter(x=>x.id!==e.id);save();render();});};}
}
function invitePicker(kind,items,selectedIds=[]){
  const isTeam=kind==='team';
  return `<div class="multi-picker"><input class="input picker-search" data-picker-search="${kind}" placeholder="Search ${isTeam?'team / roster':'user'} by name..."><div class="picker-list" data-picker-list="${kind}">${items.map(item=>{const id=isTeam?item.id:item.id,label=isTeam?item.name:`${item.displayName} · @${item.username}`,meta=isTeam?item.code:item.roleLabel;return`<label class="picker-option" data-picker-option="${kind}" data-picker-name="${esc(label.toLowerCase())}"><input type="checkbox" ${isTeam?`data-invite-team="${id}"`:`data-invite-user="${id}"`} ${selectedIds.includes(id)?'checked':''}><span><b>${esc(label)}</b><small>${esc(meta)}</small></span></label>`;}).join('')}</div></div>`;
}
function directInvitedUsersForEvent(e){
  if(e?.directInvitedUserIds)return e.directInvitedUserIds;
  if(!e)return[];
  const viaTeams=new Set();for(const tid of e.invitedTeamIds||[]){for(const p of playersForTeam(tid)){if(p.accountId)viaTeams.add(p.accountId);}}
  return (e.invitedUserIds||[]).filter(id=>id!==e.creatorUserId&&!viaTeams.has(id));
}
function bindInvitePickers(){
  document.querySelectorAll('[data-picker-search]').forEach(input=>input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase(),kind=input.dataset.pickerSearch;document.querySelectorAll(`[data-picker-option="${kind}"]`).forEach(row=>{const name=row.dataset.pickerName||'';row.style.display=!q||name.startsWith(q)?'flex':'none';});}));
}
function eventNotificationRecipients(e){
  const ids=new Set(directInvitedUsersForEvent(e));
  for(const teamId of e?.invitedTeamIds||[])for(const player of playersForTeam(teamId))if(player.accountId)ids.add(player.accountId);
  return ids;
}
function eventModal(e=null){
  const now=new Date(),localDate=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-'),localTime=[now.getHours(),now.getMinutes()].map(n=>String(n).padStart(2,'0')).join(':');
  const oldInvited=e?eventNotificationRecipients(e):new Set(),selectedDirect=directInvitedUsersForEvent(e),selectedTeams=e?.invitedTeamIds||[];
  openModal(e?'Edit calendar entry':'Add calendar entry',`<div class="form-grid"><div class="field"><label>Title</label><input id="e-title" class="input" value="${esc(e?.title||'')}"></div><div class="field"><label>Date</label><input id="e-date" type="date" class="input" value="${esc(e?.date??localDate)}"></div><div class="field"><label>Time</label><input id="e-time" type="time" class="input" value="${esc(e?.time??localTime)}"></div><div class="field"><label for="e-priority">Priority</label><select id="e-priority" class="select">${Object.entries(EVENT_PRIORITIES).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></div></div><div class="invite-picker-grid"><div class="field"><label>Invite team / roster</label>${invitePicker('team',state.teams,selectedTeams)}</div><div class="field"><label>Invite user / users</label>${invitePicker('user',state.users,selectedDirect)}</div></div>${!isAdmin()?`<label class="check-item privacy-check"><input id="e-hide-admins" type="checkbox" ${e?.hiddenFromAdmins?'checked':''}>Hide from administrators unless an administrator is invited directly or through a roster</label>`:''}<p class="profile-note">Your own entries are always visible to you. Select yourself under Invite users, or invite your roster, to receive a notification too.</p>`,()=>{
    const teamIds=[...document.querySelectorAll('[data-invite-team]:checked')].map(x=>x.dataset.inviteTeam),directUserIds=[...document.querySelectorAll('[data-invite-user]:checked')].map(x=>x.dataset.inviteUser),creator=e?.creatorUserId||state.currentUserId;
    let invitedUserIds=[...new Set([creator,...directUserIds])];
    for(const tid of teamIds){for(const p of playersForTeam(tid)){if(p.accountId)invitedUserIds.push(p.accountId);}}
    invitedUserIds=[...new Set(invitedUserIds)];
    const adminIds=state.users.filter(u=>u.role==='admin').map(u=>u.id);let hide=!isAdmin()&&document.getElementById('e-hide-admins')?.checked;if(hide&&invitedUserIds.some(id=>adminIds.includes(id)))hide=false;
    const obj={...e,id:e?.id||crypto.randomUUID(),creatorUserId:creator,title:value('e-title')||'Untitled event',date:value('e-date'),time:value('e-time'),duration:60,type:e?.type||'Meeting',priority:value('e-priority'),directInvitedUserIds:directUserIds,invitedUserIds,invitedTeamIds:teamIds,hiddenFromAdmins:hide};
    state.events=e?state.events.map(x=>x.id===e.id?obj:x):[...state.events,obj];
    for(const uid of eventNotificationRecipients(obj)){if(oldInvited.has(uid))continue;createNotification(uid,'Calendar invitation',`You were invited to ${obj.title}.`,'calendar');}
    save();closeModal();render();toast('Saving calendar entry');
  });
  document.getElementById('e-priority').value=eventPriority(e);bindInvitePickers();
}
function createNotification(userId,title,text,view){state.notifications.push({id:crypto.randomUUID()+Math.floor(Math.random()*1000),userId,title,text,view,read:false,created:new Date().toISOString()});}
function openUserPublicProfile(u){
  if(!u)return;const p=linkedPlayerForUser(u.id);
  openModal(`Profile · ${u.displayName}`,`<div class="person-profile-head">${avatarMarkup(u,'profile-avatar')}<div><h2>${esc(u.displayName)}</h2><p>@${esc(u.username)} · ${esc(u.roleLabel)}</p>${p?`<button class="inline-person" data-player-view="${p.id}">${esc(p.name)} · ${esc(p.role)}</button>`:''}</div></div><div class="card card-pad"><p>${esc(u.bio||'No bio added.')}</p><div class="social-links">${profileSocialLinks(u)}</div></div>`,null,'Close');
  document.querySelectorAll('[data-player-view]').forEach(b=>b.onclick=()=>{closeModal();viewPlayer(playerById(b.dataset.playerView));});
}
function openProfileModal(tab='profile',selectedNotificationId=null){const u=currentUser(),ns=currentNotifications();openModal('My profile',`<div class="profile-tabs"><button class="profile-tab ${tab==='profile'?'active':''}" data-profile-tab="profile">Profile</button><button class="profile-tab ${tab==='notifications'?'active':''}" data-profile-tab="notifications">Notification inbox ${unreadNotifications().length?`(${unreadNotifications().length})`:''}</button></div><div id="profile-tab-body">${tab==='profile'?profileTabMarkup(u)+passwordChangeMarkup():profileNotificationsMarkup(ns,selectedNotificationId)}</div>`,null,'Close');document.querySelectorAll('[data-profile-tab]').forEach(b=>b.onclick=()=>openProfileModal(b.dataset.profileTab));bindProfileBody(tab,u);}
function profileTabMarkup(u){

  return `<div class="profile-layout profile-layout-v6"><div class="profile-avatar-wrap"><div class="avatar-editor-stage" id="avatar-stage">${u.avatarData?`<img id="avatar-editor-img" src="${esc(safeUrl(u.avatarData, true))}">`:`<span id="avatar-editor-placeholder">${esc(u.initials)}</span>`}</div><input id="profile-image" class="file-input wide-file" type="file" accept="image/*,.gif"><p class="profile-note">PNG, JPG, WEBP and animated GIF are supported. Your photo is automatically centered and fitted.</p></div><div><div class="form-grid"><div class="field"><label>Display name</label><input id="profile-name" class="input" value="${esc(u.displayName)}"></div><div class="field"><label>Discord name</label><input id="profile-discord" class="input" value="${esc(u.discord||'')}"></div>${profileSocialFields(u)}</div><div class="field" style="margin-top:10px"><label>Bio</label><textarea id="profile-bio" class="textarea">${esc(u.bio||'')}</textarea></div><div class="card-actions" style="margin-top:12px"><button class="btn primary" id="profile-save">Save profile</button>${profileSocialLinks(u)}</div></div></div>`;
}
function profileNotificationsMarkup(ns,selectedNotificationId=null){const selected=ns.find(n=>n.id==selectedNotificationId)||ns[0];return`<div class="mailbox"><aside class="mailbox-list"><div class="mailbox-toolbar"><div><b>Inbox</b><small>${ns.length} messages · ${unreadNotifications().length} unread</small></div><button class="link-btn" id="profile-mark-all-read">Mark all read</button></div><div class="mailbox-scroll">${ns.length?ns.map(n=>`<button class="mail-row ${n.read?'':'unread'} ${selected?.id===n.id?'selected':''}" data-mail-open="${n.id}"><span class="notification-dot"></span><span><b>${esc(n.title)}</b><small>${esc(n.text)}</small><em>${esc(n.created||'')}</em></span></button>`).join(''):'<div class="empty">No notifications.</div>'}</div></aside><section class="mailbox-reader">${selected?`<div class="mail-reader-head"><span class="tag ${selected.read?'':'red'}">${selected.read?'Read':'Unread'}</span><small>${esc(selected.created||'')}</small></div><h2>${esc(selected.title)}</h2><p>${esc(selected.text)}</p><div class="card-actions"><button class="btn primary" data-mail-go="${selected.id}">Open related page</button><button class="btn" data-mail-toggle="${selected.id}">${selected.read?'Mark unread':'Mark read'}</button></div>`:'<div class="empty">Select a notification.</div>'}</section></div>`;}
function bindProfileBody(tab,u){
  if(tab==='profile'){
    bindPasswordChange();
    let pendingAvatar=u.avatarData||'';
    const stage=document.getElementById('avatar-stage');
    document.getElementById('profile-image')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>200*1024){toast('Image too large','Use a PNG, JPEG, WebP or GIF smaller than 200 KB.');e.target.value='';return;}const reader=new FileReader();reader.onload=()=>{pendingAvatar=String(reader.result);stage.innerHTML=`<img id="avatar-editor-img" src="${esc(safeUrl(pendingAvatar, true))}">`;};reader.readAsDataURL(file);});
    document.getElementById('profile-save')?.addEventListener('click',()=>{u.displayName=value('profile-name')||u.displayName;u.initials=initials(u.displayName);u.discord=value('profile-discord');for(const social of PROFILE_SOCIALS)u[social.key]=value('profile-'+social.id).trim();u.bio=value('profile-bio');u.avatarData=pendingAvatar;u.avatarScale=1;u.avatarX=0;u.avatarY=0;save();closeModal();render();toast('Saving profile');});
  }else{
    document.getElementById('profile-mark-all-read')?.addEventListener('click',()=>{state.notifications.filter(n=>n.userId===state.currentUserId).forEach(n=>n.read=true);save();openProfileModal('notifications');});
    document.querySelectorAll('[data-mail-open]').forEach(b=>b.onclick=()=>openProfileModal('notifications',b.dataset.mailOpen));
    document.querySelectorAll('[data-mail-toggle]').forEach(b=>b.onclick=()=>{const n=state.notifications.find(x=>x.id==b.dataset.mailToggle);if(n){n.read=!n.read;save();openProfileModal('notifications',n.id);}});
    document.querySelectorAll('[data-mail-go]').forEach(b=>b.onclick=()=>{const n=state.notifications.find(x=>x.id==b.dataset.mailGo);if(n){n.read=true;save();closeModal();if(canAccess(n.view)){state.view=n.view;render();}}});
  }
}
function openModal(title,body,onSave,saveLabel='Save'){document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="modal"><div class="modal-head"><h3>${esc(title)}</h3><button class="close" id="modal-close">×</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn" id="modal-cancel">Close</button>${onSave?`<button class="btn primary" id="modal-save">${esc(saveLabel)}</button>`:''}</div></div></div>`;document.getElementById('modal-close').onclick=closeModal;document.getElementById('modal-cancel').onclick=closeModal;document.getElementById('modal-backdrop').onclick=e=>{if(e.target.id==='modal-backdrop')closeModal();};if(onSave)document.getElementById('modal-save').onclick=onSave;}
function closeModal(){document.getElementById('modal-root').innerHTML='';}
function confirmModal(title,msg,yes){openModal(title,`<p class="page-sub">${esc(msg)}</p>`,()=>{closeModal();yes();},'Confirm');}
function toast(title,msg=''){const n=document.createElement('div');n.className='toast';n.innerHTML=`<strong>${esc(title)}</strong>${msg?`<span>${esc(msg)}</span>`:''}`;document.getElementById('toast-root').appendChild(n);setTimeout(()=>n.remove(),2600);}
function value(id){return document.getElementById(id)?.value||'';}
function numberOrNull(id){const v=value(id);return v===''?null:Number(v);}
function render(){if(!currentUser())return;ensureAccess();const views={overview,roster,availability,results,league,calendar,admin};document.getElementById('app').innerHTML=(views[state.view]||overview)();bindCommon();bindView();updateSyncStatus();}
startManager();

