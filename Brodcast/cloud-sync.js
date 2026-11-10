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
let storageReady = false;
let storage;
let authReady;
window.hubCloud = {
  publish() {},
  async uploadLogo(dataUrl, side) {
    if (!storageReady) throw new Error('A Firebase Storage kapcsolat nem érhető el.');
    if (!['home', 'away'].includes(side) || !/^[a-zA-Z0-9_-]{1,100}$/.test(roomId)) throw new Error('Érvénytelen szobaazonosító.');
    const user = await authReady;
    const [{ ref, uploadBytes, getDownloadURL }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-storage.js')
    ]);
    const blob = await (await fetch(dataUrl)).blob();
    const logoRef = ref(storage, `broadcast-logos/${user.uid}/${roomId}/${side}.webp`);
    await uploadBytes(logoRef, blob, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000,immutable' });
    return getDownloadURL(logoRef);
  }
};
emit('hub-room-ready', { roomId, overlayMode });

const appConfigured = ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket']
  .every(key => Boolean(firebaseConfig[key]));

if (!appConfigured) {
  setStatus('A Firebase beállítása hiányzik.', 'offline');
} else if (!roomId || !/^[a-zA-Z0-9_-]{1,100}$/.test(roomId)) {
  setStatus('Hiányzik vagy érvénytelen az overlay szobaazonosítója.', 'offline');
} else {
  try {
    const [{ initializeApp }, authApi, storageApi, firestoreApi] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-storage.js'),
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js')
    ]);
    const app = initializeApp(firebaseConfig);
    const auth = authApi.getAuth(app);
    const db = firestoreApi.getFirestore(app);
    storage = storageApi.getStorage(app);
    storageReady = true;
    authReady = authApi.signInAnonymously(auth).then(credential => credential.user);
    const settingsRef = firestoreApi.doc(db, 'broadcastHubs', roomId);
    let isOwner = false;
    let cloudHasSettings = false;
    let writeTimer;

    window.hubCloud.publish = settings => {
      if (!settings) return;
      pendingSettings = settings;
      if (!isOwner) return;
      clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        firestoreApi.setDoc(settingsRef, { settings: pendingSettings }, { merge: true })
          .then(() => setStatus('A csapatbeállítások élőben szinkronizálva.', 'online'))
          .catch(error => setStatus(`A felhőbe mentés nem sikerült: ${error.message}`, 'error'));
      }, 220);
    };

    setStatus('Kapcsolódás a Broadcast Firestore-szinkronhoz…', 'pending');
    authReady.then(async user => {
      const ownerKey = `broadcastHubOwner:${roomId}`;
      const knownOwner = localStorage.getItem(ownerKey);
      const snapshot = await firestoreApi.getDoc(settingsRef);
      if (snapshot.exists()) {
        isOwner = snapshot.data().ownerUid === user.uid;
        cloudHasSettings = Boolean(snapshot.data().settings);
      } else if (!knownOwner || knownOwner === user.uid) {
        await firestoreApi.setDoc(settingsRef, { ownerUid: user.uid });
        localStorage.setItem(ownerKey, user.uid);
        isOwner = true;
      } else {
        isOwner = knownOwner === user.uid;
      }
      firestoreApi.onSnapshot(settingsRef, docSnapshot => {
        cloudHasSettings = docSnapshot.exists() && Boolean(docSnapshot.data().settings);
        if (cloudHasSettings) {
          pendingSettings = docSnapshot.data().settings;
          emit('hub-cloud-settings', { settings: pendingSettings });
          setStatus('A csapatbeállítások élőben szinkronizálva.', 'online');
        } else if (overlayMode) {
          setStatus('Nincs még elmentett csapatbeállítás ehhez az overlay-linkhez.', 'error');
        }
      }, error => setStatus(`A felhőadatbázis nem érhető el: ${error.message}`, 'error'));

      if (!isOwner) setStatus('Ez a böngésző csak megtekintheti a beállításokat; a szerkesztés a létrehozó böngészőből érhető el.', 'error');
      emit('hub-cloud-ready', { roomId, isOwner, hasSettings: cloudHasSettings });
      if (isOwner && pendingSettings && !cloudHasSettings) window.hubCloud.publish(pendingSettings);
    }).catch(error => {
      emit('hub-cloud-ready', { roomId, isOwner: false, hasSettings: cloudHasSettings });
      setStatus(`Firebase bejelentkezés sikertelen: ${error.message}`, 'error');
    });
  } catch (error) {
    storageReady = false;
    setStatus(`A Firebase kapcsolat nem indult el: ${error.message}`, 'error');
  }
}
