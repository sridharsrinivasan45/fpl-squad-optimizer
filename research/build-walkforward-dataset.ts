import fs from 'fs';
import path from 'path';

const BASE = './research/fpl-historical-data/data';
const OUTPUT = './research/walkforward-observations.json';

const seasons = fs.readdirSync(BASE)
  .filter(x => /^\d{4}-\d{2}$/.test(x))
  .sort();

const historicalSeasons = seasons.filter(s => s !== '2026-27');

const observations: any[] = [];

console.log('BUILDING WALK-FORWARD DATASET');
console.log('==============================');
console.log(`Historical seasons: ${historicalSeasons.length}`);
console.log(historicalSeasons.join(', '));

for (const season of historicalSeasons) {
  const gwDir = path.join(BASE, season, 'gws');

  for (let gw = 1; gw <= 38; gw++) {
    const file = path.join(gwDir, `gw${gw}.csv`);

    if (!fs.existsSync(file)) {
      console.log(`${season} GW${gw}: missing`);
      continue;
    }

    const lines = fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean);

    const headers = lines[0].split(',');

    const index: Record<string, number> = {};

    headers.forEach((h, i) => {
      index[h.trim()] = i;
    });

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');

      const get = (key: string) => {
        const idx = index[key];
        return idx === undefined ? null : row[idx];
      };

      const numeric = (key: string) => {
        const value = get(key);
        if (value === null || value === '') return null;

        const n = Number(value);
        return Number.isNaN(n) ? null : n;
      };

      const boolean = (key: string) => {
        const value = get(key);
        if (value === null) return null;
        return value === 'True' || value === 'true';
      };

      observations.push({
        season,
        gameweek: gw,

        element: numeric('element'),
        name: get('name'),
        position: get('position'),
        team: get('team'),

        // Information available before/around the GW
        opponent_team: numeric('opponent_team'),
        was_home: boolean('was_home'),
        kickoff_time: get('kickoff_time'),
        value: numeric('value'),

        // Historical performance
        minutes: numeric('minutes'),
        starts: numeric('starts'),

        total_points: numeric('total_points'),
        goals_scored: numeric('goals_scored'),
        assists: numeric('assists'),
        clean_sheets: numeric('clean_sheets'),
        goals_conceded: numeric('goals_conceded'),

        bonus: numeric('bonus'),
        bps: numeric('bps'),

        influence: numeric('influence'),
        creativity: numeric('creativity'),
        threat: numeric('threat'),
        ict_index: numeric('ict_index'),

        // Underlying performance — available only in newer seasons
        expected_goals: numeric('expected_goals'),
        expected_assists: numeric('expected_assists'),
        expected_goal_involvements: numeric('expected_goal_involvements'),
        expected_goals_conceded: numeric('expected_goals_conceded'),

        selected: numeric('selected'),
        transfers_in: numeric('transfers_in'),
        transfers_out: numeric('transfers_out')
      });
    }

    console.log(`${season} GW${gw}: processed`);
  }
}

fs.writeFileSync(
  OUTPUT,
  JSON.stringify(observations, null, 2)
);

console.log('\n==============================');
console.log(`Total observations: ${observations.length}`);
console.log(`Saved: ${OUTPUT}`);
console.log('BUILD COMPLETE');