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
  confidence?: number;
  starts?: number;
  minutes?: number;
  isPromoted?: boolean;
  penalties_order?: number | null;
  direct_freekicks_order?: number | null;
  corners_and_indirect_freekicks_order?: number | null;
  breakdown?: {
    baseProjection: number;
    fixtureAdjustment: number; // average FDR adjustment percent (e.g. 10 for +10%)
    homeAdvantage: number;     // home bonus percent (e.g. 5 for +5%)
    playingProbabilityAdjustment: number; // playing probability percent (e.g. 98 for 98%)
    finalProjection: number;
    confidenceScore: number;
  };
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
  // If the maximum form across all players is <= 0.05, we are in pre-season.
  let maxForm = 0;
  elements.forEach((el: any) => {
    const f = parseFloat(el.form) || 0;
    if (f > maxForm) maxForm = f;
  });
  const isPreSeason = maxForm <= 0.05;

  // Calculate matches available per team (finished fixtures) in the current season
  const matchesAvailableMap = new Map<number, number>();
  teams.forEach((t: any) => {
    const teamFinishedFixtures = fixtures.filter(
      (f: any) => (f.team_h === t.id || f.team_a === t.id) && f.finished === true
    );
    matchesAvailableMap.set(t.id, teamFinishedFixtures.length);
  });

  // Identify promoted teams dynamically (where average player points_per_game is < 0.8 in pre-season)
  const promotedTeams = new Set<number>();
  teams.forEach((t: any) => {
    const teamPlayers = elements.filter((el: any) => el.team === t.id);
    const avgPPG = teamPlayers.reduce((acc, el) => acc + (parseFloat(el.points_per_game) || 0), 0) / Math.max(1, teamPlayers.length);
    if (avgPPG < 0.8) {
      promotedTeams.add(t.id);
    }
  });

  // Pass 1: Build player objects, calculate base projection, and estimate initial playing probability
  const playerTempData = elements.map((el: any) => {
    const teamId = el.team;
    const teamInfo = teamMap.get(teamId) || { name: 'Unknown', short_name: 'UNK' };
    
    const form = parseFloat(el.form) || 0;
    const ppg = parseFloat(el.points_per_game) || 0;

    // Transition weight w: blends from 1.0 (pre-season) to 0.0 (5+ matches played)
    const matchesAvailable = matchesAvailableMap.get(teamId) || 0;
    const w = Math.max(0, 1 - (matchesAvailable / 5));

    // Blended baseline points:
    // If a player has no historical points_per_game (e.g. promoted/new), estimate baseline using FPL price
    let estimatedPpg = ppg;
    if (ppg === 0) {
      const posMapDefaults = { 1: 2.5, 2: 2.0, 3: 2.5, 4: 3.0 };
      const defaultPosPPG = posMapDefaults[el.element_type as keyof typeof posMapDefaults] || 2.5;
      const costEstimatePPG = el.now_cost / 20;
      estimatedPpg = Math.max(defaultPosPPG, costEstimatePPG);
    }

    const basePoints = w * estimatedPpg + (1 - w) * form;
    
    const playerGwFixtures = gwFixtures.filter(
      (f: any) => f.team_h === teamId || f.team_a === teamId
    );

    // Calculate Base Projections & Adjustments
    let totalBaseProjection = 0;
    let totalFdrMultiplier = 0;
    let totalHomeMultiplier = 0;
    let totalPromotedMultiplier = 0;
    let totalAdjustedProjection = 0;

    const mappedFixtures = playerGwFixtures.map((f: any) => {
      const isHome = f.team_h === teamId;
      const opponentId = isHome ? f.team_a : f.team_h;
      const opponentInfo = teamMap.get(opponentId) || { name: 'Unknown', short_name: 'UNK' };
      const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;

      // 1. FDR difficulty multiplier:
      // Pre-season: 1: +20%, 2: +10%, 3: 0%, 4: -10%, 5: -20%
      const fdrPreSeasonMap: Record<number, number> = { 1: 1.20, 2: 1.10, 3: 1.00, 4: 0.90, 5: 0.80 };
      const fdrPreSeason = fdrPreSeasonMap[difficulty] || 1.00;
      
      // In-season: (6 - FDR) / 3.5
      const fdrInSeason = (6 - difficulty) / 3.5;
      
      // Blended FDR multiplier
      const fdrMultiplier = w * fdrPreSeason + (1 - w) * fdrInSeason;

      // 2. Home advantage multiplier (+5% in pre-season, blends to 1.00 in-season)
      const homeBonus = isHome ? 1.05 : 1.00;
      const homeMultiplier = w * homeBonus + (1 - w) * 1.00;

      // 3. Promoted team reduction (20% reduction in pre-season, blends to 1.00 in-season)
      const isPromoted = promotedTeams.has(teamId);
      const promotedDiscount = isPromoted ? 0.80 : 1.00;
      const promotedMultiplier = w * promotedDiscount + (1 - w) * 1.00;

      // Accumulate raw and adjusted totals
      totalBaseProjection += basePoints;
      totalFdrMultiplier += fdrMultiplier;
      totalHomeMultiplier += homeMultiplier;
      totalPromotedMultiplier += promotedMultiplier;

      const fixtureProjection = basePoints * fdrMultiplier * homeMultiplier * promotedMultiplier;
      totalAdjustedProjection += fixtureProjection;

      return {
        opponent: opponentInfo.short_name,
        is_home: isHome,
        difficulty
      };
    });

    // STEP 1 & 2: Playing Probability Initial Estimate
    let playingProbability = 1.0;
    if (el.chance_of_playing_next_round !== null && el.chance_of_playing_next_round !== undefined) {
      playingProbability = el.chance_of_playing_next_round / 100;
    } else {
      if (matchesAvailable > 0) {
        // In-season estimation using active statistics
        const teamMinutes = matchesAvailable * 90;
        const minutesRatio = Math.max(0, Math.min(1.0, el.minutes / teamMinutes));
        const startsRatio = Math.max(0, Math.min(1.0, el.starts / matchesAvailable));
        
        playingProbability = 0.20 + 0.50 * minutesRatio + 0.30 * startsRatio;
        playingProbability = Math.max(0.05, Math.min(1.00, playingProbability));
      } else {
        // Pre-season: Estimate using last season's totals (assume 38 matches / 3420 team minutes)
        const lastSeasonMinutes = el.minutes || 0;
        const lastSeasonStarts = el.starts || 0;
        
        const minutesRatio = Math.max(0, Math.min(1.0, lastSeasonMinutes / 3420));
        const startsRatio = Math.max(0, Math.min(1.0, lastSeasonStarts / 38));
        
        playingProbability = 0.20 + 0.50 * minutesRatio + 0.30 * startsRatio;
        playingProbability = Math.max(0.05, Math.min(1.00, playingProbability));
      }
    }

    const avgMinutes = matchesAvailable > 0 ? el.minutes / matchesAvailable : (el.starts > 0 ? el.minutes / el.starts : 90);

    return {
      el,
      teamId,
      teamInfo,
      form,
      ppg,
      basePoints,
      totalBaseProjection,
      avgFdrMultiplier: playerGwFixtures.length > 0 ? totalFdrMultiplier / playerGwFixtures.length : 1.0,
      avgHomeMultiplier: playerGwFixtures.length > 0 ? totalHomeMultiplier / playerGwFixtures.length : 1.0,
      avgPromotedMultiplier: playerGwFixtures.length > 0 ? totalPromotedMultiplier / playerGwFixtures.length : 1.0,
      totalAdjustedProjection,
      mappedFixtures,
      playingProbability,
      avgMinutes,
      matchesAvailable,
      w
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
    // Sort goalkeepers by: minutes played (last season in pre-season, current season in-season), then now_cost, then selection percentage
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

    // Exception check:
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

  // Pass 3: Adjust probabilities, compute confidence score, and build final expected points
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

    // STEP 6: Final expected points calculation
    const expectedPoints = Math.round(p.totalAdjustedProjection * prob * 100) / 100;

    // Calculate confidence score (0-100)
    // 1. Playing Probability (40%)
    const probFactor = prob * 40;
    
    // 2. Previous-Season / Current-Season Minutes (30%)
    const minutesRef = p.matchesAvailable > 0 ? (p.matchesAvailable * 90) : 3000;
    const minutesFactor = Math.min(1.0, p.el.minutes / minutesRef) * 30;
    
    // 3. Injury Status (20%)
    const statusFactor = p.el.status === 'a' ? 20 : p.el.status === 'd' ? 10 : 0;
    
    // 4. Sample Size (Starts) (10%)
    const startsRef = p.matchesAvailable > 0 ? p.matchesAvailable : 30;
    const sampleFactor = Math.min(1.0, p.el.starts / startsRef) * 10;

    const confidenceScore = Math.min(100, Math.max(0, Math.round(probFactor + minutesFactor + statusFactor + sampleFactor)));

    // Adjustments percentages for the breakdown summary
    const fixtureAdjustmentPercent = Math.round((p.avgFdrMultiplier * p.avgPromotedMultiplier - 1) * 100);
    const homeAdvantagePercent = Math.round((p.avgHomeMultiplier - 1) * 100);

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
      news: p.el.news || '',
      confidence: confidenceScore,
      starts: p.el.starts,
      minutes: p.el.minutes,
      isPromoted: promotedTeams.has(p.teamId),
      penalties_order: p.el.penalties_order,
      direct_freekicks_order: p.el.direct_freekicks_order,
      corners_and_indirect_freekicks_order: p.el.corners_and_indirect_freekicks_order,
      breakdown: {
        baseProjection: Math.round(p.totalBaseProjection * 100) / 100,
        fixtureAdjustment: fixtureAdjustmentPercent,
        homeAdvantage: homeAdvantagePercent,
        playingProbabilityAdjustment: Math.round(prob * 100),
        finalProjection: expectedPoints,
        confidenceScore
      }
    };
  });

  return {
    players,
    isPreSeason
  };
}
