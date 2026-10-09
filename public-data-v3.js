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
const portraits = {kenz: 'Kenz-profile.webp', eggy: 'eggy.webp', interz: 'interz.webp'};
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
  const label = document.createElement('span');
  label.className = 'player-index';
  label.textContent = `${String(index + 1).padStart(2, '0')} / HF`;
  image.append(label);
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
  const photoFile = isZemstaAcademy ? 'assets/zemsta-1200.webp' : portrait(player);
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
    if (photoFile === 'assets/eggy.webp' || photoFile === 'assets/interz.webp') {
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
  if (!paragraphs.length) paragraphs.push('A personal introduction is coming soon.');
  for (const text of paragraphs) { const p=document.createElement('p'); p.textContent=text; target.append(p); }
}

function updateStaticStaffBio(person) {
  const copy=document.querySelector('#main .staff-profile .profile-copy');
  if(!copy)return;
  const title=copy.querySelector('h1'); if(title)title.textContent=person.name;
  const role=copy.querySelector('.profile-role'); if(role)role.textContent=person.role;
  const facts=copy.querySelectorAll('.profile-facts > div');const roleFact=facts[facts.length-1]?.querySelector('strong');if(roleFact)roleFact.textContent=person.role;
  const aboutHeading=[...copy.querySelectorAll('h2')].find(node=>/about the (staff member|player)/i.test(node.textContent));
  if(aboutHeading){const headingText=aboutHeading.textContent;const old=aboutHeading.nextElementSibling;if(old&&!old.matches('.text-link'))old.remove();const bio=document.createElement('div');bio.className='profile-bio';appendBio(bio,person.bio);aboutHeading.after(bio);aboutHeading.textContent=headingText;}
  document.title=`${person.name} | HoloFyrn Esport`;
}

function renderStaffProfile(person) {
  const target=document.getElementById('public-staff-profile');
  if(!target)return;
  target.replaceChildren();
  if(!person){const p=document.createElement('p');p.textContent='Staff profile not found.';target.append(p);return;}
  document.title=`${person.name} | HoloFyrn Esport`;
  const crumb=document.createElement('div');crumb.className='breadcrumbs';const back=document.createElement('a');back.href='#/staff/';back.textContent='Staff';crumb.append(back,document.createTextNode(` / ${person.name}`));
  const grid=document.createElement('div');grid.className='profile-grid';const photo=document.createElement('div');photo.className='profile-photo staff-profile-photo';
  if(person.imageUrl){photo.style.backgroundImage=`linear-gradient(0deg,#131010,transparent 35%),url('${person.imageUrl}')`;photo.style.backgroundSize='cover';photo.style.backgroundPosition='center top';}
  const copy=document.createElement('div');copy.className='profile-copy';const eyebrow=document.createElement('div');eyebrow.className='eyebrow';eyebrow.append(document.createElement('i'),document.createTextNode('STAFF PROFILE'));
  const heading=document.createElement('h1');heading.textContent=person.name;const role=document.createElement('p');role.className='profile-role';role.textContent=person.role;const divider=document.createElement('div');divider.className='profile-divider';
  const about=document.createElement('h2');about.textContent='About the staff member';const bio=document.createElement('div');bio.className='profile-bio';appendBio(bio,person.bio);
  const link=document.createElement('a');link.className='text-link';link.href='#/staff/';link.textContent='Back to staff';copy.append(eyebrow,heading,role,divider,about,bio,link);grid.append(photo,copy);target.append(crumb,grid);
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
  role.textContent = person.role;
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
    grid.replaceChildren(...visible.map(article => {
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
  const slug = String(article.title || 'news').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'news';
  const id = String(article.id || slug).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
  return `/news/${slug}-${id}/`;
}

function renderPublicNewsArticle(route) {
  const article = (publicData?.news || []).find(item => newsArticlePath(item) === route);
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
  if ((decodeURIComponent(location.hash.slice(1)) || '/') === '/') renderUpcomingMatches(publicData?.upcomingMatches || []);
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
