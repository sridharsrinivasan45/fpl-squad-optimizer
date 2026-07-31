import { calculateProjectedPoints } from './src/utils/pointsProjection.js';
import { solveSquad } from './src/utils/fplSolver.js';

async function run() {
  try {
    // 1. Fetch bootstrap-static data
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });
    const bootstrapData = await bootstrapRes.json();

    // 2. Fetch fixtures data
    const fixturesRes = await fetch('https://fantasy.premierleague.com/api/fixtures/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });
    const fixturesData = await fixturesRes.json();

    // 3. Determine current gameweek
    const currentEvent = bootstrapData.events.find((e) => e.is_current) 
                      || bootstrapData.events.find((e) => e.is_next) 
                      || bootstrapData.events[0];
    const gwId = currentEvent ? currentEvent.id : 1;
    console.log(`Current Gameweek determined: ${currentEvent ? currentEvent.name : 'GW ' + gwId}`);

    // 4. Calculate projections
    const projection = calculateProjectedPoints(
      bootstrapData.elements,
      bootstrapData.teams,
      fixturesData,
      gwId
    );

    console.log(`Pre-season Fallback Mode: ${projection.isPreSeason}`);

    // 5. Solve squad
    const result = solveSquad(projection.players);
    if (!result.feasible) {
      console.error('Error: Solver was infeasible!');
      return;
    }

    console.log('\n--- Selected 15-Man Squad Summary ---');
    console.log(`Squad Size: ${result.squad.length} players`);
    console.log(`Squad Points Sum: ${result.squadProjectedPoints}`);
    console.log(`Budget Spent: £${result.totalCost}m / £100m`);

    console.log('\n--- Starting XI (11 Starters) ---');
    result.starters.forEach(p => {
      const isCap = p.id === result.captain?.id ? ' (C)' : p.id === result.viceCaptain?.id ? ' (VC)' : '';
      console.log(`[Pos: ${p.element_type}] ${p.web_name}${isCap} - Cost: £${(p.now_cost/10).toFixed(1)}m - Proj: ${p.projected_points} - Availability: ${p.chance_of_playing_next_round}%`);
    });

    console.log('\n--- Bench (4 Players) ---');
    result.bench.forEach(p => {
      console.log(`[Pos: ${p.element_type}] ${p.web_name} - Cost: £${(p.now_cost/10).toFixed(1)}m - Proj: ${p.projected_points} - Availability: ${p.chance_of_playing_next_round}%`);
    });

  } catch (err) {
    console.error('Execution failed:', err.stack || err.message);
  }
}

run();
