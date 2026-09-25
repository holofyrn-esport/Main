const teamRoutes = {
  '/teams/holofyrn-esport/': 'main',
  '/teams/holofyrn-academy/': 'academy',
  '/teams/rls-holofyrn-esport/': 'rls',
  '/teams/rls-holofyrn-academy/': 'rls-academy',
  '/teams/rls-holofyrn-elet/': 'rls-eldr',
};
const teamNames = {
  main: 'HoloFyrn Esport', academy: 'HoloFyrn Academy',
  rls: 'RLS HoloFyrn Esport', 'rls-academy': 'RLS HoloFyrn Academy',
  'rls-eldr': 'RLS HoloFyrn Élet',
};
const portraits = {kenz: 'Kenz.png', eggy: 'eggy.webp', interz: 'interz.webp'};
let publicData = null;
let loadError = false;

function teamLink(team) {
  return Object.entries(teamRoutes).find(([, id]) => id === team)?.[0] || '/teams/';
}

function playerLink(player) {
  return `#/players/${encodeURIComponent(player.team)}/${encodeURIComponent(player.name)}/`;
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
  small.append(translated('ROCKET LEAGUE PLAYER', 'ROCKET LEAGUE JÁTÉKOS'));
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
  if (match) return players.find(player => player.team === match[1] && player.name === match[2]);
  const legacy = route.match(/^\/players\/(kenz|eggy|interz)\/$/i);
  return legacy && players.find(player => player.team === 'main' && player.name.toLowerCase() === legacy[1].toLowerCase());
}

function renderProfile(route, players) {
  const player = profilePlayer(route, players);
  const target = document.querySelector('#main .player-profile');
  if (!target || !route.startsWith('/players/')) return;
  if (!player) {
    if (target.id === 'public-player-profile') target.replaceChildren(emptyMessage(loadError ? 'Player data is temporarily unavailable.' : 'Player not found.', loadError ? 'A játékosadatok átmenetileg nem érhetők el.' : 'A játékos nem található.'));
    return;
  }
  const team = teamNames[player.team] || player.team;
  const back = `#${teamLink(player.team)}`;
  const breadcrumbs = document.createElement('div');
  breadcrumbs.className = 'breadcrumbs';
  const teamAnchor = document.createElement('a');
  teamAnchor.href = back;
  teamAnchor.textContent = team;
  breadcrumbs.append(teamAnchor, document.createTextNode(' / ' + player.name));
  const grid = document.createElement('div');
  grid.className = 'profile-grid';
  const photo = document.createElement('div');
  photo.className = 'profile-photo public-profile-photo';
  const photoFile = portrait(player);
  if (photoFile) {
    photo.classList.add('has-portrait');
    photo.style.backgroundImage = `linear-gradient(0deg,#131010,transparent 35%),url('${photoFile}')`;
    if (photoFile === 'assets/eggy.webp' || photoFile === 'assets/interz.webp') {
      const illustration = document.createElement('em');
      illustration.className = 'concept-label';
      illustration.append(translated('Illustrative portrait', 'Illusztráció'));
      photo.append(illustration);
    }
  }
  const photoLabel = document.createElement('span');
  photoLabel.textContent = 'HF / ' + team;
  photo.append(photoLabel);
  const copy = document.createElement('div');
  copy.className = 'profile-copy';
  const eyebrow = document.createElement('div');
  eyebrow.className = 'eyebrow';
  eyebrow.append(document.createElement('i'), translated('PLAYER PROFILE', 'JÁTÉKOSPROFIL'));
  const title = document.createElement('h1');
  title.textContent = player.name;
  const role = document.createElement('p');
  role.className = 'profile-role';
  role.append(translated('Rocket League player', 'Rocket League játékos'), document.createTextNode(' · ' + team));
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
  const about = document.createElement('p');
  about.className = 'profile-bio';
  if (player.bio) about.textContent = player.bio;
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

function renderPlayers(grid, players) {
  if (!grid) return;
  if (!players.length) {
    grid.replaceChildren(emptyMessage(loadError ? 'Player data is temporarily unavailable.' : 'No players listed yet.', loadError ? 'A játékosadatok átmenetileg nem érhetők el.' : 'Még nincsenek játékosok feltüntetve.'));
    return;
  }
  grid.replaceChildren(...players.map(playerCard));
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
    renderPlayers(document.querySelector('#main .players-grid'), players.filter(player => player.team === team));
    const panels = document.querySelectorAll('#main .two-column .info-panel');
    if (panels.length >= 2) {
      panels[0].querySelector('p')?.replaceWith(resultList(results.filter(row => row.team === team), 'No results yet.', 'Még nincs eredmény.'));
      panels[1].querySelector('p')?.replaceWith(resultList(results.filter(row => row.team === team && row.type !== 'league'), 'No tournament results yet.', 'Még nincs versenyeredmény.'));
    }
  } else if (route === '/') {
    renderPlayers(document.querySelector('#main .players-grid'), players.filter(player => player.team === 'main'));
  }
}

document.addEventListener('holofyrn:route', render);
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
