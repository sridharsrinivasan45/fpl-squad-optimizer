import fs from 'fs';
import { calculateProjectedPoints } from './src/utils/pointsProjection';
import { solveSquad } from './src/utils/fplSolver';

const boot = JSON.parse(fs.readFileSync('temp-boot.json', 'utf8'));
const fixtures = JSON.parse(fs.readFileSync('temp-fixtures.json', 'utf8'));

// Run projections for GW3
// Completed matches count: GW1 and GW2 are completed (matchesAvailable = 2 for all teams)
const proj = calculateProjectedPoints(boot.elements, boot.teams, fixtures, 3);
console.log('Total players projected:', proj.players.length);
console.log('isPreSeason:', proj.isPreSeason);

// Show top 20 players by GW3 projected points
const topPlayers = [...proj.players].sort((a, b) => b.projected_points - a.projected_points).slice(0, 20);
console.log('\nTop 20 Players for GW3:');
topPlayers.forEach(p => {
  console.log(`${p.web_name} (${p.team_short_name}, pos:${p.element_type}, £${p.now_cost/10}m) -> proj: ${p.projected_points} pts (form: ${p.form}, total: ${p.total_points}, starts: ${p.starts})`);
});

// Run ILP solver for GW3 optimal 15-player squad
const result = solveSquad(proj.players, 1000);

console.log('\n========================================');
console.log('GW3 OPTIMAL SQUAD SOLVER RESULT');
console.log('========================================');
console.log('Feasible:', result.feasible);
console.log('Total Cost: £' + result.totalCost + 'm / £100.0m');
console.log('Starting XI Projected Points:', result.totalProjectedPoints.toFixed(2));
console.log('Squad Total Projected Points:', result.squadProjectedPoints.toFixed(2));
console.log('Captain:', result.captain?.web_name, `(£${result.captain ? result.captain.now_cost/10 : 0}m, ${result.captain?.projected_points} pts)`);
console.log('Vice-Captain:', result.viceCaptain?.web_name, `(£${result.viceCaptain ? result.viceCaptain.now_cost/10 : 0}m, ${result.viceCaptain?.projected_points} pts)`);

console.log('\nSTARTING XI:');
result.starters.forEach(p => {
  const isCap = p.id === result.captain?.id ? ' (C)' : p.id === result.viceCaptain?.id ? ' (V)' : '';
  console.log(`- [${['GK','DEF','MID','FWD'][p.element_type-1]}] ${p.web_name} (${p.team_short_name}, £${p.now_cost/10}m): ${p.projected_points} pts${isCap}`);
});

console.log('\nBENCH:');
result.bench.forEach(p => {
  console.log(`- [${['GK','DEF','MID','FWD'][p.element_type-1]}] ${p.web_name} (${p.team_short_name}, £${p.now_cost/10}m): ${p.projected_points} pts`);
});
