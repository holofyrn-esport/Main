import { firebaseConfig } from './firebase-config.js';

const params = new URLSearchParams(location.search);
const overlayMode = params.has('overlay');
const ROOM_KEY = 'broadcastHubRoomId';
const createRoomId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
const roomId = overlayMode
  ? (params.get('room') || '')
  : (params.get('room') || localStorage.getItem(ROOM_KEY) || createRoomId());

if (!overlayMode && roomId) localStorage.setItem(ROOM_KEY, roomId);
window.HUB_ROOM_ID = roomId;

const emit = (name, detail = {}) => window.dispatchEvent(new CustomEvent(name, { detail }));
const setStatus = (text, state = 'offline') => emit('hub-cloud-status', { text, state });
let pendingSettings = null;
window.hubCloud = { publish(settings) { pendingSettings = settings; } };
emit('hub-room-ready', { roomId, overlayMode });

const configured = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId']
  .every(key => Boolean(firebaseConfig[key]));

if (!configured) {
  setStatus('A felhőszinkron Firebase-beállításra vár.', 'offline');
} else if (!roomId) {
  setStatus('Hiányzik a megosztott overlay szobaazonosítója.', 'offline');
} else {
  try {
    const [{ initializeApp }, { getDatabase, ref, set, onValue }, { getAuth, signInAnonymously }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js'),
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js')
    ]);
    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const settingsRef = ref(db, `hubs/${roomId}/settings`);
    let initialResolved = false;
    let cloudHasSettings = false;
    let ownerReady = overlayMode;
    let isOwner = false;
    let writeTimer;

    function queueWrite(settings) {
      if (!settings) return;
      pendingSettings = settings;
      if (!ownerReady || !initialResolved || !isOwner) return;
      clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        set(settingsRef, pendingSettings).then(() => setStatus('A csapatbeállítások élőben szinkronizálva.', 'online'))
          .catch(error => setStatus(`A felhőbe mentés nem sikerült: ${error.message}`, 'error'));
      }, 220);
    }

    window.hubCloud.publish = queueWrite;
    const settingsRefStatus = overlayMode ? 'Az overlay a megosztott beállításokra vár.' : 'Kapcsolódás a HUB felhőszinkronjához…';
    setStatus(settingsRefStatus, 'pending');

    onValue(settingsRef, snapshot => {
      initialResolved = true;
      cloudHasSettings = snapshot.exists();
      if (cloudHasSettings) {
        pendingSettings = snapshot.val();
        emit('hub-cloud-settings', { settings: pendingSettings });
        setStatus('A csapatbeállítások élőben szinkronizálva.', 'online');
      } else if (isOwner && pendingSettings) {
        queueWrite(pendingSettings);
      } else if (overlayMode) {
        setStatus('Nincs még elmentett csapatbeállítás ehhez az overlay-linkhez.', 'error');
      }
    }, error => setStatus(`A felhőadatbázis nem érhető el: ${error.message}`, 'error'));

    if (!overlayMode) {
      const auth = getAuth(app);
      signInAnonymously(auth).then(async credential => {
        const uid = credential.user.uid;
        const ownerKey = `broadcastHubOwner:${roomId}`;
        const knownOwner = localStorage.getItem(ownerKey);
        if (knownOwner === uid) {
          isOwner = true;
        } else if (!knownOwner) {
          try {
            await set(ref(db, `hubs/${roomId}/ownerUid`), uid);
            localStorage.setItem(ownerKey, uid);
            isOwner = true;
          } catch {
            isOwner = false;
          }
        }
        ownerReady = true;
        if (!isOwner) setStatus('Ez a böngésző csak megtekintheti a beállításokat; a szerkesztés a létrehozó böngészőből érhető el.', 'error');
        else if (!cloudHasSettings) queueWrite(pendingSettings);
        emit('hub-cloud-ready', { roomId, isOwner, hasSettings: cloudHasSettings });
      }).catch(error => {
        ownerReady = true;
        emit('hub-cloud-ready', { roomId, isOwner: false, hasSettings: cloudHasSettings });
        setStatus(`Firebase bejelentkezés sikertelen: ${error.message}`, 'error');
      });
    }
  } catch (error) {
    setStatus(`A Firebase kapcsolat nem indult el: ${error.message}`, 'error');
  }
}
