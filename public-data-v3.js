import {matchesForNextDay, todayInBudapest} from './public-matches.mjs';
import {rosterRole, sortedRoster, teamRole} from './public-roster.mjs?v=20260930-team-roles';

const teamRoutes = {
  '/teams/holofyrn-esport/': 'main',
  '/teams/holofyrn-academy/': 'academy',
  '/teams/rls-holofyrn-esport/': 'rls',
  '/teams/rls-holofyrn-academy/': 'rls-academy',
  '/teams/rls-holofyrn-elet/': 'rls-eldr',
  '/teams/holofyrn-shadows/': 'shadows',
  '/teams/holofyrn-vanguards/': 'vanguards',
};
const teamNames = {
  main: 'HoloFyrn Esport', academy: 'HoloFyrn Academy',
  rls: 'RLS HoloFyrn Esport', 'rls-academy': 'RLS HoloFyrn Academy',
  'rls-eldr': 'RLS HoloFyrn Élet',
  shadows: 'HoloFyrn Shadows',
  vanguards: 'Holofyrn Vanguards',
};
const portraits = {kenz: 'Kenz-profile.webp', eggy: 'NoPicPlayer.webp', interz: 'interz.webp'};
let publicData = null;
let loadError = false;
let matchCountdownTimer = null;

function playerTeams(player) {
  return Array.isArray(player.teamIds) && player.teamIds.length ? player.teamIds : [player.team];
}

function onTeam(player, team) {
  return playerTeams(player).includes(team);
}

function teamLink(team) {
  return Object.entries(teamRoutes).find(([, id]) => id === team)?.[0] || '/teams/';
}

function playerLink(player) {
  const currentTeam = teamRoutes[decodeURIComponent(location.hash.slice(1))];
  const team = currentTeam && onTeam(player, currentTeam) ? currentTeam : player.team;
  return `#/players/${encodeURIComponent(team)}/${encodeURIComponent(player.name)}/`;
}

