import { calculateProjectedPoints } from './src/utils/pointsProjection';
import { solveSquad } from './src/utils/fplSolver';

async function diagnose() {
  try {
    console.log("Fetching bootstrap-static...");
    const bootstrapRes = await fetch('http://localhost:3001/api/bootstrap-static');
    const bootstrapData = await bootstrapRes.json();

    console.log("Fetching fixtures...");
    const fixturesRes = await fetch('http://localhost:3001/api/fixtures');
    const fixturesData = await fixturesRes.json();

    const currentEvent = bootstrapData.events.find((e: any) => e.is_current) 
                      || bootstrapData.events.find((e: any) => e.is_next) 
                      || bootstrapData.events[0];
    const gwId = currentEvent ? currentEvent.id : 1;
    console.log("Gameweek ID:", gwId);

    console.log("Calculating points projections...");
    const projection = calculateProjectedPoints(
      bootstrapData.elements,
      bootstrapData.teams,
      fixturesData,
      gwId
    );
    console.log("Calculated projections for", projection.players.length, "players.");

    console.log("Running solver...");
    const result = solveSquad(projection.players);
    console.log("Solver feasible:", result.feasible);
    if (result.feasible) {
      console.log("Squad size:", result.squad.length);
      console.log("Total projected points:", result.totalProjectedPoints);
    } else {
      console.log("Solver failed.");
    }
  } catch (e) {
    console.error("Diagnosis Exception:", e);
  }
}
diagnose();
