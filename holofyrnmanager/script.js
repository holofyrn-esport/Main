const sessionKey = "noctiq-manager-session";
const storeKey = "noctiq-manager-store";
const app = document.querySelector("#app");
let firebaseApp = null;
let db = null;
let auth = null;
let storeRef = null;
let publicRef = null;
let publicModel = null;
let usersRef = null;
let remoteApi = null;
let authApi = null;
let firebaseAppApi = null;
let firebaseConfigValue = null;
let accountCreationApp = null;
let accountCreationAuth = null;
let currentStore = null;
let currentRemoteData = null;
let currentRemoteUsers = [];
let publicPublishStarted = false;
let storageMode = "local";
let currentAuthUser = null;
let unsubscribeStore = null;
let unsubscribeUsers = null;
let authProfileCreationInProgress = false;

let currentPage = "dashboard";
let filters = {};
let filterTimer;
let calendarMonth = new Date();
let selectedCalendarItemKey = "";
let resultDraft = null;
let selectedReplayResultId = "";
let availabilityWeekOffset = 0;

const teams = [
  { id: "rls-academy", name: "Rls HoloFyrn Academy", label: "RLS Academy" },
  { id: "rls-eldr", name: "Rls HoloFyrn Eldr", label: "RLS Eldr" },
  { id: "main", name: "HoloFyrn Esports", label: "Main Team" },
  { id: "academy", name: "HoloFyrn Academy", label: "Academy" },
  { id: "rls", name: "HoloFyrn Esports RLS", label: "HoloFyrn Esports RLS" },
];

const eventColors = {
  Match: "#36d399",
  "League match": "#78e6a8",
  Scrim: "#3f96ff",
  Training: "#6fb6ff",
  Tournament: "#f2f5ff",
  Tryout: "#a65cff",
  Meeting: "#c34cff",
  Other: "#aab6d6",
};
const eventTypes = Object.keys(eventColors);
const playerRoles = ["Captain", "Coach", "Manager", "Player", "Sub"];
const weekModes = ["3s", "2s", "1s", "Hoops", "Dropshot", "Snowday", "Heatseeker", "4s", "Rumble", "Casual", "Freeplay", "Custom pack", "Workshop map"];
const trainingCategories = ["Shooting", "Dribbling", "Defending", "Aerial", "Recovery", "Mechanics", "Rotation", "Passing", "Other"];

const statKeys = ["mechanics", "rotation", "communication", "gameSense", "consistency", "mentality", "teamFit"];
const emptyStats = Object.fromEntries(statKeys.map((key) => [key, 5]));
const statLabels = {
  mechanics: "Mechanics",
  rotation: "Rotation",
  communication: "Communication",
  gameSense: "Game sense",
  consistency: "Consistency",
  mentality: "Mentality",
  teamFit: "Team fit",
};
const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const availabilitySlots = ["17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];
const weekDayLabels = { Hetfo: "Monday", Kedd: "Tuesday", Szerda: "Wednesday", Csutortok: "Thursday", Pentek: "Friday", Szombat: "Saturday", Vasarnap: "Sunday" };
const customMapOptions = ["Dribble Challenge 2", "Aim Training by Coco", "Speed Jump Rings", "Air Dribble Mele", "Hornets Nest", "Custom map"];
const customPackOptions = ["Aerial consistency", "Shooting consistency", "Shadow defense", "Backboard reads", "Custom pack"];
const workshopMapOptions = ["Dribble Challenge 2", "Aim Training by Coco", "Speed Jump Rings", "Air Dribble Mele", "Hornets Nest", "Custom workshop map"];
const sortLabels = {
  dateTime: "Date",
  opponent: "Opponent",
  level: "Level",
  teamId: "Team",
  prizeEur: "Prize",
  name: "Name",
  rlName: "Rocket League name",
  status: "Status",
  rank: "Rank",
  title: "Title",
  creatorName: "Creator",
  weeklyDay: "Weekly day",
  totalHours: "Weekly hours",
  peak1s: "Peak 1s MMR",
  peak2s: "Peak 2s MMR",
  peak3s: "Peak 3s MMR",
  contact: "Contact",
};
const resultTypes = ["Match", "Tournament"];
const logoMarkup = `<img class="brand-logo" src="assets/holofyrn-logo.png" alt="HoloFyrn logo">`;
const projectVersion = "v.1.0.1";

const adminUsers = [];
const playerStatUsers = [];
const playerUsers = [];
const builtInUsers = [...adminUsers, ...playerStatUsers, ...playerUsers];
const dataKeys = ["players", "tryouts", "scrims", "partners", "tournaments", "results", "events", "trainingRoutines", "trainingPresets", "weeks", "availability", "confirmationTemplates", "notifications"];
const demoIds = {
  players: new Set(["p1", "p2"]),
  tryouts: new Set(["tr1"]),
  scrims: new Set(["s1", "s2"]),
  partners: new Set(["sp1", "sp2"]),
  tournaments: new Set(["t1", "t2"]),
  events: new Set(["e1", "e2", "e3"]),
  trainingRoutines: new Set(["r1"]),
};

// Structured data model: User, Team, Player, Tryout, Scrim, ScrimPartner, Tournament, CalendarEvent.
const seedStore = {
  users: [],
  players: [],
  tryouts: [],
  scrims: [],
  partners: [],
  tournaments: [],
  results: [],
  events: [],
  trainingRoutines: [],
  trainingPresets: [],
  weeks: [],
  availability: [],
  confirmationTemplates: [],
  notifications: [],
};

const schemas = {
  scrims: {
    title: "Scrim entry",
    empty: { id: "", dateTime: "", durationMinutes: "90", opponent: "", level: "", teamId: "main", notes: "" },
    fields: [["dateTime", "Date and start time", "datetime-local"], ["durationMinutes", "Duration minutes", "number"], ["opponent", "Opponent"], ["level", "Level / MMR"], ["teamId", "HoloFyrn team", "team"], ["notes", "Notes", "textarea"]],
    headers: ["Date", "Duration", "Opponent", "Level", "Team", "Notes"],
    cells: (item) => [fmtRange(item), `${item.durationMinutes || 0} min`, item.opponent, item.level, teamName(item.teamId), item.notes],
    search: (item) => `${item.opponent} ${item.level} ${item.notes}`,
    sort: ["dateTime", "opponent", "level", "teamId"],
  },
  tournaments: {
    title: "Tournament entry",
    empty: { id: "", name: "", dateTime: "", durationMinutes: "180", prizeEur: "", link: "", notes: "", teamId: "main" },
    fields: [["name", "Tournament name"], ["dateTime", "Start time", "datetime-local"], ["durationMinutes", "Duration minutes", "number"], ["prizeEur", "Prize pool EUR", "number"], ["link", "Registration link", "url"], ["teamId", "HoloFyrn team", "team"], ["notes", "Notes", "textarea"]],
    headers: ["Date", "Duration", "Name", "Prize", "Team", "Link", "Notes"],
    cells: (item) => [fmtRange(item), `${item.durationMinutes || 0} min`, item.name, `${item.prizeEur || "-"} EUR`, teamName(item.teamId), item.link ? `<a href="${escapeAttr(item.link)}" target="_blank">Open</a>` : "-", item.notes],
    search: (item) => `${item.name} ${item.notes}`,
    sort: ["dateTime", "prizeEur", "teamId"],
  },
  players: {
    title: "Player profile",
    empty: { id: "", name: "", rlName: "", discord: "", teamId: "main", position: "Player", peak1s: "", peak2s: "", peak3s: "", profileLink: "", peaksUpdatedAt: "", publicBio: "", notes: "", stats: emptyStats },
    fields: [["name", "Name"], ["rlName", "Rocket League name"], ["discord", "Discord"], ["teamId", "Team", "team"], ["position", "Role / position", playerRoles], ["peak1s", "Peak 1s MMR", "number"], ["peak2s", "Peak 2s MMR", "number"], ["peak3s", "Peak 3s MMR", "number"], ["profileLink", "RL Tracker link", "url"], ["peaksUpdatedAt", "Peaks last updated", "date"], ["publicBio", "Public bio / training notes", "textarea"], ["notes", "Private coaching notes", "textarea"]],
    headers: ["RL", "Discord", "Team", "Role", "Peak MMR", "Tracker", "Notes"],
    cells: (item) => [item.rlName, item.discord, teamName(item.teamId), item.position, peakMmrStack(item), item.profileLink ? `<a href="${escapeAttr(item.profileLink)}" target="_blank" rel="noreferrer">Open</a>` : "-", item.notes],
    search: (item) => `${item.name} ${item.rlName} ${item.discord} ${item.peak1s} ${item.peak2s} ${item.peak3s}`,
    sort: ["name", "rlName", "teamId", "position"],
  },
  partners: {
    title: "Scrim partner",
    empty: { id: "", name: "", level: "", contact: "", availability: "", records: "", notes: "" },
    fields: [["name", "Team name"], ["level", "Approx. level / MMR"], ["contact", "Contact / Discord"], ["availability", "Availability", "textarea"], ["records", "Scrim records", "textarea"], ["notes", "Notes", "textarea"]],
    headers: ["Team", "Level", "Contact", "Availability", "Scrim records", "Notes"],
    cells: (item) => [item.name, item.level, item.contact, item.availability, multiline(item.records), item.notes],
    search: (item) => `${item.name} ${item.level} ${item.contact} ${item.availability} ${item.records} ${item.notes}`,
    sort: ["name", "level", "contact"],
  },
  availability: {
    title: "Availability entry",
    empty: { id: "", playerName: "", teamId: "main", day: "", date: "", startTime: "", endTime: "", status: "Available", notes: "" },
    fields: [["playerName", "Player"], ["teamId", "Team", "team"], ["day", "Day"], ["date", "Date", "date"], ["startTime", "Start", "time"], ["endTime", "End", "time"], ["status", "Status", ["Available", "Maybe", "Unavailable"]], ["notes", "Notes", "textarea"]],
    headers: ["Player", "Team", "Day/date", "Time", "Status", "Notes"],
    cells: (item) => [item.playerName || playerNameById(loadStore(), item.playerId), teamName(item.teamId), availabilityDayLabel(item), availabilityTimeLabel(item), availabilityStatusBadge(item.status), multiline(item.notes || "")],
    search: (item) => `${item.playerName} ${item.day} ${item.date} ${item.status} ${item.notes}`,
    sort: ["playerName", "teamId", "day", "date", "status"],
  },
  confirmationTemplates: {
    title: "Confirmation template",
    empty: { id: "", title: "", subject: "", message: "" },
    fields: [["title", "Template name"], ["subject", "Subject"], ["message", "Message", "textarea"]],
    headers: ["Template", "Subject", "Message"],
    cells: (item) => [item.title, item.subject, multiline(item.message || "")],
    search: (item) => `${item.title} ${item.subject} ${item.message}`,
    sort: ["title", "subject"],
  },
};

function loadStore() {
  return currentStore || normalizeStore(structuredClone(seedStore));
}

function stripDemoRows(key, rows = []) {
  const ids = demoIds[key];
  return ids ? rows.filter((item) => !ids.has(item.id)) : rows;
}

function cleanStoreForSave(store) {
  const cleanStore = {
    users: (store.users || []).filter((user) => !isBuiltInUser(user)).map(({ password, ...user }) => user),
    ...(store.managerV8 ? { managerV8: store.managerV8 } : {}),
  };
  dataKeys.forEach((key) => {
    const rows = stripDemoRows(key, store[key] || []);
    if (rows.length) cleanStore[key] = rows;
  });
  return cleanStore;
}

async function saveStore(store) {
  const cleanStore = cleanStoreForSave(store);
  currentStore = normalizeStore(cleanStore);
  if (storageMode === "remote" && remoteApi && storeRef) {
    try {
      // UI hides private staff notes, but this single-document Firestore model still sends the whole app object to authenticated clients.
      // True field-level privacy needs private staff data in separate documents guarded by role-based Firestore rules.
      const batch = remoteApi.writeBatch(db);
      batch.set(storeRef, { ...cleanStore, updatedAt: remoteApi.serverTimestamp() });
      const publisher = currentRemoteUsers.find(user => user.id === currentAuthUser?.uid || user.authUid === currentAuthUser?.uid);
      if (publicRef && publicModel && ["Admin", "Coach", "Manager", "Captain", "admin", "coach", "manager", "captain"].includes(publisher?.role)) {
        batch.set(publicRef, { ...publicModel.publicHoloFyrnData(cleanStore), publishedAt: remoteApi.serverTimestamp() });
      }
      await batch.commit();
      if (usersRef && publisher?.role?.toLowerCase() === "admin") {
        // A browser's list can be incomplete or stale. Missing profiles must
        // never be treated as account deletions during an ordinary save.
        await Promise.all(cleanStore.users.map((user) => remoteApi.setDoc(remoteApi.doc(db, "users", user.id), user, { merge: true })));
      }
      return true;
    } catch (error) {
      console.error("Remote save failed.", error);
      throw error;
    }
  }
  localStorage.setItem(storeKey, JSON.stringify(cleanStore));
  return true;
}

async function persistStore(store) {
  try {
    await saveStore(store);
    render();
    return true;
  } catch (error) {
    console.error(error);
    await showAlert(authMessage(error), { title: "Save failed", tone: "warning" });
    return false;
  }
}

async function publishPublicDataOnce() {
  if (publicPublishStarted || !currentRemoteData || !publicRef || !currentAuthUser) return;
  const publisher = currentRemoteUsers.find(user => user.id === currentAuthUser.uid || user.authUid === currentAuthUser.uid);
  if (!["Admin", "Coach", "Manager", "Captain", "admin", "coach", "manager", "captain"].includes(publisher?.role)) return;
  publicPublishStarted = true;
  try {
    await remoteApi.runTransaction(db, async transaction => {
      const snapshot = await transaction.get(storeRef);
      transaction.set(publicRef, { ...publicModel.publicHoloFyrnData(snapshot.exists() ? snapshot.data() : {}), publishedAt: remoteApi.serverTimestamp() });
    });
  } catch (error) { console.error("Public data publication failed.", error); }
}

async function saveUserProfile(profile) {
  if (storageMode !== "remote" || !remoteApi || !db) return;
  try {
    const profileRef = remoteApi.doc(db, "users", profile.id);
    await remoteApi.setDoc(profileRef, profile);
    const savedProfile = await remoteApi.getDoc(profileRef);
    if (!savedProfile.exists()) throw new Error(`Firestore user profile was not created: users/${profile.id}`);
    console.info(`Saved user profile to Firestore: users/${profile.id}`);
  } catch (error) {
    console.error("User profile save failed.", error);
    throw error;
  }
}

function applyRemoteStore() {
  const baseStore = currentRemoteData || structuredClone(seedStore);
  const users = currentRemoteUsers.length ? currentRemoteUsers : (baseStore.users || []);
  currentStore = normalizeStore({ ...baseStore, users });
  render();
}

async function setupFirebase() {
  try {
    const [{ firebaseConfig }, publicData, firebaseAppModule, firebaseFirestoreModule, firebaseAuthModule] = await Promise.all([
      import("./firebaseConfig.js"),
      import("./public-data.mjs"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
    ]);
    const firebaseReady = Object.values(firebaseConfig).every((value) => typeof value === "string" && value && !value.startsWith("PASTE_"));
    if (!firebaseReady) return false;
    firebaseAppApi = firebaseAppModule;
    firebaseConfigValue = firebaseConfig;
    firebaseApp = firebaseAppModule.initializeApp(firebaseConfig);
    db = firebaseFirestoreModule.initializeFirestore
      ? firebaseFirestoreModule.initializeFirestore(firebaseApp, {
        experimentalAutoDetectLongPolling: true,
        useFetchStreams: false,
      })
      : firebaseFirestoreModule.getFirestore(firebaseApp);
    auth = firebaseAuthModule.getAuth(firebaseApp);
    storeRef = firebaseFirestoreModule.doc(db, "noctiqManager", "main");
    publicRef = firebaseFirestoreModule.doc(db, "holofyrnPublic", "main");
    publicModel = publicData;
    usersRef = firebaseFirestoreModule.collection(db, "users");
    remoteApi = firebaseFirestoreModule;
    authApi = firebaseAuthModule;
    return true;
  } catch (error) {
    console.warn("Firebase unavailable, using local storage.", error);
    return false;
  }
}

function initLocalStore() {
  storageMode = "local";
  try {
    const savedStore = localStorage.getItem(storeKey);
    currentStore = normalizeStore(savedStore ? JSON.parse(savedStore) : structuredClone(seedStore));
  } catch (error) {
    console.warn("Local store could not be loaded, using seed data.", error);
    currentStore = normalizeStore(structuredClone(seedStore));
  }
  render();
}

async function initRemoteStore() {
  app.innerHTML = `<div class="auth-screen"><section class="auth-panel"><div class="brand">${logoMarkup}<div><strong>HoloFyrn Manager</strong><span>Loading Firebase...</span></div></div></section></div>`;
  try {
    const firebaseReady = await setupFirebase();
    if (!firebaseReady) {
      initLocalStore();
      return;
    }
    storageMode = "remote";
    authApi.onAuthStateChanged(auth, async (firebaseUser) => {
      currentAuthUser = firebaseUser;
      publicPublishStarted = false;
      if (unsubscribeStore) {
        unsubscribeStore();
        unsubscribeStore = null;
      }
      if (unsubscribeUsers) {
        unsubscribeUsers();
        unsubscribeUsers = null;
      }
      if (!firebaseUser) {
        localStorage.removeItem(sessionKey);
        currentRemoteData = null;
        currentRemoteUsers = [];
        currentStore = normalizeStore(structuredClone(seedStore));
        render();
        return;
      }
      localStorage.setItem(sessionKey, firebaseUser.uid);
      try {
        unsubscribeStore = remoteApi.onSnapshot(storeRef, (snapshot) => {
          currentRemoteData = snapshot.exists() ? snapshot.data() : structuredClone(seedStore);
          applyRemoteStore();
          publishPublicDataOnce();
        }, (error) => {
          console.error(error);
          initLocalStore();
        });
        unsubscribeUsers = remoteApi.onSnapshot(usersRef, (snapshot) => {
          currentRemoteUsers = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
          applyRemoteStore();
          publishPublicDataOnce();
        }, (error) => {
          console.error(error);
        });
      } catch (error) {
        console.error(error);
        currentStore = normalizeStore(structuredClone(seedStore));
        render();
      }
    });
  } catch (error) {
    console.error(error);
    initLocalStore();
  }
}

function normalizeStore(store) {
  const storedUsers = (store.users || [])
    .map((user) => ({ ...user, username: user.username || user.email || user.name || "" }))
    .filter((user) => !builtInUsers.some((builtInUser) => builtInUser.username.toLowerCase() === user.username.toLowerCase()))
    .map((user) => {
      const role = user.role === "Viewer" ? "Player" : (user.role || "Player");
      const { password, ...safeUser } = user;
      return { ...safeUser, name: safeUser.name || safeUser.username, email: safeUser.email || "", authUid: safeUser.authUid || safeUser.id, role, approved: safeUser.approved !== false, canEdit: role === "Admin" || Boolean(safeUser.canEdit), systemAdmin: false, playerStatsAccess: role === "Coach" || Boolean(safeUser.playerStatsAccess), coachAccess: role === "Coach" || Boolean(safeUser.coachAccess), managerAccess: role === "Manager" || Boolean(safeUser.managerAccess), captainAccess: role === "Captain" || Boolean(safeUser.captainAccess) };
    });
  const players = stripDemoRows("players", store.players || []).map((player) => ({
    ...player,
    position: normalizePlayerRole(player.position || player.status),
    peak1s: player.peak1s || "",
    peak2s: player.peak2s || player.mmr || "",
    peak3s: player.peak3s || "",
    profileLink: player.profileLink || "",
    peaksUpdatedAt: player.peaksUpdatedAt || "",
    publicBio: player.publicBio || player.about || "",
    notes: player.notes || "",
    stats: { ...emptyStats, ...(player.stats || {}) },
  }));
  const trainingRoutines = stripDemoRows("trainingRoutines", store.trainingRoutines || []).map((routine) => ({
    ...routine,
    creatorId: routine.creatorId || routine.userId || "",
    visibility: routine.visibility || (routine.isPreset ? "global" : "private"),
    customPackMinutes: routine.customPackMinutes || routine.onesMinutes || "",
    workshopMapMinutes: routine.workshopMapMinutes || routine.twosMinutes || routine.threesMinutes || "",
    customPacks: normalizeTrainingItems(routine.customPacks || []),
    workshopMaps: normalizeTrainingItems(routine.workshopMaps || routine.customMaps || []),
    favorites: routine.favorites || [],
  }));
  const trainingPresets = stripDemoRows("trainingPresets", store.trainingPresets || []).map((preset) => ({
    ...preset,
    type: preset.type === "workshopMap" ? "workshopMap" : "trainingPack",
    category: trainingCategories.includes(preset.category) ? preset.category : "Other",
    code: preset.code || "",
    link: preset.link || "",
    description: preset.description || "",
    createdBy: preset.createdBy || "",
    createdAt: preset.createdAt || "",
    updatedAt: preset.updatedAt || preset.createdAt || "",
  }));
  const results = stripDemoRows("results", store.results || []).map((result) => ({
    ...result,
    type: result.type === "League match" ? "Match" : (resultTypes.includes(result.type) ? result.type : "Tournament"),
    resultSource: result.resultSource || (result.tournamentId ? `tournaments:${result.tournamentId}` : ""),
    averageMmr: result.averageMmr || result.aveMmr || result.avgMmr || "",
    replayLinks: normalizeReplayLinks(result.replayLinks || result.replays || result.replayLink || ""),
    tournamentMatches: normalizeTournamentMatches(result.tournamentMatches || result.matches || []),
  }));
  const tryouts = stripDemoRows("tryouts", store.tryouts || []).map((tryout) => ({ ...tryout, status: tryout.status || "Open", nextStep: tryout.nextStep || "", stats: { ...emptyStats, ...(tryout.stats || {}) }, opinion: tryout.opinion || "" }));
  const scrims = stripDemoRows("scrims", store.scrims || []);
  const partners = stripDemoRows("partners", store.partners || []);
  const tournaments = stripDemoRows("tournaments", store.tournaments || []).map(normalizeTimedItem);
  const events = stripDemoRows("events", store.events || []).map((event) => normalizeTimedItem({ ...event, type: normalizeEventType(event.type) }));
  tournaments.forEach((tournament) => {
    tournament.tournamentMatches = normalizeTournamentMatches(tournament.tournamentMatches || tournament.matches || []);
  });
  events.forEach((event) => {
    event.tournamentMatches = normalizeTournamentMatches(event.tournamentMatches || event.matches || []);
  });
  const weeks = stripDemoRows("weeks", store.weeks || []).map((week) => ({
    ...week,
    ownerUserId: week.ownerUserId || "",
    showInCalendar: Boolean(week.showInCalendar),
    items: (week.items || []).map((item) => ({ ...item, showInCalendar: Boolean(item.showInCalendar) })),
  }));
  const availability = stripDemoRows("availability", store.availability || []).map((item) => ({
    ...item,
    playerName: item.playerName || playerNameById({ players }, item.playerId),
    teamId: validTeamId(item.teamId, players.find((player) => player.id === item.playerId)?.teamId || "main"),
    status: ["Available", "Maybe", "Unavailable"].includes(item.status) ? item.status : "Available",
  }));
  const confirmationTemplates = stripDemoRows("confirmationTemplates", store.confirmationTemplates || []).map((item) => ({
    ...item,
    title: item.title || "Untitled template",
    subject: item.subject || item.title || "Confirmation",
    message: item.message || "",
  }));
  const notifications = stripDemoRows("notifications", store.notifications || []).map((item) => ({
    ...item,
    targetType: item.targetType || (item.playerId ? "player" : "team"),
    teamId: item.teamId || "",
    playerId: item.playerId || "",
    recipientIds: Array.isArray(item.recipientIds) ? item.recipientIds : [],
    acceptedBy: Array.isArray(item.acceptedBy) ? item.acceptedBy : [],
    readBy: Array.isArray(item.readBy) ? item.readBy : [],
    createdAt: item.createdAt || "",
  }));
  return { ...seedStore, ...store, users: [...builtInUsers, ...storedUsers], players, tryouts, scrims, partners, tournaments, results, events, trainingRoutines, trainingPresets, weeks, availability, confirmationTemplates, notifications };
}

function normalizeTrainingItems(items = []) {
  return items.map((item) => ({
    ...item,
    name: item.name || "",
    minutes: item.minutes || "",
    category: trainingCategories.includes(item.category) ? item.category : "Other",
    code: item.code || "",
    link: item.link || "",
  }));
}

function normalizeReplayLinks(value) {
  const rows = Array.isArray(value) ? value : String(value || "").split(/\r?\n|,/);
  return rows.map((item) => {
    if (typeof item === "string") return { type: "link", label: item.trim(), url: item.trim() };
    return {
      type: item.type === "file" ? "file" : "link",
      label: item.label || item.name || item.fileName || item.url || "",
      url: item.url || item.link || item.dataUrl || "",
      dataUrl: item.dataUrl || item.url || item.link || "",
      fileName: item.fileName || item.name || item.label || "replay.replay",
      mimeType: item.mimeType || "application/octet-stream",
      size: item.size || 0,
      uploadedAt: item.uploadedAt || "",
    };
  }).filter((item) => item.url || item.dataUrl);
}

function replayDisplayName(link) {
  return link.label || link.fileName || link.url || "Replay";
}

function replayHref(link) {
  return link.type === "file" ? (link.dataUrl || link.url) : link.url;
}

function replayDownloadName(link) {
  const name = link.fileName || link.label || "replay.replay";
  return name.toLowerCase().endsWith(".replay") ? name : `${name}.replay`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function replayFilesFromForm(form) {
  const input = form.querySelector('input[name="replayFiles"]');
  const files = [...(input?.files || [])];
  const validFiles = files.filter((file) => file.name.toLowerCase().endsWith(".replay"));
  return Promise.all(validFiles.map(async (file) => {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      type: "file",
      label: file.name,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      uploadedAt: new Date().toISOString(),
      dataUrl,
      url: dataUrl,
    };
  }));
}

function normalizeEventType(type = "Other") {
  if (type === "Free Play") return "Training";
  return eventTypes.includes(type) ? type : "Other";
}

function normalizeTimedItem(item) {
  const dateTime = item.dateTime || localInputFromUtc(item.startsAtUtc) || "";
  const startsAtUtc = item.startsAtUtc || localInputToUtc(dateTime) || "";
  return {
    ...item,
    dateTime,
    startsAtUtc,
    timezone: item.timezone || item.createdTimezone || viewerTimeZone(),
    createdTimezone: item.createdTimezone || item.timezone || viewerTimeZone(),
  };
}

function uid() {
  return crypto.randomUUID();
}

function getUser(store) {
  const uid = currentAuthUser?.uid || localStorage.getItem(sessionKey);
  const email = currentAuthUser?.email?.toLowerCase();
  const user = store.users.find((item) => item.id === uid || item.authUid === uid || (email && item.email?.toLowerCase() === email));
  if (!user) return undefined;
  const username = String(user.username || user.name || "").toLowerCase();
  const player = store.players.find((item) => (
    item.id === user.playerId ||
    item.authUid === user.authUid ||
    item.authUid === user.id ||
    item.userId === user.id ||
    (username && [item.rlName, item.name, item.discord].some((value) => String(value || "").toLowerCase() === username)) ||
    (email && [item.email, item.discord].some((value) => String(value || "").toLowerCase() === email))
  ));
  return player ? { ...user, playerId: user.playerId || player.id, position: user.position || player.position, teamId: user.teamId || player.teamId } : user;
}

function isAdmin(user) {
  return Boolean(user?.systemAdmin || user?.role === "Admin" || adminUsers.some((admin) => admin.id === user?.id));
}

function isBuiltInUser(user) {
  return builtInUsers.some((builtInUser) => builtInUser.id === user?.id || builtInUser.username.toLowerCase() === user?.username?.toLowerCase());
}

function canEdit(user) {
  return isAdmin(user);
}

function isCoach(user) {
  return Boolean(user?.coachAccess || user?.role === "Coach");
}

function isManager(user) {
  return Boolean(user?.managerAccess || user?.role === "Manager" || String(user?.position || "").toLowerCase() === "manager");
}

function isTeamCaptain(user) {
  return Boolean(user?.captainAccess || user?.role === "Captain" || String(user?.position || "").toLowerCase() === "captain");
}

function isStaff(user) {
  return isAdmin(user) || isCoach(user) || isManager(user);
}

function canManagePlayerStats(user) {
  return isStaff(user) || Boolean(user?.playerStatsAccess);
}

function canManageEntity(user, key) {
  if (isAdmin(user)) return true;
  if (key === "results") return canManageResults(user);
  if (key === "tournaments") return canManageTournaments(user);
  if (key === "events") return canManageCalendarEvent(user);
  if (["availability", "confirmationTemplates", "notifications"].includes(key)) return isStaff(user) || isTeamCaptain(user);
  return (isCoach(user) || isManager(user) || isTeamCaptain(user)) && ["scrims", "tryouts"].includes(key);
}

function canSendConfirmations(user) {
  return isStaff(user) || isTeamCaptain(user);
}

function canCreateTrainingRoutine(user) {
  return Boolean(user);
}

function canManageTrainingPresets(user) {
  return isStaff(user);
}

function isOwnRoutine(user, routine) {
  return Boolean(user && routine?.creatorId === user.id);
}

function canManageTrainingRoutine(user, routine) {
  return Boolean(user && (isOwnRoutine(user, routine) || (routine?.visibility === "global" && canManageTrainingPresets(user))));
}

function matchingPlayerForUser(store, user) {
  if (!user) return null;
  if (user.playerId) {
    const direct = store.players.find((player) => player.id === user.playerId);
    if (direct) return direct;
  }
  const username = String(user.username || user.name || "").toLowerCase();
  const email = String(user.email || "").toLowerCase();
  return store.players.find((player) => (
    player.authUid === user.authUid ||
    player.authUid === user.id ||
    player.userId === user.id ||
    (username && [player.rlName, player.name, player.discord].some((value) => String(value || "").toLowerCase() === username)) ||
    (email && [player.email, player.discord].some((value) => String(value || "").toLowerCase() === email))
  )) || null;
}

function weekOwnerId(store, user, selectedPlayerId = "") {
  if (canManagePlayerStats(user) && selectedPlayerId) return { playerId: selectedPlayerId, ownerUserId: "" };
  const player = matchingPlayerForUser(store, user);
  return player ? { playerId: player.id, ownerUserId: user.id } : { playerId: "", ownerUserId: user?.id || "" };
}

function weekMatchesOwner(week, owner) {
  return Boolean((owner.ownerUserId && week.ownerUserId === owner.ownerUserId) || (owner.playerId && week.playerId === owner.playerId));
}

function canManageWeek(user, week, owner = {}) {
  if (!user) return false;
  if (isStaff(user)) return true;
  return weekMatchesOwner(week || {}, { ...owner, ownerUserId: owner.ownerUserId || user.id });
}

function canManageResults(user) {
  return isStaff(user) || isTeamCaptain(user);
}

function canManageTournaments(user) {
  return isStaff(user) || isTeamCaptain(user);
}

function canManageCalendarEvent(user, event = null, store = loadStore()) {
  if (!user) return false;
  if (isAdmin(user) || isCoach(user)) return true;
  if (!event) return true;
  const player = matchingPlayerForUser(store, user);
  if (event.playerId) return Boolean((player && event.playerId === player.id) || event.createdBy === user.id);
  return false;
}

function permissionLabel(user) {
  if (isBuiltInUser(user) && isAdmin(user)) return "Built-in admin";
  if (isAdmin(user)) return "Admin";
  if (isManager(user)) return "Manager";
  if (isCoach(user)) return "Coach";
  if (isTeamCaptain(user)) return "Team Captain";
  if (user?.playerStatsAccess) return "Player stats";
  return "Player";
}

function roleSelect(user) {
  return `<select data-user-role="${user.id}">
    ${["Player", "Captain", "Manager", "Coach", "Admin"].map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${role}</option>`).join("")}
  </select>`;
}

function accountAccessControls(user) {
  const coachChecked = user.coachAccess || user.role === "Coach" ? "checked" : "";
  const statsChecked = user.playerStatsAccess || user.role === "Coach" ? "checked" : "";
  return `
    <div class="checkbox-stack">
      <label><input type="checkbox" data-user-coach-access="${user.id}" ${coachChecked}> Coach tools</label>
      <label><input type="checkbox" data-user-stats-access="${user.id}" ${statsChecked}> Player stats</label>
    </div>
  `;
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttr(value = "") {
  return esc(value).replace(/`/g, "&#096;");
}

