import fs from 'fs';
import path from 'path';

const base = './research/fpl-historical-data/data';

const seasons = fs.readdirSync(base)
  .filter(x => /^\d{4}-\d{2}$/.test(x))
  .sort();

console.log('HISTORICAL GW DATASET AUDIT');
console.log('============================');
console.log(`Seasons found: ${seasons.length}`);
console.log(seasons.join(', '));

const required = [
  'element',
  'round',
  'total_points',
  'minutes',
  'starts',
  'value',
  'expected_goals',
  'expected_assists',
  'expected_goal_involvements',
  'expected_goals_conceded',
  'opponent_team',
  'was_home',
  'kickoff_time'
];

for (const season of seasons) {
  const file = path.join(base, season, 'gws', 'gw1.csv');

  if (!fs.existsSync(file)) {
    console.log(`${season}: gw1.csv MISSING`);
    continue;
  }

  const firstLine = fs.readFileSync(file, 'utf8').split(/\r?\n/)[0];
  const headers = firstLine.split(',').map(x => x.trim());

  const missing = required.filter(x => !headers.includes(x));

  console.log(
    `${season}: ${
      missing.length === 0
        ? 'OK'
        : 'MISSING -> ' + missing.join(', ')
    }`
  );
}

console.log('\n============================');
console.log('AUDIT COMPLETE');