import fs from 'fs';

const data = JSON.parse(
  fs.readFileSync('research/historical-seasons.json', 'utf8')
);

const players = Object.values(data) as any[];

const noEPL = players.filter(
  p => !p.history_past || p.history_past.length === 0
);

const oneSeason = players.filter(
  p => p.history_past && p.history_past.length === 1
);

const twoPlus = players.filter(
  p => p.history_past && p.history_past.length >= 2
);

console.log('\n========================================');
console.log('FPL PLAYER HISTORY COHORT ANALYSIS');
console.log('========================================');

console.log(`Total players: ${players.length}`);
console.log(`No EPL history: ${noEPL.length}`);
console.log(`Exactly 1 EPL season: ${oneSeason.length}`);
console.log(`2+ EPL seasons: ${twoPlus.length}`);

console.log('\n--- NO EPL HISTORY ---');

noEPL.forEach(p => {
  console.log(
    `${p.name} | team=${p.team} | position=${p.element_type} | price=${(p.now_cost / 10).toFixed(1)}`
  );
});

console.log('\n--- ONE EPL SEASON ---');

oneSeason.forEach(p => {
  const s = p.history_past[0];

  console.log(
    `${p.name} | team=${p.team} | position=${p.element_type} | ` +
    `season=${s.season_name} | points=${s.total_points} | ` +
    `minutes=${s.minutes} | start_cost=${(s.start_cost / 10).toFixed(1)} | ` +
    `end_cost=${(s.end_cost / 10).toFixed(1)}`
  );
});