function authMessage(error) {
  const code = error?.code || "";
  if (code.includes("permission-denied")) return "Firestore refused the save. Check that firestore.rules is deployed and the user is signed in.";
  if (code.includes("unavailable")) return "Firestore is unavailable right now. Please try again.";
  if (code.includes("invalid-credential") || code.includes("user-not-found") || code.includes("wrong-password")) return "Invalid username or password.";
  if (code.includes("email-already-in-use")) return "This username is already registered.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("invalid-email")) return "Please enter a valid username.";
  return "Authentication failed. Please try again.";
}

function showDialog({ title = "Notice", message = "", confirmText = "OK", cancelText = "", tone = "default" } = {}) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal-backdrop app-dialog-backdrop";
    modal.innerHTML = `
      <section class="modal-panel app-dialog ${tone ? `app-dialog-${tone}` : ""}" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
        <div class="dialog-icon" aria-hidden="true">${tone === "danger" ? "!" : tone === "warning" ? "!" : "i"}</div>
        <div class="modal-head dialog-head">
          <div>
            <h2 id="app-dialog-title">${esc(title)}</h2>
            <p>${esc(message)}</p>
          </div>
        </div>
        <div class="row-actions modal-actions dialog-actions">
          ${cancelText ? `<button data-dialog-action="cancel">${esc(cancelText)}</button>` : ""}
          <button class="primary ${tone === "danger" ? "danger-action" : ""}" data-dialog-action="confirm">${esc(confirmText)}</button>
        </div>
      </section>
    `;

    const close = (result) => {
      document.removeEventListener("keydown", onKeydown);
      modal.remove();
      resolve(result);
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") close(false);
    };

    modal.addEventListener("click", (event) => {
      const action = event.target.closest("[data-dialog-action]")?.dataset.dialogAction;
      if (action === "confirm") close(true);
      if (action === "cancel") close(false);
      if (event.target === modal && cancelText) close(false);
    });

    document.addEventListener("keydown", onKeydown);
    document.body.appendChild(modal);
    modal.querySelector("[data-dialog-action='confirm']")?.focus();
  });
}

function showAlert(message, options = {}) {
  return showDialog({ ...options, message, confirmText: options.confirmText || "OK" });
}

function showConfirm(message, options = {}) {
  return showDialog({ ...options, message, confirmText: options.confirmText || "Yes", cancelText: options.cancelText || "Cancel" });
}

function normalizeUsername(username = "") {
  return String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

function authEmailFromUsername(username = "") {
  const normalized = normalizeUsername(username);
  return normalized.includes("@") ? normalized : `${normalized}@noctiq.local`;
}

function authProfile(user, store, name = "", username = "") {
  const displayUsername = normalizeUsername(username || user.displayName || user.email?.split("@")[0] || "");
  return {
    id: user.uid,
    authUid: user.uid,
    name: name || displayUsername || user.displayName || user.email,
    username: displayUsername,
    email: user.email,
    role: "Player",
    approved: true,
    canEdit: false,
    playerStatsAccess: false,
    coachAccess: false,
    createdAt: new Date().toISOString(),
  };
}

function adminCreatedProfile(user, name = "", username = "", temporaryPassword = "") {
  return {
    id: user.uid,
    authUid: user.uid,
    name: name || username,
    username,
    email: user.email,
    role: "Player",
    approved: true,
    canEdit: false,
    playerStatsAccess: false,
    coachAccess: false,
    temporaryPasswordSet: true,
    temporaryPasswordHint: temporaryPassword ? "Admin-created temporary password" : "",
    createdAt: new Date().toISOString(),
  };
}

function passwordInput(name, autocomplete, label = "Password") {
  return `
    <label>
      <span>${label}</span>
      <span class="password-field">
        <input name="${name}" type="password" value="" autocomplete="${autocomplete}" required />
        <button type="button" class="password-toggle" data-password-toggle aria-label="Show password" title="Show password" aria-pressed="false">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </span>
    </label>
  `;
}

function bindPasswordToggles(root = document) {
  root.querySelectorAll("[data-password-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      const button = event.currentTarget;
      const input = button.closest(".password-field").querySelector("input");
      const shouldShow = input.type === "password";
      input.type = shouldShow ? "text" : "password";
      button.setAttribute("aria-pressed", String(shouldShow));
      button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
      button.title = shouldShow ? "Hide password" : "Show password";
    });
  });
}

function secondaryAuth() {
  if (!authApi || !firebaseAppApi || !firebaseConfigValue) return null;
  if (!accountCreationApp) accountCreationApp = firebaseAppApi.initializeApp(firebaseConfigValue, "adminAccountCreation");
  if (!accountCreationAuth) accountCreationAuth = authApi.getAuth(accountCreationApp);
  return accountCreationAuth;
}