function portrait(player) {
  if (typeof player.imageUrl === 'string' && /^https:\/\//i.test(player.imageUrl)) return player.imageUrl;
  const name = player.name.trim().toLowerCase();
  if (name === 'kenz') return 'assets/Kenz-profile.webp';
  if (name === 'zemsta') return 'assets/zemsta-1200.webp';
  if (name === 'qex') return 'Ppic/Qex.webp';
  return player.team === 'main' && portraits[name] ? `assets/${portraits[name]}` : 'assets/NoPicPlayer.webp';
}

function translated(en, hu) {
  const span = document.createElement('span');
  span.dataset.en = en;
  span.dataset.hu = hu;
  span.textContent = document.documentElement.lang === 'hu' ? hu : en;
  return span;
}

function emptyMessage(en, hu) {
  const p = document.createElement('p');
  p.append(translated(en, hu));
  return p;
}

function playerCard(player, index) {
  const card = document.createElement('a');
  card.className = 'player-card';
  card.href = playerLink(player);
  const image = document.createElement('div');
  image.className = 'player-image public-player-image';
  const photo = portrait(player);
  if (photo) {
    image.classList.add('has-portrait');
    const artwork = document.createElement('img');
    artwork.className = 'player-image-artwork';
    artwork.src = photo;
    artwork.alt = '';
    artwork.setAttribute('aria-hidden', 'true');
    artwork.loading = 'lazy';
    artwork.decoding = 'async';
    image.append(artwork);
    const overlay = document.createElement('span');
    overlay.className = 'player-image-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    image.append(overlay);
  }
  const info = document.createElement('div');
  info.className = 'player-info';
  const copy = document.createElement('div');
  const small = document.createElement('span');
  small.className = 'small-label';
  const role = rosterRole(player.role);
  const labels = {player:['ROCKET LEAGUE PLAYER','ROCKET LEAGUE JÁTÉKOS'],sub:['SUBSTITUTE','CSEREJÁTÉKOS'],coach:['COACH','EDZŐ'],manager:['MANAGER','MENEDZSER']};
  small.append(translated(...labels[role]));
  const name = document.createElement('h3');
  name.textContent = player.name;
  copy.append(small, name);
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  info.append(copy, arrow);
  card.append(image, info);
  return card;
}

function profilePlayer(route, players) {
  const match = route.match(/^\/players\/([^/]+)\/(.+)\/$/);
  if (match) return players.find(player => onTeam(player, match[1]) && player.name === match[2]);
  const legacy = route.match(/^\/players\/(kenz|eggy|interz)\/$/i);
  return legacy && players.find(player => onTeam(player, 'main') && player.name.toLowerCase() === legacy[1].toLowerCase());
}

function renderProfile(route, players) {
  const player = profilePlayer(route, players);
  const target = document.querySelector('#main .player-profile');
  if (!target || !route.startsWith('/players/')) return;
  if (!player) {
    if (target.id === 'public-player-profile') target.replaceChildren(emptyMessage(loadError ? 'Player data is temporarily unavailable.' : 'Player not found.', loadError ? 'A játékosadatok átmenetileg nem érhetők el.' : 'A játékos nem található.'));
    return;
  }
  const team = playerTeams(player).map(id => teamNames[id] || id).join(', ');
  const routeTeam = route.match(/^\/players\/([^/]+)\//)?.[1];
  const selectedTeam = routeTeam && onTeam(player, routeTeam) ? routeTeam : player.team;
  const back = `#${teamLink(selectedTeam)}`;
  const breadcrumbs = document.createElement('div');
  breadcrumbs.className = 'breadcrumbs';
  const teamAnchor = document.createElement('a');
  teamAnchor.href = back;
  teamAnchor.textContent = teamNames[selectedTeam] || selectedTeam;
  breadcrumbs.append(teamAnchor, document.createTextNode(' / ' + player.name));
  const grid = document.createElement('div');
  grid.className = 'profile-grid';
  const photo = document.createElement('div');
  photo.className = 'profile-photo public-profile-photo';
  const isZemstaAcademy = player.team === 'academy' && player.name.trim().toLowerCase() === 'zemsta';
  const isKenzMain = player.team === 'main' && player.name.trim().toLowerCase() === 'kenz';
  const photoFile = player.imageUrl ? portrait(player) : isZemstaAcademy ? 'assets/zemsta-1200.webp' : portrait(player);
  if (photoFile) {
    photo.classList.add('has-portrait');
    photo.style.backgroundImage = `linear-gradient(0deg,#131010,transparent 35%),url('${photoFile}')`;
    if (isZemstaAcademy || isKenzMain) {
      photo.classList.add('signed-profile-photo');
      const signature = document.createElement('img');
      signature.className = isKenzMain ? 'profile-signature kenz-signature' : 'profile-signature';
      signature.src = isKenzMain ? 'assets/kenz-signature-1200.webp' : 'assets/zemsta-signature-1200.webp';
      signature.alt = '';
      signature.setAttribute('aria-hidden', 'true');
      photo.append(signature);
    }
    if (photoFile === 'assets/interz.webp') {
      const illustration = document.createElement('em');
      illustration.className = 'concept-label';
      illustration.append(translated('Illustrative portrait', 'Illusztráció'));
      photo.append(illustration);
    }
  }
  const copy = document.createElement('div');
  copy.className = 'profile-copy';
  const eyebrow = document.createElement('div');
  eyebrow.className = 'eyebrow';
  eyebrow.append(document.createElement('i'), translated('PLAYER PROFILE', 'JÁTÉKOSPROFIL'));
  const title = document.createElement('h1');
  title.textContent = player.name;
  const role = document.createElement('p');
  role.className = 'profile-role';
  const roleLabels = {player:['Rocket League player','Rocket League játékos'],sub:['Substitute','Cserejátékos'],coach:['Coach','Edző'],manager:['Manager','Menedzser']};
  role.append(translated(...roleLabels[rosterRole(player.role)]), document.createTextNode(' · ' + team));
  const divider = document.createElement('div');
  divider.className = 'profile-divider';
  const facts = document.createElement('div');
  facts.className = 'profile-facts';
  for (const [en, hu, value] of [['TEAM', 'CSAPAT', team], ['ROLE', 'SZEREPKÖR', player.role || null]]) {
    const fact = document.createElement('div');
    const label = document.createElement('span');
    label.append(translated(en, hu));
    const content = document.createElement('strong');
    if (value) content.textContent = value;
    else content.append(translated('Player', 'Játékos'));
    fact.append(label, content);
    facts.append(fact);
  }
  const aboutTitle = document.createElement('h2');
  aboutTitle.append(translated('About the player', 'A játékosról'));
  const hasZemstaBio = selectedTeam === 'academy' && player.name.trim().toLowerCase() === 'zemsta';
  const hasKenzBio = player.name.trim().toLowerCase() === 'kenz';
  const about = document.createElement(hasZemstaBio || hasKenzBio ? 'div' : 'p');
  about.className = 'profile-bio';
  if (hasZemstaBio) {
    const paragraphs = [
      [
        "I'm Zemsta, captain of the HoloFyrn Esport Academy team. My main goal right now is to bring out the best in the club's players and help them keep developing both mentally and as esports competitors.",
        'Zemsta vagyok, a HoloFyrn Esport Academy csapatkapitánya. Jelenlegi fő célom, hogy az egyesület játékosaiból a lehető legtöbbet hozzam ki, és segítsem őket abban, hogy folyamatosan fejlődjenek mind mentálisan, mind esportolóként.'
      ],
      [
        'The Academy is made up of talented and motivated players who have the potential to compete at a higher level in the future. Creating an environment where everyone has the opportunity to improve, gain experience and reach their full potential is important to me.',
        'Az Academy olyan tehetséges és motivált játékosokból áll, akikben megvan a potenciál arra, hogy a jövőben magasabb szinten is megállják a helyüket. Fontos számomra, hogy egy olyan környezetet alakítsunk ki, ahol mindenki lehetőséget kap a fejlődésre, tapasztalatszerzésre és arra, hogy kihozza magából a maximumot.'
      ],
      [
        'My long-term goal is to help as many Academy players as possible reach the level needed to join the HoloFyrn main team and prove themselves there as well.',
        'Hosszú távú célom, hogy minél több Academy játékos eljusson arra a szintre, hogy bekerülhessen a HoloFyrn főcsapatába, és ott is bizonyítani tudjon.'
      ]
    ];
    for (const [en, hu] of paragraphs) {
      const paragraph = document.createElement('p');
      paragraph.append(translated(en, hu));
      about.append(paragraph);
    }
  }
  else if (hasKenzBio) {
    const paragraphs = [
  [
    "I'm Kenz, a Rocket League player and manager for HoloFyrn Esports. As a player, I believe in thoughtful, team-focused play, where communication, decision-making and coordination are just as important as individual performance.",
    "Kenz vagyok, a HoloFyrn Esports Rocket League játékosa és managere. Játékosként elsősorban a tudatos, csapatközpontú játékban hiszek, ahol az egyéni teljesitmény mellett a kommunikáció, a döntéshozatal és az összhang is meghatározó szerepet kap."
  ],
  [
    "My goal is to keep taking my own game to a higher level while contributing to the development of the team around me. As a manager, I value creating an environment where every player has the opportunity to reach their full potential.",
    "Célom, hogy folyamatosan magasabb szintre emeljem a saját játékomat, miközben a körülöttem lévő csapat fejlődéséhez is hozzájárulok. Managerként fontosnak tartom, hogy egy olyan környezetet alakitsak ki, ahol minden játékosnak megvan a lehetősége arra, hogy kihozza magából a maximumot."
  ],
  [
    "HoloFyrn is more than a team to me. It is a long-term project we are building to compete both domestically and internationally.",
    "A HoloFyrn számomra több mint egy csapat. Egy hosszú távú projekt, amelyet azért épitűnk, hogy versenyképesek legyünk nemcsak hazai, hanem nemzetközi szinten is."
  ]
];
    for (const [en, hu] of paragraphs) {
      const paragraph = document.createElement('p');
      paragraph.append(translated(en, hu));
      about.append(paragraph);
    }
  }
  else if (player.bio) about.textContent = player.bio;
  else about.append(translated('A personal introduction is coming soon.', 'A személyes bemutatkozás hamarosan érkezik.'));
  const backLink = document.createElement('a');
  backLink.className = 'text-link';
  backLink.href = back;
  backLink.append(translated('Back to team', 'Vissza a csapathoz'), document.createTextNode(' ↗'));
  copy.append(eyebrow, title, role, divider, facts, aboutTitle, about, backLink);
  grid.append(photo, copy);
  target.replaceChildren(breadcrumbs, grid);
  document.title = `${player.name} | HoloFyrn Esport`;
}

function renderPlayers(grid, players, team) {
  if (!grid) return;
  if (!players.length) {
    grid.replaceChildren(emptyMessage(loadError ? 'Player data is temporarily unavailable.' : 'No players listed yet.', loadError ? 'A játékosadatok átmenetileg nem érhetők el.' : 'Még nincsenek játékosok feltüntetve.'));
    return;
  }
  grid.replaceChildren(...sortedRoster(players, team).map((player,index)=>playerCard({...player,role:teamRole(player,team)},index)));
}

function renderUpcomingMatches(matches) {
  const layout = document.querySelector('#main .match-layout');
  if (!layout) return;
  const block = layout.firstElementChild;
  if(matchCountdownTimer){clearInterval(matchCountdownTimer);matchCountdownTimer=null;}
  const now=Date.now(),today=todayInBudapest();
  const future=(Array.isArray(matches)?matches:[]).filter(match=>match?.date>=today&&(!match.time||budapestTimestamp(match.date,match.time)>=now));
  const selected = matchesForNextDay(future);
  const label = document.createElement('span');
  label.className = 'small-label';
  label.append(translated('UPCOMING MATCHES', 'KÖVETKEZŐ MÉRKŐZÉSEK'));
  const heading = document.createElement('strong');
  if (selected.length) {
    const date = new Date(`${selected[0].date}T12:00:00Z`);
    const locale = document.documentElement.lang === 'hu' ? 'hu-HU' : 'en-GB';
    heading.textContent = selected[0].date === todayInBudapest()
      ? (locale === 'hu-HU' ? 'Ma' : 'Today')
      : new Intl.DateTimeFormat(locale, {timeZone:'UTC', year:'numeric', month:'short', day:'numeric'}).format(date);
    const list = document.createElement('div');
    list.className = 'upcoming-match-list';
    for (const match of selected) {
      const row = document.createElement('div');
      row.className = 'upcoming-match-row';
      const sides = document.createElement('span');
      sides.textContent = match.away ? `${match.home} vs ${match.away}` : `${match.home} · ${match.title||'Tournament'}`;
      row.append(sides);
      if(match.type&&match.away){const detail=document.createElement('small');detail.className='upcoming-match-detail';detail.textContent=match.title?`${match.type} · ${match.title}`:match.type;row.append(detail);}
      if (match.time) {
        const time = document.createElement('time');
        time.dateTime = `${match.date}T${match.time}`;
        time.textContent = match.time;
        row.append(time);
      }
      if (match.twitchUrl) {
        const twitch = document.createElement('a');
        twitch.className = 'upcoming-twitch-link';
        twitch.href = match.twitchUrl;
        twitch.target = '_blank';
        twitch.rel = 'noopener noreferrer';
        twitch.setAttribute('aria-label', document.documentElement.lang === 'hu' ? 'Meccs élő közvetítése Twitch-en' : 'Watch the match live on Twitch');
        twitch.title = 'Twitch';
        twitch.innerHTML = '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4.5 0 1.2 3.3v12.1h4v3.3l3.3-3.3h2.6l5.3-5.3V0H4.5zm10.3 9.2-2.7 2.7H9.5l-2.3 2.3v-2.3H4.5V1.6h10.3v7.6zM12.1 3.3h1.6v4.1h-1.6zm-4.3 0h1.6v4.1H7.8z"/></svg>';
        row.append(twitch);
      }
      list.append(row);
    }
    const countdown=document.createElement('span');countdown.className='match-countdown';countdown.setAttribute('aria-live','off');
    const updateCountdown=()=>{
      const next=selected.find(match=>match.time);
      if(!next){countdown.textContent='';countdown.hidden=true;return;}
      const left=budapestTimestamp(next.date,next.time)-Date.now();
      countdown.hidden=false;
      countdown.textContent=left<=0?(document.documentElement.lang==='hu'?'Hamarosan kezdődik':'Starting soon'):`${document.documentElement.lang==='hu'?'Kezdés: ':'Starts in '}${formatCountdown(left)}`;
    };
    updateCountdown();if(selected.some(match=>match.time))matchCountdownTimer=setInterval(updateCountdown,1000);
    block.replaceChildren(label, heading, list, countdown);
  } else {
    heading.append(translated(loadError ? 'Matches temporarily unavailable' : !publicData ? 'Loading matches…' : 'Schedule to be announced',
      loadError ? 'A mérkőzések átmenetileg nem érhetők el' : !publicData ? 'Mérkőzések betöltése…' : 'Időpont hamarosan'));
    block.replaceChildren(label, heading);
  }
  block.classList.add('upcoming-match-block');
  layout.querySelector('.match-symbols')?.remove();
}

function budapestTimestamp(date,time){
  const [year,month,day]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number),utcNoon=Date.UTC(year,month-1,day,12);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utcNoon)).map(part=>[part.type,part.value]));
  const localNoon=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
  return Date.UTC(year,month-1,day,hour,minute)-(localNoon-utcNoon);
}

