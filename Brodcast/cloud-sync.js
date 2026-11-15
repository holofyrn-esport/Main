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
const setStatus = (text, state = 'offline', extra = {}) => emit('hub-cloud-status', { text, state, ...extra });
const explainFirebaseError = error => {
  if (error?.code === 'auth/operation-not-allowed') return 'Engedélyezd a Firebase Console-ban az Anonymous és az Email/Password bejelentkezést.';
  if (error?.code === 'auth/unauthorized-domain') return `Add hozzá a(z) ${location.hostname} címet a Firebase Authentication engedélyezett domainjeihez.`;
  if (error?.code === 'permission-denied') return 'A Firestore elutasította a mentést. Ellenőrizd, hogy az új Broadcast Firestore-szabályok élesek-e, és a fiók jogosult szerkeszteni.';
  if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password' || error?.code === 'auth/user-not-found') return 'Hibás felhasználónév/e-mail vagy jelszó.';
  return error?.message || String(error);
};

let pendingSettings = null;
let authApi, auth, firestoreApi, settingsRef;
let canEdit = false;
let isOwner = false;
let cloudHasSettings = false;
let writeTimer;
let snapshotStarted = false;
window.hubCloud = { publish() {} };
emit('hub-room-ready', { roomId, overlayMode });

const appConfigured = ['apiKey', 'authDomain', 'projectId', 'appId'].every(key => Boolean(firebaseConfig[key]));
if (!appConfigured) {
  setStatus('A Firebase beállítása hiányzik.', 'offline');
} else if (!roomId || !/^[a-zA-Z0-9_-]{1,100}$/.test(roomId)) {
  setStatus('Hiányzik vagy érvénytelen az overlay szobaazonosítója.', 'offline');
} else {
  try {
    const [{ initializeApp }, loadedAuthApi, loadedFirestoreApi] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js')
    ]);
    authApi = loadedAuthApi;
    firestoreApi = loadedFirestoreApi;
    const app = initializeApp(firebaseConfig);
    auth = authApi.getAuth(app);
    const db = firestoreApi.getFirestore(app);
    settingsRef = firestoreApi.doc(db, 'broadcastHubs', roomId);

    window.hubCloud.publish = settings => {
      if (!settings) return;
      pendingSettings = settings;
      if (!canEdit) {
        setStatus('A szoba megtekinthető, de szerkesztéshez jelentkezz be egy jóváhagyott HoloFyrn Manager-fiókkal.', 'error');
        return;
      }
      clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        firestoreApi.setDoc(settingsRef, { settings: pendingSettings }, { merge: true })
          .then(() => setStatus('A csapatbeállítások és logók Firestore-ba mentve, OBS-szel szinkronizálva.', 'online', { saved: true }))
          .catch(error => setStatus(`A Firestore-mentés nem sikerült: ${explainFirebaseError(error)}`, 'error', { saved: true }));
      }, 220);
    };

    setStatus('Kapcsolódás a Broadcast Firestore-szinkronhoz…', 'pending');
    const refreshAccess = async user => {
      if (!user) return;
      const snapshot = await firestoreApi.getDoc(settingsRef);
      if (!snapshot.exists()) {
        await firestoreApi.setDoc(settingsRef, { ownerUid: user.uid });
        isOwner = true;
        cloudHasSettings = false;
      } else {
        isOwner = snapshot.data().ownerUid === user.uid;
        cloudHasSettings = Boolean(snapshot.data().settings);
      }
      canEdit = isOwner || user.isAnonymous === false;

      if (!snapshotStarted) {
        snapshotStarted = true;
        firestoreApi.onSnapshot(settingsRef, docSnapshot => {
          cloudHasSettings = docSnapshot.exists() && Boolean(docSnapshot.data().settings);
          if (cloudHasSettings) {
            pendingSettings = docSnapshot.data().settings;
            emit('hub-cloud-settings', { settings: pendingSettings });
            setStatus(canEdit
              ? 'A csapatbeállítások élőben szinkronizálva.'
              : 'A csapatbeállítások szinkronizálva. Szerkesztéshez jelentkezz be egy jóváhagyott Manager-fiókkal.', canEdit ? 'online' : 'error');
          } else if (overlayMode) {
            setStatus('Nincs még elmentett csapatbeállítás ehhez az overlay-linkhez.', 'error');
          }
        }, error => setStatus(`A felhőadatbázis nem érhető el: ${error.message}`, 'error'));
      }

      if (!canEdit) setStatus('A szoba megtekinthető, de szerkesztéshez jelentkezz be egy jóváhagyott HoloFyrn Manager-fiókkal.', 'error');
      emit('hub-cloud-ready', { roomId, isOwner: canEdit, hasSettings: cloudHasSettings });
      if (canEdit && pendingSettings && !cloudHasSettings) window.hubCloud.publish(pendingSettings);
      const loginStatus = document.getElementById('broadcast-login-status');
      if (loginStatus && !overlayMode) {
        loginStatus.textContent = user.isAnonymous ? 'Nincs bejelentkezve. A szoba létrehozója ezen a gépen továbbra is szerkeszthet.' : `Bejelentkezve: ${user.email || user.uid}`;
        loginStatus.dataset.state = user.isAnonymous ? '' : 'success';
      }
    };

    const initialUser = auth.currentUser || (await authApi.signInAnonymously(auth)).user;
    await refreshAccess(initialUser);

    const loginForm = document.getElementById('broadcast-login');
    loginForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const status = document.getElementById('broadcast-login-status');
      const submit = loginForm.querySelector('[type="submit"]');
      const data = new FormData(loginForm);
      const entered = String(data.get('username') || '').trim().toLowerCase();
      const username = entered.includes('@') ? entered : entered.replace(/[^a-z0-9._-]/g, '');
      const email = entered.includes('@') ? username : `${username}@noctiq.local`;
      if (status) { status.textContent = 'Bejelentkezés…'; status.dataset.state = ''; }
      if (submit) submit.disabled = true;
      try {
        const credential = await authApi.signInWithEmailAndPassword(auth, email, String(data.get('password') || ''));
        await refreshAccess(credential.user);
      } catch (error) {
        if (status) { status.textContent = explainFirebaseError(error); status.dataset.state = 'error'; }
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  } catch (error) {
    setStatus(`A Firebase kapcsolat nem indult el: ${error.message}`, 'error');
  }
}
