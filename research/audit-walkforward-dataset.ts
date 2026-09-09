import fs from 'fs';

const file = './research/walkforward-observations.json';

const data = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log('WALK-FORWARD DATASET AUDIT');
console.log('==========================');

console.log(`Total observations: ${data.length}`);

const seasons = [...new Set(data.map((x: any) => x.season))];

console.log(`Seasons: ${seasons.length}`);
console.log(seasons.join(', '));

console.log('\n--- OBSERVATIONS BY SEASON ---');

for (const season of seasons) {
  const rows = data.filter((x: any) => x.season === season);
  const gameweeks = new Set(rows.map((x: any) => x.gameweek));

  console.log(
    `${season}: ${rows.length} observations, ${gameweeks.size} gameweeks`
  );
}

console.log('\n--- BASIC DATA QUALITY ---');

const fields = [
  'element',
  'name',
  'gameweek',
  'total_points',
  'minutes',
  'value',
  'opponent_team',
  'was_home',
  'kickoff_time'
];

for (const field of fields) {
  const missing = data.filter(
    (x: any) =>
      x[field] === null ||
      x[field] === undefined ||
      x[field] === ''
  ).length;

  console.log(
    `${field}: ${missing} missing (${((missing / data.length) * 100).toFixed(2)}%)`
  );
}

console.log('\n--- SAMPLE RECORD ---');
console.log(JSON.stringify(data[0], null, 2));

console.log('\n--- POINTS RANGE ---');

const points = data
  .map((x: any) => x.total_points)
  .filter((x: any) => typeof x === 'number');

console.log(`Minimum: ${Math.min(...points)}`);
console.log(`Maximum: ${Math.max(...points)}`);

console.log('\n==========================');
console.log('AUDIT COMPLETE');