function formatCountdown(milliseconds){
  const total=Math.max(0,Math.floor(milliseconds/1000)),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
  const clock=[hours,minutes,seconds].map(value=>String(value).padStart(2,'0')).join(':');
  if(document.documentElement.lang==='hu')return days?`${days} nap ${clock}`:clock;
  return days?`${days}d ${clock}`:clock;
}

function resultList(rows, emptyEn, emptyHu) {
  if (!rows.length) return emptyMessage(loadError ? 'Results are temporarily unavailable.' : emptyEn, loadError ? 'Az eredmények átmenetileg nem érhetők el.' : emptyHu);
  const list = document.createElement('ul');
  list.className = 'public-results';
  for (const row of rows.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6)) {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = row.event;
    const details = document.createElement('span');
    details.textContent = [row.date, row.stage, row.placement].filter(Boolean).join(' · ');
    item.append(title, details);
    list.append(item);
  }
  return list;
}

function render() {
  const route = decodeURIComponent(location.hash.slice(1)) || '/';
  if(route!=='/'&&matchCountdownTimer){clearInterval(matchCountdownTimer);matchCountdownTimer=null;}
  const team = teamRoutes[route];
  if (route === '/') renderUpcomingMatches(publicData?.upcomingMatches || []);
  if (!publicData && !loadError) {
    const grid = document.querySelector('#main .players-grid');
    if ((team || route === '/') && grid) grid.replaceChildren(emptyMessage('Loading players…', 'Játékosok betöltése…'));
    if (team) document.querySelectorAll('#main .two-column .info-panel p').forEach(p => p.replaceWith(emptyMessage('Loading results…', 'Eredmények betöltése…')));
    return;
  }
  const players = publicData?.players || [];
  const results = publicData?.results || [];
  renderPublicStaff(route);
  renderPublishedNews(route);
  renderPublicCompetitions(route);
  if (route.startsWith('/players/')) {
    renderProfile(route, players);
    return;
  }
  if (team) {
    renderPlayers(document.querySelector('#main .players-grid'), players.filter(player => onTeam(player, team)), team);
    const panels = document.querySelectorAll('#main .two-column .info-panel');
    if (panels.length >= 2) {
      panels[0].querySelector('p')?.replaceWith(resultList(results.filter(row => row.team === team), 'No results yet.', 'Még nincs eredmény.'));
      panels[1].querySelector('p')?.replaceWith(resultList(results.filter(row => row.team === team && row.type !== 'league'), 'No tournament results yet.', 'Még nincs versenyeredmény.'));
    }
  } else if (route === '/') {
    renderPlayers(document.querySelector('#main .players-grid'), players.filter(player => onTeam(player, 'main')), 'main');
  }
}

function renderPublicStaff(route) {
  const staff = publicData?.staff;
  if (!Array.isArray(staff)) return;
  if (route === '/staff/') {
    const grid = document.querySelector('#main .staff-grid');
    if (grid) grid.replaceChildren(...staff.map((person,index) => staffCard(person,index)));
  }
  if (route === '/') {
    const preview = document.querySelector('#main .staff-preview');
    if (preview) preview.replaceChildren(...staff.slice(0,3).map((person,index) => staffCard(person,index,true)));
  }
  if (route.startsWith('/staff/') && route !== '/staff/') {
    const memberId = route.match(/^\/staff\/member\/([^/]+)\/$/)?.[1];
    const person = staff.find(item => item.profileUrl === `#${route}` || (memberId && item.id === memberId));
    if (document.getElementById('public-staff-profile')) renderStaffProfile(person);
    else if (person) updateStaticStaffBio(person);
  }
}

function appendBio(target,bio) {
  const paragraphs = String(bio || '').split(/\n\s*\n/).map(text=>text.trim()).filter(Boolean);
  if (!paragraphs.length) paragraphs.push(document.documentElement.lang === 'hu' ? 'A bemutatkozás hamarosan érkezik.' : 'A personal introduction is coming soon.');
  for (const text of paragraphs) { const p=document.createElement('p'); p.textContent=text; target.append(p); }
}

function staffText(person, field, language = document.documentElement.lang) {
  const hu = language === 'hu';
  const primary = hu ? `${field}Hu` : `${field}En`;
  const fallback = hu ? `${field}En` : `${field}Hu`;
  return person[primary] || person[fallback] || (field === 'role' ? person.role : person.bio) || '';
}

function updateStaticStaffBio(person) {
  const copy=document.querySelector('#main .staff-profile .profile-copy');
  if(!copy)return;
  const title=copy.querySelector('h1'); if(title)title.textContent=person.name;
  const localizedRole=staffText(person,'role');
  const role=copy.querySelector('.profile-role'); if(role)role.textContent=localizedRole;
  const facts=copy.querySelectorAll('.profile-facts > div');const roleFact=facts[facts.length-1]?.querySelector('strong');
  if(roleFact){
    let localized=roleFact.querySelector('[data-en][data-hu]');
    if(!localized){localized=document.createElement('span');roleFact.replaceChildren(localized);}
    localized.dataset.en=staffText(person,'role','en');localized.dataset.hu=staffText(person,'role','hu');
    localized.textContent=localized.dataset[document.documentElement.lang]||localized.dataset.en;
  }
  const aboutHeading=copy.querySelector('h2');
  if(aboutHeading){copy.querySelector('.profile-bio')?.remove();const old=aboutHeading.nextElementSibling;if(old&&!old.matches('.text-link'))old.remove();const bio=document.createElement('div');bio.className='profile-bio';appendBio(bio,staffText(person,'bio'));aboutHeading.after(bio);}
  document.title=`${person.name} | HoloFyrn Esport`;
}

