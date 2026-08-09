import { calculateProjectedPoints } from './pointsProjection';
import type { Player } from './pointsProjection';
import { solveSquad } from './fplSolver';

export interface UserChipState {
  wildcard_1: boolean;      // First half Wildcard (expires GW19)
  wildcard_2: boolean;      // Second half Wildcard
  freehit: boolean;
  triplecaptain: boolean;
  benchboost: boolean;
}

export interface ChipVerdict {
  chipCode: 'wildcard' | 'freehit' | 'triplecaptain' | 'benchboost';
  verdict: 'USE NOW' | 'HOLD';
  currentValue: number;      // Projected points gain this GW
  bestFutureGW: number;      // Best target GW
  bestFutureValue: number;   // Projected points gain in target GW
  advantage: number;        // currentValue - bestFutureValue (positive means Use Now)
  confidence: 'High' | 'Medium' | 'Low';
  reason: string;
  sensitivity: string;       // "What could change this recommendation"
}

// Projection Confidence Weights (PCW) modeling assumptions over a 5-week horizon
export const DEFAULT_PCW = [1.0, 0.9, 0.8, 0.7, 0.6];

/**
 * Audit season fixtures to identify blanks, doubles, and provisional gameweeks.
 */
export function auditSeasonFixtures(fixtures: any[], _currentGW: number) {
  const gwFixtureCounts = new Map<number, number>();
  const gwProvisionalCounts = new Map<number, number>();

  fixtures.forEach((f) => {
    if (!f.event) {
      // Postponed fixture
      return;
    }
    const gw = f.event;
    gwFixtureCounts.set(gw, (gwFixtureCounts.get(gw) || 0) + 1);
    
    // Check if the match status suggests postponement risk or rescheduled provisional state
    if (f.finished === false && (f.kickoff_time === null || f.event === null)) {
      gwProvisionalCounts.set(gw, (gwProvisionalCounts.get(gw) || 0) + 1);
    }
  });

  const audits: { [gw: number]: { status: string; confidence: number; confirmedCount: number } } = {};

  for (let gw = 1; gw <= 38; gw++) {
    const count = gwFixtureCounts.get(gw) || 0;
    const provisional = gwProvisionalCounts.get(gw) || 0;
    
    let status = 'Normal';
    if (count > 10) status = 'Double';
    else if (count < 10 && count > 0) status = 'Blank';
    else if (count === 0) status = 'Unknown';

    // Calculate fixture certainty based on provisional count
    const confidence = count === 0 ? 0.0 : Math.max(0.0, 1.0 - (provisional / count));

    audits[gw] = {
      status,
      confidence,
      confirmedCount: count - provisional
    };
  }

  return audits;
}

/**
 * Calculates user-specific chip recommendations based on active squad, available chips, and future fixture schedules.
 */
