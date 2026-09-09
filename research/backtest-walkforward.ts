import fs from 'fs';

console.log('========================================');
console.log('FPL WALK-FORWARD BACKTEST');
console.log('========================================');

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const SEASONS = [
  '2022-23',
  '2023-24',
  '2024-25',
  '2025-26',
];

const MAX_GW = 38;

// --------------------------------------------------
// Load historical data
// --------------------------------------------------

const historicalPath = 'research/historical-seasons.json';

if (!fs.existsSync(historicalPath)) {
  throw new Error(`Missing ${historicalPath}`);
}

const historical = JSON.parse(
  fs.readFileSync(historicalPath, 'utf8')
);

const players = Object.values(historical) as any[];

console.log(`Players available: ${players.length}`);
console.log(`Seasons to evaluate: ${SEASONS.join(', ')}`);

// --------------------------------------------------
// Cohort summary
// --------------------------------------------------

function getCohort(player: any): string {
  const seasons = (player.history_past || []).filter(
    (s: any) => s.season_name
  );

  if (seasons.length === 0) {
    return 'NO_EPL_HISTORY';
  }

  if (seasons.length === 1) {
    return 'ONE_EPL_SEASON';
  }

  return 'TWO_PLUS_EPL_SEASONS';
}

const cohortCounts: Record<string, number> = {};

for (const player of players) {
  const cohort = getCohort(player);
  cohortCounts[cohort] = (cohortCounts[cohort] || 0) + 1;
}

console.log('\n--- PLAYER COHORTS ---');

for (const [cohort, count] of Object.entries(cohortCounts)) {
  console.log(`${cohort}: ${count}`);
}

// --------------------------------------------------
// Historical season availability
// --------------------------------------------------

console.log('\n--- HISTORICAL SEASONS AVAILABLE ---');

const seasonCounts: Record<string, number> = {};

for (const player of players) {
  for (const season of player.history_past || []) {
    const name = season.season_name;

    if (!name) continue;

    seasonCounts[name] = (seasonCounts[name] || 0) + 1;
  }
}

for (const [season, count] of Object.entries(seasonCounts).sort()) {
  console.log(`${season}: ${count} player records`);
}

// --------------------------------------------------
// Build player-season observations
// --------------------------------------------------

interface Observation {
  player_id: number;
  player_name: string;
  season: string;
  total_points: number;
  minutes: number;
  starts: number;
  goals: number;
  assists: number;
  start_cost: number;
  end_cost: number;
  cohort: string;
}

const observations: Observation[] = [];

for (const player of players) {
  const cohort = getCohort(player);

  for (const season of player.history_past || []) {
    if (!season.season_name) continue;

    observations.push({
      player_id: player.id,
      player_name: player.name,
      season: season.season_name,
      total_points: season.total_points || 0,
      minutes: season.minutes || 0,
      starts: season.starts || 0,
      goals: season.goals_scored || 0,
      assists: season.assists || 0,
      start_cost: season.start_cost || 0,
      end_cost: season.end_cost || 0,
      cohort,
    });
  }
}

// --------------------------------------------------
// Summary by season
// --------------------------------------------------

console.log('\n--- OBSERVATIONS BY SEASON ---');

const observationsBySeason: Record<string, number> = {};

for (const observation of observations) {
  observationsBySeason[observation.season] =
    (observationsBySeason[observation.season] || 0) + 1;
}

for (const [season, count] of Object.entries(observationsBySeason).sort()) {
  console.log(`${season}: ${count}`);
}

// --------------------------------------------------
// Summary by cohort and season
// --------------------------------------------------

console.log('\n--- COHORT × SEASON ---');

const cohortSeasonCounts: Record<string, number> = {};

for (const observation of observations) {
  const key = `${observation.season} | ${observation.cohort}`;

  cohortSeasonCounts[key] =
    (cohortSeasonCounts[key] || 0) + 1;
}

for (const [key, count] of Object.entries(cohortSeasonCounts).sort()) {
  console.log(`${key}: ${count}`);
}

// --------------------------------------------------
// Save clean research dataset
// --------------------------------------------------

fs.writeFileSync(
  'research/player-season-observations.json',
  JSON.stringify(observations, null, 2)
);

console.log('\n========================================');
console.log('DONE');
console.log('========================================');

console.log(
  `Saved ${observations.length} player-season observations.`
);

console.log(
  'File: research/player-season-observations.json'
);