import fs from 'fs';

const boot = JSON.parse(fs.readFileSync('temp-boot.json', 'utf8'));
const fixtures = JSON.parse(fs.readFileSync('temp-fixtures.json', 'utf8'));

const teamMap = {};
boot.teams.forEach((t: any) => {
  teamMap[t.id] = { name: t.name, short: t.short_name };
});

function getFixtureForTeam(teamId: number, event: number) {
  const f = fixtures.find((fix: any) => fix.event === event && (fix.team_h === teamId || fix.team_a === teamId));
  if (!f) return 'No Fixture';
  const isHome = f.team_h === teamId;
  const oppId = isHome ? f.team_a : f.team_h;
  const diff = isHome ? f.team_h_difficulty : f.team_a_difficulty;
  const score = f.team_h_score !== null ? `${f.team_h_score}-${f.team_a_score}` : 'Unplayed';
  const resultStr = isHome 
    ? `${teamMap[teamId].short} (H) vs ${teamMap[oppId].short} [FDR ${diff}] (Score: ${score})`
    : `${teamMap[teamId].short} (A) vs ${teamMap[oppId].short} [FDR ${diff}] (Score: ${score})`;
  return resultStr;
}

console.log('====================================================');
console.log('AUDIT: 2026/27 PRE-SEASON BASELINE SQUAD FIXTURES');
console.log('====================================================');

const baselineSquad = [
  { name: 'Raya', team_id: 1, pos: 'GK' },
  { name: 'Gabriel', team_id: 1, pos: 'DEF' },
  { name: 'Guéhi', team_id: 15, pos: 'DEF' },
  { name: 'Tarkowski', team_id: 9, pos: 'DEF' },
  { name: 'Van Hecke', team_id: 19, pos: 'DEF' },
  { name: 'B. Fernandes', team_id: 16, pos: 'MID' },
  { name: 'Semenyo', team_id: 15, pos: 'MID' },
  { name: 'Gibbs-White', team_id: 18, pos: 'MID' },
  { name: 'Rice', team_id: 1, pos: 'MID' },
  { name: 'Anderson', team_id: 15, pos: 'MID' },
  { name: 'Thiago', team_id: 4, pos: 'FWD' }
];

baselineSquad.forEach(p => {
  console.log(`\nPlayer: ${p.name} (${teamMap[p.team_id].short})`);
  console.log(`  - GW1: ${getFixtureForTeam(p.team_id, 1)}`);
  console.log(`  - GW2: ${getFixtureForTeam(p.team_id, 2)}`);
  console.log(`  - GW3: ${getFixtureForTeam(p.team_id, 3)}`);
});

console.log('\n====================================================');
console.log('AUDIT: 2026/27 GW3 OPTIMAL SQUAD FIXTURES');
console.log('====================================================');

const gw3Squad = [
  { name: 'Tzolakis', team_id: 11, pos: 'GK' },
  { name: 'Ajayi', team_id: 11, pos: 'DEF' },
  { name: 'De Cuyper', team_id: 5, pos: 'DEF' },
  { name: 'Calafiori', team_id: 1, pos: 'DEF' },
  { name: 'B. Fernandes', team_id: 16, pos: 'MID' },
  { name: 'Gakpo', team_id: 14, pos: 'MID' },
  { name: 'M. Sangaré', team_id: 4, pos: 'MID' },
  { name: 'Lewis-Potter', team_id: 4, pos: 'MID' },
  { name: 'Groß', team_id: 5, pos: 'MID' },
  { name: 'Haaland', team_id: 15, pos: 'FWD' },
  { name: 'Isak', team_id: 14, pos: 'FWD' },
  { name: 'Gvardiol', team_id: 15, pos: 'DEF' },
  { name: 'Egan', team_id: 11, pos: 'DEF' },
  { name: 'Wissa', team_id: 17, pos: 'FWD' },
  { name: 'Trafford', team_id: 13, pos: 'GK' }
];

gw3Squad.forEach(p => {
  console.log(`${p.name} (${teamMap[p.team_id].short}): GW3 -> ${getFixtureForTeam(p.team_id, 3)}`);
});
