(() => {
  const $ = id => document.getElementById(id);
  const logo = (letters, color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 3 92 22 83 70 50 97 17 70 8 22Z" fill="#090a0d" stroke="${color}" stroke-width="5"/><path d="M50 13 81 27 74 65 50 85 26 65 19 27Z" fill="#17191d" stroke="${color}" stroke-width="2"/><text x="50" y="61" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="34" fill="${color}">${letters}</text></svg>`)}`;
  const defaults = {homeName:'HOLOFYRN',homeTag:'ESPORTS',awayName:'KARMINE CORP',awayTag:'',homeLogo:logo('HF','#f31830'),awayLogo:logo('KC','#a71930'),homeColor:'#f31830',awayColor:'#a71930',bestOf:5,seriesWins:[0,0],endedMatches:[],seriesPlayerStats:{},language:'hu'};
  let settings = {...defaults};
  try { settings={...settings,...JSON.parse(localStorage.getItem('holofyrnHubTeams')||'{}')}; } catch {}
  // Migrate the previous default cyan so existing users see the HoloFyrn palette too.
  if(settings.awayColor?.toLowerCase()==='#10b9e9')settings.awayColor=defaults.awayColor;
  if(settings.awayLogo?.includes(encodeURIComponent('#10b9e9')))settings.awayLogo=defaults.awayLogo;
  if(!['hu','en'].includes(settings.language))settings.language='hu';
  if(![3,5,7].includes(Number(settings.bestOf)))settings.bestOf=5;else settings.bestOf=Number(settings.bestOf);
  if(!Array.isArray(settings.seriesWins))settings.seriesWins=[0,0];
  settings.seriesWins=settings.seriesWins.slice(0,2).map(value=>Math.max(0,Number(value)||0));while(settings.seriesWins.length<2)settings.seriesWins.push(0);
  if(!Array.isArray(settings.endedMatches))settings.endedMatches=[];
  let socket, retryTimer, connected=false, hasGameData=false, goalTimer,lastGoalKey='',lastGoalAt=0,lastGoalIdentity=null,replayGoalIdentity=null;
  const match = {homeScore:0,awayScore:0,clock:'--:--',players:[[],[]],watchedPlayer:null,lastScorer:'',winner:null,replaying:false,replayGoal:null};
  const boostAnimations = new Map();
  let boostAnimationFrame = 0;
  function boostKey(team, player) { return `${team}:${String(player?.Name || '').toLocaleLowerCase()}`; }
  function displayedBoost(key, target) {
    const now = performance.now();
    let state = boostAnimations.get(key);
    const measured = target === null || target === undefined || target === '' ? NaN : Number(target);
    if (!Number.isFinite(measured)) return state?.value ?? 0;
    const value = Math.max(0, Math.min(100, measured));
    if (!state) {
      state = {value, from:value, to:value, started:now, duration:0, lastSample:now};
      boostAnimations.set(key, state);
    } else if (value !== state.to) {
      const progress = state.duration ? Math.min(1, (now - state.started) / state.duration) : 1;
      state.value = state.from + (state.to - state.from) * progress;
      state.from = state.value;
      state.to = value;
      state.started = now;
      // Stats API updates are already frequent; finish each tween before the next expected sample.
      // The old 120 ms minimum caused a visible trailing lag that accumulated during play.
      state.duration = Math.max(20, Math.min(70, (now - state.lastSample) * 0.8));
      state.lastSample = now;
    }
    if (state.duration) {
      const progress = Math.min(1, Math.max(0, (now - state.started) / state.duration));
      state.value = state.from + (state.to - state.from) * progress;
      if (progress >= 1) state.duration = 0;
      else scheduleBoostAnimation();
    } else state.value = state.to;
    return state.value;
  }
  function scheduleBoostAnimation() {
    if (boostAnimationFrame) return;
    boostAnimationFrame = requestAnimationFrame(tickBoostAnimations);
  }
  function tickBoostAnimations() {
    boostAnimationFrame = 0;
    let active = false;
    const now = performance.now();
    const rows = document.querySelectorAll('.player-boost-row');
    const povPanels = document.querySelectorAll('.player-pov-boost');
    for (const [key, state] of boostAnimations) {
      if (!state.duration) continue;
      const progress = Math.min(1, Math.max(0, (now - state.started) / state.duration));
      state.value = state.from + (state.to - state.from) * progress;
      if (progress >= 1) state.duration = 0;
      else active = true;
      const value = Math.round(state.value);
      rows.forEach(row => {
        if (row.dataset.boostKey !== key) return;
        const number = row.querySelector('small'), track = row.querySelector('.player-boost-track');
        if (number && number.textContent !== String(value)) number.textContent = String(value);
        if (track) { track.setAttribute('aria-valuenow', String(value)); const fill = track.querySelector('i'); if (fill) fill.style.width = `${state.value}%`; }
      });
      povPanels.forEach(panel => {
        if (panel.dataset.boostKey !== key) return;
        panel.style.setProperty('--pov-boost', `${state.value}%`);
        const number = panel.querySelector('strong');
        if (number && number.textContent !== String(value)) number.textContent = String(value);
        panel.setAttribute('aria-label', `${panel.dataset.playerName || 'Player'} boost ${value} percent`);
      });
    }
    if (active) scheduleBoostAnimation();
  }
  const safeImage=(img,src)=>{if(!img)return;const next=src||'';if(img.getAttribute('src')!==next)img.src=next;const visibility=next?'visible':'hidden';if(img.style.visibility!==visibility)img.style.visibility=visibility};
  function renderPlayerLists(){
    const safe=value=>escapeHtml(value??'');
    const demo=!hasGameData&&!new URLSearchParams(location.search).has('overlay');
    const previewPlayers=[[
      {Name:'ATOW',Boost:22},{Name:'JUICY',Boost:45},{Name:'VATIRA',Boost:6}
    ],[
      {Name:'APPARENTLYJACK',Boost:0},{Name:'JOYO',Boost:58},{Name:'SEIKOO',Boost:89}
    ]];
    for(const prefix of ['','out-']) for(let team=0;team<2;team++){
      const side=team===0?'home':'away',target=$(prefix+(team===0?'home':'away')+'-players'),card=target?.closest('.team-stats');
      const players=demo&&prefix===''?previewPlayers[team]:(match.players[team]||[]);
      if(card)card.classList.toggle('is-hidden',players.length===0);
      if(!target)continue;
      const signature=players.map(player=>String(player.Name||'PLAYER')).join('|');
      if(target.dataset.playerSignature!==signature){
        target.dataset.playerSignature=signature;
        target.innerHTML=players.map(player=>`<div class="player-boost-row" data-boost-key="${safe(boostKey(team,player))}"><b title="${safe(player.Name)}">${safe(player.Name||'PLAYER')}</b><span class="player-boost-track" role="meter" aria-label="${safe(player.Name)} boost" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i style="width:0%"></i></span><small>0</small></div>`).join('');
      }
      players.forEach(player=>{
        const key=boostKey(team,player),boost=displayedBoost(key,player.Boost),value=Math.round(boost);
        const row=[...target.querySelectorAll('.player-boost-row')].find(item=>item.dataset.boostKey===key);
        if(!row)return;
        const number=row.querySelector('small'),track=row.querySelector('.player-boost-track'),fill=track?.querySelector('i');
        if(number)number.textContent=String(value);
        if(track)track.setAttribute('aria-valuenow',String(value));
        if(fill)fill.style.width=`${boost}%`;
      });
      if(card)card.style.setProperty('--player-color',settings[side+'Color']||defaults[side+'Color']);
    }
    renderPlayerPov();
  }
  function renderPlayerPov(){
    const player=hasGameData?match.watchedPlayer:null;
    for(const prefix of ['hud-','out-']){
      const panel=$(prefix+'player-pov'),boostPanel=$(prefix+'pov-boost');
      if(!panel||!boostPanel)continue;
      panel.classList.toggle('is-hidden',!player);
      boostPanel.classList.toggle('is-hidden',!player);
      if(!player)continue;
      const team=Number(player.TeamNum)===1?'away':'home',color=settings[team+'Color']||defaults[team+'Color'];
      panel.style.setProperty('--pov-color',color);boostPanel.style.setProperty('--pov-color',color);
      const values={name:player.Name||'PLAYER',score:player.Score,goals:player.Goals,assists:player.Assists,saves:player.Saves,shots:player.Shots};
      for(const [key,value] of Object.entries(values)){const el=$(prefix+'pov-'+key);if(el)el.textContent=key==='name'?String(value):String(Number(value)||0)}
      const key=boostKey(Number(player.TeamNum)===1?1:0,player),boost=displayedBoost(key,player.Boost),boostNumber=Math.round(boost);
      boostPanel.dataset.boostKey=key;boostPanel.dataset.playerName=player.Name||'Player';
      boostPanel.style.setProperty('--pov-boost',`${boost}%`);
      const boostValue=$(prefix+'pov-boost-value');if(boostValue)boostValue.textContent=String(boostNumber);
      panel.setAttribute('aria-label',`${player.Name||'Player'} POV statistics`);
      boostPanel.setAttribute('aria-label',`${player.Name||'Player'} boost ${boostNumber} percent`);
    }
  }
  function updateSettings({publishCloud=true}={}){
    document.documentElement.style.setProperty('--home-color',settings.homeColor);
    document.documentElement.style.setProperty('--away-color',settings.awayColor);
    for(const side of ['home','away']){
      const cap=side[0].toUpperCase()+side.slice(1), name=settings[side+'Name']||`${cap} team`, color=settings[side+'Color']||defaults[side+'Color'], src=settings[side+'Logo']||'';
      const nameInput=$(`${side}-name`), colorInput=$(`${side}-color`);
      if(nameInput)nameInput.value=settings[side+'Name']||'';
      const tagInput=$(`${side}-tag`);if(tagInput)tagInput.value=settings[side+'Tag']||'';
      if(colorInput){colorInput.value=color;$(`${side}-color-value`).textContent=color.toUpperCase()}
      const swatch=$(`${side}-swatch`);if(swatch)swatch.style.backgroundColor=color;
      safeImage($(`${side}-thumb`),src);
      document.querySelectorAll(`[data-team-name="${side}"]`).forEach(el=>el.textContent=name);
      document.querySelectorAll(`[data-team-logo="${side}"]`).forEach(el=>safeImage(el,src));
    }
    saveSettings();
    render();
    updateLanguageButtons();
    if(publishCloud)window.hubCloud?.publish({...settings});
  }
  function render(){
    const names={home:settings.homeName||'HOME',away:settings.awayName||'AWAY'};
    const ids={home:['hud-home-logo','out-home-logo'],away:['hud-away-logo','out-away-logo']};
    for(const side of ['home','away']){
      document.querySelectorAll(`[data-team-name="${side}"]`).forEach(el=>el.textContent=names[side]);
      ids[side].forEach(id=>safeImage($(id),settings[side+'Logo']));
    }
    ['hud-home-name','out-home-name'].forEach(id=>{if($(id))$(id).textContent=names.home});
    ['hud-away-name','out-away-name'].forEach(id=>{if($(id))$(id).textContent=names.away});
    for(const side of ['home','away']){for(const id of [`hud-${side}-tag`,`out-${side}-tag`]){const el=$(id);if(el){el.textContent=settings[side+'Tag']||'';el.classList.toggle('is-hidden',!settings[side+'Tag']?.trim())}}}
    const previewDemo=!hasGameData&&!new URLSearchParams(location.search).has('overlay');
    const vals={'hud-home-score':previewDemo?2:match.homeScore,'out-home-score':match.homeScore,'hud-away-score':previewDemo?1:match.awayScore,'out-away-score':match.awayScore,'hud-clock':previewDemo?'2:52':match.clock,'out-clock':match.clock};
    Object.entries(vals).forEach(([id,value])=>{const el=$(id);if(el)el.textContent=value});
    renderPlayerLists();
    const language=new URLSearchParams(location.search).get('lang')||settings.language;
    const targetWins=Math.ceil(Number(settings.bestOf)/2),gameNumber=settings.seriesWins[0]+settings.seriesWins[1]+1;
    const gameWord=language==='en'?'GAME':'MECCS';
    const seriesLabel=settings.seriesWins[0]>=targetWins?(language==='en'?`${names.home} WINS SERIES`:`${names.home} NYERI A SOROZATOT`):settings.seriesWins[1]>=targetWins?(language==='en'?`${names.away} WINS SERIES`:`${names.away} NYERI A SOROZATOT`):`${gameWord} ${gameNumber} · BO${settings.bestOf}`;
    for(const prefix of ['','out-']){
      const format=$(prefix+'hud-series-label');if(format)format.textContent=`${gameWord} ${gameNumber}`;
      const boLabel=$(prefix+'hud-bo-label');if(boLabel)boLabel.textContent=`BO${settings.bestOf}`;
      const gameLabel=$(prefix+'series-game');if(gameLabel){gameLabel.textContent=seriesLabel;gameLabel.style.color=settings.seriesWins[0]>=targetWins?settings.homeColor:settings.seriesWins[1]>=targetWins?settings.awayColor:''}
      const homeLabel=$(prefix+'series-home-name'),awayLabel=$(prefix+'series-away-name');if(homeLabel)homeLabel.textContent=names.home;if(awayLabel)awayLabel.textContent=names.away;
      drawSeriesDots($(prefix+'series-home-dots'),settings.seriesWins[0],targetWins,settings.homeColor);
      drawSeriesDots($(prefix+'series-away-dots'),settings.seriesWins[1],targetWins,settings.awayColor);
    }
    document.querySelectorAll('[data-bestof]').forEach(button=>{const selected=Number(button.dataset.bestof)===Number(settings.bestOf);button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected))});
    const stateLabel=$('preview-data-state');if(stateLabel){stateLabel.textContent=hasGameData?'LIVE':'VÁRAKOZÁS';stateLabel.classList.toggle('is-live',hasGameData)}
    renderScene();
  }
  // Stats API sends UpdateState continuously. Keep that hot path to text/style
  // updates; rebuilding the full HUD and scene on every packet causes layout churn.
  let lastSceneTick=0,livePlayerKey='';
  function setTextIfChanged(id,value){const el=$(id),text=String(value);if(el&&el.textContent!==text)el.textContent=text}
  function formatStartCountdown(){const total=Math.ceil(Math.max(0,startCountdownEnd-Date.now())/1000);return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
  setInterval(()=>{if(screenMode==='intermission')document.querySelectorAll('[data-countdown]').forEach(node=>node.textContent=formatStartCountdown())},250);
  function renderLiveHud(){
    for(const [id,value] of Object.entries({'hud-home-score':match.homeScore,'out-home-score':match.homeScore,'hud-away-score':match.awayScore,'out-away-score':match.awayScore,'hud-clock':match.clock,'out-clock':match.clock}))setTextIfChanged(id,value);
    renderPlayerLists();
    const state=$('preview-data-state');if(state){const label=hasGameData?'LIVE':'VÁRAKOZÁS';setTextIfChanged('preview-data-state',label);state.classList.toggle('is-live',hasGameData)}
    // Game HUD does not need scene rendering. Other scene layouts refresh at 4 Hz.
    if(screenMode!=='game'&&Date.now()-lastSceneTick>=250){lastSceneTick=Date.now();renderScene()}
  }
  let screenMode=new URLSearchParams(location.search).get('screen')||'game';
  let startCountdownEnd=Number(new URLSearchParams(location.search).get('countdownEnd'))||Date.now()+600000;
  function renderScene(){
    const sceneTargets=[$('broadcast-scene'),$('preview-broadcast-scene')].filter(Boolean);if(!sceneTargets.length)return;
    const queryLanguage=new URLSearchParams(location.search).get('lang');
    const language=queryLanguage==='en'||queryLanguage==='hu'?queryLanguage:(settings.language==='en'?'en':'hu');
    const names=[settings.homeName||'HOME',settings.awayName||'AWAY'],colors=[settings.homeColor,settings.awayColor];
    const previewDemo=!hasGameData&&!new URLSearchParams(location.search).has('overlay');
    const demoPlayers=[
      {Name:'JUICY',Score:482,Goals:2,Assists:1,Saves:2,Shots:4,Demolitions:1,TeamNum:0},
      {Name:'ATOW',Score:365,Goals:1,Assists:1,Saves:1,Shots:3,Demolitions:0,TeamNum:0},
      {Name:'VATIRA',Score:297,Goals:0,Assists:0,Saves:3,Shots:2,Demolitions:1,TeamNum:0},
      {Name:'JOYO',Score:428,Goals:2,Assists:0,Saves:1,Shots:5,Demolitions:0,TeamNum:1},
      {Name:'SEIKOO',Score:344,Goals:1,Assists:1,Saves:2,Shots:3,Demolitions:1,TeamNum:1},
      {Name:'APPARENTLYJACK',Score:251,Goals:0,Assists:1,Saves:2,Shots:2,Demolitions:0,TeamNum:1}
    ];
    const displayPlayers=previewDemo?demoPlayers:match.players.flat(),displayClock=previewDemo?'2:52':match.clock;
    const displayScores=previewDemo?[2,1]:[match.homeScore,match.awayScore],displayWinner=previewDemo?0:match.winner;
    const safe=value=>escapeHtml(value??'');
    const all=displayPlayers,players=all.slice().sort((a,b)=>(Number(b.Score)||0)-(Number(a.Score)||0));
    const seriesPlayers=(previewDemo?demoPlayers:Object.values(settings.seriesPlayerStats||{})).slice().sort((a,b)=>(Number(b.Score)||0)-(Number(a.Score)||0));
    const seriesTable=seriesPlayers.map(p=>`<tr><td>${safe(p.Name)}</td><td>${p.Score||0}</td><td>${p.Goals||0}</td><td>${p.Assists||0}</td><td>${p.Saves||0}</td><td>${p.Shots||0}</td></tr>`).join('');
    const statsTable=players.map(p=>`<tr><td>${safe(p.Name)}</td><td>${Number(p.Score)||0}</td><td>${Number(p.Goals)||0}</td><td>${Number(p.Assists)||0}</td><td>${Number(p.Saves)||0}</td><td>${Number(p.Shots)||0}</td></tr>`).join('');
    const teams=[0,1].map(team=>players.filter(player=>Number(player.TeamNum)===team).sort((a,b)=>(Number(b.Score)||0)-(Number(a.Score)||0)));
    const playerCount=Math.max(1,...teams.map(team=>team.length));
    const statRows=[['Score','Score'],['Goals','Goals'],['Assists','Assists'],['Shots','Shots'],['Saves','Saves'],['Demos','Demos']];
    const metricValue=(player,key)=>Number(key==='Demos'?(player?.Demos??player?.Demolitions):player?.[key])||0;
    const postgameMarkup=`<div class="scene-card postgame-card" style="--player-count:${playerCount}">
      <header class="postgame-header">
        <div class="postgame-team postgame-home" style="--team:${colors[0]}"><img src="${safe(settings.homeLogo)}" alt=""><h2>${safe(names[0])}</h2><strong>${displayScores[0]}</strong></div>
        <div class="postgame-versus"><b>VS</b><small>GAME ${settings.seriesWins[0]+settings.seriesWins[1]+1} | BO${settings.bestOf}</small></div>
        <div class="postgame-team postgame-away" style="--team:${colors[1]}"><strong>${displayScores[1]}</strong><h2>${safe(names[1])}</h2><img src="${safe(settings.awayLogo)}" alt=""></div>
      </header>
      <div class="postgame-grid">
        <div class="postgame-player-head postgame-home-names">${Array.from({length:playerCount},(_,i)=>`<b>${safe(teams[0][i]?.Name||'—')}</b>`).join('')}</div>
        <b class="postgame-section-title">STATISTICS</b>
        <div class="postgame-player-head postgame-away-names">${Array.from({length:playerCount},(_,i)=>`<b>${safe(teams[1][i]?.Name||'—')}</b>`).join('')}</div>
        ${statRows.map(([key,label])=>`<div class="postgame-stat-row"><div class="postgame-values">${Array.from({length:playerCount},(_,i)=>`<b>${metricValue(teams[0][i],key)}</b>`).join('')}</div><b class="postgame-stat-label">${label}</b><div class="postgame-values">${Array.from({length:playerCount},(_,i)=>`<b>${metricValue(teams[1][i],key)}</b>`).join('')}</div></div>`).join('')}
      </div>
    </div>`;
    const teamBlock=i=>`<article class="scene-team" style="--team:${colors[i]}"><img src="${safe(settings[i?'awayLogo':'homeLogo'])}" alt=""><h2>${safe(names[i])}</h2><strong>${displayScores[i]}</strong></article>`;
    const scenes={game:'',goal:`<div class="scene-card goal-card"><small>ROCKET LEAGUE · GOAL</small><h1>GÓL!</h1><p>${safe(previewDemo?'JUICY':match.lastScorer||'Várakozás a gólra')}</p><b>${safe(displayClock)}</b></div>`,win:`<div class="scene-card winner-card"><small>MECCS VÉGE</small><h1>GYŐZTES</h1>${displayWinner===null?'<p>A győztes a meccs végén jelenik meg.</p>':teamBlock(displayWinner)}<p>${safe(displayWinner===null?'':names[displayWinner])}</p></div>`,postgame:`<div class="scene-card"><small>POST GAME · ${safe(displayClock)}</small><h1>MECCS STATISZTIKÁK</h1><div class="scene-teams">${teamBlock(0)}${teamBlock(1)}</div><table><thead><tr><th>JÁTÉKOS</th><th>PONT</th><th>GÓL</th><th>GÓLP.</th><th>VÉDÉS</th><th>LÖVÉS</th></tr></thead><tbody>${statsTable||'<tr><td colspan="6">A játékosadatok a Stats API-ból érkeznek.</td></tr>'}</tbody></table></div>`,series:`<div class="scene-card series-card"><small>POST SERIES · BO${settings.bestOf}</small><h1>SOROZAT STATISZTIKÁK</h1><div class="scene-teams">${teamBlock(0)}${teamBlock(1)}</div><div class="series-count">${previewDemo?'2':settings.seriesWins[0]} <i>—</i> ${previewDemo?'1':settings.seriesWins[1]}</div><table><thead><tr><th>JÁTÉKOS</th><th>PONT</th><th>GÓL</th><th>GÓLP.</th><th>VÉDÉS</th><th>LÖVÉS</th></tr></thead><tbody>${seriesTable||'<tr><td colspan="6">Az első meccs után jelennek meg.</td></tr>'}</tbody></table></div>`,mvp:`<div class="scene-card mvp-card"><small>SOROZAT MVP</small><h1>${safe(seriesPlayers[0]?.Name||players[0]?.Name||'MVP')}</h1><p>${seriesPlayers.length?'A sorozat összesített Stats API adatai alapján':'A játékosadatok a Stats API-ból érkeznek.'}</p><div class="mvp-stats">${['Score','Goals','Assists','Saves','Shots','Demolitions'].map((key,i)=>`<span><b>${Number((seriesPlayers[0]||players[0])?.[key])||0}</b>${['PONT','GÓL','GÓLP.','VÉDÉS','LÖVÉS','DEMÓ'][i]}</span>`).join('')}</div></div>`,caster:`<div class="scene-card caster-card"><small>HOLOFYRN BROADCAST</small><h1>CASTER KÉPERNYŐ</h1><div class="scene-teams">${teamBlock(0)}<b class="versus-mark">VS</b>${teamBlock(1)}</div><p>${safe(displayClock)} · GAME ${settings.seriesWins[0]+settings.seriesWins[1]+1} · BO${settings.bestOf}</p><footer>A játékállás és az óra a Rocket League Stats API-ból érkezik.</footer></div>`,'media-frame':`<div class="media-frame-scene" aria-hidden="true"><div class="media-frame-window"></div></div>`,intermission:`<div class="start-screen"><header><span>GAME DAY</span></header><div class="start-date">${new Date().toLocaleDateString(language==='en'?'en-US':'hu-HU',{year:'numeric',month:'long',day:'numeric'}).toUpperCase()}</div><div class="start-next">COMING UP NEXT</div><div class="start-match"><div class="start-team-name start-home-name"><h2>${safe(names[0])}</h2>${settings.homeTag?`<small>${safe(settings.homeTag)}</small>`:''}</div><div class="start-logo" style="--team:${colors[0]}"><img src="${safe(settings.homeLogo)}" alt="${safe(names[0])} logo"></div><div class="start-versus"><small>MATCH ${settings.seriesWins[0]+settings.seriesWins[1]+1}</small><strong>VS</strong><b>BO${settings.bestOf}</b></div><div class="start-logo" style="--team:${colors[1]}"><img src="${safe(settings.awayLogo)}" alt="${safe(names[1])} logo"></div><div class="start-team-name start-away-name"><h2>${safe(names[1])}</h2>${settings.awayTag?`<small>${safe(settings.awayTag)}</small>`:''}</div></div><div class="start-countdown-label">STREAM STARTING IN</div><div class="start-countdown" data-countdown>${formatStartCountdown()}</div></div>`};
    let markup=scenes[screenMode]??scenes.game;
    if(screenMode==='interview-home'||screenMode==='interview-away'){
      const team=screenMode==='interview-away'?1:0,side=team===0?'home':'away';
      const teamName=settings[side+'Name']||names[team],teamLogo=settings[side+'Logo']||'',teamColor=colors[team];
      markup=`<div class="scene-card interview-card interview-${side}" style="--team:${teamColor}">
        <div class="interview-layout">
          <div class="interview-video-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <section class="interview-branding">
            <small>${language==='en'?'HOLOFYRN ESPORTS · INTERVIEW':'HOLOFYRN ESPORTS · INTERJÚ'}</small>
            <div class="interview-team"><img src="${safe(teamLogo)}" alt=""><b>${safe(teamName)}</b></div>
            <h1>${language==='en'?'INTERVIEW':'INTERJÚ'}</h1>
            <div class="interview-name-slot" aria-label="Empty name field for an OBS text source"></div>
            <span class="interview-label">${language==='en'?'POST MATCH':'MÉRKŐZÉS UTÁN'}</span>
          </section>
        </div>
      </div>`;
    }
    if(screenMode==='postgame')markup=postgameMarkup;
    if(screenMode==='win'){
      const winner=displayWinner===null?0:displayWinner,loser=1-winner;
      const winnerSide=winner===0?'home':'away',loserSide=loser===0?'home':'away';
      const winnerColor=colors[winner],winnerName=names[winner];
      markup=`<div class="scene-card winner-victory-card" style="--winner-color:${winnerColor}">
        <div class="winner-watermark">${language==='en'?'VICTORY':'GYŐZELEM'}</div><i class="winner-corner winner-corner-top"></i><i class="winner-corner winner-corner-bottom"></i>
        <main class="winner-main"><img class="winner-main-logo" src="${safe(settings[winnerSide+'Logo'])}" alt="${safe(winnerName)} logo"><small class="winner-overline">${language==='en'?'MATCH WINNER':'MECCSGYŐZTES'}</small><h1>${language==='en'?'VICTORY':'GYŐZELEM'}</h1><b class="winner-team-label">${language==='en'?'TEAM':'CSAPAT'} ${safe(winnerName)}</b></main>
        <aside class="winner-score-rail"><div class="winner-rail-matchup"><img src="${safe(settings[winnerSide+'Logo'])}" alt=""><b>VS</b><img src="${safe(settings[loserSide+'Logo'])}" alt=""></div><div class="winner-final-score"><strong>${displayScores[winner]}</strong><i>:</i><strong>${displayScores[loser]}</strong></div><small>${language==='en'?'FINAL SCORE':'VÉGEREDMÉNY'}</small><span>GAME ${settings.seriesWins[0]+settings.seriesWins[1]+1} · BO${settings.bestOf}</span></aside>
      </div>`;
    }
    if(language==='en'){
      const translations={'GÓL!</h1>':'GOAL!</h1>','Várakozás a gólra':'Waiting for a goal','MECCS VÉGE':'GAME OVER','GYŐZTES':'WINNER','A győztes a meccs végén jelenik meg.':'Winner will appear when the match ends.','MECCS STATISZTIKÁK':'POST GAME STATS','SOROZAT STATISZTIKÁK':'SERIES STATS','JÁTÉKOS':'PLAYER','PONT':'SCORE','GÓL':'GOALS','GÓLP.':'ASSISTS','VÉDÉS':'SAVES','LÖVÉS':'SHOTS','A játékosadatok a Stats API-ból érkeznek.':'Player stats will appear when data arrives from the Stats API.','Az első meccs után jelennek meg.':'Stats will appear after the first game.','SOROZAT MVP':'SERIES MVP','A sorozat összesített Stats API adatai alapján':'Based on aggregated Stats API data for the series','DEMÓ':'DEMOS','CASTER KÉPERNYŐ':'CASTER SCREEN','A játékállás és az óra a Rocket League Stats API-ból érkezik.':'Score and clock are provided by the Rocket League Stats API.','SZÜNET':'INTERMISSION','FOLYTATÁS HAMAROSAN':'COMING UP NEXT'};
      for(const [hu,en] of Object.entries(translations))markup=markup.split(hu).join(en);
    }
    sceneTargets.forEach(scene=>{if(scene.innerHTML!==markup)scene.innerHTML=markup});
    const canvas=document.querySelector('.preview-canvas');if(canvas)canvas.dataset.screen=screenMode;
    document.querySelectorAll('.screen-picker [data-screen]').forEach(button=>button.classList.toggle('selected',button.dataset.screen===screenMode));
    const screenName=$('preview-screen-name');if(screenName)screenName.textContent=({game:language==='en'?'MATCH HUD':'MECCS HUD',goal:language==='en'?'GOAL':'GÓL',win:language==='en'?'WINNER':'GYŐZTES',postgame:language==='en'?'POST GAME':'MECCS STATISZTIKA',series:language==='en'?'SERIES STATS':'SOROZAT STATISZTIKA',mvp:'MVP',caster:'CASTER',intermission:language==='en'?'INTERMISSION':'SZÜNET'})[screenMode]||'MECCS HUD';
    if($('preview-screen-name')&&screenMode==='interview-home')$('preview-screen-name').textContent=language==='en'?'HOME INTERVIEW':'HAZAI INTERJÚ';if($('preview-screen-name')&&screenMode==='interview-away')$('preview-screen-name').textContent=language==='en'?'AWAY INTERVIEW':'VENDÉG INTERJÚ';
    document.body.dataset.screen=screenMode;document.body.dataset.language=language;document.documentElement.lang=language;
  }
  function drawSeriesDots(container,wins,count,color){if(!container)return;container.replaceChildren(...Array.from({length:count},(_,i)=>{const dot=document.createElement('i');dot.style.setProperty('--dot-color',color);if(i<wins)dot.classList.add('won');return dot}))}
  function saveSettings(){localStorage.setItem('holofyrnHubTeams',JSON.stringify(settings))}
  function setConnection(isConnected,message){
    connected=isConnected;if(!isConnected)hasGameData=false;if($('connection-dot'))$('connection-dot').classList.toggle('connected',isConnected);
    if($('connection-label'))$('connection-label').textContent=isConnected?(hasGameData?'ROCKET LEAGUE · ÉLŐ ADATOK':'ROCKET LEAGUE · MECCSRE VÁR'):(message||'ROCKET LEAGUE · LEVÁLASZTVA');
    if($('api-status'))$('api-status').textContent=isConnected?(hasGameData?'Élő játékadatok érkeznek a Rocket League-ből.':'A kapcsolat létrejött; az API meccsadatokra vár.'):'A HUD automatikusan csatlakozik a játék helyi Stats API-jához.';
    render();
  }
  function showGoal(data){
    const scorer=data.Scorer?.Name||'GOAL';
    match.lastScorer=scorer;renderScene();
    if(screenMode==='goal')document.body.dataset.goalActive='true';
    // GoalScored.GoalSpeed is already reported on the HUD's km/h scale here;
    // converting it again was shrinking normal goal speeds to 2–3 km/h.
    const speed=Math.round(Number(data.GoalSpeed)||0);
    match.replayGoal={scorer,speed,team:Number(data.Scorer?.TeamNum)};
    const goalColor=Number(data.Scorer?.TeamNum)===1?settings.awayColor:settings.homeColor;
    for(const prefix of ['','out-']){const scorerNode=$(`${prefix}goal-scorer`),speedNode=$(`${prefix}goal-speed`),toast=$(`${prefix}goal-toast`);if(scorerNode)scorerNode.textContent=scorer;if(speedNode)speedNode.textContent=`${speed} KM/H`;if(toast){toast.style.setProperty('--goal-color',goalColor);toast.classList.remove('visible');void toast.offsetWidth;toast.classList.add('visible')}}
    updateReplayHud();
    clearTimeout(goalTimer);goalTimer=setTimeout(()=>{document.querySelectorAll('.goal-toast').forEach(e=>e.classList.remove('visible'));if(screenMode==='goal')document.body.dataset.goalActive='false'},4200);
  }
  function updateReplayHud(){
    const goal=match.replayGoal;
    for(const prefix of ['','out-']){
      const hud=$(prefix+'replay-hud');if(hud)hud.classList.toggle('is-hidden',!match.replaying);
      const scorer=$(prefix+'replay-scorer'),speed=$(prefix+'replay-speed');
      if(scorer)scorer.textContent=goal?.scorer||'GOAL';
      if(speed)speed.textContent=`${goal?.speed||0} KM/H`;
      if(hud)hud.style.setProperty('--replay-color',goal?.team===1?settings.awayColor:settings.homeColor);
    }
  }
  function onMessage(raw){
    let message;try{message=JSON.parse(raw)}catch{return}
    const data=typeof message.Data==='string'?(()=>{try{return JSON.parse(message.Data)}catch{return {}}})():message.Data||{};
    if(message.Event==='UpdateState'){
      const firstUpdate=!hasGameData;
      hasGameData=true;
      if(firstUpdate)setConnection(true);
      const game=data.Game||{};
      const blue=(game.Teams||[]).find(team=>Number(team.TeamNum)===0), orange=(game.Teams||[]).find(team=>Number(team.TeamNum)===1);
      if(blue)match.homeScore=Number(blue.Score)||0;if(orange)match.awayScore=Number(orange.Score)||0;
      if(Number.isFinite(Number(game.TimeSeconds))){const sec=Math.max(0,Math.floor(Number(game.TimeSeconds)));match.clock=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}${game.bOvertime?' · OT':''}`}
      const players=data.Players||[];match.players=[players.filter(p=>Number(p.TeamNum)===0),players.filter(p=>Number(p.TeamNum)===1)];
      const targetInfo=game.bHasTarget===true?game.Target:null;
      const target=targetInfo?.Name?players.find(p=>p.Name===targetInfo.Name&&Number(p.TeamNum)===Number(targetInfo.TeamNum)&&Number(p.Shortcut)===Number(targetInfo.Shortcut))||players.find(p=>p.Name===targetInfo.Name&&Number(p.TeamNum)===Number(targetInfo.TeamNum))||players.find(p=>p.Name===targetInfo.Name)||null:null;
      match.watchedPlayer=target;
      renderLiveHud();
    }else if(message.Event==='GoalScored'){
      const scorerName=String(data.Scorer?.Name||'').trim(),scorerTeam=Number(data.Scorer?.TeamNum);
      // Rocket League emits a placeholder GoalScored with an empty scorer when a goal replay ends.
      // It is a replay notification, not a new goal; counting it also briefly corrupts the HUD score.
      if(!scorerName||(scorerTeam!==0&&scorerTeam!==1))return;
      const location=data.ImpactLocation||{};
      const goalKey=[data.MatchGuid||'',data.GoalTime??'',data.Scorer?.Name||'',data.Scorer?.TeamNum??'',data.GoalSpeed??'',location.X??'',location.Y??'',location.Z??''].join(':');
      const now=Date.now();
      const identity={match:String(data.MatchGuid||''),time:String(data.GoalTime??''),scorer:scorerName,team:String(scorerTeam)};
      const sameReplayGoal=replayGoalIdentity&&now<=replayGoalIdentity.until
        &&identity.scorer&&identity.team
        &&identity.scorer===replayGoalIdentity.scorer&&identity.team===replayGoalIdentity.team
        &&(!identity.match||!replayGoalIdentity.match||identity.match===replayGoalIdentity.match)
        &&(!identity.time||!replayGoalIdentity.time||identity.time===replayGoalIdentity.time);
      const sameRecentGoal=lastGoalIdentity&&now-lastGoalAt<15000
        &&identity.scorer&&identity.team
        &&identity.scorer===lastGoalIdentity.scorer&&identity.team===lastGoalIdentity.team
        &&(!identity.match||!lastGoalIdentity.match||identity.match===lastGoalIdentity.match)
        &&(!identity.time||!lastGoalIdentity.time||identity.time===lastGoalIdentity.time)
        &&((identity.match&&lastGoalIdentity.match&&identity.match===lastGoalIdentity.match)
          ||(identity.time&&lastGoalIdentity.time&&identity.time===lastGoalIdentity.time));
      // Replay packets often omit the speed or position data from the original goal.
      // Match scorer/team around the replay so the duplicate cannot show a 0 KM/H toast.
      if(sameReplayGoal||((sameRecentGoal||goalKey===lastGoalKey)&&now-lastGoalAt<15000))return;
      lastGoalKey=goalKey;lastGoalAt=now;
      lastGoalIdentity=identity;replayGoalIdentity=null;
      if(scorerTeam===0)match.homeScore++;else match.awayScore++;render();showGoal(data);
    }
    else if(message.Event==='GoalReplayStart'){match.replaying=true;if(lastGoalIdentity)replayGoalIdentity={...lastGoalIdentity,until:Date.now()+12000};document.querySelectorAll('.goal-toast').forEach(toast=>toast.classList.remove('visible'));updateReplayHud()}
    else if(message.Event==='GoalReplayEnd'){match.replaying=false;updateReplayHud()}
    else if(message.Event==='MatchEnded')recordSeriesWinner(data);
    else if(message.Event==='MatchCreated'){if(settings.seriesWins.some(wins=>wins>=Math.ceil(Number(settings.bestOf)/2))){settings.seriesWins=[0,0];settings.endedMatches=[];settings.seriesPlayerStats={};saveSettings();render();window.hubCloud?.publish({...settings})}}
    else if(message.Event==='MatchInitialized'){match.homeScore=0;match.awayScore=0;match.clock='5:00';match.players=[[],[]];match.watchedPlayer=null;match.winner=null;match.replaying=false;match.replayGoal=null;lastGoalKey='';lastGoalAt=0;lastGoalIdentity=null;replayGoalIdentity=null;updateReplayHud();render()}
    else if(message.Event==='MatchDestroyed'){hasGameData=false;match.clock='--:--';match.players=[[],[]];match.watchedPlayer=null;match.replaying=false;updateReplayHud();setConnection(connected);render()}
  }
  function recordSeriesWinner(data){
    const winner=Number(data.WinnerTeamNum);if(winner!==0&&winner!==1)return;
    match.winner=winner;renderScene();
    const matchId=String(data.MatchGuid||'');
    const key=matchId?`match:${matchId}`:`no-guid:${match.homeScore}-${match.awayScore}:${winner}:${Math.floor(Date.now()/15000)}`;
    try{
      const latest=JSON.parse(localStorage.getItem('holofyrnHubTeams')||'{}');settings={...settings,...latest};
      if(!Array.isArray(settings.endedMatches))settings.endedMatches=[];
      if(settings.endedMatches.includes(key))return;
      settings.endedMatches=[...settings.endedMatches,key].slice(-40);
      if(!settings.seriesPlayerStats||typeof settings.seriesPlayerStats!=='object')settings.seriesPlayerStats={};
      match.players.flat().forEach(player=>{const id=`${player.TeamNum}:${player.Name}`;const total=settings.seriesPlayerStats[id]||{Name:player.Name,TeamNum:player.TeamNum,Score:0,Goals:0,Assists:0,Saves:0,Shots:0,Demolitions:0};for(const stat of ['Score','Goals','Assists','Saves','Shots','Demolitions'])total[stat]=(Number(total[stat])||0)+(Number(player[stat])||0);settings.seriesPlayerStats[id]=total});
      if(!Array.isArray(settings.seriesWins))settings.seriesWins=[0,0];
      const winTarget=Math.ceil(Number(settings.bestOf)/2);
      if(settings.seriesWins[winner]<winTarget)settings.seriesWins[winner]++;
      saveSettings();render();window.hubCloud?.publish({...settings});
    }catch{settings.seriesWins[winner]=Math.min(Math.ceil(Number(settings.bestOf)/2),settings.seriesWins[winner]+1);render();window.hubCloud?.publish({...settings})}
  }
  function connect(){
    clearTimeout(retryTimer);if(socket){socket.onclose=null;socket.close()}
    let ws;try{ws=new WebSocket('ws://127.0.0.1:49124')}catch{setConnection(false,'ROCKET LEAGUE · API HIBA');retryTimer=setTimeout(connect,5000);return}
    socket=ws;ws.onopen=()=>{hasGameData=false;setConnection(true)};ws.onmessage=event=>onMessage(event.data);
    ws.onerror=()=>setConnection(false,'ROCKET LEAGUE · API NEM ELÉRHETŐ');
    ws.onclose=()=>{if(socket===ws){setConnection(false);retryTimer=setTimeout(connect,5000)}};
  }
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function loadLogo(file){
    const normalize=image=>{
      const size=512,padding=32,scale=Math.min((size-padding*2)/image.width,(size-padding*2)/image.height);
      const width=image.width*scale,height=image.height*scale,canvas=document.createElement('canvas');
      canvas.width=size;canvas.height=size;
      const context=canvas.getContext('2d');if(!context)throw new Error('Canvas is unavailable');
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
      context.drawImage(image,(size-width)/2,(size-height)/2,width,height);
        const dataUrl=canvas.toDataURL('image/webp',.92);
        if(dataUrl.length>280000)throw new Error('A logó túl nagy a Firestore-hoz (max. 280 KB). Próbálj kisebb képet.');
        return dataUrl;
    };
    try{const bitmap=await createImageBitmap(file);try{return normalize(bitmap)}finally{bitmap.close()}}
    catch{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>{try{resolve(normalize(image))}catch(error){reject(error)}};image.onerror=reject;image.src=reader.result};reader.onerror=reject;reader.readAsDataURL(file)})}
  }
  function bindLogo(side){
    $(`${side}-file`).addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;const input=event.currentTarget,localStatus=$(`${side}-upload-status`),status=$('cloud-status');const show=(text,state)=>{if(localStatus){localStatus.textContent=text;localStatus.dataset.state=state}};try{show('Kép feldolgozása…','pending');const dataUrl=await loadLogo(file);settings[side+'Logo']=dataUrl;updateSettings();show('A logó beállítva; mentés Firestore-ba…','pending')}catch(error){const message=`A logó beállítása nem sikerült: ${error.message}`;show(message,'error');if(status){status.textContent=message;status.dataset.state='error'}}finally{input.value=''}});
    $(`${side}-remove`).addEventListener('click',()=>{settings[side+'Logo']='';updateSettings();const status=$(`${side}-upload-status`);if(status){status.textContent='A logó eltávolítva.';status.dataset.state='success'}});
    $(`${side}-name`).addEventListener('input',e=>{if(settings[side+'Name']!==e.target.value){settings.seriesWins=[0,0];settings.endedMatches=[]}settings[side+'Name']=e.target.value;settings.seriesPlayerStats={};updateSettings()});
    $(`${side}-tag`).addEventListener('input',e=>{settings[side+'Tag']=e.target.value;updateSettings()});
    $(`${side}-color`).addEventListener('input',e=>{settings[side+'Color']=e.target.value;updateSettings()});
  }
  bindLogo('home');bindLogo('away');
  document.querySelectorAll('[data-bestof]').forEach(button=>button.addEventListener('click',()=>{const value=Number(button.dataset.bestof);if(value===Number(settings.bestOf))return;settings.bestOf=value;settings.seriesWins=[0,0];settings.endedMatches=[];settings.seriesPlayerStats={};updateSettings()}));
  $('reset-series').addEventListener('click',()=>{settings.seriesWins=[0,0];settings.endedMatches=[];updateSettings()});
  window.addEventListener('storage',event=>{if(event.key==='holofyrnHubTeams'){try{settings={...defaults,...JSON.parse(event.newValue||'{}')};updateSettings({publishCloud:false})}catch{}}});
  let lastCloudSettings='';
  window.addEventListener('hub-cloud-settings',event=>{
    const remote=event.detail?.settings;if(!remote||typeof remote!=='object')return;
    let signature;try{signature=JSON.stringify(remote)}catch{return}
    if(signature===lastCloudSettings)return;lastCloudSettings=signature;
    settings={...defaults,...remote};
    if(!['hu','en'].includes(settings.language))settings.language='hu';
    if(![3,5,7].includes(Number(settings.bestOf)))settings.bestOf=5;else settings.bestOf=Number(settings.bestOf);
    if(!/^#[0-9a-f]{6}$/i.test(settings.homeColor||''))settings.homeColor=defaults.homeColor;
    if(!/^#[0-9a-f]{6}$/i.test(settings.awayColor||''))settings.awayColor=defaults.awayColor;
    if(settings.awayColor.toLowerCase()==='#10b9e9')settings.awayColor=defaults.awayColor;
    if(settings.awayLogo?.includes(encodeURIComponent('#10b9e9')))settings.awayLogo=defaults.awayLogo;
    if(!Array.isArray(settings.seriesWins))settings.seriesWins=[0,0];
    settings.seriesWins=settings.seriesWins.slice(0,2).map(value=>Math.max(0,Number(value)||0));while(settings.seriesWins.length<2)settings.seriesWins.push(0);
    if(!Array.isArray(settings.endedMatches))settings.endedMatches=[];
    if(!settings.seriesPlayerStats||typeof settings.seriesPlayerStats!=='object'||Array.isArray(settings.seriesPlayerStats))settings.seriesPlayerStats={};
    updateSettings({publishCloud:false});
  });
  window.addEventListener('hub-cloud-status',event=>{const status=$('cloud-status');if(status){status.textContent=event.detail.text;status.dataset.state=event.detail.state||'offline'}for(const side of ['home','away']){const localStatus=$(`${side}-upload-status`);if(!localStatus)continue;if(event.detail.state==='error'&&(localStatus.dataset.state==='idle'||localStatus.dataset.state==='pending')){localStatus.textContent=event.detail.text;localStatus.dataset.state='error'}else if(event.detail.saved&&event.detail.state==='online'&&localStatus.dataset.state==='pending'){localStatus.textContent='A logó Firestore-ba mentve, OBS-szel szinkronizálva.';localStatus.dataset.state='success'}}});
  window.addEventListener('hub-cloud-ready',event=>{if(event.detail?.isOwner&&!event.detail.hasSettings)window.hubCloud?.publish({...settings})});
  function getOverlayUrl(screen='game',language=settings.language){const url=new URL(location.href);url.search='';url.searchParams.set('overlay','');url.searchParams.set('screen',screen);if(screen==='intermission')url.searchParams.set('countdownEnd',String(startCountdownEnd));url.searchParams.set('lang',language==='en'?'en':'hu');if(window.HUB_ROOM_ID)url.searchParams.set('room',window.HUB_ROOM_ID);url.hash='';return url}
  function updateRoomLink(){const room=window.HUB_ROOM_ID;if(room){$('room-badge').textContent=`SZOBAKÓD ${room.slice(0,8).toUpperCase()}`;$('obs-url').textContent=getOverlayUrl().href}}
  document.querySelectorAll('.screen-picker [data-screen]').forEach(button=>{button.dataset.label=button.textContent;button.addEventListener('click',()=>{screenMode=button.dataset.screen;if(screenMode==='intermission')startCountdownEnd=Date.now()+600000;document.querySelectorAll('.screen-picker [data-screen]').forEach(item=>item.classList.toggle('selected',item===button));render();const url=getOverlayUrl(screenMode);$('screen-url').textContent=url.href;navigator.clipboard?.writeText(url.href).then(()=>{button.textContent='Link másolva ✓';setTimeout(()=>button.textContent=button.dataset.label,1400)}).catch(()=>{})})});
  document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>{settings.language=button.dataset.language;updateSettings()}));
  function updateLanguageButtons(){document.querySelectorAll('[data-language]').forEach(button=>button.classList.toggle('selected',button.dataset.language===settings.language))}
  window.addEventListener('hub-room-ready',updateRoomLink);
  function copyObsLink(button){navigator.clipboard.writeText(getOverlayUrl().href).then(()=>{const old=button.textContent;button.textContent='MÁSOLVA ✓';setTimeout(()=>button.textContent=old,1500)}).catch(()=>{button.textContent='A LINKET NEM SIKERÜLT MÁSOLNI';setTimeout(()=>button.textContent='LINK MÁSOLÁSA ↗',2000)})}
  $('obs-copy').addEventListener('click',e=>copyObsLink(e.currentTarget));$('obs-copy-bottom').addEventListener('click',e=>copyObsLink(e.currentTarget));$('api-retry').addEventListener('click',connect);
  updateSettings();
  if(new URLSearchParams(location.search).has('overlay')){document.body.classList.add('overlay-mode');$('setup').remove();$('obs-output').classList.add('overlay-active')}
  connect();
})();
