// Coaching notes live outside the shared manager document so Firestore rules can
// protect team notes and individual player notes independently.
export function coachingTeamPath(teamId) {
  return ['coachingTeams', teamId, 'notes'];
}

export function coachingPlayerPath(teamId, playerId) {
  return ['coachingPlayers', teamId, 'players', playerId, 'notes'];
}

export async function loadCoachingNotes(fire, db, teamId, playerIds = []) {
  const targets = [{kind: 'team', playerId: '', path: coachingTeamPath(teamId)},
    ...playerIds.map(playerId => ({kind: 'player', playerId, path: coachingPlayerPath(teamId, playerId)}))];
  const snapshots = await Promise.all(targets.map(target =>
    fire.getDocs(fire.query(fire.collection(db, ...target.path), fire.orderBy('createdAt', 'desc')))
  ));
  return snapshots.flatMap((snapshot, index) => snapshot.docs.map(doc => ({
    id: doc.id,
    kind: targets[index].kind,
    playerId: targets[index].playerId,
    ...doc.data()
  }))).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

export async function addCoachingNote(fire, db, teamId, playerId, authorId, text) {
  const path = playerId ? coachingPlayerPath(teamId, playerId) : coachingTeamPath(teamId);
  return fire.addDoc(fire.collection(db, ...path), {
    authorId,
    text,
    createdAt: fire.serverTimestamp()
  });
}