function renderStaffProfile(person) {
  const target=document.getElementById('public-staff-profile');
  if(!target)return;
  target.replaceChildren();
  if(!person){const p=document.createElement('p');p.textContent=document.documentElement.lang==='hu'?'A menedzser nem található.':'Manager profile not found.';target.append(p);return;}
  document.title=`${person.name} | HoloFyrn Esport`;
  const hu=document.documentElement.lang==='hu';
  const crumb=document.createElement('div');crumb.className='breadcrumbs';const back=document.createElement('a');back.href='#/staff/';back.textContent=hu?'Vezetőség':'Management';crumb.append(back,document.createTextNode(` / ${person.name}`));
  const grid=document.createElement('div');grid.className='profile-grid';const photo=document.createElement('div');photo.className='profile-photo staff-profile-photo';
  if(person.imageUrl){photo.style.backgroundImage=`linear-gradient(0deg,#131010,transparent 35%),url('${person.imageUrl}')`;photo.style.backgroundSize='cover';photo.style.backgroundPosition='center top';}
  if(String(person.id).toLowerCase()==='metalhub'||String(person.name).toLowerCase()==='metalhub'){photo.classList.add('signed-profile-photo');const signature=document.createElement('img');signature.className='profile-signature';signature.src='assets/MetalSign.png';signature.alt='';signature.setAttribute('aria-hidden','true');photo.append(signature);}
  const copy=document.createElement('div');copy.className='profile-copy';const eyebrow=document.createElement('div');eyebrow.className='eyebrow';eyebrow.append(document.createElement('i'),document.createTextNode(hu?'MENEDZSER':'MANAGER'));
  const heading=document.createElement('h1');heading.textContent=person.name;const role=document.createElement('p');role.className='profile-role';role.textContent=staffText(person,'role');const divider=document.createElement('div');divider.className='profile-divider';
  const about=document.createElement('h2');about.textContent=hu?'A menedzserről':'About the manager';const bio=document.createElement('div');bio.className='profile-bio';appendBio(bio,staffText(person,'bio'));
  const link=document.createElement('a');link.className='text-link';link.href='#/staff/';link.textContent=hu?'Vissza a vezetőséghez':'Back to management';copy.append(eyebrow,heading,role,divider,about,bio,link);grid.append(photo,copy);target.append(crumb,grid);
}

function staffCard(person,index,preview=false) {
  const card = document.createElement(preview || person.profileUrl ? 'a' : 'div');
  card.className = preview ? 'staff-preview-public' : 'staff-card';
  if (preview || person.profileUrl) card.href = person.profileUrl || '#/staff/';
  const number = document.createElement('span');
  number.className = preview ? '' : 'staff-number';
  number.textContent = String(index+1).padStart(2,'0');
  card.append(number);
  if (person.imageUrl) {
    const image = document.createElement('img');
    image.className = preview ? 'staff-preview-artwork' : 'staff-avatar staff-avatar-photo';
    image.src = person.imageUrl.startsWith('assets/') ? person.imageUrl : person.imageUrl;
    image.alt = preview ? '' : person.name;
    image.loading = 'lazy'; image.decoding = 'async';
    card.append(image);
  } else {
    const avatar = document.createElement('span');
    avatar.className = preview ? 'staff-preview-initial' : 'staff-avatar';
    avatar.textContent = person.name.slice(0,1).toUpperCase();
    card.append(avatar);
  }
  const name = document.createElement(preview ? 'strong' : 'h2');
  name.textContent = person.name;
  const role = document.createElement(preview ? 'small' : 'p');
  role.textContent = staffText(person,'role');
  card.append(name,role);
  return card;
}

