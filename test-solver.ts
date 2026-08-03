import { solveSquad } from './src/utils/fplSolver.js';
import { Player } from './src/utils/pointsProjection.js';

// Setup mock players: 21 players with balanced costs to allow a feasible £100m squad
const mockPlayers: Player[] = [
  // GKs (3 players)
  {
    id: 1,
    web_name: 'Pope',
    team: 3, // Newcastle
    team_name: 'Newcastle',
    team_short_name: 'NEW',
    element_type: 1,
    now_cost: 50, // £5.0m
    form: 5.0,
    total_points: 100,
    chance_of_playing_next_round: 100,
    selected_by_percent: 10.0,
    projected_points: 5.0,
    fixtures: []
  },
  {
    id: 2,
    web_name: 'Raya',
    team: 1, // Arsenal
    team_name: 'Arsenal',
    team_short_name: 'ARS',
    element_type: 1,
    now_cost: 55, // £5.5m
    form: 5.5,
    total_points: 160,
    chance_of_playing_next_round: 100,
    selected_by_percent: 30.0,
    projected_points: 5.5,
    fixtures: []
  },
  {
    id: 3,
    web_name: 'Leno',
    team: 10, // Fulham
    team_name: 'Fulham',
    team_short_name: 'FUL',
    element_type: 1,
    now_cost: 40, // £4.0m (Cheap)
    form: 4.5,
    total_points: 110,
    chance_of_playing_next_round: 100,
    selected_by_percent: 8.0,
    projected_points: 4.5,
    fixtures: []
  },
  // DEFs (7 players)
  {
    id: 4,
    web_name: 'Saliba',
    team: 1, // Arsenal
    team_name: 'Arsenal',
    team_short_name: 'ARS',
    element_type: 2,
    now_cost: 60, // £6.0m
    form: 6.0,
    total_points: 120,
    chance_of_playing_next_round: 100,
    selected_by_percent: 35.0,
    projected_points: 6.0,
    fixtures: []
  },
  {
    id: 5,
    web_name: 'Gabriel',
    team: 1, // Arsenal
    team_name: 'Arsenal',
    team_short_name: 'ARS',
    element_type: 2,
    now_cost: 60, // £6.0m
    form: 5.8,
    total_points: 110,
    chance_of_playing_next_round: 100,
    selected_by_percent: 25.0,
    projected_points: 5.8,
    fixtures: []
  },
  {
    id: 6,
    web_name: 'Trippier',
    team: 3, // Newcastle
    team_name: 'Newcastle',
    team_short_name: 'NEW',
    element_type: 2,
    now_cost: 65, // £6.5m
    form: 5.5,
    total_points: 130,
    chance_of_playing_next_round: 100,
    selected_by_percent: 15.0,
    projected_points: 5.5,
    fixtures: []
  },
  {
    id: 7,
    web_name: 'Estupinan',
    team: 4, // Brighton
    team_name: 'Brighton',
    team_short_name: 'BHA',
    element_type: 2,
    now_cost: 40, // £4.0m (Cheap)
    form: 5.0,
    total_points: 90,
    chance_of_playing_next_round: 100,
    selected_by_percent: 12.0,
    projected_points: 5.0,
    fixtures: []
  },
  {
    id: 8,
    web_name: 'White',
    team: 1, // Arsenal
    team_name: 'Arsenal',
    team_short_name: 'ARS',
    element_type: 2,
    now_cost: 55, // £5.5m
    form: 5.2,
    total_points: 105,
    chance_of_playing_next_round: 100,
    selected_by_percent: 20.0,
    projected_points: 5.2,
    fixtures: []
  },
  {
    id: 9,
    web_name: 'Gvardiol',
    team: 5, // Man City
    team_name: 'Man City',
    team_short_name: 'MCI',
    element_type: 2,
    now_cost: 40, // £4.0m (Cheap)
    form: 4.8,
    total_points: 95,
    chance_of_playing_next_round: 100,
    selected_by_percent: 18.0,
    projected_points: 4.8,
    fixtures: []
  },
  {
    id: 10,
    web_name: 'Botman',
    team: 3, // Newcastle
    team_name: 'Newcastle',
    team_short_name: 'NEW',
    element_type: 2,
    now_cost: 40, // £4.0m (Cheap)
    form: 4.5,
    total_points: 85,
    chance_of_playing_next_round: 100,
    selected_by_percent: 9.0,
    projected_points: 4.5,
    fixtures: []
  },
  // MIDs (7 players)
  {
    id: 11,
    web_name: 'Salah',
    team: 6, // Liverpool
    team_name: 'Liverpool',
    team_short_name: 'LIV',
    element_type: 3,
    now_cost: 125, // £12.5m
    form: 8.5,
    total_points: 211,
    chance_of_playing_next_round: 100,
    selected_by_percent: 55.0,
    projected_points: 8.5,
    fixtures: []
  },
  {
    id: 12,
    web_name: 'Saka',
    team: 1, // Arsenal
    team_name: 'Arsenal',
    team_short_name: 'ARS',
    element_type: 3,
    now_cost: 95, // £9.5m
    form: 8.0,
    total_points: 180,
    chance_of_playing_next_round: 100,
    selected_by_percent: 60.0,
    projected_points: 8.0,
    fixtures: []
  },
  {
    id: 13,
    web_name: 'Son',
    team: 7, // Tottenham
    team_name: 'Tottenham',
    team_short_name: 'TOT',
    element_type: 3,
    now_cost: 95, // £9.5m
    form: 7.5,
    total_points: 150,
    chance_of_playing_next_round: 100,
    selected_by_percent: 15.0,
    projected_points: 7.5,
    fixtures: []
  },
  {
    id: 14,
    web_name: 'Foden',
    team: 5, // Man City
    team_name: 'Man City',
    team_short_name: 'MCI',
    element_type: 3,
    now_cost: 95, // £9.5m
    form: 7.5,
    total_points: 160,
    chance_of_playing_next_round: 100,
    selected_by_percent: 35.0,
    projected_points: 7.5,
    fixtures: []
  },
  {
    id: 15,
    web_name: 'Palmer',
    team: 8, // Chelsea
    team_name: 'Chelsea',
    team_short_name: 'CHE',
    element_type: 3,
    now_cost: 105, // £10.5m
    form: 8.0,
    total_points: 190,
    chance_of_playing_next_round: 100,
    selected_by_percent: 45.0,
    projected_points: 8.0,
    fixtures: []
  },
  {
    id: 16,
    web_name: 'Gordon',
    team: 3, // Newcastle
    team_name: 'Newcastle',
    team_short_name: 'NEW',
    element_type: 3,
    now_cost: 55, // £5.5m (Cheap)
    form: 6.5,
    total_points: 135,
    chance_of_playing_next_round: 100,
    selected_by_percent: 22.0,
    projected_points: 6.5,
    fixtures: []
  },
  {
    id: 17,
    web_name: 'Douglas Luiz',
    team: 9, // Aston Villa
    team_name: 'Aston Villa',
    team_short_name: 'AVL',
    element_type: 3,
    now_cost: 50, // £5.0m (Cheap)
    form: 6.0,
    total_points: 125,
    chance_of_playing_next_round: 100,
    selected_by_percent: 18.0,
    projected_points: 6.0,
    fixtures: []
  },
  // FWDs (4 players)
  {
    id: 18,
    web_name: 'Haaland',
    team: 5, // Man City
    team_name: 'Man City',
    team_short_name: 'MCI',
    element_type: 4,
    now_cost: 140, // £14.0m
    form: 9.5,
    total_points: 240,
    chance_of_playing_next_round: 100,
    selected_by_percent: 75.0,
    projected_points: 9.5,
    fixtures: []
  },
  {
    id: 19,
    web_name: 'Watkins',
    team: 9, // Aston Villa
    team_name: 'Aston Villa',
    team_short_name: 'AVL',
    element_type: 4,
    now_cost: 90, // £9.0m
    form: 8.0,
    total_points: 170,
    chance_of_playing_next_round: 100,
    selected_by_percent: 30.0,
    projected_points: 8.0,
    fixtures: []
  },
  {
    id: 20,
    web_name: 'Isak',
    team: 3, // Newcastle
    team_name: 'Newcastle',
    team_short_name: 'NEW',
    element_type: 4,
    now_cost: 85, // £8.5m
    form: 7.8,
    total_points: 160,
    chance_of_playing_next_round: 100,
    selected_by_percent: 28.0,
    projected_points: 7.8,
    fixtures: []
  },
  {
    id: 21,
    web_name: 'Solanke',
    team: 7, // Tottenham
    team_name: 'Tottenham',
    team_short_name: 'TOT',
    element_type: 4,
    now_cost: 60, // £6.0m (Cheap)
    form: 7.0,
    total_points: 130,
    chance_of_playing_next_round: 100,
    selected_by_percent: 12.0,
    projected_points: 7.0,
    fixtures: []
  }
];

