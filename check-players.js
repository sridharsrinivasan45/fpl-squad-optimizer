async function run() {
  try {
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });
    const bootstrapData = await bootstrapRes.json();

    const fixturesRes = await fetch('https://fantasy.premierleague.com/api/fixtures/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });
    const fixturesData = await fixturesRes.json();

    const currentEvent = bootstrapData.events.find((e) => e.is_current) 
                      || bootstrapData.events.find((e) => e.is_next) 
                      || bootstrapData.events[0];
    const gwId = currentEvent ? currentEvent.id : 1;
    const gwFixtures = fixturesData.filter(f => f.event === gwId);

    const names = ['Saka', 'Rice', 'Gibbs-White', 'Haaland'];
    const targetPlayers = bootstrapData.elements.filter(el => names.includes(el.web_name));

    console.log(`Gameweek ID: ${gwId}`);
    targetPlayers.forEach(p => {
      console.log(`\nPlayer: ${p.web_name} (ID: ${p.id})`);
      console.log(`- Team: ${p.team}`);
      console.log(`- Points Per Game (last season): ${p.points_per_game}`);
      console.log(`- Chance of Playing Next Round: ${p.chance_of_playing_next_round}`);
      console.log(`- Form: ${p.form}`);
      
      const playerFixtures = gwFixtures.filter(f => f.team_h === p.team || f.team_a === p.team);
      console.log(`- Fixtures count in GW${gwId}: ${playerFixtures.length}`);
      playerFixtures.forEach(f => {
        const isHome = f.team_h === p.team;
        const opp = isHome ? f.team_a : f.team_h;
        const oppTeam = bootstrapData.teams.find(t => t.id === opp)?.short_name || opp;
        const diff = isHome ? f.team_h_difficulty : f.team_a_difficulty;
        console.log(`  * vs ${oppTeam} (${isHome ? 'H' : 'A'}) - FDR: ${diff}`);
      });
    });

  } catch (err) {
    console.error('Check failed:', err.message);
  }
}

run();
