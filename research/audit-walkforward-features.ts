import fs from 'fs';

const file = './research/walkforward-observations.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log('WALK-FORWARD FEATURE AUDIT');
console.log('==========================');
console.log(`Total observations: ${data.length}`);

const fields = [
  'season',
  'gameweek',
  'element',
  'name',
  'position',
  'team',
  'opponent_team',
  'was_home',
  'kickoff_time',
  'value',
  'minutes',
  'starts',
  'total_points',
  'goals_scored',
  'assists',
  'clean_sheets',
  'goals_conceded',
  'bonus',
  'bps',
  'influence',
  'creativity',
  'threat',
  'ict_index',
  'expected_goals',
  'expected_assists',
  'expected_goal_involvements',
  'expected_goals_conceded',
  'selected',
  'transfers_in',
  'transfers_out'
];

console.log('\n--- FIELD COMPLETENESS ---');

for (const field of fields) {
  const present = data.filter(
    (x: any) =>
      x[field] !== null &&
      x[field] !== undefined &&
      x[field] !== ''
  ).length;

  const pct = (present / data.length) * 100;

  console.log(
    `${field.padEnd(30)} ${present}/${data.length} (${pct.toFixed(2)}%)`
  );
}

console.log('\n--- SEASON × FIELD COMPLETENESS ---');

const seasons = [...new Set(data.map((x: any) => x.season))];

for (const season of seasons) {
  const rows = data.filter((x: any) => x.season === season);

  const starts = rows.filter((x: any) => x.starts !== null && x.starts !== undefined).length;
  const xg = rows.filter((x: any) => x.expected_goals !== null && x.expected_goals !== undefined).length;
  const xa = rows.filter((x: any) => x.expected_assists !== null && x.expected_assists !== undefined).length;

  console.log(
    `${season}: rows=${rows.length}, starts=${starts}, xG=${xg}, xA=${xa}`
  );
}

console.log('\n--- UNIQUE PLAYERS ---');

const players = new Set(data.map((x: any) => x.element));

console.log(`Unique player IDs: ${players.size}`);

console.log('\n--- DUPLICATE PLAYER-GW CHECK ---');

const keys = new Map<string, number>();

for (const row of data) {
  const key = `${row.season}|${row.gameweek}|${row.element}`;
  keys.set(key, (keys.get(key) || 0) + 1);
}

const duplicates = [...keys.entries()].filter(([, count]) => count > 1);

console.log(`Unique player-season-GW keys: ${keys.size}`);
console.log(`Duplicate keys: ${duplicates.length}`);

if (duplicates.length > 0) {
  console.log('First 10 duplicates:');
  console.log(duplicates.slice(0, 10));
}

console.log('\n--- POINTS DISTRIBUTION ---');

let min = Infinity;
let max = -Infinity;
let sum = 0;

for (const row of data) {
  const pts = Number(row.total_points);

  if (!Number.isFinite(pts)) continue;

  if (pts < min) min = pts;
  if (pts > max) max = pts;
  sum += pts;
}

console.log(`Minimum: ${min}`);
console.log(`Maximum: ${max}`);
console.log(`Mean: ${(sum / data.length).toFixed(3)}`);

console.log('\n--- SAMPLE PRE-GW RECORD ---');
console.log(JSON.stringify(data.find((x: any) => x.season === '2025-26' && x.gameweek === 1), null, 2));

console.log('\n==========================');
console.log('FEATURE AUDIT COMPLETE');
