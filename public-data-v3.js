import {matchesForNextDay, todayInBudapest} from './public-matches.mjs';
import {rosterRole, sortedRoster} from './public-roster.mjs?v=20260930-order';

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
const portraits = {kenz: 'Kenz.png', eggy: 'eggy.webp', interz: 'interz.webp'};
let publicData = null;
let loadError = false;

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
  if (name === 'zemsta') return 'assets/zemsta.png?v=2';
  if (name === 'qex') return 'Ppic/Qex.png';
  return player.team === 'main' && portraits[name] ? `assets/${portraits[name]}` : null;
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
    image.style.backgroundImage = `linear-gradient(0deg,#131010,transparent 35%),url('${photo}')`;
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
  const photoFile = isZemstaAcademy ? 'assets/zemsta-profile.png' : portrait(player);
  if (photoFile) {
    photo.classList.add('has-portrait');
    photo.style.backgroundImage = `linear-gradient(0deg,#131010,transparent 35%),url('${photoFile}')`;
    if (isZemstaAcademy || isKenzMain) {
      photo.classList.add('signed-profile-photo');
      const signature = document.createElement('img');
      signature.className = isKenzMain ? 'profile-signature kenz-signature' : 'profile-signature';
      signature.src = isKenzMain ? 'assets/kenz-signature.png' : 'assets/zemsta-signature.png';
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
  const about = document.createElement(hasZemstaBio ? 'div' : 'p');
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
  grid.replaceChildren(...sortedRoster(players, team).map(playerCard));
}

function renderUpcomingMatches(matches) {
  const layout = document.querySelector('#main .match-layout');
  if (!layout) return;
  const block = layout.firstElementChild;
  const selected = matchesForNextDay(matches);
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
      sides.textContent = `${match.home} vs ${match.away}`;
      row.append(sides);
      if (match.time) {
        const time = document.createElement('time');
        time.dateTime = `${match.date}T${match.time}`;
        time.textContent = match.time;
        row.append(time);
      }
      list.append(row);
    }
    block.replaceChildren(label, heading, list);
  } else {
    heading.append(translated(loadError ? 'Matches temporarily unavailable' : !publicData ? 'Loading matches…' : 'Schedule to be announced',
      loadError ? 'A mérkőzések átmenetileg nem érhetők el' : !publicData ? 'Mérkőzések betöltése…' : 'Időpont hamarosan'));
    block.replaceChildren(label, heading);
  }
  block.classList.add('upcoming-match-block');
  layout.querySelector('.match-symbols')?.remove();
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
