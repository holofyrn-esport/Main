import assert from 'node:assert/strict';
import test from 'node:test';
import {rosterRole, sortedRoster} from './public-roster.mjs';
import {publicHoloFyrnData} from './holofyrnmanager/public-data.mjs';

test('orders actual roster members by player, sub, coach, manager', () => {
  const members = [
    {name:'Manager',role:'Manager'},
    {name:'Coach',role:'Coach'},
    {name:'Sub',role:'Sub'},
    {name:'Player 1',role:'Captain'},
    {name:'Player 2',role:'Starter'},
    {name:'Reserve',role:'Reserve'},
  ];
  assert.deepEqual(sortedRoster(members).map(member => member.name),
    ['Player 1','Player 2','Sub','Reserve','Coach','Manager']);
  assert.equal(rosterRole('Substitute'), 'sub');
  assert.equal(rosterRole('Player'), 'player');
});

test('does not invent a manager for teams without a manager roster record', () => {
  const publicData = publicHoloFyrnData({
    players:[{id:'p1',name:'Player',teamId:'main',position:'Player'}],
    users:[{id:'u1',name:'Staff account',role:'Manager',teamId:'main'}],
  });
  assert.deepEqual(publicData.players.map(player => player.name), ['Player']);
});
