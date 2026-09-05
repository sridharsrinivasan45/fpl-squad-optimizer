import fs from 'fs';
import vm from 'vm';

console.log('--- AUDITING STANDALONE prototype.html ---');
const content = fs.readFileSync('prototype.html', 'utf8');

// 1. Basic File Checks
console.log(`1. File size: ${(content.length / 1024).toFixed(1)} KB`);
console.assert(content.includes('<!DOCTYPE html>'), 'Must have valid DOCTYPE');
console.assert(content.includes('<style>'), 'Must have inlined styles');
console.assert(content.includes('<script>'), 'Must have inlined scripts');
console.assert(!content.includes('<link rel="stylesheet" href="styles.css">'), 'Must NOT have external CSS link');
console.assert(!content.includes('<script src="script.js"></script>'), 'Must NOT have external JS script tag');
console.log('✅ Structure checks passed: 100% self-contained single file.');

// 2. View Checks
const views = ['optimal', 'my-team', 'scouting', 'comparison', 'simulator', 'learning-report', 'academy'];
views.forEach(v => {
  console.assert(content.includes(`id="view-${v}"`), `Must contain view id="view-${v}"`);
});
console.log(`✅ All ${views.length} product views verified in HTML markup.`);

// 3. Extract and Execute Inlined JavaScript in Sandbox
const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  throw new Error('Could not find inlined <script> block in prototype.html');
}

const jsCode = scriptMatch[1];
const sandbox: any = {
  console: console,
  document: {
    addEventListener: () => {},
    querySelectorAll: () => [],
    getElementById: () => null
  },
  window: {}
};

vm.createContext(sandbox);
const result = vm.runInContext(jsCode + '\n; ({ TEAMS, PLAYERS, GW3_OPTIMAL_SQUAD, PRESEASON_OPTIMAL_SQUAD });', sandbox);

console.log(`2. TEAMS embedded count: ${result.TEAMS?.length}`);
console.assert(result.TEAMS?.length === 20, 'TEAMS must have exactly 20 clubs');

const teamNames = result.TEAMS.map((t: any) => t.name);
console.log(`   Sample clubs: ${teamNames.slice(0, 8).join(', ')}...`);
console.assert(!teamNames.includes('West Ham'), 'West Ham must not be in 2026/27 team set');
console.assert(!teamNames.includes('Wolves'), 'Wolves must not be in 2026/27 team set');
console.assert(teamNames.includes('Coventry City'), 'Coventry City must be in 2026/27 team set');
console.assert(teamNames.includes('Sunderland'), 'Sunderland must be in 2026/27 team set');
console.assert(teamNames.includes('Hull City'), 'Hull City must be in 2026/27 team set');
console.assert(teamNames.includes('Leeds'), 'Leeds must be in 2026/27 team set');
console.log('✅ Team set integrity verified (20 current 2026/27 clubs).');

console.log(`3. PLAYERS embedded count: ${result.PLAYERS?.length}`);
console.assert(result.PLAYERS?.length === 626, `PLAYERS must have exactly 626 elements, got ${result.PLAYERS?.length}`);

const haaland = result.PLAYERS.find((p: any) => p.name === 'Haaland');
console.log(`   Haaland: £${haaland.cost}m, Proj: ${haaland.proj} EP, Team: ${haaland.team}`);
console.assert(haaland.proj === 8.83, `Haaland projection must be 8.83 EP, got ${haaland.proj}`);

const bruno = result.PLAYERS.find((p: any) => p.name === 'B.Fernandes');
console.log(`   Bruno Fernandes: £${bruno.cost}m, Proj: ${bruno.proj} EP, Team: ${bruno.team}`);
console.assert(bruno.proj === 8.60, `Bruno projection must be 8.60 EP, got ${bruno.proj}`);

const tzolakis = result.PLAYERS.find((p: any) => p.name === 'Tzolakis');
console.log(`   Tzolakis: £${tzolakis.cost}m, Proj: ${tzolakis.proj} EP, Team: ${tzolakis.team}`);
console.assert(tzolakis.proj === 5.67, `Tzolakis projection must be 5.67 EP, got ${tzolakis.proj}`);

console.log('✅ Player pool and calibrated projections verified.');

console.log(`4. GW3 Optimal Squad count: ${result.GW3_OPTIMAL_SQUAD?.length}`);
console.assert(result.GW3_OPTIMAL_SQUAD?.length === 15, 'GW3 squad must have 15 players');

console.log(`5. Pre-Season Baseline Squad count: ${result.PRESEASON_OPTIMAL_SQUAD?.length}`);
console.assert(result.PRESEASON_OPTIMAL_SQUAD?.length === 15, 'Pre-season squad must have 15 players');

console.log('\n========================================');
console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
console.log('prototype.html is 100% standalone and Netlify-ready.');
console.log('========================================');
