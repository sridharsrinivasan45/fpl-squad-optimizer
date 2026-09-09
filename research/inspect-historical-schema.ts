import fs from 'fs';

const path = 'research/historical-seasons.json';

if (!fs.existsSync(path)) {
  throw new Error(`File not found: ${path}`);
}

const data = JSON.parse(fs.readFileSync(path, 'utf8'));

console.log('========================================');
console.log('HISTORICAL DATA SCHEMA INSPECTION');
console.log('========================================');

console.log('\nTop-level type:');
console.log(Array.isArray(data) ? 'ARRAY' : typeof data);

console.log('\nNumber of top-level records:');
console.log(Array.isArray(data) ? data.length : Object.keys(data).length);

// --------------------------------------------------
// Find first player record
// --------------------------------------------------

const firstPlayer: any = Array.isArray(data)
  ? data[0]
  : Object.values(data)[0];

if (!firstPlayer) {
  throw new Error('No player records found.');
}

console.log('\n--- FIRST PLAYER RECORD ---');
console.log(JSON.stringify(firstPlayer, null, 2));

// --------------------------------------------------
// Top-level keys
// --------------------------------------------------

console.log('\n--- PLAYER KEYS ---');
console.log(Object.keys(firstPlayer));

// --------------------------------------------------
// Inspect history arrays
// --------------------------------------------------

console.log('\n--- HISTORY STRUCTURE ---');

if (Array.isArray(firstPlayer.history_past)) {
  console.log(
    `history_past entries: ${firstPlayer.history_past.length}`
  );

  if (firstPlayer.history_past.length > 0) {
    console.log('\nFirst history_past entry:');
    console.log(
      JSON.stringify(firstPlayer.history_past[0], null, 2)
    );
  }
}

if (Array.isArray(firstPlayer.history)) {
  console.log(
    `history entries: ${firstPlayer.history.length}`
  );

  if (firstPlayer.history.length > 0) {
    console.log('\nFirst history entry:');
    console.log(
      JSON.stringify(firstPlayer.history[0], null, 2)
    );
  }
}

// --------------------------------------------------
// Search for GW-level fields
// --------------------------------------------------

console.log('\n--- SEARCHING FOR GW-LEVEL DATA ---');

const possibleFields = [
  'round',
  'gw',
  'fixture',
  'total_points',
  'points',
  'kickoff_time',
  'opponent_team',
  'was_home',
  'minutes',
];

for (const field of possibleFields) {
  let found = false;

  if (Array.isArray(firstPlayer.history)) {
    found = firstPlayer.history.some(
      (x: any) => x && x[field] !== undefined
    );
  }

  if (Array.isArray(firstPlayer.history_past)) {
    found =
      found ||
      firstPlayer.history_past.some(
        (x: any) => x && x[field] !== undefined
      );
  }

  console.log(`${field}: ${found ? 'FOUND' : 'not found'}`);
}

// --------------------------------------------------
// Count historical season records
// --------------------------------------------------

console.log('\n--- SEASON COVERAGE ---');

const seasonCounts: Record<string, number> = {};

for (const player of Object.values(data) as any[]) {
  for (const season of player.history_past || []) {
    if (!season.season_name) continue;

    seasonCounts[season.season_name] =
      (seasonCounts[season.season_name] || 0) + 1;
  }
}

for (const [season, count] of Object.entries(seasonCounts).sort()) {
  console.log(`${season}: ${count}`);
}

console.log('\n========================================');
console.log('INSPECTION COMPLETE');
console.log('========================================');