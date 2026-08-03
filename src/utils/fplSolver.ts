import solver from 'javascript-lp-solver';
import type { Player } from './pointsProjection';

export interface SolverResult {
  feasible: boolean;
  squad: Player[];
  starters: Player[];
  bench: Player[];
  captain: Player | null;
  viceCaptain: Player | null;
  totalCost: number; // in millions, e.g. 98.5
  totalProjectedPoints: number; // sum of starting 11
  squadProjectedPoints: number; // sum of all 15
  alternatives: {
    selectedPlayerId: number;
    selectedPlayerName: string;
    alternativePlayerName: string;
    projectedPoints: number;
    selectedOwnership: number;
    alternativeOwnership: number;
    positionName: string;
  }[];
}

export interface SolverInterventions {
  forcedPlayerIds?: number[];
  excludedPlayerIds?: number[];
  customBudgetLimit?: number;
}

export function solveSquad(
  players: Player[],
  budget: number = 1000,
  interventions?: SolverInterventions
): SolverResult {
  // We only consider players with positive or zero projected points.
  // Filter out any players with invalid numbers or missing info.
  const validPlayers = players.filter(
    (p) => 
      p.id && 
      p.web_name && 
      p.now_cost > 0 && 
      !isNaN(p.projected_points)
  );

  const finalBudget = interventions?.customBudgetLimit !== undefined 
    ? interventions.customBudgetLimit 
    : budget;

  const model: any = {
    optimize: 'points',
    opType: 'max',
    constraints: {
      cost: { max: finalBudget }, // Total cost of squad <= budget limit
      squad_size: { equal: 15 },
      gk_sq: { equal: 2 },
      def_sq: { equal: 5 },
      mid_sq: { equal: 5 },
      fwd_sq: { equal: 3 },

      starter_size: { equal: 11 },
      gk_st: { equal: 1 },
      def_st: { min: 3, max: 5 },
      mid_st: { min: 2, max: 5 },
      fwd_st: { min: 1, max: 3 },
    },
    variables: {},
    ints: {},
  };

  // Add team constraints to ensure max 3 players from any single club in the 15-player squad
  const uniqueTeams = Array.from(new Set(validPlayers.map((p) => p.team)));
  uniqueTeams.forEach((teamId) => {
    model.constraints[`team_${teamId}`] = { max: 3 };
  });

  validPlayers.forEach((p) => {
    const sVar = `s_${p.id}`;       // Squad variable (x_i)
    const startVar = `start_${p.id}`;// Starter variable (y_i)
    
    // Add individual player binary limits (s_i <= 1, start_i <= 1)
    let sConstraint = { max: 1 };
    if (interventions?.forcedPlayerIds?.includes(p.id)) {
      sConstraint = { equal: 1 } as any;
    } else if (interventions?.excludedPlayerIds?.includes(p.id)) {
      sConstraint = { equal: 0 } as any;
    }
    model.constraints[sVar] = sConstraint;
    model.constraints[startVar] = { max: 1 };
    
    // Linking constraint: start_i - s_i <= 0 (y_i <= x_i)
    const linkName = `link_${p.id}`;
    model.constraints[linkName] = { max: 0 };
    
    // Epsilon tie-breaker:
    // Add a tiny value based on lower ownership to the projected points.
    // Epsilon range: [0, 0.00001]. Lower ownership % -> larger epsilon.
    const ownershipFraction = p.selected_by_percent / 100;
    const epsilon = (1 - ownershipFraction) * 0.00001;
    const adjustedPoints = p.projected_points + epsilon;

    // Variable definition for s_i (squad choice):
    // In objective, x_i points coefficient is 0.15 * adjustedPoints.
    const squadVarObj: any = {
      points: 0.15 * adjustedPoints,
      cost: p.now_cost,
      squad_size: 1,
      [sVar]: 1,
      [`team_${p.team}`]: 1,
      [linkName]: -1,
    };

    // Variable definition for start_i (starter choice):
    // In objective, y_i points coefficient is 0.85 * adjustedPoints.
    const starterVarObj: any = {
      points: 0.85 * adjustedPoints,
      starter_size: 1,
      [startVar]: 1,
      [linkName]: 1,
    };

    // Position mapping for squad variable
    if (p.element_type === 1) squadVarObj.gk_sq = 1;
    else if (p.element_type === 2) squadVarObj.def_sq = 1;
    else if (p.element_type === 3) squadVarObj.mid_sq = 1;
    else if (p.element_type === 4) squadVarObj.fwd_sq = 1;

    // Position mapping for starter variable
    if (p.element_type === 1) starterVarObj.gk_st = 1;
    else if (p.element_type === 2) starterVarObj.def_st = 1;
    else if (p.element_type === 3) starterVarObj.mid_st = 1;
    else if (p.element_type === 4) starterVarObj.fwd_st = 1;

    model.variables[sVar] = squadVarObj;
    model.variables[startVar] = starterVarObj;
    
    model.ints[sVar] = 1;
    model.ints[startVar] = 1;
  });

  // Solve model
  const solution = solver.Solve(model);

  if (!solution.feasible) {
    return {
      feasible: false,
      squad: [],
      starters: [],
      bench: [],
      captain: null,
      viceCaptain: null,
      totalCost: 0,
      totalProjectedPoints: 0,
      squadProjectedPoints: 0,
      alternatives: [],
    };
  }

  // Extract selected squad, starters, and bench
  const squad: Player[] = [];
  const starters: Player[] = [];
  const bench: Player[] = [];

  validPlayers.forEach((p) => {
    const sVar = `s_${p.id}`;
    const startVar = `start_${p.id}`;
    if (solution[sVar] === 1) {
      squad.push(p);
      if (solution[startVar] === 1) {
        starters.push(p);
      } else {
        bench.push(p);
      }
    }
  });

  // Sort starters and full squad by position then by projected points descending
  // GK (1) -> DEF (2) -> MID (3) -> FWD (4)
  const sortByPositionAndPoints = (a: Player, b: Player) => {
    if (a.element_type !== b.element_type) {
      return a.element_type - b.element_type;
    }
    return b.projected_points - a.projected_points;
  };

  starters.sort(sortByPositionAndPoints);
  squad.sort(sortByPositionAndPoints);

  // Enforce auto-sub priority sorting for the bench:
  // Split bench into goalkeeper and outfielders
  const benchGK = bench.filter((p) => p.element_type === 1);
  const benchOutfield = bench.filter((p) => p.element_type !== 1);

  // Sort outfielders by projected points descending (primary),
  // and by chance_of_playing_next_round descending (secondary tie-breaker)
  benchOutfield.sort((a, b) => {
    if (b.projected_points !== a.projected_points) {
      return b.projected_points - a.projected_points;
    }
    return b.chance_of_playing_next_round - a.chance_of_playing_next_round;
  });

  // Recombine: outfielders first (representing Bench 1, 2, 3), followed by the Goalkeeper (representing Reserve GK)
  const sortedBench = [...benchOutfield, ...benchGK];

  // Calculate totals
  const totalCost = squad.reduce((acc, p) => acc + p.now_cost, 0) / 10;
  const totalProjectedPoints = Math.round(starters.reduce((acc, p) => acc + p.projected_points, 0) * 100) / 100;
  const squadProjectedPoints = Math.round(squad.reduce((acc, p) => acc + p.projected_points, 0) * 100) / 100;

  // Determine Captain and Vice-Captain from starters
  const sortedByProjection = [...starters].sort((a, b) => {
    if (a.projected_points !== b.projected_points) {
      return b.projected_points - a.projected_points;
    }
    return a.selected_by_percent - b.selected_by_percent; // lower ownership first
  });

  const captain = sortedByProjection[0] || null;
  const viceCaptain = sortedByProjection[1] || null;

  // Scan for squad selection tie-breaker alternatives
  const alternatives: SolverResult['alternatives'] = [];
  const positionNames: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

  squad.forEach((selectedPlayer) => {
    // Find players of the same position, with the EXACT same projected points, who were NOT selected in the squad
    const tiedOthers = validPlayers.filter(
      (p) =>
        p.element_type === selectedPlayer.element_type &&
        p.id !== selectedPlayer.id &&
        p.projected_points === selectedPlayer.projected_points &&
        !squad.some((s) => s.id === p.id)
    );

    tiedOthers.forEach((altPlayer) => {
      if (selectedPlayer.selected_by_percent <= altPlayer.selected_by_percent) {
        alternatives.push({
          selectedPlayerId: selectedPlayer.id,
          selectedPlayerName: selectedPlayer.web_name,
          alternativePlayerName: altPlayer.web_name,
          projectedPoints: selectedPlayer.projected_points,
          selectedOwnership: selectedPlayer.selected_by_percent,
          alternativeOwnership: altPlayer.selected_by_percent,
          positionName: positionNames[selectedPlayer.element_type] || 'Player',
        });
      }
    });
  });

  return {
    feasible: true,
    squad,
    starters,
    bench: sortedBench,
    captain,
    viceCaptain,
    totalCost,
    totalProjectedPoints,
    squadProjectedPoints,
    alternatives,
  };
}
