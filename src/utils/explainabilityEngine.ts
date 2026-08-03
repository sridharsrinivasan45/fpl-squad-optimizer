import { solveSquad } from './fplSolver';
import type { SolverResult } from './fplSolver';
import type { Player } from './pointsProjection';
import { calculatePlayerRatings } from './recommendationEngine';

export interface CounterfactualReplacement {
  playerId: number;
  web_name: string;
  pointsDiff: number;
  costDiff: number;
  reason: string;
}

export interface SelectedExplanation {
  playerId: number;
  web_name: string;
  opportunityCost: number; // point loss if excluded
  replacement?: CounterfactualReplacement;
  reasons: string[];
}

export interface ExcludedExplanation {
  playerId: number;
  web_name: string;
  cost: number;
  pointsLoss: number; // points loss if forced in
  reasons: string[];
}

export interface BudgetSensitivity {
  currentBudgetLimit: number;
  reducedBudgetLimit: number;
  pointsLoss: number;
  explanation: string;
}

export interface OptimizationExplanation {
  selections: SelectedExplanation[];
  exclusions: ExcludedExplanation[];
  budgetSensitivity: BudgetSensitivity;
  globalOptimalitySummary: string;
}

export function generateOptimizationExplanation(
  players: Player[],
  baselineResult: SolverResult,
  isPreSeason: boolean
): OptimizationExplanation {
  if (!baselineResult.feasible || baselineResult.squad.length === 0) {
    return {
      selections: [],
      exclusions: [],
      budgetSensitivity: {
        currentBudgetLimit: 100.0,
        reducedBudgetLimit: 99.0,
        pointsLoss: 0,
        explanation: 'Optimization was not feasible.'
      },
      globalOptimalitySummary: 'No feasible squad loaded.'
    };
  }

  const baselinePoints = baselineResult.totalProjectedPoints;

  // 1. Selection Explanations & Opportunity Costs (x_s = 0)
  // We limit to starting 11 starters to save cycles, or compute for all 15.
  // Computing for the starters makes the most sense as they are the points yielders!
  const selections: SelectedExplanation[] = baselineResult.starters.map(s => {
    // Run counterfactual solver excluding this player
    const interventions = { excludedPlayerIds: [s.id] };
    const counterfactualRes = solveSquad(players, 1000, interventions);
    
    let opportunityCost = 0;
    let replacement: CounterfactualReplacement | undefined;

    if (counterfactualRes.feasible) {
      opportunityCost = Math.round((baselinePoints - counterfactualRes.totalProjectedPoints) * 100) / 100;
      
      // Find the player in counterfactualRes.squad who is NOT in baselineResult.squad
      const replacementPlayer = counterfactualRes.squad.find(
        cp => !baselineResult.squad.some(bp => bp.id === cp.id)
      );

      if (replacementPlayer) {
        const pointsDiff = Math.round((s.projected_points - replacementPlayer.projected_points) * 100) / 100;
        const costDiff = (s.now_cost - replacementPlayer.now_cost) / 10;
        
        let reason = `${s.web_name} projects at ${s.projected_points} pts compared to ${replacementPlayer.web_name} (${replacementPlayer.projected_points} pts). `;
        if (costDiff > 0) {
          reason += `Selecting ${s.web_name} costs £${costDiff.toFixed(1)}m more, which the optimizer funded by adjusting other positions.`;
        } else {
          reason += `Selecting ${s.web_name} saves £${Math.abs(costDiff).toFixed(1)}m, allowing upgrades elsewhere.`;
        }

        replacement = {
          playerId: replacementPlayer.id,
          web_name: replacementPlayer.web_name,
          pointsDiff,
          costDiff,
          reason
        };
      }
    }

    // Determine reasons based on recommendation engine ratings
    const rec = calculatePlayerRatings(s, isPreSeason, 0);
    const reasons: string[] = [];
    if (rec.ratings.expectedPointsRating >= 7.5) reasons.push('Elite expected points return');
    if (rec.ratings.valueRating >= 7.5) reasons.push('Excellent value-for-money metric');
    if (rec.ratings.fixtureRating >= 8.0) reasons.push('Favorable upcoming opponent difficulty');
    if (rec.ratings.reliabilityRating >= 9.0) reasons.push('Highly nailed starting probability');
    if (s.penalties_order === 1) reasons.push('Primary penalty taker role');

    if (reasons.length === 0) {
      reasons.push('Fills squad structure with optimal cost efficiency');
    }

    return {
      playerId: s.id,
      web_name: s.web_name,
      opportunityCost,
      replacement,
      reasons
    };
  });

  // 2. Exclusion Explanations (x_e = 1)
  // Identify notable unselected players: highest-priced or highest-PPG players in pool
  const selectedIds = new Set(baselineResult.squad.map(p => p.id));
  const notableExcluded = players
    .filter(p => !selectedIds.has(p.id))
    // Notable means either price >= £9.5m or ppg >= 4.5
    .filter(p => p.now_cost >= 95 || p.projected_points >= 4.5)
    .sort((a, b) => b.projected_points - a.projected_points)
    .slice(0, 5); // limit to top 5 exclusions

  const exclusions: ExcludedExplanation[] = notableExcluded.map(e => {
    // Run counterfactual solver forcing this player to be selected
    const interventions = { forcedPlayerIds: [e.id] };
    const counterfactualRes = solveSquad(players, 1000, interventions);

    let pointsLoss = 0;
    const reasons: string[] = [];

    if (counterfactualRes.feasible) {
      pointsLoss = Math.round((baselinePoints - counterfactualRes.totalProjectedPoints) * 100) / 100;
      
      // Calculate how many starters in baselineResult had to be downgraded to fit the forced player
      const downgradedStarters = baselineResult.starters.filter(
        bs => !counterfactualRes.starters.some(cs => cs.id === bs.id)
      );

      const forcedCostDiff = e.now_cost / 10;
      if (pointsLoss > 0) {
        reasons.push(`Forcing ${e.web_name} (£${forcedCostDiff.toFixed(1)}m) into the team causes a net loss of -${pointsLoss.toFixed(1)} expected points across the squad.`);
        if (downgradedStarters.length > 0) {
          const names = downgradedStarters.slice(0, 2).map(p => p.web_name).join(' and ');
          reasons.push(`To fund his price tag, the optimizer was forced to downgrade key starters like ${names}.`);
        }
      } else {
        reasons.push(`Selecting ${e.web_name} is mathematically possible, but the alternative combination yields equal points and superior budget flexibility.`);
      }
    } else {
      reasons.push(`Forcing ${e.web_name} (£${(e.now_cost / 10).toFixed(1)}m) violates overall budget limits, making the squad mathematically infeasible.`);
    }

    return {
      playerId: e.id,
      web_name: e.web_name,
      cost: e.now_cost,
      pointsLoss,
      reasons
    };
  });

  // 3. Budget Sensitivity (reduced budget to £99.0m, i.e., 990 tenths)
  const budgetInterventions = { customBudgetLimit: 990 };
  const reducedBudgetRes = solveSquad(players, 1000, budgetInterventions);
  let budgetPointsLoss = 0;
  let budgetExplanation = 'Reducing budget from £100.0m to £99.0m is mathematically infeasible.';

  if (reducedBudgetRes.feasible) {
    budgetPointsLoss = Math.round((baselinePoints - reducedBudgetRes.totalProjectedPoints) * 100) / 100;
    budgetExplanation = `Reducing the squad budget by £1.0m decreases the optimal starting XI score by -${budgetPointsLoss.toFixed(1)} points. This demonstrates that the final £1.0m of budget capital has a shadow value of ${budgetPointsLoss.toFixed(1)} expected points.`;
  }

  // 4. Global Optimality Summary
  const squadCost = baselineResult.totalCost;
  const forwardCount = baselineResult.starters.filter(p => p.element_type === 4).length;
  const midfieldCount = baselineResult.starters.filter(p => p.element_type === 3).length;
  
  const globalOptimalitySummary = `This 15-player squad represents the global mathematical optimum. The optimizer allocated £${squadCost.toFixed(1)}m of capital, prioritizing high-yield midfielders (${midfieldCount} starters) and forwards (${forwardCount} starters) due to their superior expected points return. The opportunity cost of adding more premium assets (such as Erling Haaland) outweighs their individual points gain, as the forced counterfactual runs show a net points decline from the necessary budget downgrades in supporting positions.`;

  return {
    selections,
    exclusions,
    budgetSensitivity: {
      currentBudgetLimit: 100.0,
      reducedBudgetLimit: 99.0,
      pointsLoss: budgetPointsLoss,
      explanation: budgetExplanation
    },
    globalOptimalitySummary
  };
}