async function loadWritableStore() {
  if (storageMode === "remote" && remoteApi && storeRef && (currentAuthUser || auth?.currentUser)) {
    const snapshot = await remoteApi.getDoc(storeRef);
    const userSnapshot = usersRef ? await remoteApi.getDocs(usersRef) : null;
    const users = userSnapshot ? userSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })) : [];
    const data = snapshot.exists() ? snapshot.data() : structuredClone(seedStore);
    return normalizeStore({ ...data, users: users.length ? users : (data.users || []) });
  }
  return loadStore();
}

function fmt(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: viewerTimeZone() }).format(new Date(eventDateValue(value)));
}

function fmtTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: viewerTimeZone() }).format(new Date(eventDateValue(value)));
}

function endDate(item) {
  const date = new Date(eventDateValue(item));
  date.setMinutes(date.getMinutes() + Number(item.durationMinutes || 0));
  return date;
}

function eventsOverlap(a, b) {
  if (!a.dateTime || !b.dateTime || a.teamId !== b.teamId) return false;
  const aStart = new Date(eventDateValue(a));
  const bStart = new Date(eventDateValue(b));
  const aDuration = Number(a.durationMinutes || 0);
  const bDuration = Number(b.durationMinutes || 0);
  const timeOverlap = !aDuration || !bDuration ? aStart.getTime() === bStart.getTime() : aStart < endDate(b) && bStart < endDate(a);
  if (!timeOverlap) return false;
  if (a.playerId || b.playerId) {
    return Boolean(a.playerId && b.playerId && a.playerId === b.playerId) || Boolean(a.playerId && rosterPlayerIds(b).has(a.playerId)) || Boolean(b.playerId && rosterPlayerIds(a).has(b.playerId));
  }
  const aRoster = rosterPlayerIds(a);
  const bRoster = rosterPlayerIds(b);
  if (aRoster.size && bRoster.size && ![...aRoster].some((playerId) => bRoster.has(playerId))) return false;
  return true;
}

function rosterPlayerIds(item) {
  return new Set((item.ourLineup || []).map((player) => player.id).filter(Boolean));
}

function needsRoster(item) {
  return ["Match", "Scrim", "Training", "Tournament", "Tryout"].includes(item.type) && !item.playerId && item.teamId !== "both" && !rosterPlayerIds(item).size;
}

function conflictKeys(events, user = null, store = loadStore()) {
  return new Set(events
    .filter((item) => events.some((other) => resultSourceKey(other) !== resultSourceKey(item) && eventsOverlapForViewer(item, other, user, store)))
    .map((item) => resultSourceKey(item)));
}

function eventsOverlapForViewer(a, b, user, store) {
  const player = !isStaff(user) && !isTeamCaptain(user) ? matchingPlayerForUser(store, user) : null;
  if (player) {
    const aRoster = rosterPlayerIds(a);
    const bRoster = rosterPlayerIds(b);
    if ((aRoster.size && !aRoster.has(player.id)) || (bRoster.size && !bRoster.has(player.id))) return false;
  }
  return eventsOverlap(a, b);
}

function fmtRange(item) {
  if (!item.dateTime && !item.startsAtUtc) return "-";
  const start = fmt(item);
  if (!Number(item.durationMinutes || 0)) return start;
  return `${start} - ${fmtTime(endDate(item).toISOString())}`;
}

function viewerTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function localInputToUtc(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function localInputFromUtc(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function eventDateValue(itemOrValue) {
  if (typeof itemOrValue === "string") return itemOrValue;
  return itemOrValue?.startsAtUtc || localInputToUtc(itemOrValue?.dateTime) || itemOrValue?.dateTime || "";
}

function teamIds() {
  return teams.map((team) => team.id);
}

function validTeamId(teamId, fallback = "main") {
  return teamIds().includes(teamId) ? teamId : fallback;
}

function teamName(teamId) {
  if (teamId === "both") return "Both teams";
  const team = teams.find((item) => item.id === teamId);
  if (team) return team.label;
  return "Personal";
}

function teamOptions(selected = "main", includeBoth = false) {
  return `${includeBoth ? `<option value="both" ${selected === "both" ? "selected" : ""}>Both teams</option>` : ""}${teams.map((team) => `<option value="${team.id}" ${selected === team.id ? "selected" : ""}>${esc(team.label)}</option>`).join("")}`;
}

function teamFilterOptions(selected = "all", includeBoth = false) {
  return `<option value="all">All teams</option>${teams.map((team) => `<option value="${team.id}" ${selected === team.id ? "selected" : ""}>${esc(team.label)}</option>`).join("")}${includeBoth ? `<option value="both" ${selected === "both" ? "selected" : ""}>Both teams</option>` : ""}`;
}

function playerNameById(store, playerId) {
  const player = (store?.players || []).find((item) => item.id === playerId);
  return player ? (player.rlName || player.name || "Player") : "Player";
}

function calendarTargetLabel(item, store = loadStore()) {
  if (item.playerId) return `Player: ${playerNameById(store, item.playerId)}`;
  if (item.teamId === "both") return "Both teams";
  return teamName(item.teamId);
}

function canSeeCalendarItem(user, item, store = loadStore()) {
  if (!user) return false;
  if (isAdmin(user) || isCoach(user)) return true;
  const player = matchingPlayerForUser(store, user);
  if (item.playerId) return Boolean((player && item.playerId === player.id) || item.createdBy === user.id);
  if (item.teamId === "both") return true;
  return Boolean(player?.teamId && item.teamId === player.teamId);
}

function displayWeekDay(day) {
  return weekDayLabels[day] || day;
}

function normalizePlayerRole(role = "Player") {
  const found = playerRoles.find((item) => item.toLowerCase() === String(role).toLowerCase());
  return found || "Player";
}

function peakMmrStack(player) {
  return `<div class="stacked-cell"><span>1s: ${esc(player.peak1s || "-")}</span><span>2s: ${esc(player.peak2s || "-")}</span><span>3s: ${esc(player.peak3s || "-")}</span></div>`;
}

function multiline(value = "") {
  return esc(value).replace(/\n/g, "<br>");
}

function availabilityDayLabel(item) {
  return [item.day, item.date].filter(Boolean).join(" / ") || "-";
}

function availabilityTimeLabel(item) {
  return [item.startTime, item.endTime].filter(Boolean).join(" - ") || "-";
}

function availabilityStatusBadge(status = "Available") {
  const safeStatus = ["Available", "Maybe", "Unavailable"].includes(status) ? status : "Available";
  return `<span class="status-badge status-${safeStatus.toLowerCase()}">${esc(safeStatus)}</span>`;
}

function normalizeAvailabilityDay(day = "") {
  return displayWeekDay(String(day || "").trim());
}

function normalizeAvailabilityTime(time = "") {
  const value = String(time || "").trim();
  if (!value) return "";
  const [hour = "", minute = "00"] = value.split(":");
  const numericHour = Number(hour);
  if (!Number.isFinite(numericHour)) return value;
  return `${String(numericHour).padStart(2, "0")}:${String(Number(minute || 0)).padStart(2, "0")}`;
}

function availabilitySlotEnd(startTime) {
  const [hour, minute] = normalizeAvailabilityTime(startTime).split(":").map(Number);
  if (!Number.isFinite(hour)) return "";
  return `${String(hour + 1).padStart(2, "0")}:${String(minute || 0).padStart(2, "0")}`;
}

function availabilityPlayerLabel(player) {
  return player?.rlName || player?.name || player?.discord || "Unnamed";
}

function startOfAvailabilityWeek(offset = availabilityWeekOffset) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset + (Number(offset || 0) * 7));
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateInputValue(date) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function availabilityWeekLabel(weekStart) {
  const weekEnd = addDays(weekStart, 6);
  const format = new Intl.DateTimeFormat("en-GB", { month: "short", day: "2-digit" });
  return `${format.format(weekStart)} - ${format.format(weekEnd)}`;
}

function availabilitySlotMatches(item, player, day, startTime, date = "") {
  const itemPlayer = item.playerId
    ? item.playerId === player.id
    : String(item.playerName || "").toLowerCase() === availabilityPlayerLabel(player).toLowerCase();
  return Boolean(
    itemPlayer &&
    normalizeAvailabilityDay(item.day) === day &&
    (!date || !item.date || item.date === date) &&
    normalizeAvailabilityTime(item.startTime) === startTime &&
    (item.status || "Available") === "Available"
  );
}

function canToggleAvailabilitySlot(user, player) {
  if (!user || !player) return false;
  if (isStaff(user) || isTeamCaptain(user)) return true;
  const ownPlayerId = user.playerId || "";
  return Boolean(ownPlayerId && ownPlayerId === player.id);
}

function availabilityMatrix(store, user, teamId, weekStart = startOfAvailabilityWeek()) {
  const players = (store.players || [])
    .filter((player) => player.teamId === teamId)
    .sort((a, b) => availabilityPlayerLabel(a).localeCompare(availabilityPlayerLabel(b)));
  const entries = visibleAvailabilityRows(store, user).filter((item) => item.teamId === teamId);
  if (!players.length) return `<p class="muted">No ${teamName(teamId).toLowerCase()} players found.</p>`;

  const rows = weekDays.flatMap((day, dayIndex) => availabilitySlots.map((slot, slotIndex) => {
    const date = dateInputValue(addDays(weekStart, dayIndex));
    const availableCount = players.filter((player) => entries.some((item) => availabilitySlotMatches(item, player, day, slot, date))).length;
    return `
      <tr>
        ${slotIndex === 0 ? `<th class="availability-day" rowspan="${availabilitySlots.length}">${esc(day)}<small>${esc(date)}</small></th>` : ""}
        <th class="availability-time">${esc(slot)}</th>
        ${players.map((player) => {
          const checked = entries.some((item) => availabilitySlotMatches(item, player, day, slot, date));
          const disabled = canToggleAvailabilitySlot(user, player) ? "" : "disabled";
          const label = `${availabilityPlayerLabel(player)} ${day} ${date} ${slot}`;
          return `<td class="availability-cell">
            <input
              type="checkbox"
              data-availability-slot="true"
              data-player-id="${escapeAttr(player.id)}"
              data-team-id="${escapeAttr(teamId)}"
              data-day="${escapeAttr(day)}"
              data-date="${escapeAttr(date)}"
              data-start-time="${escapeAttr(slot)}"
              aria-label="${escapeAttr(label)}"
              ${checked ? "checked" : ""}
              ${disabled}
            >
          </td>`;
        }).join("")}
        <td class="availability-count">${availableCount}</td>
      </tr>
    `;
  })).join("");

  return `
    <div class="availability-table-wrap">
      <table class="availability-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Time</th>
            ${players.map((player) => `<th>${esc(availabilityPlayerLabel(player))}</th>`).join("")}
            <th>Players available</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function visibleAvailabilityRows(store, user) {
  if (isStaff(user) || isTeamCaptain(user)) return store.availability || [];
  const player = matchingPlayerForUser(store, user);
  return (store.availability || []).filter((item) => (
    (player?.id && item.playerId === player.id) ||
    (player?.teamId && item.teamId === player.teamId)
  ));
}

function notificationTargets(store, entry) {
  if (entry.targetType === "both") return store.players || [];
  if (entry.targetType === "player") return store.players.filter((player) => player.id === entry.playerId);
  return store.players.filter((player) => player.teamId === entry.teamId);
}

function targetLabel(store, entry) {
  if (entry.targetType === "both") return "Both teams";
  if (entry.targetType === "player") return playerNameById(store, entry.playerId);
  return teamName(entry.teamId);
}

function canSeeNotification(store, user, notification) {
  if (!user) return false;
  if (isStaff(user) || isTeamCaptain(user)) return true;
  const player = matchingPlayerForUser(store, user);
  if (player?.id && (notification.recipientIds || []).includes(player.id)) return true;
  if (notification.targetType === "both") return true;
  if (notification.targetType === "player") return Boolean(player?.id && notification.playerId === player.id);
  return Boolean(player?.teamId && notification.teamId === player.teamId);
}

function visibleNotifications(store, user) {
  return (store.notifications || [])
    .filter((item) => canSeeNotification(store, user, item))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function unreadNotificationCount(store, user) {
  if (!user) return 0;
  return visibleNotifications(store, user).filter((item) => !(item.readBy || []).includes(user.id)).length;
}

function parseAvailabilityRows(text, store) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const split = (line) => line.includes("\t") ? line.split("\t") : line.split(",");
  const first = split(lines[0]).map((cell) => cell.trim().toLowerCase());
  const hasHeader = first.some((cell) => ["player", "name", "player name", "team", "day", "date", "start", "from", "end", "to", "status", "notes", "note"].includes(cell));
  const headers = hasHeader ? first : ["player", "team", "day", "date", "start", "end", "status", "notes"];
  const rows = hasHeader ? lines.slice(1) : lines;
  const value = (cells, names, fallbackIndex) => {
    const index = headers.findIndex((header) => names.includes(header));
    return String(cells[index >= 0 ? index : fallbackIndex] || "").trim();
  };
  return rows.map((line) => {
    const cells = split(line).map((cell) => cell.trim());
    const playerName = value(cells, ["player", "name", "player name"], 0);
    const matchedPlayer = store.players.find((player) => [player.rlName, player.name, player.discord].some((name) => String(name || "").toLowerCase() === playerName.toLowerCase()));
    const teamText = value(cells, ["team"], 1).toLowerCase();
    const statusText = value(cells, ["status"], 6);
    const status = ["Available", "Maybe", "Unavailable"].find((item) => item.toLowerCase() === statusText.toLowerCase()) || "Available";
    return {
      id: uid(),
      playerId: matchedPlayer?.id || "",
      playerName: matchedPlayer?.rlName || matchedPlayer?.name || playerName,
      teamId: matchedPlayer?.teamId || (teams.find((team) => teamText.includes(team.id) || teamText.includes(team.label.toLowerCase()) || teamText.includes(team.name.toLowerCase()))?.id || "main"),
      day: value(cells, ["day"], 2),
      date: value(cells, ["date"], 3),
      startTime: value(cells, ["start", "from"], 4),
      endTime: value(cells, ["end", "to"], 5),
      status,
      notes: value(cells, ["notes", "note"], 7),
    };
  }).filter((item) => item.playerName);
}

function allCalendarItems(store, viewer) {
  const events = store.events.map((item) => ({ ...item, source: "events", sourceId: item.id }));
  const scrims = store.scrims.map((item) => normalizeTimedItem({ id: `scrim-${item.id}`, sourceId: item.id, title: `Scrim vs ${item.opponent || "TBA"}`, dateTime: item.dateTime, startsAtUtc: item.startsAtUtc, durationMinutes: item.durationMinutes, type: "Scrim", teamId: item.teamId, notes: item.notes, opponent: item.opponent, lineupOpponent: item.lineupOpponent, ourLineup: item.ourLineup || [], opponentLineup: item.opponentLineup || [], source: "scrims" }));
  const tournaments = store.tournaments.map((item) => normalizeTimedItem({ id: `tournament-${item.id}`, sourceId: item.id, title: item.name || "Tournament", dateTime: item.dateTime, startsAtUtc: item.startsAtUtc, durationMinutes: item.durationMinutes, type: "Tournament", teamId: item.teamId, notes: item.notes, lineupOpponent: item.lineupOpponent, ourLineup: item.ourLineup || [], opponentLineup: item.opponentLineup || [], tournamentMatches: item.tournamentMatches || [], source: "tournaments" }));
  const tryouts = store.tryouts.map((item) => normalizeTimedItem({ id: `tryout-${item.id}`, sourceId: item.id, title: `Tryout: ${item.rlName || item.name || "TBA"}`, dateTime: item.dateTime, startsAtUtc: item.startsAtUtc, durationMinutes: item.durationMinutes, type: "Tryout", teamId: item.teamId, notes: canManagePlayerStats(viewer) ? item.opinion : "", lineupOpponent: item.lineupOpponent, ourLineup: item.ourLineup || [], opponentLineup: item.opponentLineup || [], source: "tryouts" }));
  // Weekly plan calendar entries need recurrence expansion; only include items when owners explicitly opt in.
  // TODO: this month grid can later grow into Outlook-like day/week views with time blocks and richer event popovers.
  return [...events, ...scrims, ...tournaments, ...tryouts].filter((item) => item.dateTime || item.startsAtUtc).sort((a, b) => eventDateValue(a).localeCompare(eventDateValue(b)));
}

function render() {
  const store = loadStore();
  const user = getUser(store);
  if (!user && currentAuthUser && storageMode === "remote" && !authProfileCreationInProgress) {
    store.users.push(authProfile(currentAuthUser, store));
    persistStore(store);
    return;
  }
  if (!user) {
    renderAuth(store);
    return;
  }
  if (currentPage === "admin" && !isAdmin(user)) currentPage = "dashboard";
  const unreadCount = unreadNotificationCount(store, user);

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">${logoMarkup}<div><strong>HoloFyrn Manager</strong><span>Rocket League Team Manager</span></div></div>
        <a class="secondary-action" href="index.html">← New Manager</a>
        <nav>
          ${navButton("dashboard", "Overview")}
          ${navButton("confirmations", `Confirmations${unreadCount ? ` (${unreadCount})` : ""}`)}
          ${navButton("calendar", "Calendar")}
          ${navButton("availability", "Availability")}
          ${navButton("scrims", "Scrims")}
          ${navButton("tournaments", "Tournaments")}
          ${navButton("results", "Results")}
          ${navButton("players", "Players")}
          ${navButton("tryouts", "Tryouts")}
          ${navButton("training", "My training routine")}
          ${navButton("week", "My week")}
          ${navButton("partners", "Scrim partners")}
          ${isAdmin(user) ? navButton("admin", "Admin") : ""}
        </nav>
      </aside>
      <main>
        <header class="topbar">
          <div><p class="eyebrow">HoloFyrn Esports</p><h1>${pageTitle(currentPage)}</h1></div>
          <details class="account-menu">
            <summary class="user-pill">
              <span>${esc(user.name)}</span>
              <strong>${user.role}</strong>
              <span class="account-chevron">v</span>
            </summary>
            <div class="account-dropdown">
              <button data-page="training">My Training Routine</button>
              <button data-page="week">My Week</button>
              <button data-page="account">Account settings</button>
              <button data-action="logout">Log out</button>
            </div>
          </details>
        </header>
        ${renderPage(store, user)}
      </main>
    </div>
  `;
  bindPasswordToggles(document);
}

function navButton(page, label) {
  return `<button class="${currentPage === page ? "active" : ""}" data-page="${page}">${label}</button>`;
}

function pageTitle(page) {
  return {
    dashboard: "Overview",
    calendar: "Calendar",
    availability: "Availability",
    confirmations: "Confirmations",
    scrims: "Scrims",
    tournaments: "Tournaments",
    results: "Results",
    players: "Players",
    tryouts: "Tryouts",
    training: "My training routine",
    week: "My week",
    partners: "Scrim partners",
    admin: "Admin",
    account: "Account settings",
  }[page];
}

function renderPage(store, user) {
  if (currentPage === "dashboard") return dashboard(store, user);
  if (currentPage === "confirmations") return confirmationsPage(store, user);
  if (currentPage === "availability") return availabilityPage(store, user);
  if (currentPage === "calendar") return calendarPage(store, canManageCalendarEvent(user), canManageResults(user), user);
  if (currentPage === "results") return resultsPage(store, canManageResults(user));
  if (currentPage === "tryouts") return tryoutsPage(store, canManageEntity(user, "tryouts"), user);
  if (currentPage === "training") return trainingPage(store, user);
  if (currentPage === "week") return weekPage(store, user);
  if (currentPage === "admin") return isAdmin(user) ? adminPage(store, user) : dashboard(store, user);
  if (currentPage === "account") return accountPage(user);
  return crudPage(store, currentPage, canManageEntity(user, currentPage), user);
}

function renderAuth(store) {
  app.innerHTML = `
    <div class="auth-screen">
      <section class="auth-panel">
        <div class="brand">${logoMarkup}<div><strong>HoloFyrn Manager</strong><span>Rocket League team manager</span></div></div>
        <form id="auth-form" data-mode="login" class="form-grid">
          <label><span>Username</span><input name="username" value="" autocomplete="username" required /></label>
          ${passwordInput("password", "current-password")}
          <button class="primary">Log in</button>
          <p id="auth-message" class="muted"></p>
        </form>
      </section>
      <section class="auth-visual">
      </section>
    </div>
  `;

  bindPasswordToggles(document);

  document.querySelector("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const message = document.querySelector("#auth-message");
    if (!authApi || !auth) {
      message.textContent = "Firebase Authentication is not available.";
      return;
    }
    const username = normalizeUsername(data.username);
    if (!username) {
      message.textContent = "Please enter a valid username.";
      return;
    }
    try {
      const storedUser = store.users.find((item) => item.username?.toLowerCase() === username || item.email?.toLowerCase() === username);
      const authEmail = storedUser?.email || authEmailFromUsername(username);
      const credential = await authApi.signInWithEmailAndPassword(auth, authEmail, data.password);
      const freshStore = await loadWritableStore();
      const user = freshStore.users.find((item) => item.id === credential.user.uid || item.authUid === credential.user.uid || item.username?.toLowerCase() === username || item.email?.toLowerCase() === credential.user.email?.toLowerCase());
      if (!user) console.warn("Firebase Auth login succeeded, but no app profile was found yet.");
    } catch (error) {
      message.textContent = authMessage(error);
    }
  });
}

