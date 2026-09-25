const test = require('node:test');
const assert = require('node:assert/strict');
const {processRequest, run} = require('./worker.cjs');

function setup({actorRole = 'Admin', authError = null} = {}) {
  const docs = new Map([
    ['users/admin', {role: actorRole, approved: true}],
    ['users/target', {authUid: 'target', approved: false, deletionPending: true}],
    ['accountDeletionRequests/target', {userId: 'target', requestedBy: 'admin', status: 'pending'}],
    ['noctiqManager/main', {
      users: [{id: 'admin'}, {id: 'target'}],
      players: [{id: 'player', authUid: 'target', userId: 'target', accountId: 'target', wins: 3}],
      results: [{id: 'result'}],
      managerV8: {notifications: [{userId: 'target'}, {userId: 'admin'}]}
    }]
  ]);
  const ref = path => ({
    id: path.split('/').at(-1),
    path,
    get: async () => snapshot(path),
    update: async patch => update(path, patch),
    delete: async () => docs.delete(path)
  });
  const snapshot = path => ({exists: docs.has(path), data: () => structuredClone(docs.get(path))});
  const update = (path, patch) => {
    const data = structuredClone(docs.get(path));
    for (const [key, value] of Object.entries(patch)) {
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        data[parent] = {...data[parent], [child]: value};
      } else data[key] = value;
    }
    docs.set(path, data);
  };
  const db = {
    doc: ref,
    runTransaction: async callback => {
      const writes = [];
      const result = await callback({
        get: async target => target.get(),
        update: (target, patch) => writes.push(() => update(target.path, patch)),
        delete: target => writes.push(() => docs.delete(target.path))
      });
      writes.forEach(write => write());
      return result;
    },
    collection: () => ({where: () => ({limit: () => ({get: async () => ({docs: docs.has('accountDeletionRequests/target') && docs.get('accountDeletionRequests/target').status === 'pending' ? [{id: 'target', ref: ref('accountDeletionRequests/target')}] : []})})})})
  };
  const calls = [];
  const auth = {deleteUser: async id => {calls.push(id); if (authError) throw {code: authError};}};
  return {docs, db, auth, calls, requestRef: db.doc('accountDeletionRequests/target')};
}

test('deletes the login, profile, and links while preserving player history', async () => {
  const state = setup();
  assert.equal(await processRequest(state.db, state.auth, state.requestRef), 'deleted');
  assert.deepEqual(state.calls, ['target']);
  assert.equal(state.docs.has('users/target'), false);
  assert.equal(state.docs.has('accountDeletionRequests/target'), false);
  const data = state.docs.get('noctiqManager/main');
  assert.deepEqual(data.users, [{id: 'admin'}]);
  assert.deepEqual(data.players, [{id: 'player', authUid: '', userId: '', accountId: '', wins: 3}]);
  assert.deepEqual(data.results, [{id: 'result'}]);
  assert.deepEqual(data.managerV8.notifications, [{userId: 'admin'}]);
});

test('rejects a request from an account that is no longer an administrator', async () => {
  const state = setup({actorRole: 'Player'});
  assert.equal(await processRequest(state.db, state.auth, state.requestRef), 'rejected');
  assert.deepEqual(state.calls, []);
  assert.equal(state.docs.get('accountDeletionRequests/target').status, 'rejected');
  assert.equal(state.docs.has('users/target'), true);
});

test('keeps a failed deletion queued for the next scheduled run', async () => {
  const state = setup({authError: 'auth/internal-error'});
  await assert.rejects(processRequest(state.db, state.auth, state.requestRef));
  assert.equal(state.docs.get('accountDeletionRequests/target').status, 'pending');
  assert.equal(state.docs.get('users/target').approved, false);
});

test('finishes Firestore cleanup after the Auth login has already gone', async () => {
  const state = setup({authError: 'auth/user-not-found'});
  assert.equal(await processRequest(state.db, state.auth, state.requestRef), 'deleted');
  assert.equal(state.docs.has('users/target'), false);
});

test('scheduled run processes only pending requests', async () => {
  const state = setup();
  await run(state.db, state.auth, {log() {}, error() {}});
  assert.equal(state.docs.has('accountDeletionRequests/target'), false);
});