console.log('Running Combined ILP FPL Solver Verification Test...');
const result = solveSquad(mockPlayers, 1000); // £100m budget

if (!result.feasible) {
  console.error('TEST FAILED: Solver could not find a feasible squad!');
  process.exit(1);
}

console.log('\n--- Selected 15-Man Squad ---');
console.log(`Squad Size: ${result.squad.length} players`);
console.log(`Squad Points Sum: ${result.squadProjectedPoints}`);
console.log(`Cost: £${result.totalCost}m / £100m`);

console.log('\n--- Starting XI (11 Starters) ---');
result.starters.forEach(p => {
  const role = p.id === result.captain?.id ? ' (C)' : p.id === result.viceCaptain?.id ? ' (VC)' : '';
  console.log(`[${p.element_type === 1 ? 'GK' : p.element_type === 2 ? 'DEF' : p.element_type === 3 ? 'MID' : 'FWD'}] ${p.web_name}${role} - Cost: £${p.now_cost/10}m - Points: ${p.projected_points}`);
});

console.log('\n--- Bench (4 Players) ---');
result.bench.forEach(p => {
  console.log(`[${p.element_type === 1 ? 'GK' : p.element_type === 2 ? 'DEF' : p.element_type === 3 ? 'MID' : 'FWD'}] ${p.web_name} - Cost: £${p.now_cost/10}m - Points: ${p.projected_points}`);
});

