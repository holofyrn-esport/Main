const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'holofyrnmanager', 'connected.js'), 'utf8');
const start = source.indexOf('async function requestAccountDeletion(');
const end = source.indexOf('\nfunction deleteAccountModal(', start);
assert.ok(start >= 0 && end > start, 'manager deletion function exists');
const code = source.slice(start, end);

function setup(authUid = 'target') {
  const target = {authUid, approved: true};
  const writes = [];
  const fire = {
    doc: (_db, collection, id) => `${collection}/${id}`,
    serverTimestamp: () => 'server-time',
    runTransaction: async (_db, callback) => callback({
      get: async () => ({exists: () => true, data: () => target}),
      update: (ref, patch) => writes.push({type: 'update', ref, patch}),
      set: (ref, data) => writes.push({type: 'set', ref, data})
    })
  };
  const context = {services: {fire, db: {}}, authenticatedUser: {uid: 'admin'}};
  const request = vm.runInNewContext(`${code}\nrequestAccountDeletion`, context);
  return {writes, request};
}

test('queues deletion and revokes access in the same transaction', async () => {
  const state = setup();
  await state.request('target');
  assert.equal(state.writes.length, 2);
  assert.equal(state.writes[0].ref, 'users/target');
  assert.deepEqual({...state.writes[0].patch}, {approved: false, deletionPending: true});
  assert.equal(state.writes[1].ref, 'accountDeletionRequests/target');
  assert.equal(state.writes[1].data.requestedBy, 'admin');
  assert.equal(state.writes[1].data.status, 'pending');
});

test('rejects a legacy profile with a different Authentication UID', async () => {
  const state = setup('another-uid');
  await assert.rejects(state.request('target'), /Firebase UID corrected/);
  assert.equal(state.writes.length, 0);
});