function dashboard(store, user) {
  const activePlayer = matchingPlayerForUser(store, user);
  const broadOverview = isStaff(user) || isTeamCaptain(user);
  const calendar = allCalendarItems(store, user).filter((item) => broadOverview || canSeeCalendarItem(user, item, store));
  const upcomingCalendar = calendar.filter((item) => endDate(item) >= new Date());
  const nextEvent = upcomingCalendar[0];
  const visibleTryouts = (store.tryouts || []).filter((item) => broadOverview || !activePlayer || item.teamId === activePlayer.teamId).slice(0, 6);
  const latestNotifications = visibleNotifications(store, user).slice(0, 4);
  return `
    <section class="page-grid">
      ${metric("Next Event", nextEvent?.title || "-", nextEvent ? fmtRange(nextEvent) : "no upcoming event")}
      <section class="panel"><h2>Team focus</h2>${activePlayer ? compact(activePlayer.rlName || activePlayer.name, `${teamName(activePlayer.teamId)} / ${activePlayer.position || "Player"}`) : `<p class="muted">General club overview.</p>`}</section>
      <section class="panel"><h2>Confirmations</h2>${latestNotifications.map((item) => compact(item.subject || "Confirmation", item.eventLabel || item.targetLabel || "Notification")).join("") || `<p class="muted">No confirmations yet.</p>`}<button class="secondary-action" data-page="confirmations">Open confirmations</button></section>
      <section class="panel"><h2>Project version</h2><div class="version-number">${esc(projectVersion)}</div></section>
      <section class="panel wide overview-split"><div><h2>Upcoming Schedule</h2>${eventList(upcomingCalendar.slice(0, 7))}</div><div><h2>Active Tryouts</h2>${tryoutSummaryList(visibleTryouts)}</div></section>
    </section>
  `;
}

function metric(title, value, hint) {
  return `<article class="metric"><span>${esc(title)}</span><strong>${esc(value)}</strong><small>${esc(hint)}</small></article>`;
}

function compact(title, subtitle) {
  return `<div class="compact-row"><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></div>`;
}

function eventList(events) {
  return `<div class="event-list">${events.map((item) => compact(item.title, `${fmt(item)} / ${item.type} / ${calendarTargetLabel(item)}`)).join("") || `<p class="muted">No upcoming events.</p>`}</div>`;
}

function tryoutSummaryList(rows) {
  return `<div class="event-list">${rows.map((item) => compact(item.rlName || item.name || "Unnamed tryout", `${teamName(item.teamId)} / ${item.status || "Open"}${item.dateTime || item.startsAtUtc ? ` / ${fmt(item)}` : ""}`)).join("") || `<p class="muted">No active tryouts.</p>`}</div>`;
}

function crudPage(store, key, editable, user) {
  const schema = schemas[key];
  const coachingNotesEditable = key === "players" && canManagePlayerStats(user);
  const searchSchema = key === "players" && !coachingNotesEditable
    ? { ...schema, search: (item) => `${item.rlName} ${item.discord} ${item.position} ${teamName(item.teamId)} ${item.peak1s} ${item.peak2s} ${item.peak3s}` }
    : schema;
  const rows = filteredRows(store[key], searchSchema, key);
  const form = key === "players"
    ? (editable ? playerForm(schemas.players.empty, coachingNotesEditable) : (coachingNotesEditable ? playerStatsForm(store.players) : ""))
    : (editable ? entityForm(key, schema) : "");
  return `
    <section class="crud-layout">
      ${key === "tournaments" && editable ? `<div class="row-actions"><button class="primary" data-tournament-add="true">Add Tournament</button></div>` : ""}
      ${toolbar(key, key !== "partners", false, schema.sort)}
      ${form}
      ${key === "players" ? playerRecords(schema, rows, editable, coachingNotesEditable) : `<section class="panel wide"><h2>Records</h2>${table(schema.headers, rows.map((item) => [...schema.cells(item), rowActions(editable, key, item.id)]))}</section>`}
    </section>
  `;
}

function playerRecords(schema, rows, editable, showPrivateNotes) {
  const selectedId = (filters.players || {}).detailId;
  const selectedPlayer = rows.find((player) => player.id === selectedId);
  return `
    ${selectedPlayer ? playerProfilePanel(selectedPlayer, editable, showPrivateNotes) : ""}
    ${teams.map((team) => {
      const teamRows = captainFirst(rows.filter((item) => item.teamId === team.id));
      return `<section class="panel wide"><h2>${esc(team.label)} members</h2><div class="player-card-grid">${teamRows.map((player) => playerDetailCard(player, editable, showPrivateNotes)).join("") || `<p class="muted">No ${esc(team.label.toLowerCase())} players found.</p>`}</div></section>`;
    }).join("")}
  `;
}

function captainFirst(rows) {
  return [...rows].sort((a, b) => {
    const coachOrder = Number(isCoachRole(a)) - Number(isCoachRole(b));
    if (coachOrder) return coachOrder;
    const captainOrder = Number(isCaptain(b)) - Number(isCaptain(a));
    if (captainOrder) return captainOrder;
    return String(a.rlName || a.name || "").localeCompare(String(b.rlName || b.name || ""));
  });
}

function isCaptain(player) {
  return String(player.position || "").trim().toLowerCase() === "captain";
}

function isCoachRole(player) {
  return String(player.position || "").trim().toLowerCase() === "coach";
}



function recordTable(schema, rows, editable, key) {
  if (!rows.length) return `<p class="muted">No players found.</p>`;
  return table(schema.headers, rows.map((item) => [...schema.cells(item), rowActions(editable, key, item.id)]));
}

function playerDetailCard(player, editable, showPrivateNotes) {
  return `
    <article class="routine-card player-card">
      <div class="routine-card-head">
        <div><h3>${esc(player.rlName || "Unnamed player")}</h3><span>${esc(player.position)} / ${teamName(player.teamId)}</span></div>
        ${editable ? `<div class="row-actions"><button data-edit="players:${player.id}">Edit</button><button data-delete="players:${player.id}">Delete</button></div>` : ""}
      </div>
      <div class="routine-stats">
        ${metricMini("1s peak", player.peak1s || "-")}
        ${metricMini("2s peak", player.peak2s || "-")}
        ${metricMini("3s peak", player.peak3s || "-")}
      </div>
      <div class="public-player-info">
        ${player.discord ? compact("Discord", player.discord) : ""}
        ${player.profileLink ? `<a class="player-link-box" href="${escapeAttr(player.profileLink)}" target="_blank" rel="noreferrer">RL Tracker link</a>` : ""}
      </div>
      <button class="secondary-action" data-player-profile="${player.id}">View profile</button>
    </article>
  `;
}

function playerProfilePanel(player, editable, showPrivateNotes) {
  return `
    <section class="panel wide player-profile-panel">
      <div class="modal-head">
        <div>
          <h2>${esc(player.rlName || "Player profile")}</h2>
          <p class="muted">${esc(player.position)} / ${teamName(player.teamId)}</p>
        </div>
        <div class="row-actions">
          ${editable ? `<button data-edit="players:${player.id}">Edit</button><button data-delete="players:${player.id}">Delete</button>` : ""}
          <button data-player-profile-close="true">Close</button>
        </div>
      </div>
      <div class="profile-grid">
        ${metricMini("Discord", player.discord || "-")}
        ${metricMini("1s peak", player.peak1s || "-")}
        ${metricMini("2s peak", player.peak2s || "-")}
        ${metricMini("3s peak", player.peak3s || "-")}
        ${metricMini("Peaks updated", player.peaksUpdatedAt || "-")}
      </div>
      ${player.profileLink ? `<p><a href="${escapeAttr(player.profileLink)}" target="_blank" rel="noreferrer">Open RL Tracker link</a></p>` : ""}
      ${player.publicBio ? `<div class="custom-map-box"><strong>Public bio / training notes</strong><p>${multiline(player.publicBio)}</p></div>` : ""}
      ${showPrivateNotes ? `
        <div class="custom-map-box">
          <strong>Private coaching notes</strong>
          ${player.name ? `<p class="muted">Real name: ${esc(player.name)}</p>` : ""}
          ${player.notes ? `<p>${multiline(player.notes)}</p>` : `<p class="muted">No private notes yet.</p>`}
        </div>
      ` : ""}
    </section>
  `;
}

function syncRlTrackerPeaks(player) {
  // Automatic RL Tracker peak sync needs a backend/API/proxy; client-side scraping is unreliable and usually blocked by CORS.
  return player;
}

function tryoutsPage(store, editable, user) {
  const showPrivateNotes = canManagePlayerStats(user);
  const rows = filteredRows(store.tryouts, {
    search: (item) => `${showPrivateNotes ? item.name : ""} ${item.rlName} ${item.discord} ${item.rank} ${item.status} ${showPrivateNotes ? `${item.opinion} ${item.nextStep}` : ""}`,
    sort: ["dateTime", "rlName", "teamId"],
  }, "tryouts");
  const headers = showPrivateNotes ? ["Date", "Duration", "Name", "RL", "Discord", "Rank", "Team", "Status", "Next step", "Opinion"] : ["Date", "Duration", "RL", "Discord", "Rank", "Team", "Status"];
  const row = (item) => showPrivateNotes
    ? [fmtRange(item), `${item.durationMinutes || 0} min`, item.name, item.rlName, item.discord, item.rank, teamName(item.teamId), item.status || "Open", item.nextStep || "-", item.opinion || "-"]
    : [fmtRange(item), `${item.durationMinutes || 0} min`, item.rlName, item.discord, item.rank, teamName(item.teamId), item.status || "Open"];
  return `
    <section class="crud-layout">
      ${toolbar("tryouts", true, false, ["dateTime", "rlName", "rank", "teamId"])}
      ${editable ? tryoutForm(undefined, showPrivateNotes) : ""}
      <section class="panel wide"><h2>Tryout records</h2>${table(headers, rows.map((item) => [...row(item), rowActions(editable, "tryouts", item.id)]))}</section>
    </section>
  `;
}

function resultsPage(store, editable) {
  const rows = filteredResults(store);
  const view = (filters.results || {}).view || "matches";
  const matchResults = rows.filter((item) => !isAggregateResultRecord(store, item));
  const tournamentResults = rows.filter((item) => isAggregateResultRecord(store, item));
  const draft = resultDraft;
  return `
    <section class="crud-layout">
      ${toolbar("results", true, false, ["dateTime", "title", "teamId"])}
      <div class="toolbar result-tabs">
        <button class="primary ${view === "matches" ? "selected" : ""}" data-results-view="matches">Match Results</button>
        <button class="primary ${view === "tournaments" ? "selected" : ""}" data-results-view="tournaments">Tournaments / Leagues</button>
        ${editable ? `<button class="primary" data-result-add="true">Add Result</button>` : ""}
      </div>
      ${editable && draft ? resultForm(store, draft) : ""}
      ${view === "matches" ? resultGroup("Match Results", matchResults, editable, store) : resultGroup("Tournaments / Leagues", tournamentResults, editable, store)}
      ${resultReplayDialog(store)}
    </section>
  `;
}

function filteredResults(store) {
  const f = filters.results || {};
  return [...(store.results || [])]
    .filter((item) => !f.query || `${item.title} ${item.opponent} ${item.score} ${item.averageMmr} ${item.notes}`.toLowerCase().includes(f.query.toLowerCase()))
    .filter((item) => !f.team || f.team === "all" || item.teamId === f.team)
    .sort((a, b) => (f.sort || "dateTime") === "dateTime" ? String(eventDateValue(b) || "").localeCompare(String(eventDateValue(a) || "")) : sortCompare(a, b, f.sort || "title"));
}

function resultGroup(title, rows, editable, store) {
  return `
    <section class="panel wide">
      <h2>${title}</h2>
      <div class="result-columns">
        ${teams.map((team) => `<div>
          <h3>${esc(team.label)}</h3>
          ${resultTable(rows.filter((item) => item.teamId === team.id), editable, store)}
        </div>`).join("")}
      </div>
    </section>
  `;
}

function resultTable(rows, editable, store = loadStore()) {
  if (!rows.length) return `<p class="muted">No results yet.</p>`;
  return table(["Date", "Event", "Opponent", "Ave. MMR", "Score / result", "Notes", "Replays"], rows.map((item) => [
    fmt(item),
    item.title,
    isAggregateResultRecord(store, item) ? tournamentMatchSummary(item.tournamentMatches || []) : (item.opponent || "-"),
    isAggregateResultRecord(store, item) ? "-" : (item.averageMmr || "-"),
    item.score || "-",
    isAggregateResultRecord(store, item) && item.tournamentMatches?.length ? tournamentMatchesCompact(item.tournamentMatches, item.notes) : (item.notes || ""),
    `<button data-result-replays="${item.id}">Replays</button>`,
    rowActions(editable, "results", item.id),
  ]));
}

function tournamentMatchesCompact(matches = [], notes = "") {
  const rows = normalizeTournamentMatches(matches).map((match) => {
    const label = [match.round, match.opponent].filter(Boolean).join(" vs ");
    return [label || match.opponent || "Match", match.score, match.result].filter(Boolean).join(" / ");
  });
  return multiline([...rows, notes].filter(Boolean).join("\n"));
}

function isLeagueMatchSource(source) {
  const text = `${source?.type || ""} ${source?.title || ""} ${source?.name || ""} ${source?.notes || ""}`.toLowerCase();
  return source?.type === "League match" || (source?.source === "events" && /\bleag/.test(text));
}

function isAggregateResultSource(source) {
  return source?.type === "Tournament" && !isLeagueMatchSource(source);
}

function isAggregateResultRecord(store, result) {
  if (result?.type !== "Tournament") return false;
  const source = result.resultSource ? findCalendarItem(store, result.resultSource) : null;
  return isAggregateResultSource(source || result);
}

function completedResultSources(store) {
  return allCalendarItems(store)
    .filter((item) => item.dateTime && endDate(item) < new Date())
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
}

function resultSourceKey(item) {
  return `${item.source}:${item.sourceId}`;
}

function normalizeTournamentMatches(matches = []) {
  return (Array.isArray(matches) ? matches : [])
    .map((match) => ({
      id: match.id || uid(),
      round: match.round || "",
      opponent: match.opponent || "",
      averageMmr: match.averageMmr || "",
      score: match.score || "",
      result: match.result || "",
      notes: match.notes || "",
    }))
    .filter((match) => match.opponent || match.score || match.round || match.notes);
}

function tournamentMatchSummary(matches = []) {
  const normalized = normalizeTournamentMatches(matches);
  if (!normalized.length) return "-";
  const wins = normalized.filter((match) => String(match.result || match.score).toLowerCase().includes("win")).length;
  const losses = normalized.filter((match) => String(match.result || match.score).toLowerCase().includes("loss")).length;
  return wins || losses ? `${normalized.length} matches / ${wins}W-${losses}L` : `${normalized.length} matches`;
}

function findCalendarItem(store, key) {
  return allCalendarItems(store).find((item) => resultSourceKey(item) === key);
}

function findCalendarSource(store, key) {
  const [source, sourceId] = key.split(":");
  if (!store[source]) return null;
  return store[source].find((item) => item.id === sourceId) || null;
}

function selectedOurLineupOption(savedLineup, player) {
  return savedLineup.some((item) => item.id === player.id || item.name === player.rlName || item.name === player.name);
}

function ourLineupOptions(savedPlayer, ownPlayers) {
  const saved = savedPlayer ? [savedPlayer] : [];
  const hasSavedPlayer = savedPlayer && ownPlayers.some((player) => selectedOurLineupOption(saved, player));
  return `
    <option value="">Unknown / empty</option>
    ${savedPlayer && !hasSavedPlayer ? `<option value="" selected disabled>${esc(savedPlayer.name || "Saved player")}</option>` : ""}
    ${ownPlayers.map((player) => `<option value="${player.id}" ${selectedOurLineupOption(saved, player) ? "selected" : ""}>${esc(player.rlName || player.name)}</option>`).join("")}
  `;
}

