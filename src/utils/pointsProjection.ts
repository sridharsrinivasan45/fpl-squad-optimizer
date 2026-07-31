export interface Player {
  id: number;
  web_name: string;
  team: number;
  team_name: string;
  team_short_name: string;
  element_type: number; // 1: GK, 2: DEF, 3: MID, 4: FWD
  now_cost: number; // e.g. 55 = £5.5m (in tenths)
  form: number;
  total_points: number;
  chance_of_playing_next_round: number; // 0 to 100
  selected_by_percent: number;
  projected_points: number;
  fixtures: Array<{
    opponent: string;
    is_home: boolean;
    difficulty: number;
  }>;
}

export interface ProjectionResult {
  players: Player[];
  isPreSeason: boolean;
}

export function calculateProjectedPoints(
  elements: any[],
  teams: any[],
  fixtures: any[],
  currentGameweek: number
): ProjectionResult {
  const teamMap = new Map<number, { name: string; short_name: string }>();
  teams.forEach((t: any) => {
    teamMap.set(t.id, { name: t.name, short_name: t.short_name });
  });

  const gwFixtures = fixtures.filter((f: any) => f.event === currentGameweek);

  // Detect pre-season mode:
  // If the maximum form across all players is 0 (or extremely close, e.g. <= 0.05),
  // it means the season has not started or data has reset, and we should use points_per_game as base.
  let maxForm = 0;
  elements.forEach((el: any) => {
    const f = parseFloat(el.form) || 0;
    if (f > maxForm) maxForm = f;
  });
  
  const isPreSeason = maxForm <= 0.05;

  const players = elements.map((el: any) => {
    const teamId = el.team;
    const teamInfo = teamMap.get(teamId) || { name: 'Unknown', short_name: 'UNK' };
    
    const form = parseFloat(el.form) || 0;
    const ppg = parseFloat(el.points_per_game) || 0;
    
    // Fallback baseline to last season's Points Per Game (ppg) if in pre-season
    const basePoints = isPreSeason ? ppg : form;
    
    // Filter fixtures where this player's team is home or away
    const playerGwFixtures = gwFixtures.filter(
      (f: any) => f.team_h === teamId || f.team_a === teamId
    );

    // Default availability is 100% (1.0) if null/undefined
    const availability = el.chance_of_playing_next_round !== null && el.chance_of_playing_next_round !== undefined
      ? el.chance_of_playing_next_round / 100
      : 1.0;

    let projectedPoints = 0;
    const mappedFixtures = playerGwFixtures.map((f: any) => {
      const isHome = f.team_h === teamId;
      const opponentId = isHome ? f.team_a : f.team_h;
      const opponentInfo = teamMap.get(opponentId) || { name: 'Unknown', short_name: 'UNK' };
      const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;

      // Fixture Difficulty Rating (FDR) Multiplier:
      // FDR ranges from 1 to 5. 
      // Multiplier = (6 - FDR) / 3.5
      // Easy (FDR 1) -> 5/3.5 = 1.43
      // Medium (FDR 3) -> 3/3.5 = 0.86
      // Hard (FDR 5) -> 1/3.5 = 0.29
      const fdrMultiplier = (6 - difficulty) / 3.5;
      const fixtureProjection = basePoints * fdrMultiplier * availability;
      projectedPoints += fixtureProjection;

      return {
        opponent: opponentInfo.short_name,
        is_home: isHome,
        difficulty
      };
    });

    // Round to 2 decimal places
    projectedPoints = Math.round(projectedPoints * 100) / 100;

    return {
      id: el.id,
      web_name: el.web_name,
      team: el.team,
      team_name: teamInfo.name,
      team_short_name: teamInfo.short_name,
      element_type: el.element_type,
      now_cost: el.now_cost,
      form,
      total_points: el.total_points,
      chance_of_playing_next_round: el.chance_of_playing_next_round ?? 100,
      selected_by_percent: parseFloat(el.selected_by_percent) || 0,
      projected_points: projectedPoints,
      fixtures: mappedFixtures
    };
  });

  return {
    players,
    isPreSeason
  };
}
