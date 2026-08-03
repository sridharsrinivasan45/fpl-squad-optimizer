import type { Player } from './pointsProjection';
import { solveSquad } from './fplSolver';
import type { SolverResult, SolverInterventions } from './fplSolver';
import { calculatePlayerRatings } from './recommendationEngine';
import type { RecommendationDetails } from './recommendationEngine';

export interface ComparisonReport {
  playerA: Player;
  playerB: Player;
  ratingsA: RecommendationDetails;
  ratingsB: RecommendationDetails;
  saferPlayer: string;
  higherCeilingPlayer: string;
  betterValuePlayer: string;
  beginnerFriendlyPlayer: string;
  differentialPlayer: string;
  verdictLabel: string;
  verdictExplanation: string;
}

export interface SimulationResult {
  feasible: boolean;
  baselinePoints: number;
  simulatedPoints: number;
  pointsDelta: number;
  baselineCost: number;
  simulatedCost: number;
  costDelta: number;
  verdictLabel: string;
  verdictColor: string; // e.g. "green", "yellow", "red"
  benefits: string[];
  drawbacks: string[];
  educationalTip: string;
  opportunityCostExplanation: string;
}

// 1. Player Comparison Engine
export function comparePlayers(
  playerA: Player,
  playerB: Player,
  isPreSeason: boolean
): ComparisonReport {
  const ratingsA = calculatePlayerRatings(playerA, isPreSeason, 0);
  const ratingsB = calculatePlayerRatings(playerB, isPreSeason, 0);

  // Safety comparison (Risk rating - inverse scale, higher is safer)
  let saferPlayer = 'Tied';
  if (ratingsA.ratings.riskRating > ratingsB.ratings.riskRating) saferPlayer = playerA.web_name;
  else if (ratingsB.ratings.riskRating > ratingsA.ratings.riskRating) saferPlayer = playerB.web_name;

  // Ceiling comparison (EP rating)
  let higherCeilingPlayer = 'Tied';
  if (ratingsA.ratings.expectedPointsRating > ratingsB.ratings.expectedPointsRating) higherCeilingPlayer = playerA.web_name;
  else if (ratingsB.ratings.expectedPointsRating > ratingsA.ratings.expectedPointsRating) higherCeilingPlayer = playerB.web_name;

  // Value comparison (Value rating)
  let betterValuePlayer = 'Tied';
  if (ratingsA.ratings.valueRating > ratingsB.ratings.valueRating) betterValuePlayer = playerA.web_name;
  else if (ratingsB.ratings.valueRating > ratingsA.ratings.valueRating) betterValuePlayer = playerB.web_name;

  // Beginner friendly (starts ratio & reliability)
  const begScoreA = ratingsA.ratings.reliabilityRating * 0.6 + Math.min(10, playerA.selected_by_percent / 4) * 0.4;
  const begScoreB = ratingsB.ratings.reliabilityRating * 0.6 + Math.min(10, playerB.selected_by_percent / 4) * 0.4;
  let beginnerFriendlyPlayer = 'Tied';
  if (begScoreA > begScoreB) beginnerFriendlyPlayer = playerA.web_name;
  else if (begScoreB > begScoreA) beginnerFriendlyPlayer = playerB.web_name;

  // Differential (Differential rating)
  let differentialPlayer = 'Tied';
  if (ratingsA.ratings.differentialRating > ratingsB.ratings.differentialRating) differentialPlayer = playerA.web_name;
  else if (ratingsB.ratings.differentialRating > ratingsA.ratings.differentialRating) differentialPlayer = playerB.web_name;

  // Overall recommendation verdict
  let verdictLabel = '';
  let verdictExplanation = '';
  const overallDiff = ratingsA.ratings.overallRating - ratingsB.ratings.overallRating;

  if (Math.abs(overallDiff) > 0.5) {
    const better = overallDiff > 0 ? playerA : playerB;
    verdictLabel = `Recommend ${better.web_name}`;
    verdictExplanation = `${better.web_name} has a higher overall fantasy rating (${Math.max(ratingsA.ratings.overallRating, ratingsB.ratings.overallRating).toFixed(1)}/10 vs ${Math.min(ratingsA.ratings.overallRating, ratingsB.ratings.overallRating).toFixed(1)}/10), driven by superior expected points returns and immediate playing safety.`;
  } else {
    // Overall ratings are close, compare price
    const costDiff = (playerA.now_cost - playerB.now_cost) / 10;
    if (Math.abs(costDiff) >= 1.5) {
      const cheaper = costDiff < 0 ? playerA : playerB;
      verdictLabel = `Recommend ${cheaper.web_name} (Value Pick)`;
      verdictExplanation = `Both players project at similar points values, but ${cheaper.web_name} saves £${Math.abs(costDiff).toFixed(1)}m in cost, which releases valuable capital to upgrade other areas of your squad.`;
    } else {
      // Compare fixture difficulty
      if (ratingsA.ratings.fixtureRating !== ratingsB.ratings.fixtureRating) {
        const easier = ratingsA.ratings.fixtureRating > ratingsB.ratings.fixtureRating ? playerA : playerB;
        verdictLabel = `Recommend ${easier.web_name} (Fixture Ease)`;
        verdictExplanation = `Their ratings are very close, but ${easier.web_name} has the easier upcoming fixture, making them the preferred transfer for this week.`;
      } else {
        verdictLabel = 'Tied Selection';
        verdictExplanation = 'Both players are highly comparable in terms of points output, cost, and reliability. Select based on your personal team preference.';
      }
    }
  }

  return {
    playerA,
    playerB,
    ratingsA,
    ratingsB,
    saferPlayer,
    higherCeilingPlayer,
    betterValuePlayer,
    beginnerFriendlyPlayer,
    differentialPlayer,
    verdictLabel,
    verdictExplanation
  };
}