function collectLineupDraft(store) {
  const opponentInput = document.querySelector('input[name="resultOpponentDraft"]');
  const ourLineup = [0, 1, 2, 3]
    .map((index) => {
      const playerId = document.querySelector(`[name="ourLineup${index}"]`)?.value;
      const player = store.players.find((item) => item.id === playerId);
      return player ? { id: player.id, name: player.rlName || player.name, link: player.profileLink || "" } : null;
    })
    .filter(Boolean);
  return { lineupOpponent: opponentInput?.value || "", ourLineup };
}

function saveCalendarLineup(store, key) {
  const source = findCalendarSource(store, key);
  if (!source) return null;
  const draft = collectLineupDraft(store);
  source.lineupOpponent = draft.lineupOpponent;
  source.ourLineup = draft.ourLineup;
  return draft;
}

function collectTournamentMatches(prefix = "tournamentMatch") {
  return Array.from(document.querySelectorAll(`[data-tournament-match-row="${prefix}"]`)).map((row) => ({
    id: row.dataset.matchId || uid(),
    round: row.querySelector(`[name="${prefix}Round"]`)?.value || "",
    opponent: row.querySelector(`[name="${prefix}Opponent"]`)?.value || "",
    averageMmr: row.querySelector(`[name="${prefix}AverageMmr"]`)?.value || "",
    score: row.querySelector(`[name="${prefix}Score"]`)?.value || "",
    result: row.querySelector(`[name="${prefix}Result"]`)?.value || "",
    notes: row.querySelector(`[name="${prefix}Notes"]`)?.value || "",
  })).filter((match) => match.opponent || match.score || match.round || match.notes);
}

function saveTournamentMatches(store, key) {
  const source = findCalendarSource(store, key);
  if (!source) return null;
  const matches = normalizeTournamentMatches(collectTournamentMatches());
  source.tournamentMatches = matches;
  return matches;
}

function tournamentMatchesEditor(matches = [], prefix = "tournamentMatch", rowCount = 12) {
  const rows = [...normalizeTournamentMatches(matches)];
  while (rows.length < rowCount) rows.push({ id: "", round: "", opponent: "", averageMmr: "", score: "", result: "", notes: "" });
  return `
    <div class="tournament-match-editor">
      <div class="tournament-match-head">
        <span>Round</span>
        <span>Opponent</span>
        <span>Ave. MMR</span>
        <span>Score</span>
        <span>Result</span>
        <span>Notes</span>
      </div>
      ${rows.map((match) => `
        <div class="tournament-match-row" data-tournament-match-row="${escapeAttr(prefix)}" data-match-id="${escapeAttr(match.id || "")}">
          <input name="${prefix}Round" value="${escapeAttr(match.round || "")}" placeholder="Swiss 1">
          <input name="${prefix}Opponent" value="${escapeAttr(match.opponent || "")}" placeholder="Opponent">
          <input name="${prefix}AverageMmr" type="number" value="${escapeAttr(match.averageMmr || "")}" placeholder="MMR">
          <input name="${prefix}Score" value="${escapeAttr(match.score || "")}" placeholder="3-1">
          <select name="${prefix}Result">
            <option value="" ${!match.result ? "selected" : ""}>-</option>
            <option value="Win" ${match.result === "Win" ? "selected" : ""}>Win</option>
            <option value="Loss" ${match.result === "Loss" ? "selected" : ""}>Loss</option>
          </select>
          <input name="${prefix}Notes" value="${escapeAttr(match.notes || "")}" placeholder="Notes">
        </div>
      `).join("")}
    </div>
  `;
}

function resultForm(store, item = { id: "", resultSource: "", type: "Match", title: "", dateTime: "", startsAtUtc: "", teamId: "main", opponent: "", averageMmr: "", score: "", replayLinks: [], notes: "" }) {
  const sources = completedResultSources(store).filter((source) => item.resultSource === resultSourceKey(source) || !resultForSource(store, resultSourceKey(source)));
  const selectedSource = item.resultSource ? findCalendarItem(store, item.resultSource) : null;
  const tournamentMatches = normalizeTournamentMatches(item.tournamentMatches || selectedSource?.tournamentMatches || []);
  const isTournamentResult = item.type === "Tournament" && isAggregateResultSource(selectedSource || item);
  return `
    <section class="panel result-editor"><h2>${item.id ? "Edit result" : "Add result"}</h2>
      <form class="entity-form" data-entity="results" data-id="${item.id || ""}">
        <div class="form-grid">
          <label><span>Played calendar item</span><select name="resultSource" required><option value="">Select played calendar item</option>${sources.map((source) => `<option value="${resultSourceKey(source)}" ${item.resultSource === resultSourceKey(source) ? "selected" : ""}>${esc(source.title)} / ${source.type} / ${calendarTargetLabel(source, store)} / ${fmt(source)}</option>`).join("")}</select></label>
          ${isTournamentResult ? `<div class="compact-row full-span"><strong>Tournament matches</strong><span>${esc(tournamentMatchSummary(tournamentMatches))}</span></div>` : field("opponent", selectedSource && isLeagueMatchSource(selectedSource) ? "Opponent / league opponent" : "Opponent", "text", item.opponent)}
          ${isTournamentResult ? "" : field("averageMmr", "Ave. MMR", "number", item.averageMmr)}
          ${field("score", "Score / result", "text", item.score)}
          ${isTournamentResult ? `<div class="full-span">${tournamentMatchesEditor(tournamentMatches, "resultMatch", Math.max(12, tournamentMatches.length + 2))}</div>` : ""}
          ${field("replayLinksText", "Replay links", "textarea", (item.replayLinks || []).filter((link) => (typeof link === "string") || link.type !== "file").map((link) => link.url || link).join("\n"))}
          <label><span>Replay files (.replay)</span><input name="replayFiles" type="file" accept=".replay" multiple></label>
          ${(item.replayLinks || []).filter((link) => link.type === "file").length ? `<div class="compact-row full-span"><strong>Saved replay files</strong><span>${(item.replayLinks || []).filter((link) => link.type === "file").map((link) => esc(replayDisplayName(link))).join(", ")}</span></div>` : ""}
          ${field("notes", "Notes", "textarea", item.notes)}
        </div>
        <div class="row-actions"><button class="primary">Save result</button><button type="button" data-result-cancel="true">Cancel</button></div>
      </form>
    </section>
  `;
}

function resultForSource(store, sourceKey) {
  return (store.results || []).find((item) => item.resultSource === sourceKey || `${item.source}:${item.sourceId}` === sourceKey);
}

function resultReplayDialog(store) {
  if (!selectedReplayResultId) return "";
  const result = store.results.find((item) => item.id === selectedReplayResultId);
  if (!result) return "";
  const links = normalizeReplayLinks(result.replayLinks || []);
  return `
    <div class="modal-backdrop" data-replay-close="true">
      <section class="modal-panel" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div><p class="eyebrow">Replays</p><h2>${esc(result.title || "Result")}</h2></div>
          <button class="icon-button" data-replay-close="true" title="Close">X</button>
        </div>
        <div class="custom-map-box">
          ${links.length ? links.map((link) => {
            const href = replayHref(link);
            const download = link.type === "file" ? ` download="${escapeAttr(replayDownloadName(link))}"` : "";
            const text = link.type === "file" ? "Download replay" : "Open replay";
            return `<div class="compact-row"><strong>${esc(replayDisplayName(link))}</strong><span><a href="${escapeAttr(href)}"${download} target="_blank" rel="noreferrer">${text}</a></span></div>`;
          }).join("") : `<p class="muted">No replay links or files saved for this result.</p>`}
        </div>
        <div class="row-actions modal-actions"><button data-replay-close="true">Close</button></div>
      </section>
    </div>
  `;
}

function trainingPage(store, user) {
  const visibleRoutines = (store.trainingRoutines || []).filter((routine) => routine.creatorId === user?.id || routine.visibility === "global");
  const routines = filteredRows(visibleRoutines, {
    search: (item) => `${item.title} ${item.creatorName} ${routineModes(item)} ${(item.customPacks || []).map((pack) => `${pack.name} ${pack.category} ${pack.code}`).join(" ")} ${(item.workshopMaps || []).map((map) => `${map.name} ${map.category} ${map.link}`).join(" ")}`,
    sort: ["title", "creatorName"],
  }, "training");
  const showPresets = Boolean((filters.training || {}).showPresets);
  return `
    <section class="crud-layout">
      ${toolbar("training", false, false, ["title", "creatorName"])}
      <div class="row-actions">
        <button data-training-presets-toggle="true">${showPresets ? "Hide preset packs and maps" : "View preset packs and maps"}</button>
      </div>
      ${showPresets ? trainingPresetsPanel(store.trainingPresets || [], user) : ""}
      ${canCreateTrainingRoutine(user) ? trainingRoutineForm() : ""}
      ${canManageTrainingPresets(user) ? trainingPresetForm() : ""}
      <section class="panel wide"><h2>Existing Routines</h2><div class="routine-grid">${routines.map((routine) => trainingRoutineCard(routine, user)).join("") || `<p class="muted">No training routines yet.</p>`}</div></section>
    </section>
  `;
}

function trainingRoutineForm(item = { id: "", title: "", customPackMinutes: "", workshopMapMinutes: "", freeplayMinutes: "", customPacks: [], workshopMaps: [] }) {
  return `
    <section class="panel"><h2>${item.id ? "Edit training routine" : "New training routine"}</h2>
      <form class="entity-form" data-entity="training-routines" data-id="${item.id || ""}">
        <div class="form-grid">
          ${field("title", "Routine name", "text", item.title)}
          ${field("customPackMinutes", "Custom pack minutes", "number", item.customPackMinutes)}
          ${field("workshopMapMinutes", "Workshop map minutes", "number", item.workshopMapMinutes)}
          ${field("freeplayMinutes", "Freeplay minutes", "number", item.freeplayMinutes)}
        </div>
        <details class="custom-map-box">
          <summary>Custom packs</summary>
          <div class="form-grid">
          ${[0, 1, 2, 3, 4].map((index) => trainingItemFields("customPack", index, customPackOptions, item.customPacks?.[index])).join("")}
          </div>
        </details>
        <details class="custom-map-box">
          <summary>Workshop maps</summary>
          <div class="form-grid">
            ${[0, 1, 2, 3, 4].map((index) => trainingItemFields("workshopMap", index, workshopMapOptions, item.workshopMaps?.[index])).join("")}
          </div>
        </details>
        <button class="primary">Save routine</button>
      </form>
    </section>
  `;
}

function trainingItemFields(prefix, index, options, item = {}) {
  return `
    <label><span>${prefix === "customPack" ? "Custom pack" : "Workshop map"} ${index + 1}</span><select name="${prefix}Name${index}"><option value="">None</option>${options.map((name) => `<option value="${name}" ${item.name === name ? "selected" : ""}>${name}</option>`).join("")}</select></label>
    ${field(`${prefix}Category${index}`, "Category", trainingCategories, item.category || "Other")}
    ${field(`${prefix}Minutes${index}`, "Minutes", "number", item.minutes || "")}
    ${prefix === "customPack" ? field(`${prefix}Code${index}`, "Training Pack code", "text", item.code || "") : field(`${prefix}Link${index}`, "Workshop Map link", "url", item.link || "")}
  `;
}

function trainingRoutineCard(routine, user) {
  const favorite = (routine.favorites || []).includes(user.id);
  return `
    <article class="routine-card">
      <div class="routine-card-head">
        <div><h3>${esc(routine.title || "Untitled routine")}</h3><span>${esc(routine.creatorName || "Unknown")}</span></div>
        ${canManageTrainingRoutine(user, routine) ? `<button class="chip ${favorite ? "ok" : ""}" data-routine-favorite="${routine.id}">${favorite ? "Favorited" : "Add favorite"}</button>` : ""}
      </div>
      <div class="routine-stats">
        ${metricMini("Custom pack", `${routine.customPackMinutes || 0} min`)}
        ${metricMini("Workshop", `${routine.workshopMapMinutes || 0} min`)}
        ${metricMini("Freeplay", `${routine.freeplayMinutes || 0} min`)}
      </div>
      <details class="custom-map-box">
        <summary>Custom packs</summary>
        ${(routine.customPacks || []).length ? routine.customPacks.map((pack) => trainingItemRow(pack, "trainingPack")).join("") : `<p class="muted">No custom packs.</p>`}
      </details>
      <details class="custom-map-box">
        <summary>Workshop maps</summary>
        ${(routine.workshopMaps || []).length ? routine.workshopMaps.map((map) => trainingItemRow(map, "workshopMap")).join("") : `<p class="muted">No workshop maps.</p>`}
      </details>
      <div class="routine-footer">
        <span>${(routine.favorites || []).length} favorites</span>
        ${canManageTrainingRoutine(user, routine) ? `<button data-routine-edit="${routine.id}">Edit routine</button>` : ""}
        ${canManageTrainingRoutine(user, routine) ? `<button data-routine-delete="${routine.id}">Delete routine</button>` : ""}
      </div>
    </article>
  `;
}

function trainingItemRow(item, type) {
  const detail = [
    type === "trainingPack" ? "Training Pack" : "Workshop Map",
    item.category || "Other",
    `${item.minutes || 0} minutes`,
    type === "trainingPack" && item.code ? `Code: ${item.code}` : "",
    type === "workshopMap" && item.link ? "Workshop link available" : "",
  ].filter(Boolean).join(" / ");
  return `<div class="compact-row"><strong>${esc(item.name || "Unnamed")}</strong><span>${esc(detail)} ${type === "trainingPack" && item.code ? `<code>${esc(item.code)}</code>` : ""} ${type === "workshopMap" && item.link ? `<a href="${escapeAttr(item.link)}" target="_blank" rel="noreferrer">Open</a>` : ""}</span></div>`;
}

function trainingPresetForm(item = { id: "", type: "trainingPack", name: "", code: "", link: "", category: "Other", description: "" }) {
  return `
    <section class="panel"><h2>${item.id ? "Edit preset pack/map" : "New preset pack/map"}</h2>
      <form class="entity-form" data-entity="training-presets" data-id="${item.id || ""}">
        <div class="form-grid">
          ${field("type", "Type", ["trainingPack", "workshopMap"], item.type)}
          ${field("name", "Name", "text", item.name)}
          ${field("category", "Category", trainingCategories, item.category || "Other")}
          ${field("code", "Training Pack code", "text", item.code)}
          ${field("link", "Workshop Map link", "url", item.link)}
          ${field("description", "Description", "textarea", item.description)}
        </div>
        <button class="primary">Save preset</button>
      </form>
    </section>
  `;
}

function trainingPresetsPanel(presets, user) {
  const group = (type, title) => presets.filter((preset) => preset.type === type);
  const presetCard = (preset) => `
    <article class="routine-card">
      <div class="routine-card-head">
        <div><h3>${esc(preset.name || "Unnamed preset")}</h3><span>${esc(preset.category || "Other")}</span></div>
        ${canManageTrainingPresets(user) ? `<button data-preset-edit="${preset.id}">Edit</button>` : ""}
      </div>
      ${preset.code ? `<p><code>${esc(preset.code)}</code></p>` : ""}
      ${preset.link ? `<p><a href="${escapeAttr(preset.link)}" target="_blank" rel="noreferrer">Open workshop map</a></p>` : ""}
      ${preset.description ? `<p class="muted">${multiline(preset.description)}</p>` : ""}
      ${canManageTrainingPresets(user) ? `<div class="routine-footer"><span>${esc(preset.createdAt || "")}</span><button data-preset-delete="${preset.id}">Delete preset</button></div>` : ""}
    </article>`;
  const packs = group("trainingPack");
  const maps = group("workshopMap");
  return `
    <section class="panel wide">
      <h2>Preset Training Packs and Workshop Maps</h2>
      <h3>Training Packs</h3>
      <div class="routine-grid">${packs.map(presetCard).join("") || `<p class="muted">No preset training packs yet.</p>`}</div>
      <h3>Workshop Maps</h3>
      <div class="routine-grid">${maps.map(presetCard).join("") || `<p class="muted">No preset workshop maps yet.</p>`}</div>
    </section>
  `;
}

function metricMini(title, value) {
  return `<div class="mini-metric"><span>${esc(title)}</span><strong>${esc(value)}</strong></div>`;
}

function routineModes(item) {
  return `custom pack ${item.customPackMinutes || 0} workshop ${item.workshopMapMinutes || 0} freeplay ${item.freeplayMinutes || 0}`;
}

function weekPage(store, user) {
  const canManageAny = isAdmin(user) || isCoach(user);
  const selectedPlayerId = canManageAny ? ((filters.week || {}).playerId || store.players[0]?.id || "") : "";
  const owner = weekOwnerId(store, user, selectedPlayerId);
  const selectedPlayer = store.players.find((player) => player.id === selectedPlayerId);
  const ownPlayer = matchingPlayerForUser(store, user);
  const displayPlayer = canManageAny ? selectedPlayer : ownPlayer;
  const week = store.weeks.find((item) => weekMatchesOwner(item, owner)) || { title: displayPlayer ? `${displayPlayer.rlName || displayPlayer.name}'s week` : "My week", ...owner, items: [], showInCalendar: false };
  const teamEvents = displayPlayer ? allCalendarItems(store, user).filter((item) => item.teamId === displayPlayer.teamId || isAdmin(user)) : [];
  return `
    <section class="crud-layout">
      ${canManageAny ? `<div class="toolbar">
        <label><span>Player</span><select data-filter="week" data-filter-kind="playerId">${store.players.map((player) => `<option value="${player.id}" ${player.id === selectedPlayerId ? "selected" : ""}>${esc(player.rlName || player.name)}</option>`).join("")}</select></label>
      </div>` : ""}
      ${canManageWeek(user, week, owner) ? weekForm(week, owner) : ""}
      <section class="panel wide"><h2>${esc(week.title || "My week")}</h2>${weekGrid(week.items || [], canManageWeek(user, week, owner))}</section>
      <section class="panel wide"><h2>Player schedule from calendar</h2>${eventList(teamEvents.slice(0, 12))}</section>
    </section>
  `;
}

function weekForm(week, owner) {
  return `
    <section class="panel"><h2>Plan week</h2>
      <form class="entity-form" data-entity="week-items" data-player-id="${owner.playerId || ""}" data-owner-user-id="${owner.ownerUserId || ""}">
        <div class="form-grid">
          ${field("title", "Week name", "text", week.title || "")}
          ${field("day", "Day", weekDays, "Monday")}
          ${field("startTime", "Start time", "time")}
          ${field("endTime", "End time", "time")}
          ${field("mode", "Mode", weekModes, "3s")}
          ${field("notes", "Notes", "textarea")}
          <label><span>Show this item in calendar</span><select name="showInCalendar"><option value="false">Private</option><option value="true">Show in calendar</option></select></label>
        </div>
        <button class="primary">Add to week</button>
      </form>
    </section>
  `;
}

