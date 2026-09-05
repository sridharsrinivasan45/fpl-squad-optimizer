import fs from 'fs';
import { calculateProjectedPoints } from './src/utils/pointsProjection';
import { solveSquad } from './src/utils/fplSolver';

const boot = JSON.parse(fs.readFileSync('temp-boot.json', 'utf8'));
const fixtures = JSON.parse(fs.readFileSync('temp-fixtures.json', 'utf8'));

console.log('Calculating projections for 2026/27 GW3...');
const proj = calculateProjectedPoints(boot.elements, boot.teams, fixtures, 3);
console.log(`Total players projected: ${proj.players.length}`);

// Benchmark solveSquad on all 626 players
console.log('\n--- Benchmarking solveSquad on FULL 626-Player Pool ---');
const times: number[] = [];
let fullResult: any = null;

for (let i = 0; i < 5; i++) {
  const start = performance.now();
  fullResult = solveSquad(proj.players, 1000);
  const end = performance.now();
  times.push(end - start);
}

const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
console.log(`Full-pool solver runtimes (5 runs): ${times.map(t => t.toFixed(1) + 'ms').join(', ')}`);
console.log(`Average runtime: ${avgTime.toFixed(1)}ms (Min: ${Math.min(...times).toFixed(1)}ms, Max: ${Math.max(...times).toFixed(1)}ms)`);

console.log('\n========================================');
console.log('FULL 626-PLAYER SOLVER RESULT');
console.log('========================================');
console.log(`Feasible: ${fullResult.feasible}`);
console.log(`Total Cost: £${fullResult.totalCost.toFixed(1)}m / £100.0m`);
console.log(`Starting XI Projected Points: ${fullResult.totalProjectedPoints.toFixed(2)} pts`);
console.log(`Captained Starting XI Points: ${(fullResult.totalProjectedPoints + (fullResult.captain?.projected_points || 0)).toFixed(2)} pts`);
console.log(`Squad Total Projected Points: ${fullResult.squadProjectedPoints.toFixed(2)} pts`);
const defCount = fullResult.starters.filter((p: any) => p.element_type === 2).length;
const midCount = fullResult.starters.filter((p: any) => p.element_type === 3).length;
const fwdCount = fullResult.starters.filter((p: any) => p.element_type === 4).length;
console.log(`Formation: ${defCount}-${midCount}-${fwdCount}`);
console.log(`Captain: ${fullResult.captain?.web_name} (£${(fullResult.captain?.now_cost/10).toFixed(1)}m, ${fullResult.captain?.projected_points.toFixed(2)} EP)`);
console.log(`Vice-Captain: ${fullResult.viceCaptain?.web_name} (£${(fullResult.viceCaptain?.now_cost/10).toFixed(1)}m, ${fullResult.viceCaptain?.projected_points.toFixed(2)} EP)`);

console.log('\nSTARTING XI:');
fullResult.starters.forEach((p: any) => {
  const posName = ['', 'GK', 'DEF', 'MID', 'FWD'][p.element_type];
  const capLabel = p.id === fullResult.captain?.id ? ' (C)' : p.id === fullResult.viceCaptain?.id ? ' (V)' : '';
  console.log(`- [${posName}] ${p.web_name} (${p.team_short_name}, £${(p.now_cost/10).toFixed(1)}m): ${p.projected_points.toFixed(2)} pts${capLabel}`);
});

console.log('\nBENCH:');
fullResult.bench.forEach((p: any, idx: number) => {
  const posName = ['', 'GK', 'DEF', 'MID', 'FWD'][p.element_type];
  console.log(`- [${posName}] ${p.web_name} (${p.team_short_name}, £${(p.now_cost/10).toFixed(1)}m): ${p.projected_points.toFixed(2)} pts (Bench ${idx === 3 ? 'GK' : idx + 1})`);
});
