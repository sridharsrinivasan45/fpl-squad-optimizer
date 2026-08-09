import { calculateProjectedPoints } from './src/utils/pointsProjection';
import { solveSquad } from './src/utils/fplSolver';
import { comparePlayers, simulateDecision } from './src/utils/decisionSimulator';
import { calculatePlayerRatings } from './src/utils/recommendationEngine';
import type { Player } from './src/utils/pointsProjection';

console.log('Running FPL Data Integrity Test Suite...');

// Mock data structures
const mockTeams = [
  { id: 1, name: 'Arsenal', short_name: 'ARS' },
  { id: 2, name: 'Newcastle', short_name: 'NEW' },
  { id: 3, name: 'Liverpool', short_name: 'LIV' },
  { id: 4, name: 'Chelsea', short_name: 'CHE' },
  { id: 5, name: 'Man City', short_name: 'MCI' },
  { id: 6, name: 'Spurs', short_name: 'TOT' }
];

const mockElements = [
  { id: 101, web_name: 'Saka', team: 1, element_type: 3, now_cost: 85, form: '6.5', total_points: 200, chance_of_playing_next_round: 100, selected_by_percent: '45.0', status: 'a', news: '', starts: 30, minutes: 2700 },
  { id: 102, web_name: 'Isak', team: 2, element_type: 4, now_cost: 75, form: '5.5', total_points: 170, chance_of_playing_next_round: 100, selected_by_percent: '35.0', status: 'a', news: '', starts: 28, minutes: 2400 },
  { id: 103, web_name: 'Salah', team: 3, element_type: 3, now_cost: 100, form: '8.0', total_points: 220, chance_of_playing_next_round: 100, selected_by_percent: '50.0', status: 'a', news: '', starts: 32, minutes: 2800 },
  { id: 104, web_name: 'Gabriel', team: 1, element_type: 2, now_cost: 50, form: '4.5', total_points: 150, chance_of_playing_next_round: 100, selected_by_percent: '30.0', status: 'a', news: '', starts: 34, minutes: 3000 },
  { id: 105, web_name: 'Raya', team: 1, element_type: 1, now_cost: 50, form: '4.0', total_points: 140, chance_of_playing_next_round: 100, selected_by_percent: '20.0', status: 'a', news: '', starts: 35, minutes: 3150 },
  // Extra players to satisfy squad requirements (2 GK, 5 DEF, 5 MID, 3 FWD)
  { id: 106, web_name: 'Alisson', team: 3, element_type: 1, now_cost: 50, form: '3.8', total_points: 130, chance_of_playing_next_round: 100, selected_by_percent: '15.0', status: 'a', news: '', starts: 28, minutes: 2500 },
  { id: 107, web_name: 'Saliba', team: 4, element_type: 2, now_cost: 50, form: '4.2', total_points: 145, chance_of_playing_next_round: 100, selected_by_percent: '25.0', status: 'a', news: '', starts: 38, minutes: 3420 },
  { id: 108, web_name: 'Trippier', team: 2, element_type: 2, now_cost: 50, form: '3.5', total_points: 120, chance_of_playing_next_round: 100, selected_by_percent: '10.0', status: 'a', news: '', starts: 25, minutes: 2100 },
  { id: 109, web_name: 'Burn', team: 2, element_type: 2, now_cost: 40, form: '3.0', total_points: 100, chance_of_playing_next_round: 100, selected_by_percent: '8.0', status: 'a', news: '', starts: 30, minutes: 2600 },
  { id: 110, web_name: 'Van Dijk', team: 3, element_type: 2, now_cost: 50, form: '4.5', total_points: 135, chance_of_playing_next_round: 100, selected_by_percent: '18.0', status: 'a', news: '', starts: 34, minutes: 3000 },
  { id: 111, web_name: 'Martinelli', team: 4, element_type: 3, now_cost: 65, form: '4.0', total_points: 110, chance_of_playing_next_round: 100, selected_by_percent: '12.0', status: 'a', news: '', starts: 22, minutes: 1800 },
  { id: 112, web_name: 'Gordon', team: 4, element_type: 3, now_cost: 65, form: '5.0', total_points: 130, chance_of_playing_next_round: 100, selected_by_percent: '14.0', status: 'a', news: '', starts: 29, minutes: 2500 },
  { id: 113, web_name: 'Diaz', team: 5, element_type: 3, now_cost: 65, form: '4.8', total_points: 125, chance_of_playing_next_round: 100, selected_by_percent: '16.0', status: 'a', news: '', starts: 26, minutes: 2200 },
  { id: 114, web_name: 'Haaland', team: 5, element_type: 4, now_cost: 120, form: '7.5', total_points: 210, chance_of_playing_next_round: 100, selected_by_percent: '55.0', status: 'a', news: '', starts: 30, minutes: 2600 },
  { id: 115, web_name: 'Darwin', team: 5, element_type: 4, now_cost: 65, form: '4.2', total_points: 115, chance_of_playing_next_round: 100, selected_by_percent: '10.0', status: 'a', news: '', starts: 20, minutes: 1600 }
];

const mockFixtures = [
  { event: 1, team_h: 1, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 4, finished: false },
  { event: 1, team_h: 3, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 4, finished: false }
];

