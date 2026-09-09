import fs from 'fs';

const input = './research/walkforward-observations.json';
const output = './research/backtest-results.json';

const observations = JSON.parse(fs.readFileSync(input, 'utf8'));

console.log('========================================');
console.log('CURRENT MODEL WALK-FORWARD BACKTEST');
console.log('========================================');
console.log(`Observations loaded: ${observations.length}`);

const seasons = [...new Set(
  observations.map((x: any) => x.season)
)].sort();

console.log(`Seasons: ${seasons.join(', ')}`);

const results: any[] = [];

// Group observations by season -> gameweek
const seasonMap = new Map<string, Map<number, any[]>>();

for (const row of observations) {
  if (!seasonMap.has(row.season)) {
    seasonMap.set(row.season, new Map());
  }

  const gwMap = seasonMap.get(row.season)!;

  if (!gwMap.has(row.gameweek)) {
    gwMap.set(row.gameweek, []);
  }

  gwMap.get(row.gameweek)!.push(row);
}

for (const season of seasons) {
  const gwMap = seasonMap.get(season)!;
  const gameweeks = [...gwMap.keys()].sort((a, b) => a - b);

  console.log(`\n--- ${season} ---`);
  console.log(`Gameweeks available: ${gameweeks.length}`);

  for (const gw of gameweeks) {
    /*
     * IMPORTANT:
     *
     * This is currently a DATASET VALIDATION / BASELINE HARNESS.
     *
     * We intentionally do not yet call the production projection
     * model because the historical dataset does not contain every
     * field required by the current production model for older seasons.
     *
     * Instead, this first pass establishes the walk-forward structure
     * and creates the ground-truth lookup that the actual model can
     * consume.
     */

    const currentGW = gwMap.get(gw)!;

    // All information from previous gameweeks only.
    const previousRows = observations.filter(
      (x: any) =>
        x.season === season &&
        x.gameweek < gw
    );

    // Actual outcomes for this GW.
    const actualPoints = new Map<number, number>();

    for (const row of currentGW) {
      const existing = actualPoints.get(row.element) ?? 0;
      actualPoints.set(
        row.element,
        existing + Number(row.total_points ?? 0)
      );
    }

    results.push({
      season,
      gameweek: gw,
      information_set_size: previousRows.length,
      player_count: actualPoints.size,
      actual_points: Object.fromEntries(actualPoints)
    });

    if (gw % 5 === 0 || gw === gameweeks[gameweeks.length - 1]) {
      console.log(
        `${season} GW${gw}: ` +
        `${previousRows.length} prior observations, ` +
        `${actualPoints.size} players`
      );
    }
  }
}

fs.writeFileSync(
  output,
  JSON.stringify(results, null, 2)
);

console.log('\n========================================');
console.log('BACKTEST HARNESS COMPLETE');
console.log('========================================');
console.log(`Results: ${results.length} GW observations`);
console.log(`Saved: ${output}`);
