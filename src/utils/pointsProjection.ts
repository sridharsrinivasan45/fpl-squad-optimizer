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
  status: string;
  news: string;
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
  // If the maximum form across all players is <= 0.05, we fallback to points_per_game.
  let maxForm = 0;
  elements.forEach((el: any) => {
    const f = parseFloat(el.form) || 0;
    if (f > maxForm) maxForm = f;
  });
  const isPreSeason = maxForm <= 0.05;

  // Calculate matches available per team (finished fixtures)
  const matchesAvailableMap = new Map<number, number>();
  teams.forEach((t: any) => {
    const teamFinishedFixtures = fixtures.filter(
      (f: any) => (f.team_h === t.id || f.team_a === t.id) && f.finished === true
    );
    matchesAvailableMap.set(t.id, teamFinishedFixtures.length);
  });

  // Pass 1: Build player objects, calculate base projection, and estimate initial playing probability
  const playerTempData = elements.map((el: any) => {
    const teamId = el.team;
    const teamInfo = teamMap.get(teamId) || { name: 'Unknown', short_name: 'UNK' };
    
    const form = parseFloat(el.form) || 0;
    const ppg = parseFloat(el.points_per_game) || 0;
    const basePoints = isPreSeason ? ppg : form;
    
    const playerGwFixtures = gwFixtures.filter(
      (f: any) => f.team_h === teamId || f.team_a === teamId
    );

    // Calculate Base Projection (sum of fixture projections without probability factor)
    let baseProjection = 0;
    const mappedFixtures = playerGwFixtures.map((f: any) => {
      const isHome = f.team_h === teamId;
      const opponentId = isHome ? f.team_a : f.team_h;
      const opponentInfo = teamMap.get(opponentId) || { name: 'Unknown', short_name: 'UNK' };
      const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;

      // FDR difficulty multiplier:
      // Multiplier = (6 - FDR) / 3.5
      const fdrMultiplier = (6 - difficulty) / 3.5;
      const fixtureProjection = basePoints * fdrMultiplier;
      baseProjection += fixtureProjection;

      return {
        opponent: opponentInfo.short_name,
        is_home: isHome,
        difficulty
      };
    });

    const matchesAvailable = matchesAvailableMap.get(teamId) || 0;
    
    // STEP 1 & 2: Playing Probability Initial Estimate
    let playingProbability = 1.0;
    if (el.chance_of_playing_next_round !== null && el.chance_of_playing_next_round !== undefined) {
      playingProbability = el.chance_of_playing_next_round / 100;
    } else {
      if (matchesAvailable > 0) {
        const teamMinutes = matchesAvailable * 90;
        const minutesRatio = Math.max(0, Math.min(1.0, el.minutes / teamMinutes));
        const startsRatio = Math.max(0, Math.min(1.0, el.starts / matchesAvailable));
        
        playingProbability = 0.20 + 0.50 * minutesRatio + 0.30 * startsRatio;
        playingProbability = Math.max(0.05, Math.min(1.00, playingProbability));
      } else {
        // Pre-season fallback
        playingProbability = 1.0;
      }
    }

    const avgMinutes = matchesAvailable > 0 ? el.minutes / matchesAvailable : 90;

    return {
      el,
      teamId,
      teamInfo,
      form,
      ppg,
      baseProjection,
      mappedFixtures,
      playingProbability,
      avgMinutes,
      matchesAvailable
    };
  });

  // Pass 2: Apply Goalkeeper Overrides (Step 3) per team
  const gkOverrides = new Map<number, number>();

  // Group goalkeepers by team
  const gksByTeam = new Map<number, typeof playerTempData>();
  playerTempData.forEach(p => {
    if (p.el.element_type === 1) {
      const list = gksByTeam.get(p.teamId) || [];
      list.push(p);
      gksByTeam.set(p.teamId, list);
    }
  });

  gksByTeam.forEach((gks) => {
    // Sort goalkeepers by: minutes played, then now_cost, then selected_by_percent
    gks.sort((a, b) => {
      if (b.el.minutes !== a.el.minutes) {
        return b.el.minutes - a.el.minutes;
      }
      if (b.el.now_cost !== a.el.now_cost) {
        return b.el.now_cost - a.el.now_cost;
      }
      return parseFloat(b.el.selected_by_percent) - parseFloat(a.el.selected_by_percent);
    });

    const gk1 = gks[0];
    const gk2 = gks[1];
    const gkOthers = gks.slice(2);

    // Exception:
    // If the second goalkeeper has played more minutes than the first over the last 5 league matches,
    // do NOT apply this override.
    // Proxy: we check if matchesAvailable >= 5 and the form of gk2 is strictly higher than gk1.
    const skipOverride = gk2 && (gk1.matchesAvailable >= 5) && (gk2.form > gk1.form);

    if (!skipOverride) {
      if (gk1) {
        gkOverrides.set(gk1.el.id, Math.max(gk1.playingProbability, 0.98));
      }
      if (gk2) {
        gkOverrides.set(gk2.el.id, Math.min(gk2.playingProbability, 0.05));
      }
      gkOthers.forEach(g => {
        gkOverrides.set(g.el.id, 0.01);
      });
    }
  });

  // Pass 3: Adjust probabilities and calculate final expected points
  const players = playerTempData.map(p => {
    let prob = p.playingProbability;

    // Apply goalkeeper override if applicable
    if (p.el.element_type === 1 && gkOverrides.has(p.el.id)) {
      prob = gkOverrides.get(p.el.id)!;
    }

    // STEP 4: Status adjustments
    let statusAdjustment = 1.0;
    if (p.el.status === 'a') statusAdjustment = 1.0;
    else if (p.el.status === 'd') statusAdjustment = 0.75;
    else if (p.el.status === 'i') statusAdjustment = 0.30;
    else if (p.el.status === 's') statusAdjustment = 0.00;

    prob *= statusAdjustment;
    prob = Math.max(0, Math.min(1.0, prob));

    // STEP 5: Late substitute penalty
    if (p.avgMinutes < 45) {
      prob *= 0.70;
    }

    // STEP 6: Final Expected Points
    const expectedPoints = Math.round(p.baseProjection * prob * 100) / 100;

    return {
      id: p.el.id,
      web_name: p.el.web_name,
      team: p.el.team,
      team_name: p.teamInfo.name,
      team_short_name: p.teamInfo.short_name,
      element_type: p.el.element_type,
      now_cost: p.el.now_cost,
      form: p.form,
      total_points: p.el.total_points,
      chance_of_playing_next_round: p.el.chance_of_playing_next_round ?? 100,
      selected_by_percent: parseFloat(p.el.selected_by_percent) || 0,
      projected_points: expectedPoints,
      fixtures: p.mappedFixtures,
      status: p.el.status || 'a',
      news: p.el.news || ''
    };
  });

  return {
    players,
    isPreSeason
  };
}
