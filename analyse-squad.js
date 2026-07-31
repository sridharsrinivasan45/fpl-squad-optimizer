import { calculateProjectedPoints } from './src/utils/pointsProjection.js';
import { solveSquad } from './src/utils/fplSolver.js';

async function run() {
  try {
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });
    const bootstrapData = await bootstrapRes.json();

    const fixturesRes = await fetch('https://fantasy.premierleague.com/api/fixtures/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });
    const fixturesData = await fixturesRes.json();

    const currentEvent = bootstrapData.events.find((e) => e.is_current) 
                      || bootstrapData.events.find((e) => e.is_next) 
                      || bootstrapData.events[0];
    const gwId = currentEvent ? currentEvent.id : 1;

    const projection = calculateProjectedPoints(
      bootstrapData.elements,
      bootstrapData.teams,
      fixturesData,
      gwId
    );

    const result = solveSquad(projection.players);
    const selectedIds = new Set(result.starters.map(p => p.id));
    const selectedTeamCounts = {};
    result.starters.forEach(p => {
      selectedTeamCounts[p.team] = (selectedTeamCounts[p.team] || 0) + 1;
    });

    console.log('Selected Team Counts:');
    console.log(selectedTeamCounts);

    // List top 15 defenders in the whole pool sorted by projected points
    const allDefs = projection.players
      .filter(p => p.element_type === 2)
      .sort((a, b) => b.projected_points - a.projected_points);

    console.log('\n--- Top 15 Defenders in Database ---');
    allDefs.slice(0, 15).forEach((d, idx) => {
      const isSelected = selectedIds.has(d.id) ? '[SELECTED]' : '[NOT SELECTED]';
      const curTeamCount = selectedTeamCounts[d.team] || 0;
      console.log(`${idx+1}. ${d.web_name} (Team ${d.team} - ${d.team_short_name}) - Proj: ${d.projected_points} - Cost: £${d.now_cost/10}m - Team Count: ${curTeamCount} ${isSelected}`);
    });

  } catch (err) {
    console.error(err);
  }
}

run();