export function calculateChipVerdicts(
  allPlayers: Player[],
  bootstrapData: any,
  fixturesData: any[],
  currentGW: number,
  userSquad: Player[],
  chipState: UserChipState
): ChipVerdict[] {
  const verdicts: ChipVerdict[] = [];
  if (!bootstrapData || !fixturesData || fixturesData.length === 0) return verdicts;

  const fixturesAudit = auditSeasonFixtures(fixturesData, currentGW);

  // Identify future gameweeks to evaluate (next 5 weeks + any blank/double gameweeks in the rest of the season)
  const futureGWs: number[] = [];
  for (let gw = currentGW + 1; gw <= 38; gw++) {
    const isImmediate = gw <= currentGW + 5;
    const audit = fixturesAudit[gw] || { status: 'Normal' };
    const isSpecial = audit.status === 'Double' || audit.status === 'Blank';
    
    if (isImmediate || isSpecial) {
      futureGWs.push(gw);
    }
  }

  // --- TRIPLE CAPTAIN ENGINE ---
  if (chipState.triplecaptain) {
    // Current TC Value: Expected score of the best captain option in user's starting XI
    const currentStarters = userSquad.slice(0, 11);
    const tcNowVal = currentStarters.length > 0 
      ? Math.max(...currentStarters.map(p => p.projected_points)) 
      : 0.0;

    // Find best future opportunity based on the user's current squad players' future projections
    let bestFutureGW = currentGW;
    let bestFutureVal = tcNowVal;
    let futureConfidence: 'High' | 'Medium' | 'Low' = 'High';

    futureGWs.forEach((gw) => {
      const proj = calculateProjectedPoints(bootstrapData.elements, bootstrapData.teams, fixturesData, gw);
      // Map user squad IDs to future projections
      const squadProjs = userSquad.map(saved => {
        const fresh = proj.players.find(p => p.id === saved.id);
        return fresh ? fresh.projected_points : 0;
      });
      const gwBestVal = squadProjs.length > 0 ? Math.max(...squadProjs) : 0.0;

      if (gwBestVal > bestFutureVal) {
        bestFutureVal = gwBestVal;
        bestFutureGW = gw;
        
        // Confidence calculation based on fixture audit and horizon proximity
        const gwAudit = fixturesAudit[gw] || { confidence: 1.0 };
        const horizonDist = gw - currentGW;
        if (gwAudit.confidence < 0.8 || horizonDist > 10) {
          futureConfidence = 'Low';
        } else if (gwAudit.confidence < 1.0 || horizonDist > 5) {
          futureConfidence = 'Medium';
        } else {
          futureConfidence = 'High';
        }
      }
    });

    const tcAdvantage = tcNowVal - bestFutureVal;
    const tcVerdict: 'USE NOW' | 'HOLD' = tcAdvantage > 0.0 ? 'USE NOW' : 'HOLD';

    let reason = '';
    let sensitivity = '';
    if (tcVerdict === 'USE NOW') {
      reason = `Your captain this week projects at ${tcNowVal.toFixed(1)} expected points, which is higher than any other projected future week for your squad.`;
      sensitivity = 'An unexpected injury to your captain candidate before the deadline would nullify this recommendation.';
    } else {
      reason = `Waiting for Gameweek ${bestFutureGW} is projected to yield a higher captaincy score (+${bestFutureVal.toFixed(1)} points).`;
      sensitivity = 'If the scheduled double fixtures in future weeks change or key players suffer form dips, using the chip now could be safer.';
    }

    verdicts.push({
      chipCode: 'triplecaptain',
      verdict: tcVerdict,
      currentValue: tcNowVal,
      bestFutureGW,
      bestFutureValue: bestFutureVal,
      advantage: Math.round(tcAdvantage * 100) / 100,
      confidence: futureConfidence,
      reason,
      sensitivity
    });
  }

  // --- BENCH BOOST ENGINE ---
  if (chipState.benchboost) {
    // Current BB Value: actual user's 4 bench players
    const currentBench = userSquad.length === 15 ? userSquad.slice(11) : [];
    const bbNowVal = currentBench.reduce((acc, p) => acc + p.projected_points, 0);

    let bestFutureGW = currentGW;
    let bestFutureVal = bbNowVal;
    let futureConfidence: 'High' | 'Medium' | 'Low' = 'High';

    futureGWs.forEach((gw) => {
      const proj = calculateProjectedPoints(bootstrapData.elements, bootstrapData.teams, fixturesData, gw);
      
      // Bench Boost future opportunity uses the user's actual bench in future weeks as the baseline
      // (This is realistic since the user cannot completely overhaul all 4 bench players without using a Wildcard).
      const squadBenchProjs = userSquad.slice(11).map(saved => {
        const fresh = proj.players.find(p => p.id === saved.id);
        return fresh ? fresh.projected_points : 0;
      });
      const gwBBVal = squadBenchProjs.reduce((acc, pts) => acc + pts, 0);

      if (gwBBVal > bestFutureVal) {
        bestFutureVal = gwBBVal;
        bestFutureGW = gw;

        const gwAudit = fixturesAudit[gw] || { confidence: 1.0 };
        const horizonDist = gw - currentGW;
        if (gwAudit.confidence < 0.8 || horizonDist > 10) {
          futureConfidence = 'Low';
        } else if (gwAudit.confidence < 1.0 || horizonDist > 5) {
          futureConfidence = 'Medium';
        } else {
          futureConfidence = 'High';
        }
      }
    });

    const bbAdvantage = bbNowVal - bestFutureVal;
    const bbVerdict: 'USE NOW' | 'HOLD' = bbAdvantage > 0.0 ? 'USE NOW' : 'HOLD';

    let reason = '';
    let sensitivity = '';
    if (bbVerdict === 'USE NOW') {
      reason = `Your current bench is exceptionally healthy and has strong matchups, projecting to yield +${bbNowVal.toFixed(1)} points.`;
      sensitivity = 'If any of your bench players lose their starting positions or pick up last-minute knocks, hold the chip instead.';
    } else {
      reason = `Your current bench projects at +${bbNowVal.toFixed(1)} points. Waiting for Gameweek ${bestFutureGW} projects to yield +${bestFutureVal.toFixed(1)} points from your bench.`;
      sensitivity = 'Unexpected rotation or injuries to your bench players in the lead-up to the target week will reduce its advantage.';
    }

    verdicts.push({
      chipCode: 'benchboost',
      verdict: bbVerdict,
      currentValue: bbNowVal,
      bestFutureGW,
      bestFutureValue: bestFutureVal,
      advantage: Math.round(bbAdvantage * 100) / 100,
      confidence: futureConfidence,
      reason,
      sensitivity
    });
  }

  // --- FREE HIT ENGINE ---
  if (chipState.freehit) {
    // Current FH Value: difference between optimal Free Hit squad and current squad (no transfers)
    const currentBasePoints = userSquad.slice(0, 11).reduce((acc, p) => acc + p.projected_points, 0);
    
    // Calculate FH optimal points using ILP solver
    let fhNowVal = 0.0;
    try {
      const solverResult = solveSquad(allPlayers);
      if (solverResult.feasible) {
        fhNowVal = solverResult.totalProjectedPoints - currentBasePoints;
      }
    } catch (e) {
      console.warn('FH solver failed for current week:', e);
    }

    let bestFutureGW = currentGW;
    let bestFutureVal = fhNowVal;
    let futureConfidence: 'High' | 'Medium' | 'Low' = 'High';

    futureGWs.forEach((gw) => {
      const proj = calculateProjectedPoints(bootstrapData.elements, bootstrapData.teams, fixturesData, gw);
      
      // Calculate future base points of user's active starting 11 in gameweek gw
      const futureBasePoints = userSquad.slice(0, 11).reduce((acc, saved) => {
        const fresh = proj.players.find(p => p.id === saved.id);
        return acc + (fresh ? fresh.projected_points : 0);
      }, 0);

      let gwFHVal = 0.0;
      try {
        const solverResult = solveSquad(proj.players);
        if (solverResult.feasible) {
          gwFHVal = solverResult.totalProjectedPoints - futureBasePoints;
        }
      } catch (e) {
        console.warn(`FH solver failed for future week ${gw}:`, e);
      }

      if (gwFHVal > bestFutureVal) {
        bestFutureVal = gwFHVal;
        bestFutureGW = gw;

        const gwAudit = fixturesAudit[gw] || { confidence: 1.0 };
        const horizonDist = gw - currentGW;
        if (gwAudit.confidence < 0.8 || horizonDist > 10) {
          futureConfidence = 'Low';
        } else if (gwAudit.confidence < 1.0 || horizonDist > 5) {
          futureConfidence = 'Medium';
        } else {
          futureConfidence = 'High';
        }
      }
    });

    const fhAdvantage = fhNowVal - bestFutureVal;
    const fhVerdict: 'USE NOW' | 'HOLD' = fhAdvantage > 0.0 ? 'USE NOW' : 'HOLD';

    let reason = '';
    let sensitivity = '';
    if (fhVerdict === 'USE NOW') {
      reason = `A Free Hit now is projected to yield an immediate gain of +${fhNowVal.toFixed(1)} points over your current squad.`;
      sensitivity = 'If you have transfer plans that resolve your current squad weaknesses without using a chip, save it instead.';
    } else {
      reason = `A Free Hit now yields +${fhNowVal.toFixed(1)} points. Saving it for Gameweek ${bestFutureGW} (typically a blank/double week) is projected to generate +${bestFutureVal.toFixed(1)} points of incremental value.`;
      sensitivity = 'If the blank or double gameweeks are rescheduled or cancelled, the future value of the Free Hit will decrease.';
    }

    verdicts.push({
      chipCode: 'freehit',
      verdict: fhVerdict,
      currentValue: Math.round(fhNowVal * 100) / 100,
      bestFutureGW,
      bestFutureValue: Math.round(bestFutureVal * 100) / 100,
      advantage: Math.round(fhAdvantage * 100) / 100,
      confidence: futureConfidence,
      reason,
      sensitivity
    });
  }

  // --- WILDCARD ENGINE ---
  // Wildcard is split into first half (GW1-19) and second half (GW20-38)
  const isFirstHalf = currentGW <= 19;
  const isWcAvailable = isFirstHalf ? chipState.wildcard_1 : chipState.wildcard_2;

  if (isWcAvailable) {
    // 5-Gameweek Rolling Horizon Wildcard Approximation
    const horizon = 5;
    const endGW = Math.min(38, currentGW + horizon - 1);
    const actualHorizonLength = endGW - currentGW + 1;

    // Projection Confidence Weights (PCW) modelling assumptions
    const pcw = DEFAULT_PCW.slice(0, actualHorizonLength);

    // Strategy A: Current squad managed over rolling horizon (assume 1 FT roll-forward, mock simplified transfers)
    let yieldA = 0.0;
    let activeSquadForA = [...userSquad];

    for (let i = 0; i < actualHorizonLength; i++) {
      const gw = currentGW + i;
      const proj = calculateProjectedPoints(bootstrapData.elements, bootstrapData.teams, fixturesData, gw);
      
      // Calculate current points
      const gwPoints = activeSquadForA.slice(0, 11).reduce((acc, saved) => {
        const fresh = proj.players.find(p => p.id === saved.id);
        return acc + (fresh ? fresh.projected_points : 0);
      }, 0);
      yieldA += gwPoints * pcw[i];

      // Simulate a free transfer (swap lowest projected player for highest projected candidate of same type)
      if (i < actualHorizonLength - 1) {
        const nextProj = calculateProjectedPoints(bootstrapData.elements, bootstrapData.teams, fixturesData, gw + 1);
        
        // Find player in activeSquadForA with lowest projection
        let lowestPlayerIdx = 0;
        let lowestVal = 999.0;
        activeSquadForA.forEach((p, idx) => {
          const fresh = nextProj.players.find(x => x.id === p.id);
          const val = fresh ? fresh.projected_points : 0;
          if (val < lowestVal) {
            lowestVal = val;
            lowestPlayerIdx = idx;
          }
        });

        const targetPos = activeSquadForA[lowestPlayerIdx].element_type;
        const candidates = nextProj.players
          .filter(p => p.element_type === targetPos && !activeSquadForA.some(s => s.id === p.id))
          .sort((a, b) => b.projected_points - a.projected_points);

        if (candidates.length > 0) {
          activeSquadForA[lowestPlayerIdx] = candidates[0];
        }
      }
    }

    // Strategy B: Wildcard optimized squad managed over rolling horizon
    let yieldB = 0.0;
    
    // We construct a multi-week objective projection for each player
    const multiWeekScores = allPlayers.map((player) => {
      let totalWeightedVal = 0.0;
      for (let i = 0; i < actualHorizonLength; i++) {
        const gw = currentGW + i;
        const proj = calculateProjectedPoints(bootstrapData.elements, bootstrapData.teams, fixturesData, gw);
        const fresh = proj.players.find(p => p.id === player.id);
        const val = fresh ? fresh.projected_points : 0;
        totalWeightedVal += val * pcw[i];
      }
      return {
        ...player,
        projected_points: totalWeightedVal // Override point projection for solver
      };
    });

    let wcSquad: Player[] = [];
    try {
      const solverResult = solveSquad(multiWeekScores);
      if (solverResult.feasible) {
        wcSquad = solverResult.squad;
      }
    } catch (e) {
      console.warn('Wildcard solver failed:', e);
    }

    if (wcSquad.length === 15) {
      let activeSquadForB = [...wcSquad];
      for (let i = 0; i < actualHorizonLength; i++) {
        const gw = currentGW + i;
        const proj = calculateProjectedPoints(bootstrapData.elements, bootstrapData.teams, fixturesData, gw);
        
        const gwPoints = activeSquadForB.slice(0, 11).reduce((acc, saved) => {
          const fresh = proj.players.find(p => p.id === saved.id);
          return acc + (fresh ? fresh.projected_points : 0);
        }, 0);
        yieldB += gwPoints * pcw[i];

        // Simulate free transfers on Strategy B
        if (i < actualHorizonLength - 1) {
          const nextProj = calculateProjectedPoints(bootstrapData.elements, bootstrapData.teams, fixturesData, gw + 1);
          let lowestPlayerIdx = 0;
          let lowestVal = 999.0;
          activeSquadForB.forEach((p, idx) => {
            const fresh = nextProj.players.find(x => x.id === p.id);
            const val = fresh ? fresh.projected_points : 0;
            if (val < lowestVal) {
              lowestVal = val;
              lowestPlayerIdx = idx;
            }
          });

          const targetPos = activeSquadForB[lowestPlayerIdx].element_type;
          const candidates = nextProj.players
            .filter(p => p.element_type === targetPos && !activeSquadForB.some(s => s.id === p.id))
            .sort((a, b) => b.projected_points - a.projected_points);

          if (candidates.length > 0) {
            activeSquadForB[lowestPlayerIdx] = candidates[0];
          }
        }
      }
    }

    const wcNowVal = yieldB - yieldA;

    // Future value check (we look at rolling horizons starting at future gameweeks)
    // To keep performance high and avoid nested loops, we simulate the next 2 future swing horizons
    let bestFutureGW = currentGW;
    let bestFutureVal = wcNowVal;
    let futureConfidence: 'High' | 'Medium' | 'Low' = 'High';

    const testFutureGWs = futureGWs.filter(gw => gw <= currentGW + 4);

    testFutureGWs.forEach((futureStartGW) => {
      // Simulate Strategy A starting at futureStartGW
      let fYieldA = 0.0;
      let fActiveSquadA = [...userSquad];

      for (let i = 0; i < actualHorizonLength; i++) {
        const gw = futureStartGW + i;
        if (gw > 38) break;
        const proj = calculateProjectedPoints(bootstrapData.elements, bootstrapData.teams, fixturesData, gw);
        const gwPoints = fActiveSquadA.slice(0, 11).reduce((acc, saved) => {
          const fresh = proj.players.find(p => p.id === saved.id);
          return acc + (fresh ? fresh.projected_points : 0);
        }, 0);
        fYieldA += gwPoints * pcw[i];
      }

      // Simulate Strategy B (Wildcard) starting at futureStartGW
      let fYieldB = 0.0;
      const fMultiWeekScores = allPlayers.map((player) => {
        let totalWeightedVal = 0.0;
        for (let i = 0; i < actualHorizonLength; i++) {
          const gw = futureStartGW + i;
          if (gw > 38) break;
          const proj = calculateProjectedPoints(bootstrapData.elements, bootstrapData.teams, fixturesData, gw);
          const fresh = proj.players.find(p => p.id === player.id);
          const val = fresh ? fresh.projected_points : 0;
          totalWeightedVal += val * pcw[i];
        }
        return { ...player, projected_points: totalWeightedVal };
      });

      let fWcSquad: Player[] = [];
      try {
        const solverResult = solveSquad(fMultiWeekScores);
        if (solverResult.feasible) {
          fWcSquad = solverResult.squad;
        }
      } catch (e) {
        console.warn(`FH solver failed for future week ${futureStartGW}:`, e);
      }

      if (fWcSquad.length === 15) {
        let fActiveSquadB = [...fWcSquad];
        for (let i = 0; i < actualHorizonLength; i++) {
          const gw = futureStartGW + i;
          if (gw > 38) break;
          const proj = calculateProjectedPoints(bootstrapData.elements, bootstrapData.teams, fixturesData, gw);
          const gwPoints = fActiveSquadB.slice(0, 11).reduce((acc, saved) => {
            const fresh = proj.players.find(p => p.id === saved.id);
            return acc + (fresh ? fresh.projected_points : 0);
          }, 0);
          fYieldB += gwPoints * pcw[i];
        }
      }

      const fWcVal = fYieldB - fYieldA;
      if (fWcVal > bestFutureVal) {
        bestFutureVal = fWcVal;
        bestFutureGW = futureStartGW;

        const gwAudit = fixturesAudit[futureStartGW] || { confidence: 1.0 };
        if (gwAudit.confidence < 0.8) {
          futureConfidence = 'Low';
        } else if (gwAudit.confidence < 1.0) {
          futureConfidence = 'Medium';
        } else {
          futureConfidence = 'High';
        }
      }
    });

    // Handle expiry rules
    const wcAdvantage = wcNowVal - bestFutureVal;
    
    // A Wildcard must be used if it is expiring this week
    const wcVerdict: 'USE NOW' | 'HOLD' = (wcAdvantage > 0.0 || (isFirstHalf && currentGW === 19)) ? 'USE NOW' : 'HOLD';

    let reason = '';
    let sensitivity = '';
    if (wcVerdict === 'USE NOW') {
      reason = isFirstHalf && currentGW === 19 
        ? `This is the final Gameweek (GW19) to play your first-half Wildcard. You must play it now or it will be lost.` 
        : `A Wildcard restructure now is projected to yield +${wcNowVal.toFixed(1)} points of cumulative advantage over the next 5 weeks compared to standard transfer management.`;
      sensitivity = 'If your active squad is already in a strong position with good fixture ease, you can hold the chip.';
    } else {
      reason = `Your current squad is stable. Waiting until Gameweek ${bestFutureGW} to Wildcard is projected to yield +${bestFutureVal.toFixed(1)} points of cumulative advantage.`;
      sensitivity = 'An unexpected cluster of long-term injuries or red cards would make using the Wildcard immediately more valuable.';
    }

    verdicts.push({
      chipCode: 'wildcard',
      verdict: wcVerdict,
      currentValue: Math.round(wcNowVal * 100) / 100,
      bestFutureGW,
      bestFutureValue: Math.round(bestFutureVal * 100) / 100,
      advantage: Math.round(wcAdvantage * 100) / 100,
      confidence: futureConfidence,
      reason,
      sensitivity
    });
  }

  return verdicts;
}