// Club limit verify
const teamCounts: Record<number, number> = {};
result.squad.forEach(p => {
  teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
});
console.log('\n--- Club Limits check ---');
Object.entries(teamCounts).forEach(([teamId, count]) => {
  console.log(`Club ID ${teamId}: ${count} players`);
});

// Assertions
const isGKLast = result.bench[3].element_type === 1;
const isOutfieldSortedByPoints = 
  (result.bench[0].projected_points > result.bench[1].projected_points) || 
  (result.bench[0].projected_points === result.bench[1].projected_points && result.bench[0].chance_of_playing_next_round >= result.bench[1].chance_of_playing_next_round);
const isOutfieldSortedByPoints2 = 
  (result.bench[1].projected_points > result.bench[2].projected_points) || 
  (result.bench[1].projected_points === result.bench[2].projected_points && result.bench[1].chance_of_playing_next_round >= result.bench[2].chance_of_playing_next_round);

if (
  result.squad.length === 15 && 
  result.starters.length === 11 && 
  result.bench.length === 4 &&
  isGKLast &&
  isOutfieldSortedByPoints &&
  isOutfieldSortedByPoints2
) {
  console.log('\nSUCCESS: Combined 15-man ILP Solver and Bench Auto-Sub Priority verified successfully!');
} else {
  console.error('\nFAILURE: Invalid squad counts or incorrect bench priority sorting!');
  if (!isGKLast) console.error('Goalkeeper is not last on the bench.');
  if (!isOutfieldSortedByPoints || !isOutfieldSortedByPoints2) console.error('Outfield bench players are not sorted correctly by points and availability.');
  process.exit(1);
}