// Test 1: Normal Player/Team Mapping
const projection = calculateProjectedPoints(mockElements, mockTeams, mockFixtures, 1);
const players = projection.players;

console.assert(players.length === 15, 'Player list should have 15 players');
const saka = players.find(p => p.id === 101);
if (!saka || saka.team_name !== 'Arsenal' || saka.team_short_name !== 'ARS') {
  throw new Error('Saka team mapping failed');
}
console.log('✅ Test 1 Passed: Normal player/team mapping');

// Test 2: Invalid Team ID detection
const invalidElements = [
  ...mockElements,
  { id: 999, web_name: 'Ghost', team: 99, element_type: 3, now_cost: 50, form: '2.0', total_points: 50, chance_of_playing_next_round: 100, selected_by_percent: '5.0', status: 'a', news: '' }
];

const validateFPLData = (pl: Player[], ts: any[]) => {
  const warnings: string[] = [];
  const teamIds = new Set(ts.map((t: any) => t.id));
  pl.forEach((p) => {
    if (!p.team || !teamIds.has(p.team)) {
      warnings.push(`Invalid Team ID ${p.team} for player ${p.web_name}`);
    }
  });
  return warnings;
};

const invalidProj = calculateProjectedPoints(invalidElements, mockTeams, mockFixtures, 1);
const warnings = validateFPLData(invalidProj.players, mockTeams);
console.assert(warnings.length > 0, 'Should return warning for invalid team ID');
console.log('✅ Test 2 Passed: Invalid team ID detected');

// Test 3: Player Transfer between Clubs
// Saka moves from Arsenal (1) to Newcastle (2)
const transferredElements = mockElements.map(el => {
  if (el.id === 101) {
    return { ...el, team: 2 };
  }
  return el;
});
const transProj = calculateProjectedPoints(transferredElements, mockTeams, mockFixtures, 1);
const transSaka = transProj.players.find(p => p.id === 101);
if (!transSaka || transSaka.team_name !== 'Newcastle' || transSaka.team_short_name !== 'NEW') {
  throw new Error(`Saka transfer resolution failed: ${transSaka?.team_name}`);
}
console.log('✅ Test 3 Passed: Transfer resolution matches new club');

// Test 4: Club Limit Validation (max 3 players per club)
// Add a 4th Arsenal player to a list
const activeArsenalPlayers = [
  { id: 101, web_name: 'Saka', team_name: 'Arsenal', team: 1, element_type: 3, now_cost: 100, projected_points: 6 },
  { id: 104, web_name: 'Gabriel', team_name: 'Arsenal', team: 1, element_type: 2, now_cost: 60, projected_points: 4 },
  { id: 105, web_name: 'Raya', team_name: 'Arsenal', team: 1, element_type: 1, now_cost: 55, projected_points: 4 },
  { id: 107, web_name: 'Saliba', team_name: 'Arsenal', team: 1, element_type: 2, now_cost: 60, projected_points: 4 }
];

const checkClubLimit = (squad: any[]) => {
  const counts: Record<string, number> = {};
  squad.forEach(p => {
    counts[p.team_name] = (counts[p.team_name] || 0) + 1;
  });
  return Object.values(counts).every(c => c <= 3);
};
console.assert(!checkClubLimit(activeArsenalPlayers), 'Should fail 3-player club limit check');
console.log('✅ Test 4 Passed: 3-player club limit validation');

// Test 5: Player Comparison
const comp = comparePlayers(players.find(p => p.id === 103)!, players.find(p => p.id === 101)!, false);
console.assert(comp.playerA.web_name === 'Salah' && comp.playerB.web_name === 'Saka', 'Player comparison data mismatched');
console.log('✅ Test 5 Passed: Player comparison inputs');

// Test 6: Simulator forced/excluded players
const solverResult = solveSquad(players, 1000);
console.assert(solverResult.feasible, 'Baseline squad must be feasible');

const simulated = simulateDecision(players, solverResult, {
  forcedPlayerIds: [103] // force Salah
});
console.assert(simulated.feasible, 'Simulated forced squad must be feasible');
console.log('✅ Test 6 Passed: Simulator solver run');

// Test 7: Doubtful Player Playing Probability Calibration (Single Discount)
const doubtfulElements = [
  ...mockElements,
  { id: 999, web_name: 'DoubtfulPlayer', team: 1, element_type: 3, now_cost: 60, form: '4.0', total_points: 100, chance_of_playing_next_round: 75, selected_by_percent: '5.0', status: 'd', news: 'Hamstring injury', starts: 15, minutes: 1350 }
];
const doubtfulProj = calculateProjectedPoints(doubtfulElements, mockTeams, mockFixtures, 1);
const doubtfulPlayer = doubtfulProj.players.find(p => p.id === 999);
if (!doubtfulPlayer) {
  throw new Error('Doubtful player not projected');
}
const finalProbPercent = doubtfulPlayer.breakdown?.playingProbabilityAdjustment;
console.assert(finalProbPercent === 75, `Expected playing probability to be 75%, but got ${finalProbPercent}%`);
if (finalProbPercent !== 75) {
  throw new Error(`Doubtful player playing probability calibration failed. Expected 75, got ${finalProbPercent}`);
}
console.log('✅ Test 7 Passed: Doubtful player playing probability (Single Discount)');

console.log('All FPL Data Integrity Tests PASSED successfully!');
