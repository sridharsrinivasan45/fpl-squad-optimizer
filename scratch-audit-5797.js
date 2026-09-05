async function run() {
  try {
    const res = await fetch('http://localhost:3001/api/bootstrap-static');
    const data = await res.json();

    console.log("Total elements:", data.elements.length);

    // Baseline Squad players from the 57.97 pt optimal team
    const baselineNames = [
      'Raya', 'Gabriel', 'Guéhi', 'Tarkowski', 'Van Hecke',
      'Fernandes', 'Semenyo', 'Gibbs-White', 'Rice', 'Anderson',
      'Thiago', 'Mitchell', 'Emegha', 'Destan', 'Verbruggen'
    ];

    console.log("\n========================================================");
    console.log("1. BASELINE SQUAD (57.97 PT OPTIMAL XI + BENCH) IN GW1+GW2");
    console.log("========================================================");
    
    let totalActualPts = 0;
    const squadAudits = [];

    for (const name of baselineNames) {
      const match = data.elements.find(el => 
        el.web_name.toLowerCase().includes(name.toLowerCase()) || 
        el.second_name.toLowerCase().includes(name.toLowerCase())
      );
      if (match) {
        const teamObj = data.teams.find(t => t.id === match.team);
        squadAudits.push({
          name: match.web_name,
          team: teamObj ? teamObj.short_name : match.team,
          pos: ['GK', 'DEF', 'MID', 'FWD'][match.element_type - 1],
          cost: match.now_cost / 10,
          total_points: match.total_points,
          minutes: match.minutes,
          starts: match.starts,
          goals: match.goals_scored,
          assists: match.assists,
          clean_sheets: match.clean_sheets,
          xG: match.expected_goals,
          xA: match.expected_assists,
          xGC: match.expected_goals_conceded
        });
        totalActualPts += match.total_points;
      } else {
        console.log(`Could not find match for ${name}`);
      }
    }

    console.table(squadAudits);
    console.log(`Total Actual Points scored by squad: ${totalActualPts}`);

    console.log("\n========================================================");
    console.log("2. TOP 15 SCORERS ACROSS THE ENTIRE PREMIER LEAGUE (GW1+GW2)");
    console.log("========================================================");
    const topScorers = [...data.elements]
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 15)
      .map(p => {
        const teamObj = data.teams.find(t => t.id === p.team);
        return {
          name: p.web_name,
          team: teamObj ? teamObj.short_name : p.team,
          pos: ['GK', 'DEF', 'MID', 'FWD'][p.element_type - 1],
          cost: p.now_cost / 10,
          total_points: p.total_points,
          minutes: p.minutes,
          goals: p.goals_scored,
          assists: p.assists,
          clean_sheets: p.clean_sheets,
          xG: p.expected_goals,
          xA: p.expected_assists
        };
      });
    console.table(topScorers);

    console.log("\n========================================================");
    console.log("3. PREMIUM ASSETS PERFORMANCE (Cost >= 8.5m)");
    console.log("========================================================");
    const premiums = data.elements
      .filter(p => p.now_cost >= 85)
      .sort((a, b) => b.total_points - a.total_points)
      .map(p => {
        const teamObj = data.teams.find(t => t.id === p.team);
        return {
          name: p.web_name,
          team: teamObj ? teamObj.short_name : p.team,
          cost: p.now_cost / 10,
          total_points: p.total_points,
          minutes: p.minutes,
          goals: p.goals_scored,
          assists: p.assists,
          xG: p.expected_goals
        };
      });
    console.table(premiums);

  } catch (err) {
    console.error("Audit script failed:", err);
  }
}

run();
