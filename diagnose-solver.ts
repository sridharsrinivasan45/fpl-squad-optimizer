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
    const startSolver = Date.now();
    const result = solveSquad(projection.players);
    console.log(`Baseline solver finished in ${Date.now() - startSolver}ms. Feasible:`, result.feasible);
    
    if (result.feasible) {
      console.log("Squad size:", result.squad.length);
      console.log("Total projected points:", result.totalProjectedPoints);

      console.log("Running explainability engine (17 counterfactual solver runs)...");
      const startExplain = Date.now();
      const { generateOptimizationExplanation } = await import('./src/utils/explainabilityEngine');
      const explanation = generateOptimizationExplanation(projection.players, result, projection.isPreSeason);
      console.log(`Explainability engine finished in ${Date.now() - startExplain}ms.`);
      console.log("Selections explanations count:", explanation.selections.length);
      console.log("Exclusions explanations count:", explanation.exclusions.length);
    } else {
      console.log("Solver failed.");
    }
  } catch (e) {
    console.error("Diagnosis Exception:", e);
  }
}
diagnose();
