import fs from 'fs';
import { calculateProjectedPoints } from './src/utils/pointsProjection';
import { solveSquad } from './src/utils/fplSolver';

const boot = JSON.parse(fs.readFileSync('temp-boot.json', 'utf8'));
const fixtures = JSON.parse(fs.readFileSync('temp-fixtures.json', 'utf8'));

// Run projections for GW3 across ALL 626 players
const proj = calculateProjectedPoints(boot.elements, boot.teams, fixtures, 3);
const result = solveSquad(proj.players, 1000);

console.log(`Exporting all ${proj.players.length} players with live availability data...`);

// Export complete 626-player pool with live status, chance, and news fields
const playerObjects = proj.players.map(p => {
  const el = boot.elements.find((e: any) => e.id === p.id);
  const rawChance = el ? el.chance_of_playing_next_round : null;
  const status = el ? el.status : 'a';
  const news = el ? el.news || '' : '';
  const news_added = el ? el.news_added || '' : '';

  return {
    id: p.id,
    name: p.web_name,
    team: p.team_short_name,
    team_id: p.team,
    pos: p.element_type,
    cost: p.now_cost / 10,
    pre_cost: (p.now_cost - (el?.cost_change_start || 0)) / 10,
    proj: p.projected_points,
    pre_proj: p.breakdown?.baseProjection || 4.5,
    gw1: el ? (el.event_points || 0) : 0,
    gw2: el ? (el.total_points - (el.event_points || 0)) : 0,
    total: el ? el.total_points : 0,
    mins: el ? el.minutes : 0,
    starts: el ? el.starts : 0,
    cs: el ? el.clean_sheets : 0,
    g: el ? el.goals_scored : 0,
    a: el ? el.assists : 0,
    xG: el ? el.expected_goals : '0.00',
    xA: el ? el.expected_assists : '0.00',
    selected_by: parseFloat(el?.selected_by_percent || '0'),
    chance: rawChance,
    status: status,
    news: news,
    news_added: news_added
  };
});

fs.writeFileSync('temp-prototype-players.json', JSON.stringify(playerObjects, null, 2));

const gw3Squad = result.squad.map(p => ({
  id: p.id,
  isStarter: result.starters.some(s => s.id === p.id),
  isCaptain: result.captain?.id === p.id,
  isVice: result.viceCaptain?.id === p.id
}));

fs.writeFileSync('temp-gw3-squad.json', JSON.stringify(gw3Squad, null, 2));
console.log(`Successfully exported ${playerObjects.length} players and ${gw3Squad.length} squad slots.`);
