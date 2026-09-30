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

 test('custom positions override roles and remain independent for each team', () => {
  const players=[
    {name:'A',role:'Player',rosterOrder:{main:1,academy:0}},
    {name:'B',role:'Sub',rosterOrder:{main:0,academy:1}},
    {name:'Coach',role:'Coach',rosterOrder:{main:2}},
    {name:'New',role:'Player'},
  ];
  assert.deepEqual(sortedRoster(players,'main').map(p=>p.name),['B','A','New','Coach']);
  assert.deepEqual(sortedRoster(players.slice(0,2),'academy').map(p=>p.name),['A','B']);
  assert.equal(players[0].name,'A');
 });

 test('roster order survives database save, reload and public publication', async () => {
  const {fromDatabase,changesBetween,toDatabase}=await import('./holofyrnmanager/manager-data.mjs');
  const profiles=[{id:'admin',role:'Admin',approved:true}];
  const data={players:[{id:'a',name:'A',teamId:'main',teamIds:['main','academy'],rosterOrder:{academy:4}},{id:'b',name:'B',teamId:'main'}]};
  const before=fromDatabase(data,profiles,'admin');
  const after=structuredClone(before);
  after.players[0].rosterOrder.main=1;
  after.players[1].rosterOrder.main=0;
  const changes=changesBetween(before,after);
  const {patch}=toDatabase(data,profiles,'admin',changes);
  const saved={...data,...patch};
  assert.equal(fromDatabase(saved,profiles,'admin').players[0].rosterOrder.academy,4);
  const published=publicHoloFyrnData(saved);
  assert.deepEqual(sortedRoster(published.players,'main').map(p=>p.name),['B','A']);
  assert.throws(()=>toDatabase(data,[{id:'admin',role:'Player'}],'admin',changes),/Administrator access required/);
  const concurrent=structuredClone(data);concurrent.players[0].rosterOrder.main=3;
  assert.throws(()=>toDatabase(concurrent,profiles,'admin',changes),/changed by another user/);
 });

test('team roles survive saving and publication without changing other memberships', async () => {
  const {fromDatabase, changesBetween, toDatabase, teamRole}=await import('./holofyrnmanager/manager-data.mjs');
  const profiles=[{id:'admin',role:'Admin',approved:true},{id:'user',role:'Player',playerId:'p'}];
  const data={players:[{id:'p',name:'Shared player',userId:'user',teamId:'main',teamIds:['main','academy'],position:'Starter'}]};
  const before=fromDatabase(data,profiles,'admin');
  assert.equal(teamRole(before.players[0],'academy'),'Starter');
  const after=structuredClone(before);
  after.players[0].teamRoles={main:'Starter',academy:'Coach'};
  const {patch,userWrites}=toDatabase(data,profiles,'admin',changesBetween(before,after));
  const saved={...data,...patch};
  const reloaded=fromDatabase(saved,profiles,'admin');
  assert.equal(teamRole(reloaded.players[0],'main'),'Starter');
  assert.equal(teamRole(reloaded.players[0],'academy'),'Coach');
  assert.deepEqual(userWrites.find(u=>u.id==='user').teamIds,['main','academy']);
  assert.equal(reloaded.players.length,1);
  const published=publicHoloFyrnData(saved).players[0];
  assert.equal(teamRole(published,'academy'),'Coach');
  const other={name:'Other',role:'Sub'};
  assert.deepEqual(sortedRoster([published,other],'main').map(p=>p.name),['Shared player','Other']);
  assert.deepEqual(sortedRoster([published,other],'academy').map(p=>p.name),['Other','Shared player']);
  const next=structuredClone(reloaded);
  next.players[0].teamRoles.academy='Reserve';
  const second=toDatabase(saved,profiles,'admin',changesBetween(reloaded,next));
  assert.equal(second.patch.players[0].teamRoles.main,'Starter');
  assert.equal(second.patch.players[0].teamRoles.academy,'Reserve');
});