function weekGrid(items, editable) {
  return `<div class="week-grid">${weekDays.map((day) => `
    <section class="week-day">
      <h3>${day}</h3>
      ${items.filter((item) => item.day === day).sort((a, b) => String(a.startTime).localeCompare(String(b.startTime))).map((item) => `
        <div class="compact-row">
          <strong>${esc(item.startTime || "--:--")} - ${esc(item.endTime || "--:--")} / ${esc(item.mode)}</strong>
          <span>${esc(item.notes || "")}</span>
          <span>${item.showInCalendar ? "Calendar visible" : "Private"}</span>
          ${editable ? `<button data-week-delete="${item.id}">Delete</button>` : ""}
        </div>
      `).join("") || `<p class="muted">No plan.</p>`}
    </section>
  `).join("")}</div>`;
}

function availabilityPage(store, user) {
  const f = filters.availability || {};
  const weekStart = startOfAvailabilityWeek();
  const visibleTeams = teams.filter((team) => !f.team || f.team === "all" || f.team === team.id);
  return `
    <section class="crud-layout">
      <div class="toolbar">
        <label><span>Filter by team</span><select data-filter="availability" data-filter-kind="team">
          ${teamFilterOptions(f.team || "all")}
        </select></label>
        <div>
          <span class="muted">Week</span>
          <div class="row-actions">
            <button type="button" data-availability-week="-1">Prev</button>
            <button type="button" data-availability-week="0">${esc(availabilityWeekLabel(weekStart))}</button>
            <button type="button" data-availability-week="1">Next</button>
          </div>
        </div>
      </div>
      ${visibleTeams.map((team) => `
        <section class="panel wide availability-panel">
          <div class="availability-panel-head">
            <div>
              <h2>${esc(team.label)} Availability</h2>
              <p class="muted">Players can tick their own slots for ${esc(availabilityWeekLabel(weekStart))}.</p>
            </div>
            <span class="timezone-pill">${esc(viewerTimeZone())}</span>
          </div>
          ${availabilityMatrix(store, user, team.id, weekStart)}
        </section>
      `).join("")}
    </section>
  `;
}

function availabilityForm(store, item = schemas.availability.empty) {
  const selectedPlayer = store.players.find((player) => player.id === item.playerId);
  const playerOptions = store.players.map((player) => `<option value="${player.id}" ${item.playerId === player.id ? "selected" : ""}>${esc(player.rlName || player.name)} / ${teamName(player.teamId)}</option>`).join("");
  return `
    <section class="panel"><h2>Availability entry</h2>
      <form class="entity-form" data-entity="availability" data-id="${item.id || ""}">
        <div class="form-grid">
          <label><span>Player</span><select name="playerId"><option value="">Manual name</option>${playerOptions}</select></label>
          ${field("playerName", "Player name", "text", item.playerName || selectedPlayer?.rlName || selectedPlayer?.name || "")}
          ${field("teamId", "Team", "team", item.teamId || selectedPlayer?.teamId || "main")}
          ${field("day", "Day", weekDays, item.day || "Monday")}
          ${field("date", "Date", "date", item.date || "")}
          ${field("startTime", "Start", "time", item.startTime || "")}
          ${field("endTime", "End", "time", item.endTime || "")}
          ${field("status", "Status", ["Available", "Maybe", "Unavailable"], item.status || "Available")}
          ${field("notes", "Notes", "textarea", item.notes || "")}
        </div>
        <button class="primary">Save availability</button>
      </form>
    </section>
  `;
}

function availabilityImportPanel() {
  return `
    <section class="panel"><h2>Import from Excel</h2>
      <form class="entity-form" data-entity="availability-import">
        <label><span>Paste Excel rows</span><textarea name="rows" rows="6" placeholder="Player&#9;Team&#9;Day&#9;Date&#9;Start&#9;End&#9;Status&#9;Notes"></textarea></label>
        <p class="muted">Paste rows copied from Excel. Header names can be Player, Team, Day, Date, Start, End, Status, Notes.</p>
        <button class="primary">Import availability</button>
      </form>
    </section>
  `;
}

function confirmationsPage(store, user) {
  const canSend = canSendConfirmations(user);
  const notifications = visibleNotifications(store, user);
  return `
    <section class="crud-layout">
      ${canSend ? confirmationSendForm(store) : ""}
      ${canSend ? entityForm("confirmationTemplates", schemas.confirmationTemplates) : ""}
      <section class="panel wide">
        <h2>Notifications</h2>
        <div class="notification-list">${notifications.map((item) => notificationCard(item, user, canSend)).join("") || `<p class="muted">No confirmations yet.</p>`}</div>
      </section>
      ${canSend ? `<section class="panel wide"><h2>Saved templates</h2>${table(schemas.confirmationTemplates.headers, filteredRows(store.confirmationTemplates, schemas.confirmationTemplates, "confirmationTemplates").map((item) => [...schemas.confirmationTemplates.cells(item), rowActions(true, "confirmationTemplates", item.id)]))}</section>` : ""}
    </section>
  `;
}

function confirmationSendForm(store) {
  const templateOptions = (store.confirmationTemplates || []).map((template) => `<option value="${template.id}">${esc(template.title)}</option>`).join("");
  const defaultTeam = teams[0]?.id || "main";
  const playerOptions = confirmationPlayerOptions(store, defaultTeam);
  const eventOptions = allCalendarItems(store).filter((item) => endDate(item) >= new Date()).map((item) => `<option value="${resultSourceKey(item)}">${esc(item.title)} / ${fmt(item)} / ${calendarTargetLabel(item, store)}</option>`).join("");
  return `
    <section class="panel"><h2>Send confirmation</h2>
      <form class="entity-form" data-entity="confirmation-send">
        <div class="form-grid">
          <label><span>Template</span><select name="templateId"><option value="">Custom message</option>${templateOptions}</select></label>
          <label><span>Event</span><select name="eventKey"><option value="">No event</option>${eventOptions}</select></label>
          <label><span>Target</span><select name="targetType"><option value="team">One team</option><option value="both">Both teams</option><option value="player">One player</option></select></label>
          ${field("teamId", "Team", "team", defaultTeam)}
          <label><span>Player</span><select name="playerId" data-confirmation-player-select><option value="">Select player</option>${playerOptions}</select></label>
          ${field("subject", "Subject", "text", "")}
          ${field("message", "Message", "textarea", "")}
        </div>
        <button class="primary">Notify players</button>
      </form>
    </section>
  `;
}

function confirmationPlayerOptions(store, teamId = "") {
  return (store.players || [])
    .filter((player) => !teamId || player.teamId === teamId)
    .map((player) => `<option value="${player.id}">${esc(player.rlName || player.name)} / ${teamName(player.teamId)}</option>`)
    .join("");
}

function notificationCard(item, user, canSend) {
  const unread = !(item.readBy || []).includes(user.id);
  const store = loadStore();
  const player = matchingPlayerForUser(store, user);
  const acceptedId = player?.id || user.id;
  const accepted = (item.acceptedBy || []).includes(acceptedId);
  const canAccept = Boolean(player?.id && (item.recipientIds || []).includes(player.id));
  const acceptance = notificationAcceptanceMarkup(store, item, canSend, user);
  return `
    <article class="notification-card ${unread ? "unread" : ""}">
      <div class="routine-card-head">
        <div><h3>${esc(item.subject || "Confirmation")}</h3><span>${esc(item.createdAt ? new Date(item.createdAt).toLocaleString("en-US") : "")} / ${esc(item.targetLabel || "Players")}</span></div>
        <div class="row-actions">
          ${canAccept ? `<button class="primary" data-notification-accept="${item.id}" ${accepted ? "disabled" : ""}>${accepted ? "Accepted" : "Accept"}</button>` : ""}
          ${unread ? `<button data-notification-read="${item.id}">Mark read</button>` : ""}
          ${canSend ? `<button data-delete="notifications:${item.id}">Delete</button>` : ""}
        </div>
      </div>
      ${item.eventLabel ? `<p class="muted">${esc(item.eventLabel)}</p>` : ""}
      <p>${multiline(item.message || "")}</p>
      ${acceptance}
    </article>
  `;
}

function notificationAcceptanceMarkup(store, item, canSend, user) {
  const players = (item.recipientIds || [])
    .map((playerId) => store.players.find((player) => player.id === playerId))
    .filter(Boolean);
  if (!players.length) return item.recipients?.length ? `<p class="muted">Sent to: ${esc(item.recipients.join(", "))}</p>` : "";
  if (!canSend) return `<p class="muted">Status: ${(item.acceptedBy || []).some((playerId) => playerId === matchingPlayerForUser(store, user)?.id) ? "Accepted" : "Waiting for your confirmation"}</p>`;
  return `
    <div class="confirmation-status">
      <strong>Accepted players</strong>
      ${players.map((player) => {
        const accepted = (item.acceptedBy || []).includes(player.id);
        return `<span class="${accepted ? "accepted" : ""}">${esc(availabilityPlayerLabel(player))}: ${accepted ? "Accepted" : "Waiting"}</span>`;
      }).join("")}
    </div>
  `;
}

function sortLabel(option) {
  return sortLabels[option] || option.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function calendarPage(store, editable, canRecordResults, user) {
  const f = filters.calendar || {};
  const events = allCalendarItems(store, user)
    .filter((item) => canSeeCalendarItem(user, item, store))
    .filter((item) => !f.query || `${item.title} ${item.notes} ${calendarTargetLabel(item, store)}`.toLowerCase().includes(f.query.toLowerCase()))
    .filter((item) => !f.team || f.team === "all" || item.teamId === f.team || (!item.playerId && item.teamId === "both"))
    .filter((item) => !f.type || f.type === "all" || item.type === f.type);
  const conflicts = conflictKeys(events, user, store);
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthLabel = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(monthStart);
  return `
    <section class="crud-layout">
      ${toolbar("calendar", true, true, [])}
      ${editable ? calendarForm(undefined, store, user) : ""}
      <section class="panel wide calendar-panel">
        <div class="calendar-head">
          <h2>${monthLabel}</h2>
          <div class="row-actions">
            <span class="timezone-pill">${esc(viewerTimeZone())}</span>
            <button data-calendar-shift="-1">Prev</button>
            <button data-calendar-today="true">Today</button>
            <button data-calendar-shift="1">Next</button>
          </div>
        </div>
        ${monthGrid(events, conflicts, monthStart, editable, store, user)}
      </section>
      ${calendarEventDialog(store, canRecordResults, user)}
    </section>
  `;
}

function monthGrid(events, conflicts, monthStart, editable, store, user) {
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const first = new Date(monthStart);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - mondayOffset);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dayEvents = events.filter((item) => sameDay(new Date(eventDateValue(item)), date));
    const inMonth = date.getMonth() === monthStart.getMonth();
    const today = sameDay(date, new Date());
    return `
      <div class="calendar-cell ${inMonth ? "" : "muted-cell"} ${today ? "today-cell" : ""}">
        <div class="day-number">${date.getDate()}</div>
        <div class="day-events">
          ${dayEvents.map((item) => calendarChip(item, conflicts.has(resultSourceKey(item)), editable && canManageCalendarEvent(user, item, store), store)).join("")}
        </div>
      </div>
    `;
  });
  return `<div class="calendar-grid">${weekdays.map((day) => `<div class="weekday">${day}</div>`).join("")}${cells.join("")}</div>`;
}

function calendarChip(item, conflict, editable, store = loadStore()) {
  const time = fmtTime(item);
  const duration = Number(item.durationMinutes || 0);
  const end = duration ? `-${fmtTime(endDate(item).toISOString())}` : "";
  const rosterMissing = needsRoster(item);
  return `
    <div class="calendar-chip ${conflict ? "conflict-chip" : ""} ${rosterMissing ? "needs-roster-chip" : ""}" style="border-left-color:${eventColors[item.type]}" data-calendar-open="${resultSourceKey(item)}">
      <div class="chip-main"><strong>${time}${end}</strong><span title="${escapeAttr(item.title)}">${esc(item.title)}</span></div>
      <small>${item.type} / ${calendarTargetLabel(item, store)}</small>
      ${rosterMissing ? `<small class="roster-warning">Roster needed</small>` : ""}
      ${editable ? `<div class="chip-actions"><button data-edit="${item.source}:${item.sourceId}">Edit</button><button data-delete="${item.source}:${item.sourceId}">Delete</button></div>` : ""}
    </div>
  `;
}

