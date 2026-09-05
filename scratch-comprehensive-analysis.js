async function run() {
  try {
    const resB = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    const boot = await resB.json();

    const baselineNames = [
      { name: 'Raya', role: 'Starting XI', pos: 'GK', preProj: 5.40 },
      { name: 'Gabriel', role: 'Starting XI', pos: 'DEF', preProj: 4.50 },
      { name: 'Guéhi', role: 'Starting XI', pos: 'DEF', preProj: 3.45 },
      { name: 'Tarkowski', role: 'Starting XI', pos: 'DEF', preProj: 3.45 },
      { name: 'Van Hecke', role: 'Starting XI', pos: 'DEF', preProj: 2.88 },
      { name: 'Fernandes', role: 'Starting XI (C)', pos: 'MID', preProj: 12.60 }, // Captained (2x)
      { name: 'Semenyo', role: 'Starting XI', pos: 'MID', preProj: 4.89 },
      { name: 'Gibbs-White', role: 'Starting XI', pos: 'MID', preProj: 4.60 },
      { name: 'Rice', role: 'Starting XI', pos: 'MID', preProj: 5.47 },
      { name: 'Anderson', role: 'Starting XI', pos: 'MID', preProj: 4.83 },
      { name: 'Thiago', role: 'Starting XI', pos: 'FWD', preProj: 4.60 },
      { name: 'Mitchell', role: 'Bench 1', pos: 'DEF', preProj: 2.59 },
      { name: 'Emegha', role: 'Bench 2', pos: 'FWD', preProj: 2.25 },
      { name: 'Destan', role: 'Bench 3', pos: 'FWD', preProj: 2.25 },
      { name: 'Verbruggen', role: 'Bench GK', pos: 'GK', preProj: 0.12 }
    ];

    console.log("=========================================================================================");
    console.log("PRE-SEASON 57.97 SQUAD: PROJECTED VS ACTUAL (GW1, GW2 & 2-GW TOTAL)");
    console.log("=========================================================================================");

    const squadResults = [];

    for (const item of baselineNames) {
      const el = boot.elements.find(p => 
        p.web_name.toLowerCase().includes(item.name.toLowerCase()) || 
        p.second_name.toLowerCase().includes(item.name.toLowerCase())
      );
      if (!el) {
        console.log("Player not found:", item.name);
        continue;
      }

      const teamObj = boot.teams.find(t => t.id === el.team);
      const teamName = teamObj ? teamObj.short_name : el.team;

      // Fetch individual gameweek breakdown
      const summaryRes = await fetch(`https://fantasy.premierleague.com/api/element-summary/${el.id}/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      const summary = await summaryRes.json();
      const gw1 = summary.history.find(h => h.round === 1) || { total_points: 0, minutes: 0, goals_scored: 0, assists: 0, clean_sheets: 0 };
      const gw2 = summary.history.find(h => h.round === 2) || { total_points: 0, minutes: 0, goals_scored: 0, assists: 0, clean_sheets: 0 };

      // GW1 actual points (accounting for captaincy if Fernandes)
      const gw1Actual = item.name === 'Fernandes' ? gw1.total_points * 2 : gw1.total_points;
      const gw2Actual = item.name === 'Fernandes' ? gw2.total_points * 2 : gw2.total_points;
      const total2GWActual = item.name === 'Fernandes' ? (gw1.total_points + gw2.total_points) * 2 : el.total_points;

      const diffGW1 = gw1Actual - item.preProj;

      squadResults.push({
        Player: el.web_name,
        Team: teamName,
        Pos: item.pos,
        Role: item.role,
        Price: `£${(el.now_cost/10).toFixed(1)}m`,
        'GW1 Proj': item.preProj.toFixed(2),
        'GW1 Actual': gw1Actual,
        'GW1 Diff': (diffGW1 >= 0 ? '+' : '') + diffGW1.toFixed(2),
        'GW2 Actual': gw2Actual,
        '2-GW Total': total2GWActual,
        'Total Mins': el.minutes,
        'Goals/Assists': `${el.goals_scored}G / ${el.assists}A`,
        'Clean Sheets': el.clean_sheets,
        xG: el.expected_goals,
        xA: el.expected_assists
      });
    }

    console.table(squadResults);

    // Calculate Starting XI totals for GW1
    const starters = squadResults.filter(p => p.Role.includes('Starting XI'));
    const gw1StartersProj = starters.reduce((sum, p) => sum + parseFloat(p['GW1 Proj']), 0);
    const gw1StartersActual = starters.reduce((sum, p) => sum + p['GW1 Actual'], 0);
    const gw2StartersActual = starters.reduce((sum, p) => sum + p['GW2 Actual'], 0);
    const total2GWStartersActual = starters.reduce((sum, p) => sum + p['2-GW Total'], 0);

    console.log("\n=========================================================================================");
    console.log(`GW1 STARTING XI TOTALS: Projected = ${gw1StartersProj.toFixed(2)} pts | Actual GW1 = ${gw1StartersActual} pts | Diff = ${(gw1StartersActual - gw1StartersProj).toFixed(2)} pts`);
    console.log(`GW2 STARTING XI TOTALS: Actual GW2 = ${gw2StartersActual} pts`);
    console.log(`2-GAMEWEEK STARTING XI COMBINED SCORE: ${total2GWStartersActual} pts (Average: ${(total2GWStartersActual/2).toFixed(1)} pts/GW)`);
    console.log("=========================================================================================\n");

  } catch (err) {
    console.error("Comprehensive analysis script error:", err);
  }
}

run();
