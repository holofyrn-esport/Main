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
  let socket, retryTimer, connected=false, hasGameData=false, goalTimer;
  const match = {homeScore:0,awayScore:0,clock:'--:--',players:[[],[]],watchedPlayer:null,lastScorer:'',winner:null};
  const safeImage=(img,src)=>{if(!img)return;img.src=src||'';img.style.visibility=src?'visible':'hidden'};
  function setupHudWidgets(){
    for(const stageId of ['overlay-stage','obs-output']){
      const stage=$(stageId),center=stage?.querySelector('.bar-center');
      if(!stage||!center)continue;
      stage.querySelector('.hud-boost-meter')?.remove();
      const ribbon=stage.querySelector('.series-ribbon'),meta=center.querySelector('.bar-meta');
      if(ribbon&&meta)meta.after(ribbon);
      const prefix=stageId==='obs-output'?'out-':'';
      const widget=document.createElement('div');widget.className='boost is-hidden';widget.id=prefix+'boost-widget';widget.setAttribute('role','meter');widget.setAttribute('aria-label','Player boost');widget.setAttribute('aria-valuemin','0');widget.setAttribute('aria-valuemax','100');widget.setAttribute('aria-valuenow','0');
      const inner=document.createElement('div'),value=document.createElement('strong'),label=document.createElement('small');
      value.id=prefix+'boost-value';value.textContent='0';label.textContent='BOOST';inner.append(value,label);widget.append(inner);stage.append(widget);
    }
  }
  setupHudWidgets();
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
    const vals={'hud-home-score':match.homeScore,'out-home-score':match.homeScore,'hud-away-score':match.awayScore,'out-away-score':match.awayScore,'hud-clock':match.clock,'out-clock':match.clock};
    Object.entries(vals).forEach(([id,value])=>{const el=$(id);if(el)el.textContent=value});
    const watched=match.watchedPlayer,watchedSide=Number(watched?.TeamNum)===1?'away':'home',playerLanguage=new URLSearchParams(location.search).get('lang')||settings.language;
    const watchedName=watched?.Name||(playerLanguage==='en'?'WAITING FOR PLAYER':'VÁRAKOZÁS A JÁTÉKOSRA');
    const rawBoost=watched?.Boost,boostValue=Number(rawBoost),hasBoost=!!watched&&rawBoost!==undefined&&rawBoost!==null&&Number.isFinite(boostValue);
    const playerBoost=hasBoost?Math.max(0,Math.min(100,boostValue)):0;
    for(const prefix of ['','out-']){
      const name=$(prefix+'stats-home-name');if(name)name.textContent=watchedName;
      safeImage($(prefix+'stats-home-logo'),settings[watchedSide+'Logo']);
      const card=$(prefix+'stats-home-name')?.closest('.team-stats');if(card)card.style.setProperty('--player-color',settings[watchedSide+'Color']);
      if(card)card.classList.toggle('is-hidden',!watched);
      const boostWidget=$(prefix+'boost-widget'),boostLabel=$(prefix+'boost-value');
      if(boostWidget){boostWidget.classList.toggle('is-hidden',!hasBoost);boostWidget.style.setProperty('--boost-color',settings[watchedSide+'Color']||defaults[watchedSide+'Color']);boostWidget.style.setProperty('--boost-value',`${playerBoost}%`);boostWidget.setAttribute('aria-valuenow',String(playerBoost))}
      if(boostLabel)boostLabel.textContent=String(playerBoost);
      const target=$(prefix+'home-players');
      if(target){const labels=playerLanguage==='en'?['SCORE','GOALS','ASSISTS','SAVES','SHOTS']:['PONT','GÓL','GÓLP.','VÉDÉS','LÖVÉS'];const keys=['Score','Goals','Assists','Saves','Shots'];target.innerHTML=`<div class="watched-player-stats">${keys.map((key,index)=>`<span><small>${labels[index]}</small><b>${Number(watched?.[key])||0}</b></span>`).join('')}</div>`}
    }
    const language=playerLanguage;
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
  function renderLiveHud(){
    for(const [id,value] of Object.entries({'hud-home-score':match.homeScore,'out-home-score':match.homeScore,'hud-away-score':match.awayScore,'out-away-score':match.awayScore,'hud-clock':match.clock,'out-clock':match.clock}))setTextIfChanged(id,value);
    const watched=match.watchedPlayer,side=Number(watched?.TeamNum)===1?'away':'home';
    const language=new URLSearchParams(location.search).get('lang')||settings.language;
    const name=watched?.Name||(language==='en'?'WAITING FOR PLAYER':'VÁRAKOZÁS A JÁTÉKOSRA');
    const playerKey=`${side}:${name}:${Boolean(watched)}`;
    for(const prefix of ['','out-']){
      const card=$(prefix+'stats-home-name')?.closest('.team-stats');
      if(card)card.classList.toggle('is-hidden',!watched);
      if(playerKey!==livePlayerKey){
        setTextIfChanged(prefix+'stats-home-name',name);
        safeImage($(prefix+'stats-home-logo'),settings[side+'Logo']);
        if(card)card.style.setProperty('--player-color',settings[side+'Color']);
      }
      const boost=Number(watched?.Boost),hasBoost=!!watched&&watched.Boost!==undefined&&watched.Boost!==null&&Number.isFinite(boost),value=hasBoost?Math.max(0,Math.min(100,boost)):0;
      const widget=$(prefix+'boost-widget');if(widget){widget.classList.toggle('is-hidden',!hasBoost);const color=settings[side+'Color']||defaults[side+'Color'],fill=`${value}%`;if(widget.style.getPropertyValue('--boost-color')!==color)widget.style.setProperty('--boost-color',color);if(widget.style.getPropertyValue('--boost-value')!==fill)widget.style.setProperty('--boost-value',fill);if(widget.getAttribute('aria-valuenow')!==String(value))widget.setAttribute('aria-valuenow',String(value))}
      setTextIfChanged(prefix+'boost-value',value);
      const target=$(prefix+'home-players');
      if(target){
        if(!target.querySelector('.watched-player-stats')){const labels=language==='en'?['SCORE','GOALS','ASSISTS','SAVES','SHOTS']:['PONT','GÓL','GÓLP.','VÉDÉS','LÖVÉS'];target.innerHTML=`<div class="watched-player-stats">${labels.map(label=>`<span><small>${label}</small><b>0</b></span>`).join('')}</div>`}
        const values=['Score','Goals','Assists','Saves','Shots'].map(key=>Number(watched?.[key])||0),nodes=target.querySelectorAll('.watched-player-stats b');
        values.forEach((v,i)=>{if(nodes[i]&&nodes[i].textContent!==String(v))nodes[i].textContent=String(v)});
      }
    }
    livePlayerKey=playerKey;
    const state=$('preview-data-state');if(state){const label=hasGameData?'LIVE':'VÁRAKOZÁS';setTextIfChanged('preview-data-state',label);state.classList.toggle('is-live',hasGameData)}
    // Game HUD does not need scene rendering. Other scene layouts refresh at 4 Hz.
    if(screenMode!=='game'&&Date.now()-lastSceneTick>=250){lastSceneTick=Date.now();renderScene()}
  }
  const screenMode=new URLSearchParams(location.search).get('screen')||'game';
  function renderScene(){
    const scene=$('broadcast-scene');if(!scene)return;
    const queryLanguage=new URLSearchParams(location.search).get('lang');
    const language=queryLanguage==='en'||queryLanguage==='hu'?queryLanguage:(settings.language==='en'?'en':'hu');
    const names=[settings.homeName||'HOME',settings.awayName||'AWAY'],colors=[settings.homeColor,settings.awayColor];
    const safe=value=>escapeHtml(value??'');
    const all=match.players.flat(),players=all.slice().sort((a,b)=>(Number(b.Score)||0)-(Number(a.Score)||0));
    const seriesPlayers=Object.values(settings.seriesPlayerStats||{}).sort((a,b)=>(Number(b.Score)||0)-(Number(a.Score)||0));
    const seriesTable=seriesPlayers.map(p=>`<tr><td>${safe(p.Name)}</td><td>${p.Score||0}</td><td>${p.Goals||0}</td><td>${p.Assists||0}</td><td>${p.Saves||0}</td><td>${p.Shots||0}</td></tr>`).join('');
    const statsTable=players.map(p=>`<tr><td>${safe(p.Name)}</td><td>${Number(p.Score)||0}</td><td>${Number(p.Goals)||0}</td><td>${Number(p.Assists)||0}</td><td>${Number(p.Saves)||0}</td><td>${Number(p.Shots)||0}</td></tr>`).join('');
    const teamBlock=i=>`<article class="scene-team" style="--team:${colors[i]}"><img src="${safe(settings[i?'awayLogo':'homeLogo'])}" alt=""><h2>${safe(names[i])}</h2><strong>${i?match.awayScore:match.homeScore}</strong></article>`;
    const scenes={game:'',goal:`<div class="scene-card goal-card"><small>ROCKET LEAGUE · GOAL</small><h1>GÓL!</h1><p>${safe(match.lastScorer||'Várakozás a gólra')}</p><b>${safe(match.clock)}</b></div>`,win:`<div class="scene-card winner-card"><small>MECCS VÉGE</small><h1>GYŐZTES</h1>${match.winner===null?'<p>A győztes a meccs végén jelenik meg.</p>':teamBlock(match.winner)}<p>${safe(match.winner===null?'':names[match.winner])}</p></div>`,postgame:`<div class="scene-card"><small>POST GAME · ${safe(match.clock)}</small><h1>MECCS STATISZTIKÁK</h1><div class="scene-teams">${teamBlock(0)}${teamBlock(1)}</div><table><thead><tr><th>JÁTÉKOS</th><th>PONT</th><th>GÓL</th><th>GÓLP.</th><th>VÉDÉS</th><th>LÖVÉS</th></tr></thead><tbody>${statsTable||'<tr><td colspan="6">A játékosadatok a Stats API-ból érkeznek.</td></tr>'}</tbody></table></div>`,series:`<div class="scene-card"><small>POST SERIES · BO${settings.bestOf}</small><h1>SOROZAT STATISZTIKÁK</h1><div class="scene-teams">${teamBlock(0)}${teamBlock(1)}</div><div class="series-count">${settings.seriesWins[0]} <i>—</i> ${settings.seriesWins[1]}</div><table><thead><tr><th>JÁTÉKOS</th><th>PONT</th><th>GÓL</th><th>GÓLP.</th><th>VÉDÉS</th><th>LÖVÉS</th></tr></thead><tbody>${seriesTable||'<tr><td colspan="6">Az első meccs után jelennek meg.</td></tr>'}</tbody></table></div>`,mvp:`<div class="scene-card mvp-card"><small>SOROZAT MVP</small><h1>${safe(seriesPlayers[0]?.Name||players[0]?.Name||'MVP')}</h1><p>${seriesPlayers.length?'A sorozat összesített Stats API adatai alapján':'A játékosadatok a Stats API-ból érkeznek.'}</p><div class="mvp-stats">${['Score','Goals','Assists','Saves','Shots','Demolitions'].map((key,i)=>`<span><b>${Number((seriesPlayers[0]||players[0])?.[key])||0}</b>${['PONT','GÓL','GÓLP.','VÉDÉS','LÖVÉS','DEMÓ'][i]}</span>`).join('')}</div></div>`,caster:`<div class="scene-card caster-card"><small>HOLOFYRN BROADCAST</small><h1>CASTER KÉPERNYŐ</h1><div class="scene-teams">${teamBlock(0)}<b class="versus-mark">VS</b>${teamBlock(1)}</div><p>${safe(match.clock)} · GAME ${settings.seriesWins[0]+settings.seriesWins[1]+1} · BO${settings.bestOf}</p><footer>A játékállás és az óra a Rocket League Stats API-ból érkezik.</footer></div>`,intermission:`<div class="scene-card intermission-card"><small>HOLOFYRN ESPORTS</small><h1>SZÜNET</h1><div class="scene-teams">${teamBlock(0)}${teamBlock(1)}</div><p>FOLYTATÁS HAMAROSAN</p><footer>GAME ${settings.seriesWins[0]+settings.seriesWins[1]+1} · BO${settings.bestOf}</footer></div>`};
    let markup=scenes[screenMode]??scenes.game;
    if(language==='en'){
      const translations={'GÓL!</h1>':'GOAL!</h1>','Várakozás a gólra':'Waiting for a goal','MECCS VÉGE':'GAME OVER','GYŐZTES':'WINNER','A győztes a meccs végén jelenik meg.':'Winner will appear when the match ends.','MECCS STATISZTIKÁK':'POST GAME STATS','SOROZAT STATISZTIKÁK':'SERIES STATS','JÁTÉKOS':'PLAYER','PONT':'SCORE','GÓL':'GOALS','GÓLP.':'ASSISTS','VÉDÉS':'SAVES','LÖVÉS':'SHOTS','A játékosadatok a Stats API-ból érkeznek.':'Player stats will appear when data arrives from the Stats API.','Az első meccs után jelennek meg.':'Stats will appear after the first game.','SOROZAT MVP':'SERIES MVP','A sorozat összesített Stats API adatai alapján':'Based on aggregated Stats API data for the series','DEMÓ':'DEMOS','CASTER KÉPERNYŐ':'CASTER SCREEN','A játékállás és az óra a Rocket League Stats API-ból érkezik.':'Score and clock are provided by the Rocket League Stats API.','SZÜNET':'INTERMISSION','FOLYTATÁS HAMAROSAN':'COMING UP NEXT'};
      for(const [hu,en] of Object.entries(translations))markup=markup.split(hu).join(en);
    }
    scene.innerHTML=markup;document.body.dataset.screen=screenMode;document.body.dataset.language=language;document.documentElement.lang=language;
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
    const speed=Math.round((Number(data.GoalSpeed)||0)*0.036);
    const goalColor=Number(data.Scorer?.TeamNum)===1?settings.awayColor:settings.homeColor;
    for(const prefix of ['','out-']){const scorerNode=$(`${prefix}goal-scorer`),speedNode=$(`${prefix}goal-speed`),toast=$(`${prefix}goal-toast`);if(scorerNode)scorerNode.textContent=scorer;if(speedNode)speedNode.textContent=`${speed} KM/H`;if(toast){toast.style.setProperty('--goal-color',goalColor);toast.classList.remove('visible');void toast.offsetWidth;toast.classList.add('visible')}}
    clearTimeout(goalTimer);goalTimer=setTimeout(()=>{document.querySelectorAll('.goal-toast').forEach(e=>e.classList.remove('visible'));if(screenMode==='goal')document.body.dataset.goalActive='false'},4200);
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
    }else if(message.Event==='GoalScored'){const team=Number(data.Scorer?.TeamNum);if(team===0)match.homeScore++;else if(team===1)match.awayScore++;render();showGoal(data)}
    else if(message.Event==='MatchEnded')recordSeriesWinner(data);
    else if(message.Event==='MatchCreated'){if(settings.seriesWins.some(wins=>wins>=Math.ceil(Number(settings.bestOf)/2))){settings.seriesWins=[0,0];settings.endedMatches=[];settings.seriesPlayerStats={};saveSettings();render();window.hubCloud?.publish({...settings})}}
    else if(message.Event==='MatchInitialized'){match.homeScore=0;match.awayScore=0;match.clock='5:00';match.players=[[],[]];match.watchedPlayer=null;match.winner=null;render()}
    else if(message.Event==='MatchDestroyed'){hasGameData=false;match.clock='--:--';match.players=[[],[]];match.watchedPlayer=null;setConnection(connected);render()}
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
  window.addEventListener('hub-cloud-settings',event=>{if(!event.detail?.settings)return;settings={...settings,...event.detail.settings};if(!Array.isArray(settings.seriesWins))settings.seriesWins=[0,0];if(!Array.isArray(settings.endedMatches))settings.endedMatches=[];updateSettings({publishCloud:false})});
  window.addEventListener('hub-cloud-status',event=>{const status=$('cloud-status');if(status){status.textContent=event.detail.text;status.dataset.state=event.detail.state||'offline'}for(const side of ['home','away']){const localStatus=$(`${side}-upload-status`);if(!localStatus)continue;if(event.detail.state==='error'&&(localStatus.dataset.state==='idle'||localStatus.dataset.state==='pending')){localStatus.textContent=event.detail.text;localStatus.dataset.state='error'}else if(event.detail.saved&&event.detail.state==='online'&&localStatus.dataset.state==='pending'){localStatus.textContent='A logó Firestore-ba mentve, OBS-szel szinkronizálva.';localStatus.dataset.state='success'}}});
  window.addEventListener('hub-cloud-ready',event=>{if(event.detail?.isOwner&&!event.detail.hasSettings)window.hubCloud?.publish({...settings})});
  function getOverlayUrl(screen='game',language=settings.language){const url=new URL(location.href);url.search='';url.searchParams.set('overlay','');url.searchParams.set('screen',screen);url.searchParams.set('lang',language==='en'?'en':'hu');if(window.HUB_ROOM_ID)url.searchParams.set('room',window.HUB_ROOM_ID);url.hash='';return url}
  function updateRoomLink(){const room=window.HUB_ROOM_ID;if(room){$('room-badge').textContent=`SZOBAKÓD ${room.slice(0,8).toUpperCase()}`;$('obs-url').textContent=getOverlayUrl().href}}
  document.querySelectorAll('[data-screen]').forEach(button=>{button.dataset.label=button.textContent;button.addEventListener('click',()=>{const url=getOverlayUrl(button.dataset.screen);$('screen-url').textContent=url.href;navigator.clipboard?.writeText(url.href).then(()=>{button.textContent='Link másolva ✓';setTimeout(()=>button.textContent=button.dataset.label,1400)}).catch(()=>{})})});
  document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>{settings.language=button.dataset.language;updateSettings()}));
  function updateLanguageButtons(){document.querySelectorAll('[data-language]').forEach(button=>button.classList.toggle('selected',button.dataset.language===settings.language))}
  window.addEventListener('hub-room-ready',updateRoomLink);
  function copyObsLink(button){navigator.clipboard.writeText(getOverlayUrl().href).then(()=>{const old=button.textContent;button.textContent='MÁSOLVA ✓';setTimeout(()=>button.textContent=old,1500)}).catch(()=>{button.textContent='A LINKET NEM SIKERÜLT MÁSOLNI';setTimeout(()=>button.textContent='LINK MÁSOLÁSA ↗',2000)})}
  $('obs-copy').addEventListener('click',e=>copyObsLink(e.currentTarget));$('obs-copy-bottom').addEventListener('click',e=>copyObsLink(e.currentTarget));$('api-retry').addEventListener('click',connect);
  updateSettings();
  if(new URLSearchParams(location.search).has('overlay')){document.body.classList.add('overlay-mode');$('setup').remove();$('obs-output').classList.add('overlay-active')}
  connect();
})();
