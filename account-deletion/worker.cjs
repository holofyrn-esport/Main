const PROJECT_ID = 'noctiq-d1020';

function validateRequest(id, request, actor, target) {
  if (!id || id.length > 128 || id.includes('/')) return 'Invalid account ID';
  if (request?.userId !== id || !request.requestedBy || request.requestedBy === id || request.status !== 'pending') return 'Invalid deletion request';
  if (!actor || actor.approved === false || String(actor.role).toLowerCase() !== 'admin') return 'Requesting administrator is no longer enabled';
  if (!target || target.approved !== false || target.deletionPending !== true || (target.authUid && target.authUid !== id)) return 'Target is not marked for deletion';
  return null;
}

async function processRequest(db, auth, requestRef) {
  const id = requestRef.id;
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists || requestSnap.data().status !== 'pending') return 'skipped';
  const request = requestSnap.data();
  const actorRef = db.doc(`users/${request.requestedBy || '__invalid__'}`);
  const targetRef = db.doc(`users/${id}`);
  const [actorSnap, targetSnap] = await Promise.all([actorRef.get(), targetRef.get()]);
  if (!targetSnap.exists) {
    await requestRef.delete();
    return 'stale';
  }
  const invalid = validateRequest(id, request, actorSnap.exists ? actorSnap.data() : null, targetSnap.data());
  if (invalid) {
    await requestRef.update({status: 'rejected', rejectionReason: invalid});
    return 'rejected';
  }

  try {
    await auth.deleteUser(id);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }

  const mainRef = db.doc('noctiqManager/main');
  await db.runTransaction(async transaction => {
    const [main, target, queued] = await Promise.all([
      transaction.get(mainRef), transaction.get(targetRef), transaction.get(requestRef)
    ]);
    if (!queued.exists || queued.data().status !== 'pending') return;
    if (main.exists) {
      const data = main.data();
      const patch = {};
      if (Array.isArray(data.users)) patch.users = data.users.filter(user => user.id !== id && user.authUid !== id);
      if (Array.isArray(data.players)) patch.players = data.players.map(player => {
        const copy = {...player};
        for (const key of ['authUid', 'userId', 'accountId']) if (copy[key] === id) copy[key] = '';
        return copy;
      });
      if (Array.isArray(data.managerV8?.notifications)) {
        patch['managerV8.notifications'] = data.managerV8.notifications.filter(note => note.userId !== id);
      }
      if (Object.keys(patch).length) transaction.update(mainRef, patch);
    }
    if (target.exists) transaction.delete(targetRef);
    transaction.delete(requestRef);
  });
  return 'deleted';
}

async function run(db, auth, log = console) {
  const pending = await db.collection('accountDeletionRequests').where('status', '==', 'pending').limit(100).get();
  let failures = 0;
  for (const request of pending.docs) {
    try {
      log.log(`Account deletion ${request.id}: ${await processRequest(db, auth, request.ref)}`);
    } catch (error) {
      failures++;
      log.error(`Account deletion ${request.id} failed: ${error.code || error.message}`);
    }
  }
  if (failures) throw new Error(`${failures} account deletion request(s) failed; the next run will retry.`);
}

if (require.main === module) {
  (async () => {
    const {initializeApp, cert} = require('firebase-admin/app');
    const {getAuth} = require('firebase-admin/auth');
    const {getFirestore} = require('firebase-admin/firestore');
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing. Configure the GitHub Actions secret.');
    const key = JSON.parse(raw);
    if (key.project_id !== PROJECT_ID) throw new Error('The service account belongs to another Firebase project.');
    const app = initializeApp({credential: cert(key), projectId: PROJECT_ID});
    await run(getFirestore(app), getAuth(app));
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = {validateRequest, processRequest, run};