function calendarEventDialog(store, canRecordResults, user) {
  if (!selectedCalendarItemKey) return "";
  const item = findCalendarItem(store, selectedCalendarItemKey);
  if (!item) return "";
  const played = endDate(item) < new Date();
  const existingResult = resultForSource(store, resultSourceKey(item));
  const teamLabel = item.playerId ? playerNameById(store, item.playerId) : (item.teamId === "both" ? "HoloFyrn" : teamName(item.teamId));
  const rosterMissing = needsRoster(item);
  const ownPlayers = store.players.filter((player) => (item.teamId === "both" || player.teamId === item.teamId || player.id === item.playerId) && !isCoachRole(player));
  const savedOurLineup = item.ourLineup || [];
  if (isAggregateResultSource(item)) {
    const matches = normalizeTournamentMatches(item.tournamentMatches || []);
    return `
      <div class="modal-backdrop" data-calendar-close="true">
        <section class="modal-panel tournament-dialog" role="dialog" aria-modal="true">
          <div class="modal-head">
            <div>
              <p class="eyebrow">${fmtRange(item)}</p>
              <h2>${esc(item.title || "Tournament")}</h2>
              <p class="muted">${teamLabel} / ${calendarTargetLabel(item, store)} / ${esc(tournamentMatchSummary(matches))}</p>
            </div>
            <button class="icon-button" data-calendar-close="true" title="Close">X</button>
          </div>
          <section class="lineup-panel">
            <h3>Roster</h3>
            ${[0, 1, 2, 3].map((index) => `
              <label><span>Player ${index + 1}</span><select name="ourLineup${index}">
                ${ourLineupOptions(savedOurLineup[index], ownPlayers)}
              </select></label>
            `).join("")}
          </section>
          <section class="lineup-panel">
            <h3>Tournament matches</h3>
            ${tournamentMatchesEditor(matches)}
          </section>
          ${rosterMissing ? `<p class="warning">Roster needed before conflict checks can be precise.</p>` : ""}
          ${!played ? `<p class="warning">Result can be recorded after this tournament has been played.</p>` : ""}
          <div class="row-actions modal-actions">
            ${canRecordResults ? `<button class="primary" data-calendar-save-tournament="${resultSourceKey(item)}">Save roster and matches</button>` : ""}
            ${canRecordResults && played ? `<button class="primary" data-record-result="${resultSourceKey(item)}">${existingResult ? "Edit Result" : "Add Result"}</button>` : ""}
            <button data-calendar-close="true">Close</button>
          </div>
        </section>
      </div>
    `;
  }
  const opponentName = item.lineupOpponent || item.opponent || "";
  return `
    <div class="modal-backdrop" data-calendar-close="true">
      <section class="modal-panel" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <p class="eyebrow">${fmtRange(item)}</p>
            <h2>${teamLabel} VS <span data-opponent-title>${esc(opponentName || "TBA")}</span></h2>
            <p class="muted">${esc(item.title)} / ${esc(item.type)} / ${calendarTargetLabel(item, store)}</p>
          </div>
          <button class="icon-button" data-calendar-close="true" title="Close">X</button>
        </div>
        <div class="form-grid">
          <label><span>Opponent</span><input name="resultOpponentDraft" value="${escapeAttr(opponentName)}" data-opponent-input></label>
        </div>
        <div class="lineup-grid lineup-grid-single">
          <section class="lineup-panel">
            <h3>Roster</h3>
            ${[0, 1, 2, 3].map((index) => `
              <label><span>Player ${index + 1}</span><select name="ourLineup${index}">
                ${ourLineupOptions(savedOurLineup[index], ownPlayers)}
              </select></label>
            `).join("")}
          </section>
        </div>
        ${rosterMissing ? `<p class="warning">Roster needed before conflict checks can be precise.</p>` : ""}
        ${!played ? `<p class="warning">Result can be recorded after this event has been played.</p>` : ""}
        <div class="row-actions modal-actions">
          ${canRecordResults ? `<button class="primary" data-calendar-save-lineup="${resultSourceKey(item)}">Save lineup</button>` : ""}
          ${canRecordResults && played ? `<button class="primary" data-record-result="${resultSourceKey(item)}">${existingResult ? "Edit Result" : "Add Result"}</button>` : ""}
          <button data-calendar-close="true">Close</button>
        </div>
      </section>
    </div>
  `;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function adminRegisterForm() {
  return `
    <section class="panel wide">
      <h2>Register player</h2>
      <form id="admin-register-form" class="form-grid">
        <label><span>Username</span><input name="username" autocomplete="username" required></label>
        ${passwordInput("password", "new-password", "Temporary password")}
        <button class="primary">Create player account</button>
        <p id="admin-register-message" class="muted"></p>
      </form>
    </section>
  `;
}

function adminPage(store, user) {
  if (!isAdmin(user)) return `<section class="panel"><h2>Admin</h2><p class="warning">Admin access is required for this page.</p></section>`;
  const createdUsers = store.users.filter((item) => !isBuiltInUser(item));
  const userRows = createdUsers.map((item) => [
    esc(item.username),
    permissionLabel(item),
    roleSelect(item),
    accountAccessControls(item),
    item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US") : "-",
    `<button data-user-delete="${item.id}">Delete</button>`,
  ]);
  return `
    ${adminRegisterForm()}
    <section class="panel wide">
      <h2>Created accounts</h2>
      <div class="row-actions admin-actions">
        <button data-admin-clean-store="true">Clean database</button>
      </div>
      ${createdUsers.length ? table(["Username", "Permission", "Role", "Access", "Created"], userRows) : `<p class="muted">No created accounts yet.</p>`}
    </section>
  `;
}

function accountPage(user) {
  return `
    <section class="panel">
      <h2>Account settings</h2>
      <form id="password-change-form" class="form-grid">
        <label><span>Username</span><input value="${escapeAttr(user.username || user.email || user.name)}" disabled></label>
        ${passwordInput("currentPassword", "current-password", "Current password")}
        ${passwordInput("newPassword", "new-password", "New password")}
        ${passwordInput("confirmPassword", "new-password", "Confirm new password")}
        <button class="primary">Change password</button>
        <p id="password-change-message" class="muted"></p>
      </form>
    </section>
  `;
}

function toolbar(key, hasTeam, hasType, sortOptions) {
  const f = filters[key] || {};
  return `
    <div class="toolbar">
      <label><span>Search</span><input data-filter="${key}" data-filter-kind="query" value="${escapeAttr(f.query || "")}" placeholder="Search by name, note, rank..."></label>
      ${hasTeam ? `<label><span>Filter by team</span><select data-filter="${key}" data-filter-kind="team">${teamFilterOptions(f.team || "all", key === "calendar")}</select></label>` : ""}
      ${hasType ? `<label><span>Filter by type</span><select data-filter="${key}" data-filter-kind="type"><option value="all">All types</option>${Object.keys(eventColors).map((type) => `<option ${f.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label>` : ""}
      ${sortOptions.length ? `<label><span>Sort by</span><select data-filter="${key}" data-filter-kind="sort">${sortOptions.map((item) => `<option value="${item}" ${f.sort === item ? "selected" : ""}>${sortLabel(item)}</option>`).join("")}</select></label>` : ""}
    </div>
  `;
}

function entityForm(key, schema, item = schema.empty) {
  return `
    <section class="panel"><h2>${schema.title}</h2>
      <form class="entity-form" data-entity="${key}" data-id="${item.id || ""}">
        <div class="form-grid">${schema.fields.map(([name, label, type]) => field(name, label, type, item[name])).join("")}</div>
        <button class="primary">Save</button>
      </form>
    </section>
  `;
}

function playerForm(item = schemas.players.empty, showPrivateNotes = false) {
  return `
    <section class="panel"><h2>Player profile</h2>
      <form class="entity-form" data-entity="players" data-id="${item.id || ""}">
        <div class="form-grid">${schemas.players.fields.map(([name, label, type]) => field(name, label, type, item[name])).join("")}</div>
        <button class="primary">Save profile</button>
      </form>
    </section>
  `;
}

function playerStatsForm(players, item = players[0]) {
  if (!item) return "";
  return `
    <section class="panel"><h2>Private coaching notes</h2>
      <form class="entity-form" data-entity="player-stats" data-id="${item.id}">
        <div class="form-grid">
          <label><span>Player</span><select name="playerId" data-player-stat-select>${players.map((player) => `<option value="${player.id}" ${player.id === item.id ? "selected" : ""}>${esc(player.rlName || player.name)}</option>`).join("")}</select></label>
          ${field("notes", "Private notes / goals", "textarea", item.notes)}
        </div>
        <button class="primary">Save notes</button>
      </form>
    </section>
  `;
}

function tryoutForm(item = { id: "", name: "", rlName: "", discord: "", rank: "", previousTeam: "", availability: "", dateTime: "", durationMinutes: "60", teamId: "main", status: "Open", nextStep: "", opinion: "", stats: emptyStats }, showPrivateNotes = false) {
  const publicFields = [["name", "Name"], ["rlName", "RL name"], ["discord", "Discord"], ["rank", "Rank / MMR"], ["previousTeam", "Previous team"], ["availability", "Availability"], ["dateTime", "Tryout date", "datetime-local"], ["durationMinutes", "Duration minutes", "number"], ["teamId", "HoloFyrn team", "team"], ["status", "Status", ["Open", "Scheduled", "Trial", "Accepted", "Declined"]]];
  const fields = showPrivateNotes ? [...publicFields, ["nextStep", "Next step"], ["opinion", "Staff opinion", "textarea"]] : publicFields;
  return `
    <section class="panel"><h2>Tryout entry</h2>
      <form class="entity-form" data-entity="tryouts" data-id="${item.id || ""}">
        <div class="form-grid">${fields.map(([name, label, type]) => field(name, label, type, item[name])).join("")}</div>
        <button class="primary">Save tryout</button>
      </form>
    </section>
  `;
}

function calendarForm(item = { id: "", title: "", dateTime: "", durationMinutes: "60", type: "Meeting", teamId: "main", playerId: "", targetType: "team", notes: "" }, store = loadStore(), user = null) {
  const staffCalendar = isAdmin(user) || isCoach(user);
  const ownPlayer = matchingPlayerForUser(store, user);
  const selectedTarget = item.playerId ? "player" : (item.teamId === "both" ? "both" : "team");
  const selectedTeam = validTeamId(item.teamId, teams[0]?.id || "main");
  const playerOptions = (store.players || []).filter((player) => player.teamId === selectedTeam || item.playerId === player.id).map((player) => `<option value="${player.id}" ${item.playerId === player.id ? "selected" : ""}>${esc(player.rlName || player.name)} / ${teamName(player.teamId)}</option>`).join("");
  const ownTargetText = ownPlayer ? `${esc(ownPlayer.rlName || ownPlayer.name)} / ${teamName(ownPlayer.teamId)}` : "My personal calendar";
  return `
    <section class="panel"><h2>Calendar event</h2>
      <form class="entity-form" data-entity="events" data-id="${item.id || ""}">
        <div class="form-grid">
          ${field("title", "Title", "text", item.title)}
          ${field("dateTime", "Date and time", "datetime-local", item.dateTime)}
          ${field("durationMinutes", "Duration minutes", "number", item.durationMinutes)}
          ${field("type", "Type", eventTypes, item.type)}
          ${staffCalendar ? `
            <label><span>Calendar target</span><select name="targetType">
              <option value="team" ${selectedTarget === "team" ? "selected" : ""}>One team</option>
              <option value="both" ${selectedTarget === "both" ? "selected" : ""}>Both teams</option>
              <option value="player" ${selectedTarget === "player" ? "selected" : ""}>One player</option>
            </select></label>
            <label><span>Team</span><select name="teamId">${teamOptions(selectedTeam)}</select></label>
            <label><span>Player</span><select name="playerId" data-calendar-player-select><option value="">Select player</option>${playerOptions}</select></label>
          ` : `
            <label><span>Calendar target</span><input value="${ownTargetText}" disabled></label>
            <input type="hidden" name="targetType" value="player">
            <input type="hidden" name="playerId" value="${escapeAttr(ownPlayer?.id || "")}">
            <input type="hidden" name="teamId" value="${escapeAttr(ownPlayer?.teamId || user?.teamId || "")}">
          `}
          ${field("notes", "Notes", "textarea", item.notes)}
        </div>
        <p class="muted">Times are saved as UTC and shown in each user's local timezone (${esc(viewerTimeZone())}). Players can create calendar events only for themselves; admins and coaches can target one player, one team, or both teams.</p>
        <button class="primary">Save</button>
      </form>
    </section>
  `;
}

function field(name, label, type = "text", value = "") {
  if (type === "team") {
    return `<label><span>${label}</span><select name="${name}">${teamOptions(value || "main")}</select></label>`;
  }
  if (Array.isArray(type)) {
    return `<label><span>${label}</span><select name="${name}">${type.map((option) => `<option value="${option}" ${value === option ? "selected" : ""}>${option}</option>`).join("")}</select></label>`;
  }
  if (type === "textarea") {
    return `<label><span>${label}</span><textarea name="${name}" rows="2">${esc(value)}</textarea></label>`;
  }
  return `<label><span>${label}</span><input name="${name}" type="${type}" value="${escapeAttr(value)}"></label>`;
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${[...headers, ""].map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function rowActions(editable, key, id) {
  if (!editable) return "-";
  return `<div class="row-actions"><button data-edit="${key}:${id}">Edit</button><button data-delete="${key}:${id}">Delete</button></div>`;
}

function filteredRows(rows, schema, key) {
  const f = filters[key] || {};
  return [...rows]
    .filter((item) => !f.query || schema.search(item).toLowerCase().includes(f.query.toLowerCase()))
    .filter((item) => !f.team || f.team === "all" || item.teamId === f.team)
    .sort((a, b) => sortCompare(a, b, f.sort || schema.sort[0]));
}

function sortCompare(a, b, key) {
  if (["prizeEur"].includes(key)) return Number(b[key] || 0) - Number(a[key] || 0);
  return String(a[key] || "").localeCompare(String(b[key] || ""));
}

document.addEventListener("click", async (event) => {
  const store = loadStore();
  const activeUser = getUser(store);
  const calendarChip = event.target.closest("[data-calendar-open]");

  if (event.target.dataset?.calendarClose) {
    selectedCalendarItemKey = "";
    render();
    return;
  }

  if (event.target.dataset?.replayClose) {
    selectedReplayResultId = "";
    render();
    return;
  }

  if (calendarChip && !event.target.closest("button")) {
    selectedCalendarItemKey = calendarChip.dataset.calendarOpen;
    render();
    return;
  }

  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.page) {
    currentPage = button.dataset.page;
    render();
  }

  if (button.dataset.resultsView) {
    filters.results = { ...(filters.results || {}), view: button.dataset.resultsView };
    resultDraft = null;
    render();
  }

  if (button.dataset.resultAdd) {
    if (!canManageResults(activeUser)) return;
    resultDraft = { id: "", resultSource: "", type: "Match", title: "", dateTime: "", startsAtUtc: "", teamId: "main", opponent: "", averageMmr: "", score: "", replayLinks: [], notes: "" };
    render();
  }

  if (button.dataset.resultCancel) {
    resultDraft = null;
    render();
  }

  if (button.dataset.resultReplays) {
    selectedReplayResultId = button.dataset.resultReplays;
    render();
  }

  if (button.dataset.tournamentAdd) {
    if (!canManageTournaments(activeUser)) return;
    const formPanel = key === "confirmationTemplates"
      ? [...document.querySelectorAll(".crud-layout .panel")].find((panel) => panel.querySelector('[data-entity="confirmationTemplates"]'))
      : document.querySelector(".crud-layout .panel");
    if (formPanel) formPanel.outerHTML = entityForm("tournaments", schemas.tournaments);
  }

  if (button.dataset.replayClose) {
    selectedReplayResultId = "";
    render();
  }

  if (button.dataset.calendarClose) {
    selectedCalendarItemKey = "";
    render();
  }

  if (button.dataset.calendarSaveLineup) {
    if (!canManageEntity(activeUser, "results")) return;
    if (!saveCalendarLineup(store, button.dataset.calendarSaveLineup)) return;
    await persistStore(store);
  }

  if (button.dataset.calendarSaveTournament) {
    if (!canManageEntity(activeUser, "results")) return;
    if (!saveTournamentMatches(store, button.dataset.calendarSaveTournament)) return;
    if (!saveCalendarLineup(store, button.dataset.calendarSaveTournament)) return;
    await persistStore(store);
  }

  if (button.dataset.recordResult) {
    if (!canManageResults(activeUser)) return;
    const source = findCalendarItem(store, button.dataset.recordResult);
    if (!source) return;
    const existingResult = resultForSource(store, button.dataset.recordResult);
    const aggregateResult = isAggregateResultSource(source);
    const tournamentMatches = aggregateResult ? saveTournamentMatches(store, button.dataset.recordResult) || [] : [];
    const lineupDraft = saveCalendarLineup(store, button.dataset.recordResult) || { lineupOpponent: "" };
    if (!(await persistStore(store))) return;
    resultDraft = existingResult ? { ...existingResult } : {
      id: "",
      resultSource: button.dataset.recordResult,
      type: aggregateResult ? "Tournament" : "Match",
      title: source.title,
      dateTime: source.dateTime,
      startsAtUtc: source.startsAtUtc,
      teamId: source.teamId,
      opponent: lineupDraft.lineupOpponent || source.opponent || "",
      averageMmr: "",
      score: "",
      tournamentMatches,
      replayLinks: [],
      notes: "",
    };
    selectedCalendarItemKey = "";
    currentPage = "results";
    render();
  }

  if (button.dataset.action === "logout") {
    if (!(await showConfirm("Are you sure you want to log out?", { title: "Log out", confirmText: "Log out" }))) return;
    localStorage.removeItem(sessionKey);
    if (authApi && auth) authApi.signOut(auth);
    render();
  }

  if (button.dataset.calendarShift) {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + Number(button.dataset.calendarShift), 1);
    render();
  }

  if (button.dataset.calendarToday) {
    calendarMonth = new Date();
    render();
  }

  if (button.dataset.availabilityWeek) {
    const shift = Number(button.dataset.availabilityWeek);
    availabilityWeekOffset = shift === 0 ? 0 : availabilityWeekOffset + shift;
    render();
  }

  if (button.dataset.playerProfile) {
    filters.players = { ...(filters.players || {}), detailId: button.dataset.playerProfile };
    render();
  }

  if (button.dataset.playerProfileClose) {
    filters.players = { ...(filters.players || {}), detailId: "" };
    render();
  }

  if (button.dataset.notificationRead) {
    const notification = store.notifications.find((item) => item.id === button.dataset.notificationRead);
    if (!notification || !canSeeNotification(store, activeUser, notification)) return;
    notification.readBy = Array.from(new Set([...(notification.readBy || []), activeUser.id]));
    await persistStore(store);
  }

  if (button.dataset.notificationAccept) {
    const notification = store.notifications.find((item) => item.id === button.dataset.notificationAccept);
    if (!notification || !canSeeNotification(store, activeUser, notification)) return;
    const player = matchingPlayerForUser(store, activeUser);
    const acceptId = player?.id || activeUser.id;
    notification.acceptedBy = Array.from(new Set([...(notification.acceptedBy || []), acceptId]));
    notification.readBy = Array.from(new Set([...(notification.readBy || []), activeUser.id]));
    await persistStore(store);
  }

  if (button.dataset.trainingPresetsToggle) {
    filters.training = { ...(filters.training || {}), showPresets: !(filters.training || {}).showPresets };
    render();
  }

  if (button.dataset.delete) {
    const [key, id] = button.dataset.delete.split(":");
    const item = store[key]?.find((entry) => entry.id === id);
    if (!canManageEntity(activeUser, key)) return;
    if (key === "events" && !canManageCalendarEvent(activeUser, item, store)) return;
    if (["events", "scrims", "tournaments", "tryouts", "results", "players", "availability", "confirmationTemplates", "notifications"].includes(key) && !(await showConfirm("Are you sure you want to delete this item?", { title: "Delete item", confirmText: "Delete", tone: "danger" }))) return;
    store[key] = store[key].filter((item) => item.id !== id);
    await persistStore(store);
  }

  if (button.dataset.edit) {
    const [key, id] = button.dataset.edit.split(":");
    if (!canManageEntity(activeUser, key)) return;
    const item = store[key].find((entry) => entry.id === id);
    if (key === "events" && !canManageCalendarEvent(activeUser, item, store)) return;
    if (key === "results") {
      resultDraft = item ? { ...item } : null;
      currentPage = "results";
      render();
      return;
    }
    const formPanel = document.querySelector(".crud-layout .panel");
    if (!item || !formPanel) return;
    if (key === "tryouts") formPanel.outerHTML = tryoutForm(item, canManagePlayerStats(activeUser));
    else if (key === "events") formPanel.outerHTML = calendarForm(item, store, activeUser);
    else if (key === "players") formPanel.outerHTML = playerForm(item, canManagePlayerStats(activeUser));
    else if (key === "availability") formPanel.outerHTML = availabilityForm(store, item);
    else formPanel.outerHTML = entityForm(key, schemas[key], item);
  }

  if (button.dataset.routineFavorite) {
    const routine = store.trainingRoutines.find((item) => item.id === button.dataset.routineFavorite);
    if (!routine || !canManageTrainingRoutine(activeUser, routine)) return;
    routine.favorites = routine.favorites || [];
    if (routine.favorites.includes(activeUser.id)) routine.favorites = routine.favorites.filter((id) => id !== activeUser.id);
    else routine.favorites.push(activeUser.id);
    await persistStore(store);
  }

  if (button.dataset.routineEdit) {
    const routine = store.trainingRoutines.find((item) => item.id === button.dataset.routineEdit);
    if (!routine || !canManageTrainingRoutine(activeUser, routine)) return;
    const formPanel = [...document.querySelectorAll(".crud-layout .panel")].find((panel) => panel.querySelector('[data-entity="training-routines"]'));
    if (routine && formPanel) formPanel.outerHTML = trainingRoutineForm(routine);
  }

  if (button.dataset.routineDelete) {
    const routine = store.trainingRoutines.find((item) => item.id === button.dataset.routineDelete);
    if (!routine || !canManageTrainingRoutine(activeUser, routine)) return;
    if (!(await showConfirm("Are you sure you want to delete this routine?", { title: "Delete routine", confirmText: "Delete", tone: "danger" }))) return;
    store.trainingRoutines = store.trainingRoutines.filter((item) => item.id !== button.dataset.routineDelete);
    await persistStore(store);
  }

  if (button.dataset.presetEdit) {
    if (!canManageTrainingPresets(activeUser)) return;
    const preset = store.trainingPresets.find((item) => item.id === button.dataset.presetEdit);
    const formPanel = [...document.querySelectorAll(".crud-layout .panel")].find((panel) => panel.querySelector('[data-entity="training-presets"]'));
    if (preset && formPanel) formPanel.outerHTML = trainingPresetForm(preset);
  }

  if (button.dataset.presetDelete) {
    if (!canManageTrainingPresets(activeUser)) return;
    if (!(await showConfirm("Are you sure you want to delete this preset?", { title: "Delete preset", confirmText: "Delete", tone: "danger" }))) return;
    store.trainingPresets = store.trainingPresets.filter((item) => item.id !== button.dataset.presetDelete);
    await persistStore(store);
  }

  if (button.dataset.adminCleanStore) {
    if (!isAdmin(activeUser)) return;
    if (!(await showConfirm("Clean template data from Firestore and keep only real saved data?", { title: "Clean database", confirmText: "Clean", tone: "warning" }))) return;
    await persistStore(store);
  }

  if (button.dataset.userDelete) {
    if (!isAdmin(activeUser)) return;
    const user = store.users.find((item) => item.id === button.dataset.userDelete);
    if (!user || isBuiltInUser(user)) return;
    if (user.id === currentAuthUser?.uid || user.authUid === currentAuthUser?.uid) return;
    if (!(await showConfirm(`Remove ${user.username}'s access now and queue their Firebase login for deletion?`, { title: "Request account deletion", confirmText: "Request deletion", tone: "danger" }))) return;
    button.disabled = true;
    try {
      if (!remoteApi || !db || !auth?.currentUser) throw new Error("Sign in to request account deletion.");
      const targetRef = remoteApi.doc(db, "users", user.id);
      const requestRef = remoteApi.doc(db, "accountDeletionRequests", user.id);
      await remoteApi.runTransaction(db, async (transaction) => {
        const target = await transaction.get(targetRef);
        if (!target.exists()) throw new Error("This account no longer exists. Reload the page.");
        if (target.data().authUid && target.data().authUid !== user.id) throw new Error("This legacy account needs its Firebase UID corrected before deletion.");
        transaction.update(targetRef, { approved: false, deletionPending: true });
        transaction.set(requestRef, { userId: user.id, requestedBy: auth.currentUser.uid, status: "pending", requestedAt: remoteApi.serverTimestamp() });
      });
      await showAlert("Access has been revoked. The scheduled worker will delete the Firebase login.", { title: "Deletion queued" });
    } catch (error) {
      await showAlert(error.code === "permission-denied"
        ? "Administrator access or the account deletion Firestore rule is missing."
        : error.message || "The deletion request did not finish. Please retry.", { title: "Delete failed", tone: "warning" });
    } finally {
      button.disabled = false;
    }
  }

  if (button.dataset.weekDelete) {
    for (const week of store.weeks) {
      if (!canManageWeek(activeUser, week, weekOwnerId(store, activeUser, week.playerId))) continue;
      week.items = (week.items || []).filter((item) => item.id !== button.dataset.weekDelete);
    }
    await persistStore(store);
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target.matches("#admin-register-form")) {
    event.preventDefault();
    const store = loadStore();
    const activeUser = getUser(store);
    const message = document.querySelector("#admin-register-message");
    if (!isAdmin(activeUser)) return;
    if (!authApi || !auth) {
      message.textContent = "Firebase Authentication is not available.";
      return;
    }
    const entry = Object.fromEntries(new FormData(event.target));
    const username = normalizeUsername(entry.username);
    const password = String(entry.password || "");
    if (!username) {
      message.textContent = "Please enter a valid username.";
      return;
    }
    if (password.length < 6) {
      message.textContent = "Temporary password should be at least 6 characters.";
      return;
    }
    const writableStore = await loadWritableStore();
    if (writableStore.users.some((item) => item.username?.toLowerCase() === username || item.email?.toLowerCase() === authEmailFromUsername(username).toLowerCase())) {
      message.textContent = "This username is already registered.";
      return;
    }
    try {
      const creatorAuth = secondaryAuth();
      if (!creatorAuth) throw new Error("Secondary Firebase Auth is not available.");
      const credential = await authApi.createUserWithEmailAndPassword(creatorAuth, authEmailFromUsername(username), password);
      if (authApi.updateProfile) await authApi.updateProfile(credential.user, { displayName: username });
      const profile = adminCreatedProfile(credential.user, username, username, password);
      await saveUserProfile(profile);
      writableStore.users.push(profile);
      await saveStore(writableStore);
      await authApi.signOut(creatorAuth);
      message.className = "success";
      message.textContent = `Player account created for ${username}.`;
      event.target.reset();
    } catch (error) {
      message.className = "warning";
      message.textContent = authMessage(error);
      console.error(error);
    }
    return;
  }

  if (event.target.matches("#password-change-form")) {
    event.preventDefault();
    const message = document.querySelector("#password-change-message");
    if (!authApi || !auth?.currentUser) {
      message.textContent = "Firebase Authentication is not available.";
      return;
    }
    const entry = Object.fromEntries(new FormData(event.target));
    if (entry.newPassword !== entry.confirmPassword) {
      message.textContent = "The new passwords do not match.";
      return;
    }
    if (String(entry.newPassword || "").length < 6) {
      message.textContent = "New password should be at least 6 characters.";
      return;
    }
    try {
      const email = auth.currentUser.email;
      const credential = authApi.EmailAuthProvider.credential(email, entry.currentPassword);
      await authApi.reauthenticateWithCredential(auth.currentUser, credential);
      await authApi.updatePassword(auth.currentUser, entry.newPassword);
      message.className = "success";
      message.textContent = "Password changed successfully.";
      event.target.reset();
    } catch (error) {
      message.className = "warning";
      message.textContent = authMessage(error);
      console.error(error);
    }
    return;
  }

  if (!event.target.matches(".entity-form")) return;
  event.preventDefault();
  const store = loadStore();
  const activeUser = getUser(store);
  const form = event.target;
  const key = form.dataset.entity;
  if (key === "player-stats" && !canManagePlayerStats(activeUser)) return;
  if (key === "training-routines" && !canCreateTrainingRoutine(activeUser)) return;
  if (key === "training-presets" && !canManageTrainingPresets(activeUser)) return;
  if (key === "week-items" && !activeUser) return;
  if (key === "availability-import" && !canManageEntity(activeUser, "availability")) return;
  if (key === "confirmation-send" && !canSendConfirmations(activeUser)) return;
  if (!["player-stats", "training-routines", "training-presets", "week-items", "availability-import", "confirmation-send"].includes(key) && !canManageEntity(activeUser, key)) return;
  const entry = Object.fromEntries(new FormData(form));
  const existingEntry = store[key]?.find((item) => item.id === form.dataset.id);
  if (key === "events" && existingEntry && !canManageCalendarEvent(activeUser, existingEntry, store)) return;

  if (key === "availability-import") {
    const rows = parseAvailabilityRows(entry.rows, store);
    if (!rows.length) {
      await showAlert("No availability rows were found.", { title: "Import availability", tone: "warning" });
      return;
    }
    store.availability = [...(store.availability || []), ...rows];
    await persistStore(store);
    return;
  }

  if (key === "confirmation-send") {
    const template = store.confirmationTemplates.find((item) => item.id === entry.templateId);
    const eventItem = entry.eventKey ? findCalendarItem(store, entry.eventKey) : null;
    const message = entry.message || template?.message || "";
    const subject = entry.subject || template?.subject || template?.title || "Confirmation";
    if (!message.trim() && !eventItem) {
      await showAlert("Add a message, choose a template, or attach an event first.", { title: "Send confirmation", tone: "warning" });
      return;
    }
    const senderPlayer = matchingPlayerForUser(store, activeUser);
    const targets = notificationTargets(store, entry);
    if (senderPlayer && entry.targetType !== "player" && !targets.some((player) => player.id === senderPlayer.id)) targets.push(senderPlayer);
    if (!targets.length) {
      await showAlert("No players match this confirmation target.", { title: "Send confirmation", tone: "warning" });
      return;
    }
    const eventLabel = eventItem ? `${eventItem.title} / ${fmt(eventItem)}` : "";
    store.notifications.push({
      id: uid(),
      subject,
      message: [message, eventLabel ? `Event: ${eventLabel}` : ""].filter(Boolean).join("\n\n"),
      eventKey: entry.eventKey || "",
      eventLabel,
      targetType: entry.targetType,
      teamId: entry.targetType === "team" ? entry.teamId : "",
      playerId: entry.targetType === "player" ? entry.playerId : "",
      targetLabel: targetLabel(store, entry),
      recipientIds: targets.map((player) => player.id).filter(Boolean),
      recipients: targets.map((player) => player.rlName || player.name).filter(Boolean),
      acceptedBy: [],
      createdBy: activeUser.id,
      createdByName: activeUser.name || activeUser.username || "",
      createdAt: new Date().toISOString(),
      readBy: [],
    });
    await persistStore(store);
    return;
  }

  if (key === "player-stats") {
    const player = store.players.find((item) => item.id === entry.playerId);
    if (!player) return;
    player.notes = entry.notes || "";
    await persistStore(store);
    return;
  }

  if (key === "training-routines") {
    const customPacks = [0, 1, 2, 3, 4]
      .map((index) => ({ name: entry[`customPackName${index}`], category: entry[`customPackCategory${index}`] || "Other", minutes: entry[`customPackMinutes${index}`], code: entry[`customPackCode${index}`] || "" }))
      .filter((pack) => pack.name && Number(pack.minutes || 0) > 0);
    const workshopMaps = [0, 1, 2, 3, 4]
      .map((index) => ({ name: entry[`workshopMapName${index}`], category: entry[`workshopMapCategory${index}`] || "Other", minutes: entry[`workshopMapMinutes${index}`], link: entry[`workshopMapLink${index}`] || "" }))
      .filter((map) => map.name && Number(map.minutes || 0) > 0);
    const existing = store.trainingRoutines.find((item) => item.id === form.dataset.id);
    if (existing && !canManageTrainingRoutine(activeUser, existing)) return;
    const routine = {
      id: form.dataset.id || uid(),
      title: entry.title || "Untitled routine",
      creatorId: existing?.creatorId || activeUser.id,
      creatorName: existing?.creatorName || activeUser.name,
      visibility: existing?.visibility || "private",
      customPackMinutes: entry.customPackMinutes,
      workshopMapMinutes: entry.workshopMapMinutes,
      freeplayMinutes: entry.freeplayMinutes,
      customPacks,
      workshopMaps,
      favorites: existing?.favorites || [],
    };
    const index = store.trainingRoutines.findIndex((item) => item.id === routine.id);
    if (index >= 0) store.trainingRoutines[index] = routine;
    else store.trainingRoutines.push(routine);
    await persistStore(store);
    return;
  }

  if (key === "training-presets") {
    const existing = store.trainingPresets.find((item) => item.id === form.dataset.id);
    const preset = {
      id: form.dataset.id || uid(),
      type: entry.type === "workshopMap" ? "workshopMap" : "trainingPack",
      name: entry.name || "Untitled preset",
      code: entry.code || "",
      link: entry.link || "",
      category: entry.category || "Other",
      description: entry.description || "",
      createdBy: existing?.createdBy || activeUser.id,
      createdAt: existing?.createdAt || new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const index = store.trainingPresets.findIndex((item) => item.id === preset.id);
    if (index >= 0) store.trainingPresets[index] = preset;
    else store.trainingPresets.push(preset);
    await persistStore(store);
    return;
  }

  if (key === "week-items") {
    const owner = { playerId: form.dataset.playerId || "", ownerUserId: form.dataset.ownerUserId || activeUser.id };
    let week = store.weeks.find((item) => weekMatchesOwner(item, owner));
    if (!week) {
      week = { id: uid(), ...owner, title: entry.title || "My week", showInCalendar: false, items: [] };
      store.weeks.push(week);
    }
    if (!canManageWeek(activeUser, week, owner)) return;
    week.title = entry.title || week.title || "My week";
    week.ownerUserId = week.ownerUserId || owner.ownerUserId;
    week.playerId = week.playerId || owner.playerId;
    week.items.push({ id: uid(), day: entry.day, startTime: entry.startTime, endTime: entry.endTime, mode: entry.mode, notes: entry.notes, showInCalendar: entry.showInCalendar === "true" });
    await persistStore(store);
    return;
  }

  if (key === "results") {
    const source = completedResultSources(store).find((item) => resultSourceKey(item) === entry.resultSource);
    if (!source) return;
    const aggregateResult = isAggregateResultSource(source);
    entry.type = aggregateResult ? "Tournament" : "Match";
    entry.title = source.title;
    entry.dateTime = source.dateTime;
    entry.startsAtUtc = source.startsAtUtc || localInputToUtc(source.dateTime);
    entry.teamId = source.teamId;
    entry.source = source.source;
    entry.sourceId = source.sourceId;
    entry.tournamentId = aggregateResult && source.source === "tournaments" ? source.sourceId : "";
    if (aggregateResult) {
      entry.tournamentMatches = normalizeTournamentMatches(collectTournamentMatches("resultMatch"));
      entry.opponent = tournamentMatchSummary(entry.tournamentMatches);
      entry.averageMmr = "";
    } else {
      entry.tournamentMatches = [];
      entry.tournamentId = "";
    }
    entry.averageMmr = entry.averageMmr || "";
    const existingReplays = normalizeReplayLinks(existingEntry?.replayLinks || []).filter((link) => link.type === "file");
    const uploadedReplays = await replayFilesFromForm(form);
    entry.replayLinks = [...normalizeReplayLinks(entry.replayLinksText || ""), ...existingReplays, ...uploadedReplays];
    delete entry.replayLinksText;
    delete entry.replayFiles;
    resultDraft = null;
  }

  if (key === "tryouts" || key === "players") {
    const existing = existingEntry;
    if (existing?.stats) entry.stats = existing.stats;
    if (!canManagePlayerStats(activeUser) && existing?.opinion && key === "tryouts") entry.opinion = existing.opinion;
    if (!canManagePlayerStats(activeUser) && existing?.notes && key === "players") entry.notes = existing.notes;
  }

  if (key === "availability") {
    const player = store.players.find((item) => item.id === entry.playerId);
    entry.playerName = player ? (player.rlName || player.name) : entry.playerName;
    entry.teamId = player?.teamId || entry.teamId || "main";
  }

  if (key === "events") {
    const staffCalendar = isAdmin(activeUser) || isCoach(activeUser);
    const ownPlayer = matchingPlayerForUser(store, activeUser);
    entry.createdBy = existingEntry?.createdBy || activeUser.id;
    entry.createdByName = existingEntry?.createdByName || activeUser.name || activeUser.username || "";
    if (!staffCalendar) {
      entry.targetType = "player";
      entry.playerId = ownPlayer?.id || "";
      entry.teamId = ownPlayer?.teamId || activeUser.teamId || "";
    } else if (entry.targetType === "both") {
      entry.teamId = "both";
      entry.playerId = "";
    } else if (entry.targetType === "player") {
      const targetPlayer = store.players.find((player) => player.id === entry.playerId);
      if (!targetPlayer) return;
      entry.teamId = targetPlayer.teamId || "";
    } else {
      entry.targetType = "team";
      entry.playerId = "";
      entry.teamId = validTeamId(entry.teamId, "main");
    }
  }

  if (["events", "scrims", "tournaments", "tryouts"].includes(key)) {
    entry.startsAtUtc = localInputToUtc(entry.dateTime);
    entry.timezone = viewerTimeZone();
    entry.createdTimezone = entry.createdTimezone || viewerTimeZone();
    if (entry.type) entry.type = normalizeEventType(entry.type);
  }

  entry.id = form.dataset.id || uid();
  const index = store[key].findIndex((item) => item.id === entry.id);
  if (index >= 0) store[key][index] = entry;
  else store[key].push(entry);
  await persistStore(store);
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-filter]")) {
    const key = event.target.dataset.filter;
    const kind = event.target.dataset.filterKind;
    filters[key] = { ...(filters[key] || {}), [kind]: event.target.value };
    if (kind === "query") {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(render, 250);
      return;
    }
    render();
  }

  if (event.target.matches('input[type="range"]')) {
    event.target.nextElementSibling.textContent = event.target.value;
  }

  if (event.target.matches("[data-opponent-input]")) {
    const target = document.querySelector("[data-opponent-title]");
    if (target) target.textContent = event.target.value || "TBA";
  }
});

