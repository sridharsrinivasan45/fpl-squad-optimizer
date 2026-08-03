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
    console.log('PRE-SEASON COMPARISON (Live Data with Breakdown)');
    console.log('==================================================');

    targets.forEach(t => {
      const el = bootstrapData.elements.find((p: any) => p.web_name.toLowerCase().includes(t.name.toLowerCase()));
      if (!el) return;

      const newProj = newProjection.players.find((p: any) => p.id === el.id);

      if (!newProj || !newProj.breakdown) return;

      console.log(`\nPlayer: ${el.web_name} (${t.label})`);
      console.log(`- Status: "${el.status}" | News: "${el.news || 'None'}"`);
      console.log(`- Stats: Minutes (last season): ${el.minutes} | Starts (last season): ${el.starts} | PPG: ${el.points_per_game}`);
      console.log(`- Chance of Playing next GW: ${el.chance_of_playing_next_round ?? 'Null'}`);
      console.log(`- Breakdown Details:`);
      console.log(`  * Base Projection (historical PPG): ${newProj.breakdown.baseProjection} pts`);
      console.log(`  * Fixture Difficulty/Promoted Adj: ${newProj.breakdown.fixtureAdjustment}%`);
      console.log(`  * Home Advantage Bonus: ${newProj.breakdown.homeAdvantage}%`);
      console.log(`  * Playing Probability Factor: ${newProj.breakdown.playingProbabilityAdjustment}%`);
      console.log(`  * Confidence Score (0-100): ${newProj.breakdown.confidenceScore}%`);
      console.log(`  * FINAL Projection: ${newProj.projected_points} pts`);
    });

  } catch (err: any) {
    console.error('Validation script execution failed:', err.message);
  }
}

run();
