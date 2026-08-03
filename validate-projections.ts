import { calculateProjectedPoints } from './src/utils/pointsProjection';

async function run() {
  const bootstrapUrl = 'https://fantasy.premierleague.com/api/bootstrap-static/';
  const fixturesUrl = 'https://fantasy.premierleague.com/api/fixtures/';
  
  console.log('Fetching live FPL database for validation...');
  try {
    const bootstrapRes = await fetch(bootstrapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });
    const bootstrapData = await bootstrapRes.json();

    const fixturesRes = await fetch(fixturesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });
    const fixturesData = await fixturesRes.json();

    const currentEvent = bootstrapData.events.find((e: any) => e.is_current) 
                      || bootstrapData.events.find((e: any) => e.is_next) 
                      || bootstrapData.events[0];
    const gwId = currentEvent ? currentEvent.id : 1;

    console.log(`Analyzing Gameweek ${gwId}`);

    // Calculate Old Projections (inline old logic)
    const oldPlayers = bootstrapData.elements.map((el: any) => {
      const teamId = el.team;
      const form = parseFloat(el.form) || 0;
      const ppg = parseFloat(el.points_per_game) || 0;
      
      // Pre-season check
      let maxForm = 0;
      bootstrapData.elements.forEach((e: any) => {
        const f = parseFloat(e.form) || 0;
        if (f > maxForm) maxForm = f;
      });
      const isPreSeason = maxForm <= 0.05;
      const basePoints = isPreSeason ? ppg : form;

      const gwFixtures = fixturesData.filter((f: any) => f.event === gwId);
      const playerGwFixtures = gwFixtures.filter((f: any) => f.team_h === teamId || f.team_a === teamId);

      let projectedPoints = 0;
      playerGwFixtures.forEach((f: any) => {
        const isHome = f.team_h === teamId;
        const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
        const fdrMultiplier = (6 - difficulty) / 3.5;
        projectedPoints += basePoints * fdrMultiplier;
      });

      const availability = el.chance_of_playing_next_round !== null && el.chance_of_playing_next_round !== undefined
        ? el.chance_of_playing_next_round / 100
        : 1.0;

      return {
        id: el.id,
        web_name: el.web_name,
        projected_points: Math.round(projectedPoints * availability * 100) / 100
      };
    });

    // Calculate New Projections (live)
    const newProjection = calculateProjectedPoints(
      bootstrapData.elements,
      bootstrapData.teams,
      fixturesData,
      gwId
    );

    // Identify target players for validation comparisons
    const targets = [
      { name: 'Raya', label: 'Starting Goalkeeper (Arsenal)' },
      { name: 'Arrizabalaga', label: 'Backup Goalkeeper (Arsenal)' },
      { name: 'Gabriel', label: 'Nailed Defender (Arsenal)' },
      { name: 'Calafiori', label: 'Rotation/Substitute Defender (Arsenal)' }
    ];

    // Find some injured players with active news
    const injuredInDb = bootstrapData.elements.filter(
      (el: any) => el.status !== 'a' && el.chance_of_playing_next_round !== null && el.chance_of_playing_next_round < 100
    );
    if (injuredInDb.length > 0) {
      targets.push({
        name: injuredInDb[0].web_name,
        label: `Injured/Doubtful Player (Status: ${injuredInDb[0].status}, News: ${injuredInDb[0].news})`
      });
    }

    console.log('\n==================================================');
    console.log('PRE-SEASON COMPARISON (Live Data)');
    console.log('==================================================');

    targets.forEach(t => {
      const el = bootstrapData.elements.find((p: any) => p.web_name.toLowerCase().includes(t.name.toLowerCase()));
      if (!el) return;

      const oldProj = oldPlayers.find((p: any) => p.id === el.id);
      const newProj = newProjection.players.find((p: any) => p.id === el.id);

      if (!oldProj || !newProj) return;

      console.log(`\nPlayer: ${el.web_name} (${t.label})`);
      console.log(`- Status: "${el.status}" | News: "${el.news || 'None'}"`);
      console.log(`- Stats: Minutes: ${el.minutes} | Starts: ${el.starts} | PPG: ${el.points_per_game}`);
      console.log(`- Chance of Playing: ${el.chance_of_playing_next_round ?? 'Null'}`);
      console.log(`- OLD Projection: ${oldProj.projected_points} pts`);
      console.log(`- NEW Projection: ${newProj.projected_points} pts`);
    });

    console.log('\n==================================================');
    console.log('SIMULATED IN-SEASON VALIDATION COMPARISON (Matches Played = 10)');
    console.log('==================================================');

    // We manually simulate mid-season stats for 10 matches (team minutes = 900)
    // 1. Nailed Defender (Gabriel): played 900 minutes, started 10 matches. Status "a", News "None", base projection = 5.0
    // 2. Rotation Midfielder (Jorginho): played 400 minutes, started 3 matches. Status "a", News "None", base projection = 4.0
    // 3. Injured Player (Doubtful defender): played 800 minutes, started 9 matches, chance of playing = null, status "d" (knock), base projection = 6.0
    // 4. Starting GK (Raya): minutes = 900, starts = 10, status "a", base = 5.0
    // 5. Backup GK (Arrizabalaga): minutes = 0, starts = 0, status "a", base = 5.0

    const mockFixturesCount = 10;
    const mockTeamMinutes = mockFixturesCount * 90;

    const mockScenarios = [
      {
        name: 'Raya (Starting GK)',
        element_type: 1,
        minutes: 900,
        starts: 10,
        chance: null,
        status: 'a',
        baseProjection: 5.0,
        gkRank: 1
      },
      {
        name: 'Arrizabalaga (Backup GK)',
        element_type: 1,
        minutes: 0,
        starts: 0,
        chance: null,
        status: 'a',
        baseProjection: 5.0,
        gkRank: 2
      },
      {
        name: 'Gabriel (Nailed DEF)',
        element_type: 2,
        minutes: 900,
        starts: 10,
        chance: null,
        status: 'a',
        baseProjection: 5.0
      },
      {
        name: 'Jorginho (Rotation MID)',
        element_type: 3,
        minutes: 400,
        starts: 3,
        chance: null,
        status: 'a',
        baseProjection: 4.0
      },
      {
        name: 'Injured Star (Status d / Knock)',
        element_type: 4,
        minutes: 810,
        starts: 9,
        chance: null,
        status: 'd',
        baseProjection: 6.0
      }
    ];

    mockScenarios.forEach(m => {
      // Calculate Step 1 & 2 playing probability
      let prob = 1.0;
      if (m.chance !== null) {
        prob = m.chance / 100;
      } else {
        const minutesRatio = m.minutes / mockTeamMinutes;
        const startsRatio = m.starts / mockFixturesCount;
        prob = 0.20 + 0.50 * minutesRatio + 0.30 * startsRatio;
        prob = Math.max(0.05, Math.min(1.00, prob));
      }

      console.log(`\nPlayer: ${m.name}`);
      console.log(`- Input Stats: Minutes: ${m.minutes}/${mockTeamMinutes} | Starts: ${m.starts}/${mockFixturesCount}`);
      console.log(`- Pre-adjust probability: ${prob.toFixed(3)}`);

      // Goalkeeper Override
      if (m.element_type === 1) {
        if (m.gkRank === 1) {
          prob = Math.max(prob, 0.98);
          console.log(`  * GK #1 override applied -> ${prob.toFixed(3)}`);
        } else if (m.gkRank === 2) {
          prob = Math.min(prob, 0.05);
          console.log(`  * GK #2 override applied -> ${prob.toFixed(3)}`);
        }
      }

      // Status adjustment
      let statusFactor = 1.0;
      if (m.status === 'a') statusFactor = 1.0;
      else if (m.status === 'd') statusFactor = 0.75;
      else if (m.status === 'i') statusFactor = 0.30;
      else if (m.status === 's') statusFactor = 0.00;
      prob *= statusFactor;
      console.log(`  * Status adjustment ("${m.status}" -> x${statusFactor}) -> ${prob.toFixed(3)}`);

      // Late sub penalty
      const avgMinutes = m.minutes / mockFixturesCount;
      if (avgMinutes < 45) {
        prob *= 0.70;
        console.log(`  * Late sub penalty (Avg Mins: ${avgMinutes} < 45 -> x0.70) -> ${prob.toFixed(3)}`);
      }

      const finalExpectedPoints = Math.round(m.baseProjection * prob * 100) / 100;
      const oldOldPoints = Math.round(m.baseProjection * (m.chance !== null ? m.chance / 100 : 1.0) * 100) / 100;

      console.log(`- Base Projection: ${m.baseProjection} pts`);
      console.log(`- OLD Projection (no probability adjustments): ${oldOldPoints} pts`);
      console.log(`- NEW Expected Points: ${finalExpectedPoints} pts`);
    });

  } catch (err: any) {
    console.error('Validation script execution failed:', err.message);
  }
}

run();