document.addEventListener("change", async (event) => {
  const store = loadStore();
  const activeUser = getUser(store);

  if (event.target.matches('form[data-entity="confirmation-send"] select[name="teamId"]')) {
    const form = event.target.closest("form");
    const select = form?.querySelector("[data-confirmation-player-select]");
    if (select) select.innerHTML = `<option value="">Select player</option>${confirmationPlayerOptions(store, event.target.value)}`;
  }

  if (event.target.matches('form[data-entity="events"] select[name="teamId"]')) {
    const form = event.target.closest("form");
    const select = form?.querySelector("[data-calendar-player-select]");
    if (select) select.innerHTML = `<option value="">Select player</option>${confirmationPlayerOptions(store, event.target.value)}`;
  }

  if (event.target.matches("[data-filter]")) {
    const key = event.target.dataset.filter;
    const kind = event.target.dataset.filterKind;
    filters[key] = { ...(filters[key] || {}), [kind]: event.target.value };
    render();
  }

  if (event.target.matches('form[data-entity="results"] select[name="resultSource"]')) {
    const source = findCalendarItem(store, event.target.value);
    if (source) {
      const aggregateResult = isAggregateResultSource(source);
      resultDraft = {
        ...(resultDraft || {}),
        id: event.target.closest("form")?.dataset.id || resultDraft?.id || "",
        resultSource: resultSourceKey(source),
        type: aggregateResult ? "Tournament" : "Match",
        title: source.title,
        dateTime: source.dateTime,
        startsAtUtc: source.startsAtUtc,
        teamId: source.teamId,
        opponent: source.lineupOpponent || source.opponent || "",
        tournamentMatches: aggregateResult ? normalizeTournamentMatches(source.tournamentMatches || []) : [],
      };
      render();
      return;
    }
  }

  if (event.target.matches("[data-availability-slot]")) {
    const writableStore = await loadWritableStore();
    const writableUser = getUser(writableStore);
    const player = writableStore.players.find((item) => item.id === event.target.dataset.playerId);
    if (!player || !canToggleAvailabilitySlot(writableUser, player)) {
      render();
      return;
    }
    const day = normalizeAvailabilityDay(event.target.dataset.day);
    const date = event.target.dataset.date || "";
    const startTime = normalizeAvailabilityTime(event.target.dataset.startTime);
    const teamId = player.teamId || event.target.dataset.teamId || "main";
    const matchesSlot = (item) => availabilitySlotMatches(item, player, day, startTime, date);

    if (event.target.checked) {
      if (!(writableStore.availability || []).some(matchesSlot)) {
        writableStore.availability.push({
          id: uid(),
          playerId: player.id,
          playerName: availabilityPlayerLabel(player),
          teamId,
          day,
          date,
          startTime,
          endTime: availabilitySlotEnd(startTime),
          status: "Available",
          notes: "",
        });
      }
    } else {
      writableStore.availability = (writableStore.availability || []).filter((item) => !matchesSlot(item));
    }
    await persistStore(writableStore);
    return;
  }

  if (event.target.matches("[data-user-role]")) {
    if (!isAdmin(activeUser)) return;
    const user = store.users.find((item) => item.id === event.target.dataset.userRole);
    if (!user || isBuiltInUser(user)) return;
    user.role = event.target.value;
    user.canEdit = user.role === "Admin";
    user.managerAccess = user.role === "Manager";
    user.captainAccess = user.role === "Captain";
    if (user.role === "Coach") {
      user.coachAccess = true;
      user.playerStatsAccess = true;
    }
    await persistStore(store);
  }

  if (event.target.matches("[data-user-coach-access]")) {
    if (!isAdmin(activeUser)) return;
    const user = store.users.find((item) => item.id === event.target.dataset.userCoachAccess);
    if (!user || isBuiltInUser(user)) return;
    user.coachAccess = event.target.checked;
    await persistStore(store);
  }

  if (event.target.matches("[data-user-stats-access]")) {
    if (!isAdmin(activeUser)) return;
    const user = store.users.find((item) => item.id === event.target.dataset.userStatsAccess);
    if (!user || isBuiltInUser(user)) return;
    user.playerStatsAccess = event.target.checked;
    await persistStore(store);
  }

  if (event.target.matches("[data-player-stat-select]")) {
    if (!canManagePlayerStats(activeUser)) return;
    const player = store.players.find((item) => item.id === event.target.value);
    const formPanel = event.target.closest(".panel");
    if (player && formPanel) formPanel.outerHTML = playerStatsForm(store.players, player);
  }
});

initRemoteStore();
