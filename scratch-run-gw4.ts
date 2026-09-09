import * as fs from 'fs';
import { calculateProjectedPoints } from './src/utils/pointsProjection';
import { solveSquad } from './src/utils/fplSolver';

const boot = JSON.parse(fs.readFileSync('temp-boot.json', 'utf8'));
const fixtures = JSON.parse(fs.readFileSync('temp-fixtures.json', 'utf8'));

// Run projections for GW4
// GW1, GW2 and GW3 are completed.
// Therefore matchesAvailable should be 3 and w should be 0.40
// = 40% pre-season prior + 60% current-season form.
const proj = calculateProjectedPoints(
  boot.elements,
  boot.teams,
  fixtures,
  4
);

// Solve the optimal 15-player squad using the existing solver.
// Do not change the existing budget or squad constraints.
const result = solveSquad(proj.players, 1000);

console.log('\n========================================');
console.log('GW4 OPTIMAL SQUAD SOLVER RESULT');
console.log('========================================');
console.log('Feasible:', result.feasible);
console.log('Total Cost: £' + result.totalCost + 'm / £100.0m');
console.log(
  'Starting XI Projected Points:',
  result.totalProjectedPoints.toFixed(2)
);
console.log(
  'Squad Total Projected Points:',
  result.squadProjectedPoints.toFixed(2)
);
console.log(
  'Captain:',
  result.captain?.web_name,
  `(£${result.captain ? result.captain.now_cost / 10 : 0}m, ${result.captain?.projected_points} pts)`
);
console.log(
  'Vice-Captain:',
  result.viceCaptain?.web_name,
  `(£${result.viceCaptain ? result.viceCaptain.now_cost / 10 : 0}m, ${result.viceCaptain?.projected_points} pts)`
);

console.log('\nSTARTING XI:');
result.starters.forEach(p => {
  const isCap = p.id === result.captain?.id ? ' (C)' : '';
  const isVice = p.id === result.viceCaptain?.id ? ' (VC)' : '';

  console.log(
    `${p.web_name} | ${p.team_short_name} | £${(p.now_cost / 10).toFixed(1)}m | ${p.projected_points.toFixed(2)} pts${isCap}${isVice}`
  );
});

console.log('\nBENCH:');
result.squad
  .filter(p => !result.starters.some(s => s.id === p.id))
  .forEach(p => {
    console.log(
      `${p.web_name} | ${p.team_short_name} | £${(p.now_cost / 10).toFixed(1)}m | ${p.projected_points.toFixed(2)} pts`
    );
  });

console.log('\n========================================');
console.log('PROJECTION ENGINE CHECK');
console.log('========================================');
console.log('Players projected:', proj.players.length);
console.log('Expected player pool: 626');
console.log('Target Gameweek: GW4');
console.log('Expected completed GWs: 3');
console.log('Expected preseason weight: 40%');
console.log('Expected current-season weight: 60%');
console.log('========================================\n');