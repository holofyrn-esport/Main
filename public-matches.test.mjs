import assert from 'node:assert/strict';
import test from 'node:test';
import {publicHoloFyrnData} from './holofyrnmanager/public-data.mjs';
import {matchesForNextDay, todayInBudapest} from './public-matches.mjs';

test('publishes only HoloFyrn fixtures and scrim match details', () => {
  const publicData = publicHoloFyrnData({
    managerV8: {leagueGames: [
      {date:'2026-10-02', home:'HoloFyrn Esports', away:'Opponent A', played:false},
      {date:'2026-10-02', home:'Opponent B', away:'HoloFyrn Academy', played:false},
      {date:'2026-10-02', home:'Noctiq Esports', away:'Opponent F', played:false},
      {date:'2026-10-02', home:'Opponent C', away:'Opponent D', played:false},
      {date:'2026-10-02', home:'HoloFyrn Esports', away:'Opponent E', played:true},
    ]},
    scrims:[{teamId:'main', opponent:'Scrim rival', dateTime:'2026-10-02T20:30', notes:'Private'}],
  });
  assert.equal(publicData.upcomingMatches.length, 4);
  assert.equal(publicData.upcomingMatches[2].home, 'HoloFyrn Esports');
  assert.deepEqual(publicData.upcomingMatches[3], {
    date:'2026-10-02', time:'20:30', home:'HoloFyrn Esports', away:'Scrim rival',
  });
  assert.equal(JSON.stringify(publicData).includes('Private'), false);
});

test('shows every match today, or every match on the next match day', () => {
  const matches = [
    {date:'2026-09-27', time:'', home:'Past'},
    {date:'2026-09-28', time:'18:00', home:'Today 1'},
    {date:'2026-09-28', time:'20:00', home:'Today 2'},
    {date:'2026-10-02', time:'19:00', home:'Next 1'},
    {date:'2026-10-02', time:'21:00', home:'Next 2'},
    {date:'2026-10-03', time:'', home:'Later'},
  ];
  assert.deepEqual(matchesForNextDay(matches, '2026-09-28').map(match => match.home), ['Today 1','Today 2']);
  assert.deepEqual(matchesForNextDay(matches, '2026-09-29').map(match => match.home), ['Next 1','Next 2']);
  assert.deepEqual(matchesForNextDay(matches, '2026-10-04'), []);
});

test('uses Budapest calendar date around midnight', () => {
  assert.equal(todayInBudapest(new Date('2026-09-28T22:30:00Z')), '2026-09-29');
});
