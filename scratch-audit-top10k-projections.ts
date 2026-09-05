import fs from 'fs';
import { calculateProjectedPoints } from './src/utils/pointsProjection';
import { solveSquad } from './src/utils/fplSolver';

const boot = JSON.parse(fs.readFileSync('temp-boot.json', 'utf8'));
const fixtures = JSON.parse(fs.readFileSync('temp-fixtures.json', 'utf8'));

console.log('--- RECALCULATING MODEL PROJECTIONS PER GAMEWEEK ---');

// GW1 Model (Pre-season Baseline: 100% prior, GW1 fixtures)
// In pre-season, matchesAvailable = 0, horizon = 1
const gw1Proj = calculateProjectedPoints(boot.elements, boot.teams, fixtures, 1);
const gw1Solve = solveSquad(gw1Proj.players, 1000);
console.log('GW1 Solver Result:');
console.log(`- Starting XI Projected Points (without captain double): ${gw1Solve.starters.reduce((s, p) => s + p.projected_points, 0).toFixed(2)} pts`);
console.log(`- Captain: ${gw1Solve.captain?.web_name} (${gw1Solve.captain?.projected_points.toFixed(2)} EP)`);
console.log(`- Captained Starting XI Projected Points: ${(gw1Solve.starters.reduce((s, p) => s + p.projected_points, 0) + (gw1Solve.captain?.projected_points || 0)).toFixed(2)} pts`);

// GW2 Model (After GW1: 1 completed GW, 80% prior / 20% form, GW2 fixtures)
// We simulate GW2 by setting horizon = 2
const gw2Proj = calculateProjectedPoints(boot.elements, boot.teams, fixtures, 2);
const gw2Solve = solveSquad(gw2Proj.players, 1000);
console.log('\nGW2 Solver Result:');
console.log(`- Starting XI Projected Points (without captain double): ${gw2Solve.starters.reduce((s, p) => s + p.projected_points, 0).toFixed(2)} pts`);
console.log(`- Captain: ${gw2Solve.captain?.web_name} (${gw2Solve.captain?.projected_points.toFixed(2)} EP)`);
console.log(`- Captained Starting XI Projected Points: ${(gw2Solve.starters.reduce((s, p) => s + p.projected_points, 0) + (gw2Solve.captain?.projected_points || 0)).toFixed(2)} pts`);

// GW3 Model (After GW2: 2 completed GWs, 60% prior / 40% form, GW3 fixtures)
const gw3Proj = calculateProjectedPoints(boot.elements, boot.teams, fixtures, 3);
const gw3Solve = solveSquad(gw3Proj.players, 1000);
console.log('\nGW3 Solver Result:');
console.log(`- Starting XI Projected Points (without captain double): ${gw3Solve.starters.reduce((s, p) => s + p.projected_points, 0).toFixed(2)} pts`);
console.log(`- Captain: ${gw3Solve.captain?.web_name} (${gw3Solve.captain?.projected_points.toFixed(2)} EP)`);
console.log(`- Captained Starting XI Projected Points: ${(gw3Solve.starters.reduce((s, p) => s + p.projected_points, 0) + (gw3Solve.captain?.projected_points || 0)).toFixed(2)} pts`);

// Also check the Preserved Baseline Squad (57.97 total squad) across GW1 and GW2
const baseline15Ids = [1, 10, 12, 13, 14, 30, 35, 34, 40, 41, 53, 15, 56, 57, 2];
const baseline11Starters = [1, 10, 12, 13, 14, 30, 35, 34, 40, 41, 53];
console.log('\n--- PRESERVED BASELINE SQUAD SPECIFIC PROJECTIONS ---');
const gw1BaselineStarters = gw1Proj.players.filter(p => baseline11Starters.includes(p.id));
const gw1BaseCap = gw1BaselineStarters.find(p => p.id === 30);
const gw1BaseCapPts = gw1BaselineStarters.reduce((s, p) => s + p.projected_points, 0) + (gw1BaseCap?.projected_points || 0);
console.log(`GW1 Baseline Starting XI: ${gw1BaselineStarters.reduce((s, p) => s + p.projected_points, 0).toFixed(2)} pts (Captained: ${gw1BaseCapPts.toFixed(2)} pts)`);

const gw2BaselineStarters = gw2Proj.players.filter(p => baseline11Starters.includes(p.id));
const gw2BaseCap = gw2BaselineStarters.find(p => p.id === 30);
const gw2BaseCapPts = gw2BaselineStarters.reduce((s, p) => s + p.projected_points, 0) + (gw2BaseCap?.projected_points || 0);
console.log(`GW2 Baseline Starting XI: ${gw2BaselineStarters.reduce((s, p) => s + p.projected_points, 0).toFixed(2)} pts (Captained: ${gw2BaseCapPts.toFixed(2)} pts)`);