// 2. Interactive Decision Simulator
export function simulateDecision(
  playerPool: Player[],
  baselineResult: SolverResult,
  interventions: SolverInterventions
): SimulationResult {
  const baselinePoints = baselineResult.totalProjectedPoints;
  const baselineCost = baselineResult.totalCost;

  // Run the solver with the interventions
  const simulatedResult = solveSquad(playerPool, 1000, interventions);

  if (!simulatedResult.feasible) {
    return {
      feasible: false,
      baselinePoints,
      simulatedPoints: 0,
      pointsDelta: 0,
      baselineCost,
      simulatedCost: 0,
      costDelta: 0,
      verdictLabel: 'Infeasible Simulation',
      verdictColor: 'red',
      benefits: [],
      drawbacks: ['The simulated constraints (player locks/exclusions/budget) violate FPL squad rules.'],
      educationalTip: 'Make sure your simulated transfers fit the positional requirements (2 GK, 5 DEF, 5 MID, 3 FWD) and club limits.',
      opportunityCostExplanation: 'No valid opportunity cost can be calculated.'
    };
  }

  const simulatedPoints = simulatedResult.totalProjectedPoints;
  const simulatedCost = simulatedResult.totalCost;
  const pointsDelta = Math.round((simulatedPoints - baselinePoints) * 100) / 100;
  const costDelta = Math.round((simulatedCost - baselineCost) * 10) / 10;

  // Determine Verdict
  let verdictLabel = 'Neutral';
  let verdictColor = 'yellow';
  
  if (pointsDelta >= 1.5) {
    verdictLabel = 'Strongly Recommend';
    verdictColor = 'green';
  } else if (pointsDelta > 0.2) {
    verdictLabel = 'Recommend';
    verdictColor = 'green';
  } else if (pointsDelta >= -0.2) {
    verdictLabel = 'Neutral';
    verdictColor = 'yellow';
  } else if (pointsDelta > -1.5) {
    verdictLabel = 'Not Recommended';
    verdictColor = 'red';
  } else {
    verdictLabel = 'Strongly Discourage';
    verdictColor = 'red';
  }

  // Generate benefits & drawbacks lists dynamically
  const benefits: string[] = [];
  const drawbacks: string[] = [];

  if (pointsDelta > 0) {
    benefits.push(`Increases starting XI projection by +${pointsDelta.toFixed(1)} points.`);
  } else if (pointsDelta < 0) {
    drawbacks.push(`Decreases starting XI projection by ${pointsDelta.toFixed(1)} points.`);
  }

  if (costDelta < 0) {
    benefits.push(`Saves £${Math.abs(costDelta).toFixed(1)}m in capital, increasing bank flexibility.`);
  } else if (costDelta > 0) {
    drawbacks.push(`Consumes an extra £${costDelta.toFixed(1)}m in squad cost.`);
  }

  // Check if forced inclusions caused squad downgrades
  if (interventions.forcedPlayerIds && interventions.forcedPlayerIds.length > 0) {
    const downgradedStarters = baselineResult.starters.filter(
      bs => !simulatedResult.starters.some(cs => cs.id === bs.id) && !interventions.forcedPlayerIds?.includes(bs.id)
    );

    if (downgradedStarters.length > 0) {
      drawbacks.push(`Forces downgrades of previous starters: ${downgradedStarters.map(p => p.web_name).slice(0, 2).join(', ')}.`);
    }
  }

  // Educational Tips
  let educationalTip = 'Premium players should justify their extra cost by outperforming a combination of mid-priced alternatives.';
  if (costDelta < 0 && pointsDelta >= -0.2) {
    educationalTip = 'Saving budget (releasing capital) is highly effective if the points difference is minor, as it allows upgrading other positions later.';
  } else if (interventions.excludedPlayerIds && interventions.excludedPlayerIds.length > 0) {
    educationalTip = 'Omitting template assets can be a high-upside mini-league strategy, but it increases rank volatility if those players perform.';
  }

  // Opportunity cost explain
  let opportunityCostExplanation = `By implementing these simulated interventions, the optimizer was forced to adjust the starting XI. `;
  if (pointsDelta > 0) {
    opportunityCostExplanation += `This change is optimal, gaining +${pointsDelta.toFixed(1)} points because the added assets utilize budget more efficiently.`;
  } else {
    opportunityCostExplanation += `This change sacrifices ${Math.abs(pointsDelta).toFixed(1)} points because forcing these overrides limits the mathematical options of the solver.`;
  }

  return {
    feasible: true,
    baselinePoints,
    simulatedPoints,
    pointsDelta,
    baselineCost,
    simulatedCost,
    costDelta,
    verdictLabel,
    verdictColor,
    benefits,
    drawbacks,
    educationalTip,
    opportunityCostExplanation
  };
}
