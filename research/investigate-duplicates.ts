import fs from 'fs';

const data = JSON.parse(
  fs.readFileSync('./research/walkforward-observations.json', 'utf8')
);

console.log('DUPLICATE PLAYER-GW INVESTIGATION');
console.log('================================');

const groups = new Map<string, any[]>();

for (const row of data) {
  const key = `${row.season}|${row.gameweek}|${row.element}`;

  if (!groups.has(key)) {
    groups.set(key, []);
  }

  groups.get(key)!.push(row);
}

const duplicates = [...groups.entries()]
  .filter(([, rows]) => rows.length > 1);

console.log(`Duplicate player-season-GW groups: ${duplicates.length}`);

console.log('\n--- FIRST 20 DUPLICATE GROUPS ---');

for (const [key, rows] of duplicates.slice(0, 20)) {
  console.log(`\n${key}`);
  console.log(
    rows.map((r: any) => ({
      name: r.name,
      gameweek: r.gameweek,
      opponent_team: r.opponent_team,
      kickoff_time: r.kickoff_time,
      minutes: r.minutes,
      total_points: r.total_points,
      value: r.value,
      was_home: r.was_home
    }))
  );
}

console.log('\n--- DUPLICATE COUNTS BY SEASON ---');

const seasonCounts = new Map<string, number>();

for (const [key] of duplicates) {
  const season = key.split('|')[0];
  seasonCounts.set(
    season,
    (seasonCounts.get(season) || 0) + 1
  );
}

for (const [season, count] of seasonCounts) {
  console.log(`${season}: ${count}`);
}

console.log('\n--- GROUP SIZE DISTRIBUTION ---');

const sizes = new Map<number, number>();

for (const [, rows] of groups) {
  if (rows.length > 1) {
    sizes.set(
      rows.length,
      (sizes.get(rows.length) || 0) + 1
    );
  }
}

for (const [size, count] of [...sizes.entries()].sort()) {
  console.log(`${size} records: ${count} groups`);
}

console.log('\n================================');
console.log('DUPLICATE INVESTIGATION COMPLETE');