function renderPublishedNews(route) {
  if (route.startsWith('/news/') && route !== '/news/') {
    renderPublicNewsArticle(route);
    return;
  }
  const grids = [...document.querySelectorAll(route === '/news/' ? '#main .news-grid' : '#news .news-grid')];
  const articles = publicData?.news || [];
  if (!articles.length) return;
  grids.forEach(grid => {
    const visible = route === '/news/' ? articles : articles.slice(0, 3);
    grid.replaceChildren(...visible.map(source => {
      const article = localizedNews(source);
      const card = document.createElement('a');
      card.href = `#${newsArticlePath(article)}`; card.className = 'news-card public-news-card';
      const visual = document.createElement('span'); visual.className = 'news-visual news-visual-lines';
      if (typeof article.imageUrl === 'string' && /^(https:\/\/|\/assets\/)/i.test(article.imageUrl)) {
        const image = document.createElement('img');
        image.className = 'news-visual-artwork';
        if (/Rllogo-960\.webp(?:[?#]|$)/i.test(article.imageUrl)) {
          image.classList.add('news-visual-artwork-contained');
          visual.classList.add('news-visual-has-full-logo');
        }
        image.src = article.imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => image.remove(), {once:true});
        visual.append(image);
      }
      const body = document.createElement('span'); body.className = 'news-body';
      const category = document.createElement('span'); category.className = 'pill'; category.textContent = article.category;
      const title = document.createElement('strong'); title.textContent = article.title;
      const summary = document.createElement('span'); summary.className = 'public-news-summary'; summary.textContent = article.summary;
      const action = document.createElement('span'); action.className = 'card-action'; action.textContent = document.documentElement.lang === 'hu' ? 'Olvasd el ↗' : 'Read article ↗';
      body.append(category, title, summary, action); card.append(visual, body);
      return card;
    }));
  });
}

function renderPublicCompetitionsLegacy(route) {
  if (route.startsWith('/competitions/') && route !== '/competitions/') { renderPublicCompetitionDetail(route); return; }
  if (route !== '/competitions/') return;
  const container = document.querySelector('#main .compact-section, #main .competition-list');
  if (!container) return;
  const competitions = (publicData?.competitions || []).filter(item => item && item.titleEn && item.titleHu && /^\d{4}-\d{2}-\d{2}$/.test(item.date));
  if (!competitions.length) return;
  const hu = document.documentElement.lang === 'hu';
  const cards = competitions.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(item => {
    const card = document.createElement('article');
    card.className = 'card competition-card';
    const link = document.createElement('a'); link.className='competition-card-link'; link.href=competitionPath(item);
    const content = document.createElement('div');
    const date = document.createElement('span');
    date.className = 'eyebrow';
    date.textContent = new Intl.DateTimeFormat(hu ? 'hu-HU' : 'en-GB', {year:'numeric',month:'long',day:'numeric'}).format(new Date(`${item.date}T12:00:00`));
    const title = document.createElement('h3');
    title.textContent = hu ? item.titleHu : item.titleEn;
    content.append(date,title);
    const location = hu ? item.locationHu : item.locationEn;
    const description = hu ? item.descriptionHu : item.descriptionEn;
    if (location) { const place=document.createElement('p'); place.textContent=location; content.append(place); }
    if (description) { const copy=document.createElement('p'); copy.textContent=description; content.append(copy); }
    const action=document.createElement('span'); action.className='competition-card-action'; action.textContent=hu?'Verseny megtekint\u00e9se \u2192':'View tournament \u2192';
    link.append(content,action); card.append(link);
    if (item.url && /^https:\/\/[^\s]+$/i.test(item.url)) { const link=document.createElement('a'); link.className='button button-outline'; link.href=item.url; link.target='_blank'; link.rel='noopener noreferrer'; link.textContent=hu?'Részletek és nevezés ↗':'Details and registration ↗'; card.append(link); }
    return card;
  });
  container.classList.remove('compact-section'); container.classList.add('competition-list'); container.replaceChildren(...cards);
}

function renderPublicCompetitions(route) {
  if(route.startsWith('/competitions/')&&route!=='/competitions/'){renderPublicCompetitionDetail(route);return;}
  if(route!=='/competitions/')return;
  const container=document.querySelector('#main .compact-section, #main .competition-list, #main .competition-hub');
  if(!container)return;
  const hu=document.documentElement.lang==='hu';
  const items=(publicData?.competitions||[]).filter(item=>item&&item.titleEn&&item.titleHu&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)).sort((a,b)=>a.date.localeCompare(b.date));
  if(!items.length)return;
  const today=todayInBudapest();
  const filters=document.createElement('div');filters.className='competition-filters';
  const select=(label,options)=>{const el=document.createElement('select');el.setAttribute('aria-label',label);for(const [value,text]of options){const option=document.createElement('option');option.value=value;option.textContent=text;el.append(option);}return el;};
  const game=select(hu?'Játék':'Game',[['all',hu?'Minden játék':'All Games'],['rocket-league','Rocket League']]);
  const status=select(hu?'Állapot':'Status',[['all',hu?'Minden állapot':'All Statuses'],['upcoming',hu?'Közelgő':'Upcoming'],['ongoing',hu?'Folyamatban':'Ongoing'],['finished',hu?'Lezárult':'Finished']]);
  const date=select(hu?'Dátum':'Date',[['all',hu?'Bármikor':'Any Date'],['30',hu?'Következő 30 nap':'Next 30 Days'],['past',hu?'Korábbi versenyek':'Past Tournaments']]);
  const searchBox=document.createElement('label');searchBox.className='competition-search';searchBox.setAttribute('aria-label',hu?'Verseny keresése':'Search tournaments');const icon=document.createElement('span');icon.textContent='⌕';icon.setAttribute('aria-hidden','true');const search=document.createElement('input');search.type='search';search.placeholder=hu?'Verseny keresése…':'Search tournaments…';searchBox.append(icon,search);filters.append(game,status,date,searchBox);
  const section=(titleText,extraClass='')=>{const el=document.createElement('section');el.className=`competition-category ${extraClass}`.trim();const header=document.createElement('header');header.className='competition-category-heading';const title=document.createElement('h2');title.textContent=titleText;header.append(title);const list=document.createElement('div');list.className=extraClass==='upcoming'?'competition-upcoming-grid':'competition-horizontal-list';el.append(header,list);return{el,header,list};};
  const upcoming=section(hu?'Közelgő versenyek':'Upcoming Tournaments','upcoming'),ongoing=section(hu?'Folyamatban':'Ongoing Tournaments'),finished=section(hu?'Lezárult versenyek':'Finished Tournaments');
  const viewAll=(target,value)=>{const button=document.createElement('button');button.type='button';button.className='competition-view-all';button.textContent=hu?'Összes megtekintése →':'View all →';button.addEventListener('click',()=>{status.value=value;date.value='all';render();});target.header.append(button);};
  const lower=document.createElement('div');lower.className='competition-lower-grid';lower.append(ongoing.el,finished.el);viewAll(upcoming,'all');viewAll(finished,'finished');
  const stateOf=item=>item.date>today?'upcoming':item.date===today?'ongoing':'finished';
  const makeCard=(item,kind)=>{const card=document.createElement('article');card.className=`competition-tile competition-tile-${kind}`;const link=document.createElement('a');link.className='competition-tile-link';link.href=competitionPath(item);const visual=document.createElement('div');visual.className='competition-tile-visual';const badge=document.createElement('span');badge.className=`competition-state competition-state-${stateOf(item)}`;badge.textContent=stateOf(item)==='upcoming'?(hu?'KÖZELGŐ':'UPCOMING'):stateOf(item)==='ongoing'?(hu?'ÉLŐ':'LIVE'):(hu?'LEZÁRULT':'FINISHED');visual.append(badge);const body=document.createElement('div');body.className='competition-tile-content';const title=document.createElement('h3');title.textContent=hu?item.titleHu:item.titleEn;const gameMeta=document.createElement('p');gameMeta.className='competition-tile-meta';gameMeta.textContent=item.game||'Rocket League';const dateMeta=document.createElement('p');dateMeta.className='competition-tile-meta';dateMeta.textContent=new Intl.DateTimeFormat(hu?'hu-HU':'en-GB',{year:'numeric',month:'short',day:'numeric'}).format(new Date(`${item.date}T12:00:00`));body.append(title,gameMeta,dateMeta);if(item.prizePool){const prize=document.createElement('p');prize.className='competition-tile-prize';prize.textContent=`🏆 ${item.prizePool} · ${hu?'Díjalap':'Prize Pool'}`;body.append(prize);}const action=document.createElement('span');action.className='competition-card-action';action.textContent=hu?'Részletek →':'View details →';link.append(visual,body,action);card.append(link);return card;};
  const render=()=>{const query=search.value.trim().toLocaleLowerCase(hu?'hu-HU':'en-GB'),now=Date.now();const visible=items.filter(item=>{const name=`${item.titleEn} ${item.titleHu} ${item.format||''} ${item.locationEn||''} ${item.locationHu||''}`.toLocaleLowerCase(hu?'hu-HU':'en-GB');if(game.value==='rocket-league'&&!String(item.game||'Rocket League').toLocaleLowerCase().includes('rocket league'))return false;if(status.value!=='all'&&stateOf(item)!==status.value)return false;if(date.value==='30'&&(item.date<today||new Date(`${item.date}T23:59:59`).getTime()>now+30*86400000))return false;if(date.value==='past'&&item.date>=today)return false;return !query||name.includes(query);});const sets=[[upcoming.list,visible.filter(item=>stateOf(item)==='upcoming'),'No upcoming tournaments.','Nincs közelgő verseny.','upcoming'],[ongoing.list,visible.filter(item=>stateOf(item)==='ongoing'),'No tournaments are currently ongoing.','Jelenleg nincs folyamatban verseny.','horizontal'],[finished.list,visible.filter(item=>stateOf(item)==='finished').sort((a,b)=>b.date.localeCompare(a.date)),'No finished tournaments yet.','Még nincs lezárult verseny.','horizontal']];for(const [list,rows,en,huText,kind]of sets){list.replaceChildren(...rows.map(item=>makeCard(item,kind)));if(!rows.length){const empty=document.createElement('p');empty.className='competition-filter-empty';empty.textContent=hu?huText:en;list.append(empty);}}};
  for(const control of [game,status,date])control.addEventListener('change',render);search.addEventListener('input',render);container.classList.remove('compact-section');container.classList.add('competition-hub');container.replaceChildren(filters,upcoming.el,lower);render();
}

