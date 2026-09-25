
// Loaded before concept.js. The imported UI calls these production services.
let services, model, publicModel, authenticatedUser, baseline, remoteData = {}, remoteProfiles = [];
let subscriptions = [], pendingWrites = 0, writeQueue = Promise.resolve(), syncMessage = '';
let availabilityOffset = 0, connectionEpoch = 0, liveReady = false, refreshDeferred = false, publicPublishStarted = false;
function today(){return model ? model.localDate() : new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);}
function emptyState(){return {currentUserId:'',activeTeam:'main',view:'overview',resultTab:'tournament',selectedLeagueId:null,leagueTab:'standings',calendarCursor:today().slice(0,7),sidebarOpen:!matchMedia("(max-width: 900px)").matches,teams:[],users:[],players:[],results:[],leagues:[],leagueGames:[],events:[],availability:[],notifications:[]};}
function currentUser(){return authenticatedUser ? state.users.find(u=>u.id===state.currentUserId && (u.authUid===authenticatedUser.uid || u.id===authenticatedUser.uid)) : null;}
function safeUrl(input, image=false){
  if(image && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(input))return input;
  try{const url=new URL(input);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
function availabilityWeekStart(){const date=new Date();date.setDate(date.getDate()-((date.getDay()+6)%7)+availabilityOffset*7);return model.localDate(date);}
function updateSyncStatus(){const el=document.getElementById('sync-status');if(el){el.textContent=syncMessage || (pendingWrites?'Saving…':liveReady?'Connected':'Connecting…');el.dataset.error=syncMessage?'true':'false';}}
function savePreferences(){try{localStorage.setItem('noctiq-manager-view',JSON.stringify(Object.fromEntries(['activeTeam','view','resultTab','selectedLeagueId','leagueTab','calendarCursor','sidebarOpen'].map(k=>[k,state[k]]))));}catch{/* View preferences are optional. */}}
function queueSave(){
  savePreferences();
  if(!liveReady || !currentUser() || !baseline)return false;
  const changes=model.changesBetween(baseline,state);
  if(!Object.keys(changes).length)return true;
  try{model.validateChanges(changes,currentUser(),baseline.players);}catch(error){state={...state,...structuredClone(baseline)};render();toast('Change rejected',error.message);return false;}
  const previous=structuredClone(baseline), epoch=connectionEpoch;
  baseline=structuredClone(state);pendingWrites++;syncMessage='';updateSyncStatus();
  writeQueue=writeQueue.then(async()=>{
    if(epoch!==connectionEpoch || !liveReady)throw new Error('The session or database connection has changed. Reload before trying again.');
    const {fire,db,storeRef}=services;
    await fire.runTransaction(db,async transaction=>{
      const main=await transaction.get(storeRef);
      const latest=main.exists()?main.data():{};
      const profileIds=new Set([currentUser().id,...(changes.users || []).map(c=>c.id)]);
      const freshProfiles=remoteProfiles.map(u=>({...u}));
      for(const id of profileIds){
        const snapshot=await transaction.get(fire.doc(db,'users',id));
        if(!snapshot.exists())throw new Error('An account profile is missing. Contact an administrator.');
        const profile={...snapshot.data(),id:snapshot.id},index=freshProfiles.findIndex(u=>u.id===id);
        if(index<0)freshProfiles.push(profile);else freshProfiles[index]=profile;
      }
      const {patch,userWrites}=model.toDatabase(latest,freshProfiles,authenticatedUser.uid,changes);
      if(Object.keys(patch).length){
        if(new TextEncoder().encode(JSON.stringify({...latest,...patch})).length>900000)throw new Error('The shared database document is nearly full. Export/archive old records before adding more.');
        transaction.set(storeRef,{...patch,updatedAt:fire.serverTimestamp()},{merge:true});
        if(['players','results','managerV8'].some(key=>key in patch)) transaction.set(services.publicRef,{...publicModel.publicHoloFyrnData({...latest,...patch}),publishedAt:fire.serverTimestamp()});
      }
      for(const profile of userWrites)transaction.set(fire.doc(db,'users',profile.id),profile,{merge:true});
    });
  }).catch(error=>{
    console.error('Manager save failed',error);
    if(epoch!==connectionEpoch)return;
    syncMessage='Not saved';
    // Do not report success or silently fall back to a browser-only database.
    liveReady=false;
    state={...state,...previous};baseline=structuredClone(previous);
    document.getElementById('modal-root').innerHTML='';
    render();
    openModal('Save failed',`<p>${esc(error.message)}</p><p>Your change was not confirmed by the database. Reload to fetch the latest data before trying again.</p><button class="btn primary" id="reload-data">Reload data</button>`,null);
    document.getElementById('reload-data').onclick=()=>location.reload();
  }).finally(()=>{pendingWrites--;if(epoch===connectionEpoch && !pendingWrites && liveReady)applyDatabase();updateSyncStatus();});
  return writeQueue;
}
function applyDatabase(){
  if(!authenticatedUser || !liveReady || pendingWrites)return;
  if(document.querySelector('#modal-root .modal') || document.activeElement?.matches('input,textarea,select')){refreshDeferred=true;return;}
  refreshDeferred=false;
  const mapped=model.fromDatabase(remoteData,remoteProfiles,authenticatedUser.uid);
  const me=mapped.users.find(u=>u.id===mapped.currentUserId);
  if(!me || me.approved===false){showAccessError('Your account is not enabled. Contact an administrator.');return;}
  state=normalizeState({...state,...mapped});
  if(!state.teams.some(t=>t.id===state.activeTeam))state.activeTeam=state.teams[0].id;
  baseline=structuredClone(state);render();
  if(!publicPublishStarted && ['admin','coach','manager','captain'].includes(me.role)){
    publicPublishStarted=true;
    publishPublicData().catch(error=>console.error('Public data publication failed',error));
  }
}
async function publishPublicData(){
  const {fire,db,storeRef,publicRef}=services;
  await fire.runTransaction(db,async transaction=>{
    const main=await transaction.get(storeRef);
    transaction.set(publicRef,{...publicModel.publicHoloFyrnData(main.exists()?main.data():{}),publishedAt:fire.serverTimestamp()});
  });
}
function showAccessError(message){liveReady=false;document.getElementById('modal-root').innerHTML='';document.getElementById('app').innerHTML=`<main class="login-screen"><section class="card login-card"><h1>HoloFyrn Manager</h1><p role="alert">${esc(message)}</p><button class="btn primary" id="access-logout">Log out</button><button class="btn" id="access-reload">Retry</button></section></main>`;document.getElementById('access-logout').onclick=()=>services.authApi.signOut(services.auth);document.getElementById('access-reload').onclick=()=>location.reload();}
function passwordChangeMarkup(){
  return `<details class="password-settings"><summary>Change password</summary><form id="password-change-form"><input type="text" name="username" autocomplete="username" value="${esc(services?.auth?.currentUser?.email || '')}" hidden><label class="field">Current password<input class="input" name="currentPassword" type="password" autocomplete="current-password" required></label><label class="field">New password<input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="6" required></label><label class="field">Confirm new password<input class="input" name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required></label><p class="profile-note">Use at least 6 characters.</p><p id="password-change-message" role="status" aria-live="polite"></p><button class="btn primary" type="submit">Update password</button></form></details>`;
}
function bindPasswordChange(){
  const form=document.getElementById('password-change-form');
  if(!form)return;
  form.onsubmit=async event=>{
    event.preventDefault();
    const button=form.querySelector('button[type=submit]'),message=form.querySelector('[role=status]');
    if(button.disabled || !form.reportValidity())return;
    message.textContent='';
    const current=form.elements.currentPassword.value,next=form.elements.newPassword.value;
    if(next!==form.elements.confirmPassword.value){message.textContent='The new passwords do not match.';return;}
    if(current===next){message.textContent='Choose a different password from your current one.';return;}
    const user=services?.auth?.currentUser;
    if(!user?.email || user.uid!==authenticatedUser?.uid){message.textContent='Please sign in again before changing your password.';return;}
    button.disabled=true;button.textContent='Updating…';
    try{
      const {authApi,auth}=services;
      const credential=authApi.EmailAuthProvider.credential(user.email,current);
      await authApi.reauthenticateWithCredential(user,credential);
      if(auth.currentUser?.uid!==user.uid)throw {code:'auth/user-mismatch'};
      await authApi.updatePassword(user,next);
      form.reset();
      message.textContent='Password updated successfully. Use your new password next time you sign in.';
    }catch(error){
      const messages={
        'auth/invalid-credential':'The current password is incorrect.',
        'auth/wrong-password':'The current password is incorrect.',
        'auth/too-many-requests':'Too many attempts. Please try again later.',
        'auth/weak-password':'Choose a stronger password with at least 6 characters.',
        'auth/password-does-not-meet-requirements':'This password does not meet the account password requirements. Choose a stronger password.',
        'auth/network-request-failed':'Connection failed. Check your connection and try again.',
        'auth/requires-recent-login':'Please sign in again before changing your password.',
        'auth/user-mismatch':'Your session changed. Please sign in again.',
        'auth/user-token-expired':'Your session expired. Please sign in again.'
      };
      message.textContent=messages[error.code] || 'Unable to update your password. Please try again.';
    }finally{
      form.elements.currentPassword.value='';
      button.disabled=false;button.textContent='Update password';
    }
  };
}
function showLogin(message=''){
  document.getElementById('app').innerHTML=`<main class="login-screen"><section class="card login-card"><div class="brand"><img src="assets/holofyrn-logo.png" alt="HoloFyrn"><div><div class="brand-title">HOLOFYRN</div><div class="brand-sub">Esports Management</div></div></div><h1>Welcome back.</h1><p class="page-sub">Sign in to your team workspace.</p><form id="login-form"><label class="field"><span>Username or email</span><input class="input" name="username" autocomplete="username" required></label><label class="field"><span>Password</span><input class="input" name="password" type="password" autocomplete="current-password" required></label><button class="btn primary" type="submit">Log in</button><p id="login-message" role="alert">${esc(message)}</p></form></section></main>`;
  document.getElementById('login-form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),message=document.getElementById('login-message');
    const username=form.elements.username.value.trim().toLowerCase(),email=username.includes('@')?username:`${username}@noctiq.local`;
    button.disabled=true;message.textContent='Signing in…';
    try{await services.authApi.signInWithEmailAndPassword(services.auth,email,form.elements.password.value);}catch(error){message.textContent=error.code==='auth/invalid-credential'?'Incorrect username or password.':error.code==='auth/too-many-requests'?'Too many attempts. Please try again later.':'Unable to sign in. Check your connection and try again.';button.disabled=false;}
  };
}
async function startManager(){
  try{
    const [data,publicData,{firebaseConfig},appApi,fire,authApi]=await Promise.all([import('./manager-data.mjs'),import('./public-data.mjs'),import('./firebaseConfig.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js')]);
    model=data;publicModel=publicData;
    const app=appApi.initializeApp(firebaseConfig),db=fire.initializeFirestore(app,{experimentalAutoDetectLongPolling:true,useFetchStreams:false}),auth=authApi.getAuth(app);
    services={appApi,fire,authApi,db,auth,firebaseConfig,storeRef:fire.doc(db,'noctiqManager','main'),publicRef:fire.doc(db,'holofyrnPublic','main')};
    authApi.onAuthStateChanged(auth,async user=>{
      const epoch=++connectionEpoch;subscriptions.forEach(fn=>fn());subscriptions=[];
      liveReady=false;syncMessage='';authenticatedUser=user;remoteData={};remoteProfiles=[];baseline=null;state=emptyState();publicPublishStarted=false;
      document.getElementById('modal-root').innerHTML='';
      if(!user){showLogin();return;}
      document.getElementById('app').innerHTML='<main class="login-screen"><section class="card login-card" role="status">Loading team data…</section></main>';
      try{
        const ownRef=fire.doc(db,'users',user.uid),own=await fire.getDoc(ownRef);
        if(epoch!==connectionEpoch)return;
        if(!own.exists()){showAccessError('No team profile is linked to this login. Ask an administrator to create the account.');return;}
        try{const prefs=JSON.parse(localStorage.getItem('noctiq-manager-view') || '{}');for(const key of ['activeTeam','view','resultTab','selectedLeagueId','leagueTab','calendarCursor','sidebarOpen'])if(key in prefs && key!=='sidebarOpen')state[key]=prefs[key];}catch{/* Ignore invalid preferences. */}
        let gotData=false,gotUsers=false;
        const ready=()=>{if(epoch!==connectionEpoch || syncMessage==='Not saved')return;if(gotData&&gotUsers){liveReady=true;applyDatabase();}};
        const fail=error=>{if(epoch===connectionEpoch){console.error(error);showAccessError('The database could not be loaded. Check your connection and Firestore access.');}};
        subscriptions.push(fire.onSnapshot(services.storeRef,snap=>{if(epoch!==connectionEpoch)return;remoteData=snap.exists()?snap.data():{};gotData=true;ready();},fail));
        subscriptions.push(fire.onSnapshot(fire.collection(db,'users'),snap=>{if(epoch!==connectionEpoch)return;remoteProfiles=snap.docs.map(d=>({...d.data(),id:d.id}));gotUsers=true;ready();},fail));
      }catch(error){if(epoch===connectionEpoch)showAccessError(error.code==='permission-denied'?'This login has no approved team profile or Firestore access. Ask an administrator to check the account.':error.message);}
    });
  }catch(error){console.error(error);document.getElementById('app').innerHTML='<main class="login-screen"><section class="card login-card"><h1>Connection unavailable</h1><p>Firebase could not be loaded. Open this page through the local server or the website, check your connection, then reload.</p><button class="btn primary" onclick="location.reload()">Retry</button></section></main>';}
}
function bindConnectedActions(){
  document.getElementById('account-settings')?.addEventListener('click',()=>openProfileModal());
  document.getElementById('logout')?.addEventListener('click',async()=>{if(pendingWrites){toast('Saving changes','Please wait before signing out.');return;}await services.authApi.signOut(services.auth);});
  document.getElementById('availability-prev')?.addEventListener('click',()=>{availabilityOffset--;render();});
  document.getElementById('availability-next')?.addEventListener('click',()=>{availabilityOffset++;render();});
  const search=document.querySelector('.searchbar input');
  if(search){search.setAttribute('aria-label','Search players, events and leagues');search.onkeydown=event=>{if(event.key!=='Enter')return;event.preventDefault();const q=search.value.trim().toLowerCase();if(!q)return;const players=state.players.filter(p=>`${p.name} ${p.rl}`.toLowerCase().includes(q));const events=visibleEventsForCurrentUser().filter(e=>e.title.toLowerCase().includes(q));const leagues=state.leagues.filter(l=>l.name.toLowerCase().includes(q));openModal('Search results',`<div class="search-results">${players.map(p=>`<button class="btn" data-found-player="${esc(p.id)}">Player · ${esc(p.name)}</button>`).join('')}${events.map(e=>`<button class="btn" data-found-event="${esc(e.id)}">Calendar · ${esc(e.title)}</button>`).join('')}${leagues.map(l=>`<button class="btn" data-found-league="${esc(l.id)}">League · ${esc(l.name)}</button>`).join('')}${!players.length&&!events.length&&!leagues.length?'<p class="empty">No results.</p>':''}</div>`,null);document.querySelectorAll('[data-found-player]').forEach(b=>b.onclick=()=>viewPlayer(playerById(b.dataset.foundPlayer)));document.querySelectorAll('[data-found-event]').forEach(b=>b.onclick=()=>eventDetailModal(state.events.find(e=>String(e.id)===b.dataset.foundEvent)));document.querySelectorAll('[data-found-league]').forEach(b=>b.onclick=()=>{state.selectedLeagueId=state.leagues.find(l=>String(l.id)===b.dataset.foundLeague).id;state.view='league';closeModal();render();});};}
}
function bindAdmin(){
  if(!isAdmin())return;
  document.querySelectorAll('[data-account-delete]').forEach(b=>b.onclick=()=>deleteAccountModal(userById(b.dataset.accountDelete)));
  document.getElementById('add-account')?.addEventListener('click',()=>accountModal());
  document.querySelectorAll('[data-account-edit]').forEach(b=>b.onclick=()=>accountModal(userById(b.dataset.accountEdit)));
  document.querySelectorAll('[data-player-rename]').forEach(b=>b.onclick=()=>playerNameModal(playerById(b.dataset.playerRename)));
  document.querySelectorAll('[data-account-toggle]').forEach(b=>{const user=userById(b.dataset.accountToggle);b.textContent=user.approved===false?'Enable':'Disable';b.disabled=user.id===state.currentUserId||user.deletionPending===true;b.onclick=()=>confirmModal(`${user.approved===false?'Enable':'Disable'} account?`,'This changes access to the manager. The Firebase login is retained.',()=>{user.approved=user.approved===false;save();render();});});
}
function playerNameModal(player){
  if(!isAdmin()||!player)return;
  openModal('Edit player profile name',`<label class="field" for="admin-player-name">Player profile name<input class="input" id="admin-player-name" value="${esc(player.name)}" maxlength="100" autocomplete="off"></label><p class="profile-note">This changes the player profile and public roster name. The linked account display name stays the same.</p><p id="admin-player-name-error" role="alert"></p>`,()=>{
    const name=value('admin-player-name').trim();
    if(!name){document.getElementById('admin-player-name-error').textContent='Enter a player profile name.';return;}
    if(name!==player.name){player.name=name;if(!save())return;}
    closeModal();render();
  });
}
async function requestAccountDeletion(userId){
  const {fire,db}=services;
  const targetRef=fire.doc(db,'users',userId);
  const requestRef=fire.doc(db,'accountDeletionRequests',userId);
  await fire.runTransaction(db,async transaction=>{
    const target=await transaction.get(targetRef);
    if(!target.exists())throw new Error('This account no longer exists. Reload the page.');
    if(target.data().authUid && target.data().authUid!==userId)throw new Error('This legacy account needs its Firebase UID corrected before deletion.');
    transaction.update(targetRef,{approved:false,deletionPending:true});
    transaction.set(requestRef,{userId,requestedBy:authenticatedUser.uid,status:'pending',requestedAt:fire.serverTimestamp()});
  });
}
function deleteAccountModal(user){
  if(!isAdmin()||!user||user.id===state.currentUserId)return;
  openModal('Request account deletion?',`<p>Remove access for <b>${esc(user.displayName)}</b> (@${esc(user.username)}) now and queue their Firebase login for deletion. The scheduled deletion worker completes the removal; player records and competition history remain.</p><label class="field" for="delete-account-confirm">Type the username to confirm<input class="input" id="delete-account-confirm" autocomplete="off" spellcheck="false"></label><p id="delete-account-error" role="alert"></p>`,async()=>{
    const button=document.getElementById('modal-save'),message=document.getElementById('delete-account-error');
    if(button.disabled)return;
    if(value('delete-account-confirm')!==user.username){message.textContent='Enter the exact username to confirm.';return;}
    if(pendingWrites){message.textContent='Wait for current changes to finish saving, then try again.';return;}
    if(!isAdmin()||user.id===state.currentUserId)return;
    button.disabled=true;button.textContent='Requesting…';message.textContent='';
    try{
      await requestAccountDeletion(user.id);
      closeModal();render();toast('Deletion queued',`${user.displayName} can no longer access the manager.`);
    }catch(error){
      message.textContent=error.code==='permission-denied'?'Administrator access or the account deletion Firestore rule is missing.':error.message||'Deletion request failed. Please retry.';
      button.disabled=false;button.textContent='Request deletion';
    }
  },'Request deletion');
  document.getElementById('modal-save').classList.add('danger');
}
function accountModal(user=null){
  if(!isAdmin())return;
  openModal(user?'Edit account':'Create account',`<div class="form-grid"><label class="field">Username<input class="input" id="account-username" value="${esc(user?.username || '')}" ${user?'disabled':''}></label><label class="field">Display name<input class="input" id="account-name" value="${esc(user?.displayName || '')}"></label><label class="field">Role<select class="select" id="account-role">${['player','coach','manager','captain','admin'].map(r=>`<option value="${r}" ${user?.role===r?'selected':''}>${r[0].toUpperCase()+r.slice(1)}</option>`).join('')}</select></label>${user?'':'<label class="field">Initial password<input class="input" id="account-password" type="password" autocomplete="new-password" minlength="6"></label>'}<p id="account-error" role="alert"></p></div>`,async()=>{
    const username=value('account-username').trim().toLowerCase(),name=value('account-name').trim(),role=value('account-role'),message=document.getElementById('account-error');
    if(!/^[a-z0-9._-]+$/.test(username)||!name){message.textContent='Enter a name and a username containing letters, numbers, dots, underscores or hyphens.';return;}
    if(user){
      if(user.id===state.currentUserId && role!=='admin'){message.textContent='Ask another administrator to change your own role.';return;}
      user.displayName=name;user.role=role;user.roleLabel=role[0].toUpperCase()+role.slice(1);save();closeModal();render();return;
    }
    if(value('account-password').length<6){message.textContent='Use a password of at least 6 characters.';return;}
    const button=document.getElementById('modal-save');button.disabled=true;
    let secondary,credential;
    try{
      const {appApi,authApi,fire,db,firebaseConfig}=services;
      secondary=appApi.initializeApp(firebaseConfig,`account-${crypto.randomUUID()}`);
      const secondaryAuth=authApi.getAuth(secondary);
      await authApi.setPersistence(secondaryAuth,authApi.inMemoryPersistence);
      credential=await authApi.createUserWithEmailAndPassword(secondaryAuth,`${username}@noctiq.local`,value('account-password'));
      await fire.setDoc(fire.doc(db,'users',credential.user.uid),{id:credential.user.uid,authUid:credential.user.uid,username,name,email:credential.user.email,role:role[0].toUpperCase()+role.slice(1),approved:true,canEdit:role==='admin',createdAt:new Date().toISOString()});
      closeModal();toast('Account created',name);
    }catch(error){
      if(credential)try{await services.authApi.deleteUser(credential.user);}catch{console.error('Account profile failed; remove the orphan login in Firebase Authentication.');}
      message.textContent=error.code==='auth/email-already-in-use'?'This username is already in use.':error.message;button.disabled=false;
    }finally{if(secondary)await services.appApi.deleteApp(secondary);}
  });
}
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeModal();document.querySelectorAll('.team-menu.open,.user-menu.open,.notification-panel.open').forEach(el=>el.classList.remove('open'));}});
document.addEventListener('focusout',()=>setTimeout(()=>{if(refreshDeferred)applyDatabase();},0));
document.addEventListener('click',()=>{if(refreshDeferred)setTimeout(applyDatabase,0);});
window.addEventListener('beforeunload',event=>{if(pendingWrites){event.preventDefault();event.returnValue='';}});