function competitionPath(item) { const id=String(item.id||'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,100); return `#/competitions/${id||'tournament'}/`; }

function renderCompetitionStandings(item, hu) {
  const section=document.createElement('section');section.className='competition-standings-section';
  const heading=document.createElement('h2');heading.textContent=hu?'Tabella':'Standings';section.append(heading);
  const teams=Array.isArray(item.teams)?item.teams.filter(team=>team&&team.id&&team.name):[];
  const rows=new Map(teams.map(team=>[team.id,{team,wins:0,losses:0,gamesWon:0,gamesLost:0}]));
  for(const match of Array.isArray(item.bracketMatches)?item.bracketMatches:[]){
    const a=rows.get(match.teamAId),b=rows.get(match.teamBId),scoreA=Number(match.scoreA),scoreB=Number(match.scoreB);
    if(!a||!b||String(match.scoreA??'').trim()===''||String(match.scoreB??'').trim()===''||!Number.isInteger(scoreA)||!Number.isInteger(scoreB)||scoreA<0||scoreB<0)continue;
    a.gamesWon+=scoreA;a.gamesLost+=scoreB;b.gamesWon+=scoreB;b.gamesLost+=scoreA;
    if(scoreA>scoreB){a.wins++;b.losses++;}else if(scoreB>scoreA){b.wins++;a.losses++;}
  }
  if(!teams.length){const empty=document.createElement('p');empty.className='competition-description competition-bracket-empty';empty.textContent=hu?'A tabella a résztvevő csapatok hozzáadása után jelenik meg.':'Standings will appear after teams are added.';section.append(empty);return section;}
  const byGroup=new Map();
  for(const row of rows.values()){const group=String(row.team.group||'').trim()||(teams.some(team=>String(team.group||'').trim())?(hu?'Csoport nélkül':'Ungrouped'):(hu?'Összesített':'Overall'));if(!byGroup.has(group))byGroup.set(group,[]);byGroup.get(group).push(row);}
  for(const [group,entries] of byGroup){
    if(byGroup.size>1){const label=document.createElement('h3');label.textContent=group;section.append(label);}
    entries.sort((a,b)=>b.wins-a.wins||(b.gamesWon-b.gamesLost)-(a.gamesWon-a.gamesLost));
    const wrap=document.createElement('div');wrap.className='competition-standings';const table=document.createElement('table');
    const head=document.createElement('thead'),headRow=document.createElement('tr');
    const labels=hu?['#','Csapat','Szett győzelem','Szett vereség','Megnyert meccsek','Elvesztett meccsek','Meccskülönbség']:['#','Team','Series Wins','Series Losses','Games Won','Games Lost','Game Difference'];
    for(const label of labels){const cell=document.createElement('th');cell.textContent=label;headRow.append(cell);}head.append(headRow);table.append(head);
    const body=document.createElement('tbody');let position=0,previous=null;entries.forEach((entry,index)=>{const difference=entry.gamesWon-entry.gamesLost;if(!previous||entry.wins!==previous.wins||difference!==previous.gamesWon-previous.gamesLost)position=index+1;previous=entry;const row=document.createElement('tr');for(const value of [String(position),entry.team.name,String(entry.wins),String(entry.losses),String(entry.gamesWon),String(entry.gamesLost),difference>0?`+${difference}`:String(difference)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);});table.append(body);wrap.append(table);section.append(wrap);
  }
  return section;
}
function renderPublicCompetitionDetail(route) {
  const page=document.getElementById('public-competition-detail'); if(!page)return;
  const hu=document.documentElement.lang==='hu', id=route.split('/').filter(Boolean).at(-1);
  const item=(publicData?.competitions||[]).find(entry=>String(entry.id||'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,100)===id);
  page.replaceChildren();
  const back=document.createElement('a'); back.className='public-competition-back'; back.href='#/competitions/'; back.textContent=hu?'\u2190 Vissza a versenyekhez':'\u2190 Back to tournaments';
  if(!item){const message=document.createElement('p');message.textContent=hu?'Ez a verseny nem tal\u00e1lhat\u00f3.':'This tournament could not be found.';page.append(back,message);return;}
  const title=hu?item.titleHu:item.titleEn, location=hu?item.locationHu:item.locationEn, description=hu?item.descriptionHu:item.descriptionEn;
  document.title=`${title} | HoloFyrn Esports`;
  const date=new Date(`${item.date}T12:00:00`), formattedDate=new Intl.DateTimeFormat(hu?'hu-HU':'en-GB',{year:'numeric',month:'long',day:'numeric'}).format(date);
  const hero=document.createElement('div');hero.className='competition-hero';const main=document.createElement('header');main.className='competition-hero-main';
  const category=document.createElement('div');category.className='eyebrow';category.textContent=hu?'HOLOFYRN / VERSENY':'HOLOFYRN / TOURNAMENT';
  const status=document.createElement('span');status.className='competition-status';status.textContent=Date.now()<new Date(`${item.date}T23:59:59`).getTime()?(hu?'K\u00f6zelg\u0151 verseny':'Upcoming tournament'):(hu?'Lez\u00e1rult verseny':'Tournament concluded');
  const heading=document.createElement('h1');heading.textContent=title;
  const meta=document.createElement('div');meta.className='competition-hero-meta';
  const dateMeta=document.createElement('span');dateMeta.textContent=`\u25f7  ${formattedDate}`;meta.append(dateMeta);
  if(location){const placeMeta=document.createElement('span');placeMeta.textContent=`\u25c9  ${location}`;meta.append(placeMeta);}
  main.append(category,status,heading,meta);
  const facts=document.createElement('aside');facts.className='competition-facts';
  const prize=document.createElement('div');prize.className='competition-prize';const prizeIcon=document.createElement('span');prizeIcon.className='competition-prize-icon';const trophy=document.createElementNS('http://www.w3.org/2000/svg','svg');trophy.setAttribute('viewBox','0 0 24 24');trophy.setAttribute('aria-hidden','true');trophy.innerHTML='<path d="M8 3h8v3c0 4-2 6-4 6s-4-2-4-6V3ZM8 5H5v2c0 2 1.5 3 4 3m7-5h3v2c0 2-1.5 3-4 3M12 12v4m-3 0h6v3H9zm-2 4h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';prizeIcon.append(trophy);const prizeCopy=document.createElement('span');const prizeLabel=document.createElement('small');prizeLabel.textContent=hu?'D\u00edjalap':'Prize Pool';const prizeValue=document.createElement('strong');prizeValue.textContent=item.prizePool||'TBA';prizeCopy.append(prizeLabel,prizeValue);prize.append(prizeIcon,prizeCopy);facts.append(prize);
  const fact=(icon,label,value)=>{const row=document.createElement('div');row.className='competition-fact';const symbol=document.createElement('span');symbol.className='competition-fact-icon';symbol.textContent=icon;const copy=document.createElement('span');const caption=document.createElement('small');caption.textContent=label;const strong=document.createElement('strong');strong.textContent=value;copy.append(caption,strong);row.append(symbol,copy);facts.append(row);};
  fact('\u25ce','Game','Rocket League');fact('\u2691',hu?'Form\u00e1tum':'Format',item.format||'TBA');fact('\u25ce',hu?'R\u00e9gi\u00f3':'Region','Global (EU Servers)');hero.append(main,facts);
  const nav=document.createElement('nav');nav.className='competition-nav';nav.setAttribute('aria-label',hu?'Verseny inform\u00e1ci\u00f3k':'Tournament information');nav.setAttribute('role','tablist');
  const overviewTab=document.createElement('button');overviewTab.type='button';overviewTab.id='competition-overview-tab';overviewTab.className='active';overviewTab.setAttribute('role','tab');overviewTab.setAttribute('aria-controls','competition-overview-panel');overviewTab.setAttribute('aria-selected','true');overviewTab.textContent=hu?'\u00c1ttekint\u00e9s':'Overview';
  const bracketTab=document.createElement('button');bracketTab.type='button';bracketTab.id='competition-bracket-tab';bracketTab.setAttribute('role','tab');bracketTab.setAttribute('aria-controls','competition-bracket-panel');bracketTab.setAttribute('aria-selected','false');bracketTab.textContent='Bracket';
  const standingsTab=document.createElement('button');standingsTab.type='button';standingsTab.id='competition-standings-tab';standingsTab.setAttribute('role','tab');standingsTab.setAttribute('aria-controls','competition-standings-panel');standingsTab.setAttribute('aria-selected','false');standingsTab.textContent=hu?'Tabella':'Standings';nav.append(overviewTab,bracketTab,standingsTab);
  const layout=document.createElement('div');layout.id='competition-overview-panel';layout.className='competition-detail-grid';layout.setAttribute('aria-labelledby',overviewTab.id);const about=document.createElement('section');about.className='competition-panel';const aboutTitle=document.createElement('h2');aboutTitle.textContent=hu?'A versenyr\u0151l':'About the tournament';about.append(aboutTitle);
  if(description){const copy=document.createElement('p');copy.className='competition-description';copy.textContent=description;about.append(copy);}
  const schedule=document.createElement('section');schedule.className='competition-panel competition-schedule';const scheduleTitle=document.createElement('h2');scheduleTitle.textContent=hu?'Verseny menetrend':'Tournament schedule';schedule.append(scheduleTitle);
  const scheduleItems=[
    {key:'registrationOpen',label:hu?'Nevez\u00e9s kezdete':'Registration opens'},
    {key:'registrationClose',label:hu?'Nevez\u00e9s lez\u00e1r\u00e1sa':'Registration closes'},
    {key:'checkIn',label:hu?'Check-in':'Check-in'},
    {key:'tournamentStart',label:hu?'Verseny kezdete':'Tournament start',fallback:item.date},
  ].map(row=>({...row,value:item[row.key]||row.fallback||''})).filter(row=>row.value).sort((a,b)=>new Date(a.value.length===10?`${a.value}T12:00:00`:a.value)-new Date(b.value.length===10?`${b.value}T12:00:00`:b.value));
  const scheduleList=document.createElement('div');scheduleList.className='competition-schedule-list';
  for(const entry of scheduleItems){const row=document.createElement('div');row.className='competition-schedule-item';const marker=document.createElement('span');marker.className='competition-schedule-marker';const copy=document.createElement('span');const label=document.createElement('small');label.textContent=entry.label;const value=document.createElement('strong');const time=new Date(entry.value.length===10?`${entry.value}T12:00:00`:entry.value);value.textContent=entry.value.length===10?new Intl.DateTimeFormat(hu?'hu-HU':'en-GB',{year:'numeric',month:'short',day:'numeric'}).format(time):new Intl.DateTimeFormat(hu?'hu-HU':'en-GB',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(time);copy.append(label,value);row.append(marker,copy);scheduleList.append(row);}
  if(!scheduleItems.length){const empty=document.createElement('p');empty.className='competition-description';empty.textContent=hu?'A menetrend hamarosan el\u00e9rhet\u0151 lesz.':'The schedule will be announced soon.';scheduleList.append(empty);}
  schedule.append(scheduleList);
  const side=document.createElement('aside');side.className='competition-side';const quick=document.createElement('section');quick.className='competition-panel';const quickTitle=document.createElement('h2');quickTitle.textContent=hu?'Gyors el\u00e9r\u00e9s':'Quick links';quick.append(quickTitle);
  const joinLabel=hu?'Nevez\u00e9s a versenyre':'Join tournament';
  if(item.url&&/^https:\/\/[^\s]+$/i.test(item.url)){const join=document.createElement('a');join.className='button competition-detail-cta';join.href=item.url;join.target='_blank';join.rel='noopener noreferrer';join.textContent=joinLabel;quick.append(join);}else{const join=document.createElement('button');join.className='button competition-detail-cta competition-link-disabled';join.type='button';join.disabled=true;join.textContent=joinLabel;quick.append(join);}
  const discord=document.createElement('a');discord.className='button button-outline competition-detail-cta';discord.href='https://discord.gg/3xE5bmsMJ';discord.target='_blank';discord.rel='noopener noreferrer';discord.textContent=hu?'Discord szerver':'Discord server';quick.append(discord);
  if(item.twitchUrl&&/^https:\/\/(?:www\.)?twitch\.tv\/[A-Za-z0-9_/-]+(?:[?#].*)?$/i.test(item.twitchUrl)){const twitch=document.createElement('a');twitch.className='button button-outline competition-detail-cta';twitch.href=item.twitchUrl;twitch.target='_blank';twitch.rel='noopener noreferrer';twitch.textContent=hu?'N\u00e9zd Twitchen':'Watch on Twitch';quick.append(twitch);}else{const twitch=document.createElement('button');twitch.className='button button-outline competition-detail-cta competition-link-disabled';twitch.type='button';twitch.disabled=true;twitch.textContent=hu?'N\u00e9zd Twitchen':'Watch on Twitch';quick.append(twitch);}
  const participantsPanel=document.createElement('section');participantsPanel.className='competition-panel competition-participants-panel';const participantsTitle=document.createElement('h2');participantsTitle.textContent=hu?'Résztvevő csapatok':'Participating Teams';participantsPanel.append(participantsTitle);const participantNames=(item.teams||[]).filter(team=>team&&typeof team.name==='string'&&team.name.trim());if(participantNames.length){const list=document.createElement('ul');list.className='competition-participant-list';for(const team of participantNames){const entry=document.createElement('li');entry.textContent=team.name.trim();list.append(entry);}participantsPanel.append(list);}else{const empty=document.createElement('p');empty.className='competition-description';empty.textContent=hu?'A résztvevő csapatok hamarosan megjelennek.':'Participating teams will be announced soon.';participantsPanel.append(empty);}
  const aboutColumn=document.createElement('div');aboutColumn.className='competition-about-column';aboutColumn.append(about,participantsPanel);side.append(schedule,quick);layout.append(aboutColumn,side);layout.classList.add('competition-tab-panel');layout.setAttribute('role','tabpanel');
  const bracketView=document.createElement('section');bracketView.id='competition-bracket-panel';bracketView.className='competition-bracket-view competition-tab-panel';bracketView.setAttribute('role','tabpanel');bracketView.setAttribute('aria-labelledby',bracketTab.id);bracketView.hidden=true;
  const teamsHeading=document.createElement('h2');teamsHeading.textContent=hu?'Résztvevő csapatok':'Participating teams';bracketView.append(teamsHeading);
  const teamsGrid=document.createElement('div');teamsGrid.className='competition-groups-grid';
  const participants=(item.teams||[]).filter(team=>team&&typeof team.name==='string'&&team.name.trim());
  if(participants.length){for(const team of participants){const card=document.createElement('article');card.className='competition-group-card';const name=document.createElement('h3');name.textContent=team.name.trim();card.append(name);if(team.seed){const seed=document.createElement('div');seed.className='competition-group-team';seed.textContent=`${hu?'Kiemelés':'Seed'}: ${team.seed}`;card.append(seed);}teamsGrid.append(card);}}
  else {const empty=document.createElement('p');empty.className='competition-description competition-bracket-empty';empty.textContent=hu?'A résztvevő csapatok hamarosan megjelennek.':'Participating teams will appear here when announced.';teamsGrid.append(empty);}
  bracketView.append(teamsGrid);
  const groupsHeading=document.createElement('h2');groupsHeading.textContent=hu?'Csoportok':'Groups';// Group UI is only shown for group-stage tournaments.
  const groupsGrid=document.createElement('div');groupsGrid.className='competition-groups-grid';
  const groupMap=new Map();
  for(const team of item.teams||[]){const group=String(team.group||'Ungrouped').trim()||'Ungrouped';if(!groupMap.has(group))groupMap.set(group,[]);groupMap.get(group).push(team.name);}
  const groups=groupMap.size?[...groupMap].map(([name,teams])=>({name,teams})): (item.groupsText||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const split=line.indexOf(':');return{name:split<0?(hu?'Csoport':'Group'):line.slice(0,split).trim(),teams:(split<0?line:line.slice(split+1)).split(',').map(team=>team.trim()).filter(Boolean)};});
  if(groups.length){for(const group of groups){const card=document.createElement('article');card.className='competition-group-card';const name=document.createElement('h3');name.textContent=group.name;card.append(name);for(const team of group.teams){const row=document.createElement('div');row.className='competition-group-team';row.textContent=team;card.append(row);}groupsGrid.append(card);}}
  else {const empty=document.createElement('p');empty.className='competition-description competition-bracket-empty';empty.textContent=hu?'A csoportbeosztás hamarosan megjelenik.':'Group assignments will appear here when announced.';groupsGrid.append(empty);}
  if((item.tournamentType||'groups')==='groups'){bracketView.append(groupsHeading,groupsGrid);}
  const bracketHeading=document.createElement('h2');bracketHeading.className='competition-bracket-heading';bracketHeading.textContent=hu?'Verseny ágrajz':'Bracket (partial view)';bracketView.append(bracketHeading);
  const bracketGrid=document.createElement('div');bracketGrid.className='competition-bracket-grid';
  const teamNames=new Map((item.teams||[]).map(team=>[team.id,team.name]));
  const matches=(item.bracketMatches||[]).map(match=>({round:match.round,teamA:teamNames.get(match.teamAId)||'TBD',scoreA:match.scoreA,scoreB:match.scoreB,teamB:teamNames.get(match.teamBId)||'TBD'}));
  if(!matches.length)matches.push(...(item.bracketText||'').split(/\r?\n/).map(line=>line.split('|').map(value=>value.trim())).filter(parts=>parts.length>=5&&parts[0]&&parts[1]&&parts[4]).map(parts=>({round:parts[0],teamA:parts[1],scoreA:parts[2],scoreB:parts[3],teamB:parts[4]})));
  const rounds=[...new Set(matches.map(match=>match.round))];
  if(rounds.length){for(const roundName of rounds){const column=document.createElement('div');column.className='competition-bracket-round';const title=document.createElement('h3');title.textContent=roundName;column.append(title);for(const match of matches.filter(entry=>entry.round===roundName)){const card=document.createElement('article');card.className='competition-match-card';for(const [team,score] of [[match.teamA,match.scoreA],[match.teamB,match.scoreB]]){const row=document.createElement('div');row.className='competition-match-team';const teamName=document.createElement('span');teamName.textContent=team;const result=document.createElement('strong');result.textContent=score||'—';row.append(teamName,result);card.append(row);}column.append(card);}bracketGrid.append(column);}}
  else {const empty=document.createElement('p');empty.className='competition-description competition-bracket-empty';empty.textContent=hu?'A verseny ágrajza hamarosan megjelenik.':'The tournament bracket will appear here when announced.';bracketGrid.append(empty);}
  bracketView.append(bracketGrid);
  const standingsView=renderCompetitionStandings(item,hu);standingsView.id='competition-standings-panel';standingsView.classList.add('competition-tab-panel');standingsView.setAttribute('role','tabpanel');standingsView.setAttribute('aria-labelledby',standingsTab.id);standingsView.hidden=true;
  const tabs=[overviewTab,bracketTab,standingsTab],panels=[layout,bracketView,standingsView];
  const setTab=active=>{tabs.forEach(tab=>{const selected=tab===active;tab.classList.toggle('active',selected);tab.setAttribute('aria-selected',String(selected));});panels.forEach((panel,index)=>{panel.hidden=tabs[index]!==active;});};
  overviewTab.addEventListener('click',()=>setTab(overviewTab));bracketTab.addEventListener('click',()=>setTab(bracketTab));standingsTab.addEventListener('click',()=>setTab(standingsTab));
  page.append(back,hero,nav,layout,bracketView,standingsView);
}

function showPublicArticle(article) {
  let dialog = document.getElementById('public-news-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.id = 'public-news-dialog'; dialog.className = 'public-news-dialog';
    dialog.innerHTML = '<form method="dialog"><button class="btn small" aria-label="Close article">Close ×</button></form><div class="eyebrow"></div><h2></h2><p class="page-sub"></p><div class="public-news-body"></div>';
    document.body.append(dialog);
  }
  dialog.querySelector('.eyebrow').textContent = article.category;
  dialog.querySelector('h2').textContent = article.title;
  dialog.querySelector('.page-sub').textContent = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : '';
  dialog.querySelector('.public-news-body').textContent = article.body;
  if (!dialog.open) dialog.showModal();
}

function newsArticlePath(article) {
  const slug = String(article.titleEn || article.title || 'news').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'news';
  const id = String(article.id || slug).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
  return `/news/${slug}-${id}/`;
}

function localizedNews(article) {
  const hu = document.documentElement.lang === 'hu';
  return {...article,
    title: (hu ? article.titleHu : article.titleEn) || article.title || article.titleEn || article.titleHu || '',
    summary: (hu ? article.summaryHu : article.summaryEn) || article.summary || article.summaryEn || article.summaryHu || '',
    body: (hu ? article.bodyHu : article.bodyEn) || article.body || article.bodyEn || article.bodyHu || '',
    ctaLabel: (hu ? article.ctaLabelHu : article.ctaLabelEn) || article.ctaLabel || ''
  };
}

function renderPublicNewsArticle(route) {
  const source = (publicData?.news || []).find(item => newsArticlePath(item) === route);
  const article = source ? localizedNews(source) : null;
  const page = document.getElementById('public-news-article');
  if (!page) return;
  page.replaceChildren();
  if (!article) {
    const back = document.createElement('a'); back.className = 'public-news-back'; back.href = '#/news/';
    back.textContent = document.documentElement.lang === 'hu' ? '← Vissza a hírekhez' : '← Back to news';
    const message = document.createElement('p'); message.textContent = document.documentElement.lang === 'hu' ? 'Ez a hír nem található.' : 'This article could not be found.';
    page.append(back, message);
    return;
  }
  document.title = `${article.title} | HoloFyrn Esport`;
  const back = document.createElement('a'); back.className = 'public-news-back'; back.href = '#/news/';
  back.textContent = document.documentElement.lang === 'hu' ? '← Vissza a hírekhez' : '← Back to news';

  const header = document.createElement('header'); header.className = 'public-news-header';
  const category = document.createElement('div'); category.className = 'eyebrow'; category.textContent = article.category || 'NEWS';
  const title = document.createElement('h1'); title.textContent = article.title;
  const summary = document.createElement('p'); summary.className = 'article-summary'; summary.textContent = article.summary;
  header.append(category, title, summary);
  if (article.publishedAt) {
    const date = document.createElement('p'); date.className = 'article-date';
    date.textContent = new Date(article.publishedAt).toLocaleDateString(document.documentElement.lang === 'hu' ? 'hu-HU' : 'en-GB');
    header.append(date);
  }

  const layout = document.createElement('div'); layout.className = 'public-news-layout';
  if (article.imageUrl && /^(https:\/\/|\/assets\/)/i.test(article.imageUrl)) {
    layout.classList.add('has-image');
    const visual = document.createElement('div'); visual.className = 'public-news-visual';
    const image = document.createElement('img'); image.className = 'public-news-article-image';
    if (/Rllogo-960\.webp(?:[?#]|$)/i.test(article.imageUrl)) image.classList.add('public-news-article-image-contain');
    image.src = article.imageUrl; image.alt = article.title; image.decoding = 'async';
    image.addEventListener('error', () => { visual.remove(); layout.classList.remove('has-image'); }, {once:true}); visual.append(image); layout.append(visual);
  }
  const content = document.createElement('div'); content.className = 'public-news-content';
  const copy = document.createElement('div'); copy.className = 'public-news-article-copy'; copy.textContent = article.body; content.append(copy);
  if (article.ctaLabel && article.ctaUrl) {
    const link = document.createElement('a'); link.className = 'button public-news-cta'; link.href = article.ctaUrl; link.textContent = article.ctaLabel;
    if (/^https:\/\//i.test(article.ctaUrl)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    content.append(link);
  }
  layout.append(content);
  page.append(back, header, layout);
}
document.addEventListener('holofyrn:route', render);
document.querySelector('.language-toggle')?.addEventListener('click', () => {
  const route = decodeURIComponent(location.hash.slice(1)) || '/';
  if (route === '/') renderUpcomingMatches(publicData?.upcomingMatches || []);
  renderPublicStaff(route);
  renderPublishedNews(route);
  renderPublicCompetitions(route);
});
document.addEventListener('holofyrn:language', () => {
  const route = decodeURIComponent(location.hash.slice(1)) || '/';
  renderPublicStaff(route);
  renderPublishedNews(route);
  renderPublicCompetitions(route);
});
render();
try {
  const [{firebaseConfig}, appApi, authApi, fire] = await Promise.all([
    import('./holofyrnmanager/firebaseConfig.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'),
  ]);
  const app = appApi.initializeApp(firebaseConfig);
  const auth = authApi.getAuth(app);
  const existingUser = await new Promise((resolve, reject) => {
    const unsubscribe = authApi.onAuthStateChanged(auth, user => { unsubscribe(); resolve(user); }, reject);
  });
  if (!existingUser) await authApi.signInAnonymously(auth);
  const db = fire.initializeFirestore(app, {experimentalAutoDetectLongPolling:true,useFetchStreams:false});
  fire.onSnapshot(fire.doc(db, 'holofyrnPublic', 'main'), snapshot => {
    const data = snapshot.data();
    if (!snapshot.exists() || !Array.isArray(data.players) || !Array.isArray(data.results)) {
      publicData = {players:[],results:[]};
    } else publicData = data;
    loadError = false;
    render();
  }, error => {
    console.error('HoloFyrn public data could not be loaded', error);
    loadError = true;
    render();
  });
} catch (error) {
  console.error('HoloFyrn public data could not be loaded', error);
  loadError = true;
}
render();
