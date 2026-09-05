import fs from 'fs';

const players = JSON.parse(fs.readFileSync('temp-prototype-players.json', 'utf8'));
const gw3Squad = JSON.parse(fs.readFileSync('temp-gw3-squad.json', 'utf8'));

const playerEntries = players.map((p: any) => {
  return '  { ' +
    'id: ' + p.id + ', ' +
    'name: ' + JSON.stringify(p.name) + ', ' +
    'team: ' + JSON.stringify(p.team) + ', ' +
    'team_id: ' + p.team_id + ', ' +
    'pos: ' + p.pos + ', ' +
    'cost: ' + p.cost.toFixed(1) + ', ' +
    'pre_cost: ' + p.pre_cost.toFixed(1) + ', ' +
    'proj: ' + p.proj.toFixed(2) + ', ' +
    'pre_proj: ' + p.pre_proj.toFixed(2) + ', ' +
    'gw1: ' + p.gw1 + ', ' +
    'gw2: ' + p.gw2 + ', ' +
    'total: ' + p.total + ', ' +
    'mins: ' + p.mins + ', ' +
    'starts: ' + p.starts + ', ' +
    'cs: ' + p.cs + ', ' +
    'g: ' + p.g + ', ' +
    'a: ' + p.a + ', ' +
    'xG: ' + JSON.stringify(p.xG) + ', ' +
    'xA: ' + JSON.stringify(p.xA) + ', ' +
    'selected_by: ' + p.selected_by.toFixed(1) + ', ' +
    'chance: ' + (p.chance === null ? 'null' : p.chance) + ', ' +
    'status: ' + JSON.stringify(p.status) + ', ' +
    'news: ' + JSON.stringify(p.news || '') + ', ' +
    'news_added: ' + JSON.stringify(p.news_added || '') +
  ' }';
}).join(',\n');

const gw3SquadEntries = gw3Squad.map((s: any) => {
  return '  { id: ' + s.id + ', isStarter: ' + s.isStarter + ', isCaptain: ' + s.isCaptain + ', isVice: ' + s.isVice + ' }';
}).join(',\n');

const boot = JSON.parse(fs.readFileSync('temp-boot.json', 'utf8'));
const teamEntries = boot.teams.map((t: any) => {
  return '  { id: ' + t.id + ', name: ' + JSON.stringify(t.name) + ', short: ' + JSON.stringify(t.short_name) + ' }';
}).join(',\n');

const scriptContent = `/**
 * FPL DECISION SUPPORT SYSTEM - STANDALONE PROTOTYPE SCRIPT
 * 2026/27 Live Season State: GW1 + GW2 Completed -> GW3 Calibrated Projections
 * Complete 626-Player Pool with Live Availability & Injury Tracking
 */

// ==========================================
// 1. EMBEDDED TEAMS & 2026/27 PLAYERS POOL
// ==========================================

const TEAMS = [
${teamEntries}
];

const PLAYERS = [
${playerEntries}
];

// Preserved Pre-Season Baseline Squad (57.97 pts)
const PRESEASON_OPTIMAL_SQUAD = [
  { id: 1, isStarter: true, isCaptain: false, isVice: true },   // Raya
  { id: 10, isStarter: true, isCaptain: false, isVice: false },  // Gabriel
  { id: 12, isStarter: true, isCaptain: false, isVice: false },  // Guéhi
  { id: 13, isStarter: true, isCaptain: false, isVice: false },  // Tarkowski
  { id: 14, isStarter: true, isCaptain: false, isVice: false },  // Van Hecke
  { id: 30, isStarter: true, isCaptain: true, isVice: false },   // B. Fernandes (C)
  { id: 35, isStarter: true, isCaptain: false, isVice: false },  // Semenyo
  { id: 34, isStarter: true, isCaptain: false, isVice: false },  // Gibbs-White
  { id: 40, isStarter: true, isCaptain: false, isVice: false },  // Rice
  { id: 41, isStarter: true, isCaptain: false, isVice: false },  // Anderson
  { id: 53, isStarter: true, isCaptain: false, isVice: false },  // Thiago
  { id: 15, isStarter: false, isCaptain: false, isVice: false }, // Mitchell
  { id: 56, isStarter: false, isCaptain: false, isVice: false }, // Emegha
  { id: 57, isStarter: false, isCaptain: false, isVice: false }, // Destan
  { id: 2, isStarter: false, isCaptain: false, isVice: false }   // Verbruggen
];

// Corrected Live GW3 Optimal Squad (66.51 pts baseline / 75.34 pts captained)
const GW3_OPTIMAL_SQUAD = [
${gw3SquadEntries}
];

// Application State
const state = {
  currentTab: 'optimal',
  squadMode: 'gw3', // 'gw3' or 'preseason'
  myTeam: [...GW3_OPTIMAL_SQUAD.map(s => {
    const p = PLAYERS.find(x => x.id === s.id) || PLAYERS[0];
    return { ...p, isStarter: s.isStarter, isCaptain: s.isCaptain, isVice: s.isVice };
  })],
  myTeamFormation: '3-5-2',
  myTeamPosFilter: 'all',
  scoutingFilter: { pos: 'all', search: '', maxPrice: 16.0, availability: 'all' },
  comparePlayerA: PLAYERS.find(p => p.name === 'Haaland') || PLAYERS[0],
  comparePlayerB: PLAYERS.find(p => p.name === 'B.Fernandes') || PLAYERS[1],
  simInPlayer: PLAYERS.find(p => p.name === 'Saka') || PLAYERS[2],
  simOutPlayer: PLAYERS.find(p => p.name === 'Gakpo') || PLAYERS[3]
};

// ==========================================
// 2. HELPER CALCULATIONS & AVAILABILITY
// ==========================================

function getPlayer(id) {
  return PLAYERS.find(p => p.id === id) || PLAYERS[0];
}

function getPosName(pos) {
  return ['GK', 'DEF', 'MID', 'FWD'][pos - 1] || 'PL';
}

function getPosBadgeClass(pos) {
  return ['gk', 'def', 'mid', 'fwd'][pos - 1] || 'def';
}

function getAvailabilityBadge(p) {
  if (p.status === 'i') {
    return '<span class="badge-status badge-status-injured" title="' + (p.news ? p.news.replace(/"/g, '&quot;') : 'Injured') + '">🔴 Injured (0%)</span>';
  }
  if (p.status === 'u') {
    return '<span class="badge-status badge-status-unavailable" title="' + (p.news ? p.news.replace(/"/g, '&quot;') : 'Unavailable') + '">🔴 Unavailable</span>';
  }
  if (p.status === 's') {
    return '<span class="badge-status badge-status-suspended" title="' + (p.news ? p.news.replace(/"/g, '&quot;') : 'Suspended') + '">🔴 Suspended</span>';
  }
  if (p.status === 'd' || (p.chance !== null && p.chance < 100)) {
    const pct = p.chance !== null ? p.chance : 50;
    return '<span class="badge-status badge-status-doubt" title="' + (p.news ? p.news.replace(/"/g, '&quot;') : 'Doubtful') + '">🟡 ' + pct + '% Chance</span>';
  }
  return '';
}

function getStatusDot(p) {
  if (p.status === 'i' || p.status === 'u' || p.status === 's' || p.chance === 0) {
    return '<span class="pitch-card-status-dot is-injured" title="' + (p.news ? p.news.replace(/"/g, '&quot;') : 'Unavailable') + '"></span>';
  }
  if (p.status === 'd' || (p.chance !== null && p.chance < 100)) {
    return '<span class="pitch-card-status-dot is-doubt" title="' + (p.news ? p.news.replace(/"/g, '&quot;') : 'Doubtful') + '"></span>';
  }
  return '';
}

function calculateRating(player) {
  const ppm = player.proj / (player.cost || 4.5);
  const overall = Math.min(10, Math.max(1, Math.round((player.proj * 0.8 + ppm * 2.0) * 10) / 10));
  const value = Math.min(10, Math.max(1, Math.round((ppm * 7.5) * 10) / 10));
  const reliability = player.starts >= 2 ? 9.5 : player.starts === 1 ? 6.5 : 2.0;
  const fixture = 7.5;
  const risk = player.status !== 'a' ? 8.5 : player.starts === 0 ? 9.0 : 2.5;
  const captaincy = player.cost >= 9.0 ? 9.2 : player.cost >= 7.5 ? 6.5 : 2.0;

  let label = 'Buy / Recommended';
  let badgeColor = '#10b981';
  if (player.status === 'i' || player.status === 'u' || player.status === 's') {
    label = 'Unavailable / Injured';
    badgeColor = '#ef4444';
  } else if (risk >= 7.0 || player.status === 'd') {
    label = 'Caution / Doubtful';
    badgeColor = '#f59e0b';
  } else if (overall < 5.0) {
    label = 'Avoid / Low Ceiling';
    badgeColor = '#ef4444';
  }

  return { overall, value, reliability, fixture, risk, captaincy, label, badgeColor };
}

// ==========================================
// 3. UI RENDERING & INTERACTION
// ==========================================

function switchTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-view-content').forEach(view => {
    view.style.display = view.id === \`view-\${tabId}\` ? 'block' : 'none';
  });

  if (tabId === 'optimal') renderOptimalSquad();
  if (tabId === 'my-team') renderMyTeam();
  if (tabId === 'scouting') renderScouting();
  if (tabId === 'comparison') renderComparison();
  if (tabId === 'simulator') renderSimulator();
}

function toggleOptimalMode(mode) {
  state.squadMode = mode;
  document.querySelectorAll('.opt-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  renderOptimalSquad();
}

// ------------------------------------------
// RENDER: OPTIMAL SQUAD
// ------------------------------------------
function renderOptimalSquad() {
  const isGw3 = state.squadMode === 'gw3';
  const targetSquadConfig = isGw3 ? GW3_OPTIMAL_SQUAD : PRESEASON_OPTIMAL_SQUAD;

  const squad = targetSquadConfig.map(s => ({
    ...getPlayer(s.id),
    isStarter: s.isStarter,
    isCaptain: s.isCaptain,
    isVice: s.isVice
  }));

  const starters = squad.filter(p => p.isStarter);
  const bench = squad.filter(p => !p.isStarter);

  const totalCost = squad.reduce((sum, p) => sum + p.cost, 0);
  const startingPoints = starters.reduce((sum, p) => sum + (p.isCaptain ? p.proj * 2 : p.proj), 0);
  const captain = starters.find(p => p.isCaptain);
  const vice = starters.find(p => p.isVice);

  // Update KPIs
  document.getElementById('opt-kpi-points').innerText = \`\${startingPoints.toFixed(2)} pts\`;
  document.getElementById('opt-kpi-cost').innerText = \`£\${totalCost.toFixed(1)}m / £100.0m\`;
  document.getElementById('opt-kpi-bank').innerText = \`£\${(100.0 - totalCost).toFixed(1)}m bank remaining\`;
  document.getElementById('opt-kpi-formation').innerText = isGw3 ? '3-5-2' : '4-5-1';
  document.getElementById('opt-kpi-captain').innerText = captain ? \`\${captain.name} (C)\` : 'None';
  document.getElementById('opt-kpi-vice').innerText = vice ? \`Vice: \${vice.name}\` : 'Vice: None';
  document.getElementById('opt-kpi-badge-title').innerText = isGw3 ? '2026/27 Early-Season Model (GW3 Active)' : 'Pre-Season Baseline (Frozen Prior)';

  renderPitchRow('opt-row-gk', starters.filter(p => p.pos === 1), false);
  renderPitchRow('opt-row-def', starters.filter(p => p.pos === 2), false);
  renderPitchRow('opt-row-mid', starters.filter(p => p.pos === 3), false);
  renderPitchRow('opt-row-fwd', starters.filter(p => p.pos === 4), false);

  const benchContainer = document.getElementById('opt-bench-cards');
  if (benchContainer) {
    benchContainer.innerHTML = bench.map((p, idx) => \`
      <div class="pitch-card" onclick="openPlayerModal(\${p.id})">
        \${getStatusDot(p)}
        <span class="pitch-card-badge badge-pos badge-\${getPosBadgeClass(p.pos)}">\${getPosName(p.pos)}</span>
        <div class="pitch-card-name">\${p.name}</div>
        <div class="pitch-card-details">
          <span class="pitch-card-cost">£\${p.cost.toFixed(1)}m</span>
          <span class="pitch-card-points">\${p.proj.toFixed(1)} EP</span>
        </div>
        <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Bench \${idx === 3 ? 'GK' : idx + 1}</div>
      </div>
    \`).join('');
  }

  // Update explainability box
  const explainBox = document.getElementById('opt-explain-content');
  if (explainBox) {
    if (isGw3) {
      explainBox.innerHTML = \`
        <p class="panel-desc" style="line-height: 1.6; font-size: 13px; color: #cbd5e1;">
          The updated GW3 model evaluates all <strong>626 Premier League players</strong> with <strong>60% Pre-Season Prior</strong> + <strong>40% Observed 2026/27 Performance</strong>.
        </p>
        <ul style="margin: 12px 0 0 18px; font-size: 12px; color: #94a3b8; line-height: 1.7;">
          <li><strong style="color:#fff;">Haaland Ingestion (£15.5m):</strong> Budget enablers (Ajayi £4.1m, Sangaré £5.6m, Groß £5.5m) allow fitting Haaland (8.83 EP) as captain.</li>
          <li><strong style="color:#fff;">Bruno Fernandes (£12.0m):</strong> Retained as vice-captain (8.60 EP) after his 23-pt GW2 haul.</li>
          <li><strong style="color:#fff;">Form Defense Stack:</strong> Hull (Tzolakis, Ajayi) and Brighton (De Cuyper) provide balanced value while anchored to prior regression.</li>
        </ul>
      \`;
    } else {
      explainBox.innerHTML = \`
        <p class="panel-desc" style="line-height: 1.6; font-size: 13px; color: #cbd5e1;">
          The original pre-season model projected <strong>56.67 Starting XI points (57.97 total)</strong> using historical priors.
        </p>
        <ul style="margin: 12px 0 0 18px; font-size: 12px; color: #94a3b8; line-height: 1.7;">
          <li><strong style="color:#fff;">Captain:</strong> Bruno Fernandes (£12.0m) — 6.30 EP</li>
          <li><strong style="color:#fff;">Structure:</strong> 4-5-1 formation with Arsenal defense and budget enablers.</li>
          <li><strong style="color:#fff;">Result:</strong> 41 pts in GW1, followed by 90 pts in GW2 (131 total).</li>
        </ul>
      \`;
    }
  }
}

function renderPitchRow(elementId, playerList, isMyTeam = false) {
  const container = document.getElementById(elementId);
  if (!container) return;

  container.innerHTML = playerList.map(p => \`
    <div class="pitch-card \${p.isCaptain ? 'is-captain' : ''} \${p.isVice ? 'is-vice' : ''}" onclick="openPlayerModal(\${p.id})">
      \${getStatusDot(p)}
      \${isMyTeam ? \`<button class="pitch-card-remove" title="Remove from squad" onclick="event.stopPropagation(); removePlayerFromMyTeam(\${p.id});">×</button>\` : ''}
      \${p.isCaptain ? '<span class=\"pitch-card-cap-badge\">C</span>' : ''}
      \${p.isVice ? '<span class=\"pitch-card-cap-badge\" style=\"background:#64748b;color:#fff;\">V</span>' : ''}
      <span class="pitch-card-badge badge-pos badge-\${getPosBadgeClass(p.pos)}">\${getPosName(p.pos)}</span>
      <div class="pitch-card-name">\${p.name}</div>
      <div class="pitch-card-details">
        <span class="pitch-card-cost">£\${p.cost.toFixed(1)}m</span>
        <span class="pitch-card-points">\${p.isCaptain ? (p.proj * 2).toFixed(1) : p.proj.toFixed(1)} EP</span>
      </div>
    </div>
  \`).join('');
}

// ------------------------------------------
// RENDER & CONTROLS: MY TEAM (FULLY INTERACTIVE)
// ------------------------------------------

function loadSampleSquad() {
  state.myTeam = GW3_OPTIMAL_SQUAD.map(s => {
    const p = getPlayer(s.id);
    return { ...p, isStarter: s.isStarter, isCaptain: s.isCaptain, isVice: s.isVice };
  });
  renderMyTeam();
}

function clearMyTeam() {
  state.myTeam = [];
  renderMyTeam();
}

function setMyTeamFormation(form) {
  state.myTeamFormation = form;
  document.querySelectorAll('.myteam-form-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.trim() === form);
  });
  autoAssignStartersFromFormation(form);
  renderMyTeam();
}

function autoAssignStartersFromFormation(form) {
  const [d, m, f] = form.split('-').map(Number);
  
  state.myTeam.forEach(p => { p.isStarter = false; });

  const gks = state.myTeam.filter(p => p.pos === 1).sort((a, b) => b.proj - a.proj);
  const defs = state.myTeam.filter(p => p.pos === 2).sort((a, b) => b.proj - a.proj);
  const mids = state.myTeam.filter(p => p.pos === 3).sort((a, b) => b.proj - a.proj);
  const fwds = state.myTeam.filter(p => p.pos === 4).sort((a, b) => b.proj - a.proj);

  gks.slice(0, 1).forEach(p => { p.isStarter = true; });
  defs.slice(0, d).forEach(p => { p.isStarter = true; });
  mids.slice(0, m).forEach(p => { p.isStarter = true; });
  fwds.slice(0, f).forEach(p => { p.isStarter = true; });

  ensureValidCaptaincy();
}

function autoOptimizeMyTeam() {
  if (state.myTeam.length < 11) {
    alert('Please draft at least 11 players before optimizing your Starting XI.');
    return;
  }

  const formations = ['3-5-2', '3-4-3', '4-4-2', '4-3-3', '4-5-1', '5-3-2', '5-4-1'];
  let bestFormation = '3-5-2';
  let bestPoints = -1;

  formations.forEach(form => {
    const [d, m, f] = form.split('-').map(Number);
    const defCount = state.myTeam.filter(p => p.pos === 2).length;
    const midCount = state.myTeam.filter(p => p.pos === 3).length;
    const fwdCount = state.myTeam.filter(p => p.pos === 4).length;
    const gkCount = state.myTeam.filter(p => p.pos === 1).length;

    if (gkCount >= 1 && defCount >= d && midCount >= m && fwdCount >= f) {
      const topGK = state.myTeam.filter(p => p.pos === 1).sort((a,b)=>b.proj-a.proj).slice(0,1);
      const topDEF = state.myTeam.filter(p => p.pos === 2).sort((a,b)=>b.proj-a.proj).slice(0,d);
      const topMID = state.myTeam.filter(p => p.pos === 3).sort((a,b)=>b.proj-a.proj).slice(0,m);
      const topFWD = state.myTeam.filter(p => p.pos === 4).sort((a,b)=>b.proj-a.proj).slice(0,f);
      
      const pts = [...topGK, ...topDEF, ...topMID, ...topFWD].reduce((s, p) => s + p.proj, 0);
      if (pts > bestPoints) {
        bestPoints = pts;
        bestFormation = form;
      }
    }
  });

  setMyTeamFormation(bestFormation);
  alert(\`Starting XI auto-optimized to \${bestFormation} yielding \${bestPoints.toFixed(2)} baseline expected points!\`);
}

function ensureValidCaptaincy() {
  const starters = state.myTeam.filter(p => p.isStarter);
  if (starters.length === 0) return;

  const hasCaptain = starters.some(p => p.isCaptain);
  if (!hasCaptain) {
    state.myTeam.forEach(p => { p.isCaptain = false; });
    const best = [...starters].sort((a, b) => b.proj - a.proj)[0];
    if (best) best.isCaptain = true;
  }

  const hasVice = starters.some(p => p.isVice && !p.isCaptain);
  if (!hasVice) {
    state.myTeam.forEach(p => { p.isVice = false; });
    const nonCapStarters = starters.filter(p => !p.isCaptain).sort((a, b) => b.proj - a.proj);
    if (nonCapStarters.length > 0) nonCapStarters[0].isVice = true;
  }
}

function addPlayerToMyTeam(playerId) {
  const player = getPlayer(playerId);
  if (!player) return;

  if (state.myTeam.some(p => p.id === playerId)) {
    alert(\`\${player.name} is already in your squad.\`);
    return;
  }

  if (state.myTeam.length >= 15) {
    alert('Your squad already has 15 players. Remove a player first before adding another.');
    return;
  }

  const posCounts = {
    1: state.myTeam.filter(p => p.pos === 1).length,
    2: state.myTeam.filter(p => p.pos === 2).length,
    3: state.myTeam.filter(p => p.pos === 3).length,
    4: state.myTeam.filter(p => p.pos === 4).length
  };
  const posLimits = { 1: 2, 2: 5, 3: 5, 4: 3 };
  if (posCounts[player.pos] >= posLimits[player.pos]) {
    alert(\`Cannot add \${player.name}: Maximum \${posLimits[player.pos]} \${getPosName(player.pos)}s allowed.\`);
    return;
  }

  const clubCount = state.myTeam.filter(p => p.team_id === player.team_id).length;
  if (clubCount >= 3) {
    alert(\`Cannot add \${player.name}: Maximum 3 players from \${player.team} allowed.\`);
    return;
  }

  const currentCost = state.myTeam.reduce((sum, p) => sum + p.cost, 0);
  if (currentCost + player.cost > 100.0) {
    const overflow = (currentCost + player.cost - 100.0).toFixed(1);
    if (!confirm(\`Adding \${player.name} will put your squad £\${overflow}m over the £100.0m budget. Add anyway?\`)) {
      return;
    }
  }

  const currentStarters = state.myTeam.filter(p => p.isStarter);
  const [d, m, f] = state.myTeamFormation.split('-').map(Number);
  const targetStarters = { 1: 1, 2: d, 3: m, 4: f };
  const currentPosStarters = state.myTeam.filter(p => p.isStarter && p.pos === player.pos).length;

  const isStarter = (currentStarters.length < 11) && (currentPosStarters < targetStarters[player.pos]);

  state.myTeam.push({
    ...player,
    isStarter,
    isCaptain: false,
    isVice: false
  });

  ensureValidCaptaincy();
  renderMyTeam();
}

function removePlayerFromMyTeam(playerId) {
  const idx = state.myTeam.findIndex(p => p.id === playerId);
  if (idx !== -1) {
    state.myTeam.splice(idx, 1);
    ensureValidCaptaincy();
    renderMyTeam();
  }
}

function setCaptainById(playerId) {
  state.myTeam.forEach(p => {
    p.isCaptain = p.id === playerId;
    if (p.isCaptain && p.isVice) p.isVice = false;
  });
  renderMyTeam();
}

function setViceCaptainById(playerId) {
  state.myTeam.forEach(p => {
    p.isVice = p.id === playerId;
    if (p.isVice && p.isCaptain) p.isCaptain = false;
  });
  renderMyTeam();
}

function setMyTeamPosFilter(pos) {
  state.myTeamPosFilter = pos;
  document.querySelectorAll('.myteam-pos-filter').forEach(btn => {
    const isAct = (pos === 'all' && btn.innerText === 'All') || (btn.innerText === getPosName(pos));
    btn.classList.toggle('active', isAct);
  });
  renderMyTeamPicker();
}

function openSlotPicker(pos) {
  setMyTeamPosFilter(pos);
  const input = document.getElementById('myteam-search-input');
  if (input) {
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function renderMyTeam() {
  const starters = state.myTeam.filter(p => p.isStarter);
  const bench = state.myTeam.filter(p => !p.isStarter);

  const totalCost = state.myTeam.reduce((sum, p) => sum + p.cost, 0);
  const remainingBudget = 100.0 - totalCost;
  const startingPoints = starters.reduce((sum, p) => sum + (p.isCaptain ? p.proj * 2 : p.proj), 0);

  const captain = starters.find(p => p.isCaptain);
  const vice = starters.find(p => p.isVice);

  // KPIs
  document.getElementById('myteam-kpi-points').innerText = \`\${startingPoints.toFixed(2)} pts\`;
  document.getElementById('myteam-kpi-subpoints').innerText = captain ? \`Captain: \${captain.name} (2x)\` : 'No Captain Selected';
  
  const budgetElem = document.getElementById('myteam-kpi-budget');
  budgetElem.innerText = \`£\${remainingBudget.toFixed(1)}m\`;
  budgetElem.style.color = remainingBudget >= 0 ? '#10b981' : '#ef4444';

  document.getElementById('myteam-kpi-spent').innerText = \`Spent: £\${totalCost.toFixed(1)}m / £100.0m\`;

  const posCounts = {
    1: state.myTeam.filter(p => p.pos === 1).length,
    2: state.myTeam.filter(p => p.pos === 2).length,
    3: state.myTeam.filter(p => p.pos === 3).length,
    4: state.myTeam.filter(p => p.pos === 4).length
  };
  document.getElementById('myteam-kpi-count').innerText = \`\${state.myTeam.length} / 15\`;
  document.getElementById('myteam-kpi-poscounts').innerText = \`GK: \${posCounts[1]}/2 • DEF: \${posCounts[2]}/5 • MID: \${posCounts[3]}/5 • FWD: \${posCounts[4]}/3\`;

  const statusElem = document.getElementById('myteam-kpi-status');
  const isSquadFull = state.myTeam.length === 15;
  const isPosValid = posCounts[1] === 2 && posCounts[2] === 5 && posCounts[3] === 5 && posCounts[4] === 3;
  const isBudgetValid = remainingBudget >= 0;
  
  if (isSquadFull && isPosValid && isBudgetValid) {
    statusElem.innerText = '✓ Valid 15-Man Squad';
    statusElem.style.color = '#10b981';
  } else if (!isBudgetValid) {
    statusElem.innerText = \`❌ Budget Exceeded (£\${Math.abs(remainingBudget).toFixed(1)}m)\`;
    statusElem.style.color = '#ef4444';
  } else {
    statusElem.innerText = \`⚠ Incomplete (\${state.myTeam.length}/15)\`;
    statusElem.style.color = '#f59e0b';
  }

  const clubViolations = [];
  TEAMS.forEach(t => {
    const count = state.myTeam.filter(p => p.team_id === t.id).length;
    if (count > 3) clubViolations.push(\`\${t.short} (\${count}/3)\`);
  });
  const clubStatusElem = document.getElementById('myteam-kpi-clubstatus');
  if (clubStatusElem) {
    if (clubViolations.length > 0) {
      clubStatusElem.innerText = \`❌ Club Limit: \${clubViolations.join(', ')}\`;
      clubStatusElem.style.color = '#ef4444';
    } else {
      clubStatusElem.innerText = 'Max 3 per club: OK';
      clubStatusElem.style.color = '#94a3b8';
    }
  }

  // Render Pitch Starting Rows
  const [d, m, f] = state.myTeamFormation.split('-').map(Number);
  renderInteractivePitchRow('myteam-row-gk', 1, 1);
  renderInteractivePitchRow('myteam-row-def', 2, d);
  renderInteractivePitchRow('myteam-row-mid', 3, m);
  renderInteractivePitchRow('myteam-row-fwd', 4, f);

  renderInteractiveBench(bench);
  renderMyTeamPicker();
  populateCaptainSelectors(starters, captain, vice);
}

function renderInteractivePitchRow(elementId, pos, targetCount) {
  const container = document.getElementById(elementId);
  if (!container) return;

  const currentPosStarters = state.myTeam.filter(p => p.isStarter && p.pos === pos);
  let html = currentPosStarters.map(p => \`
    <div class="pitch-card \${p.isCaptain ? 'is-captain' : ''} \${p.isVice ? 'is-vice' : ''}" onclick="openPlayerModal(\${p.id})">
      \${getStatusDot(p)}
      <button class="pitch-card-remove" title="Remove from squad" onclick="event.stopPropagation(); removePlayerFromMyTeam(\${p.id});">×</button>
      \${p.isCaptain ? '<span class=\"pitch-card-cap-badge\">C</span>' : ''}
      \${p.isVice ? '<span class=\"pitch-card-cap-badge\" style=\"background:#64748b;color:#fff;\">V</span>' : ''}
      <span class="pitch-card-badge badge-pos badge-\${getPosBadgeClass(p.pos)}">\${getPosName(p.pos)}</span>
      <div class="pitch-card-name">\${p.name}</div>
      <div class="pitch-card-details">
        <span class="pitch-card-cost">£\${p.cost.toFixed(1)}m</span>
        <span class="pitch-card-points">\${p.isCaptain ? (p.proj * 2).toFixed(1) : p.proj.toFixed(1)} EP</span>
      </div>
    </div>
  \`).join('');

  const emptySlotsCount = Math.max(0, targetCount - currentPosStarters.length);
  for (let i = 0; i < emptySlotsCount; i++) {
    html += \`
      <div class="pitch-card is-empty" onclick="openSlotPicker(\${pos})">
        <span class="pitch-card-empty-icon">+</span>
        <span class="pitch-card-empty-label">Add \${getPosName(pos)}</span>
      </div>
    \`;
  }

  container.innerHTML = html;
}

function renderInteractiveBench(benchPlayers) {
  const container = document.getElementById('myteam-bench-cards');
  if (!container) return;

  let html = benchPlayers.map((p, idx) => \`
    <div class="pitch-card" onclick="openPlayerModal(\${p.id})">
      \${getStatusDot(p)}
      <button class="pitch-card-remove" title="Remove from squad" onclick="event.stopPropagation(); removePlayerFromMyTeam(\${p.id});">×</button>
      <span class="pitch-card-badge badge-pos badge-\${getPosBadgeClass(p.pos)}">\${getPosName(p.pos)}</span>
      <div class="pitch-card-name">\${p.name}</div>
      <div class="pitch-card-details">
        <span class="pitch-card-cost">£\${p.cost.toFixed(1)}m</span>
        <span class="pitch-card-points">\${p.proj.toFixed(1)} EP</span>
      </div>
      <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Bench \${idx + 1}</div>
    </div>
  \`).join('');

  const emptyBenchSlots = Math.max(0, 4 - benchPlayers.length);
  for (let i = 0; i < emptyBenchSlots; i++) {
    html += \`
      <div class="pitch-card is-empty" style="min-height:75px;" onclick="openSlotPicker('all')">
        <span class="pitch-card-empty-icon">+</span>
        <span class="pitch-card-empty-label">Bench Slot</span>
      </div>
    \`;
  }

  container.innerHTML = html;
}

function renderMyTeamPicker() {
  const searchInput = document.getElementById('myteam-search-input');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  const filterPos = state.myTeamPosFilter;

  const resultsContainer = document.getElementById('myteam-picker-results');
  if (!resultsContainer) return;

  let filtered = PLAYERS.filter(p => {
    if (filterPos !== 'all' && p.pos !== parseInt(filterPos)) return false;
    if (search && !p.name.toLowerCase().includes(search) && !p.team.toLowerCase().includes(search)) return false;
    return true;
  });

  filtered.sort((a, b) => b.proj - a.proj);

  resultsContainer.innerHTML = filtered.map(p => {
    const inSquad = state.myTeam.some(x => x.id === p.id);
    const posCount = state.myTeam.filter(x => x.pos === p.pos).length;
    const posLimits = { 1: 2, 2: 5, 3: 5, 4: 3 };
    const isPosFull = !inSquad && posCount >= posLimits[p.pos];
    const clubCount = state.myTeam.filter(x => x.team_id === p.team_id).length;
    const isClubFull = !inSquad && clubCount >= 3;

    let btnHtml = '<button class="btn btn-primary" style="padding:4px 10px; font-size:11px;" onclick="addPlayerToMyTeam(' + p.id + ')">+ Add</button>';
    if (inSquad) {
      btnHtml = '<button class="btn btn-danger" style="padding:4px 10px; font-size:11px;" onclick="removePlayerFromMyTeam(' + p.id + ')">Remove</button>';
    } else if (isPosFull) {
      btnHtml = '<span style="font-size:10px; color:#64748b; font-family:var(--font-mono);">' + getPosName(p.pos) + ' Full</span>';
    } else if (isClubFull) {
      btnHtml = '<span style="font-size:10px; color:#ef4444; font-family:var(--font-mono);">Club Full</span>';
    }

    const availBadge = getAvailabilityBadge(p);
    const newsHtml = p.news ? '<div style="font-size: 10.5px; color: ' + (p.status === 'i' || p.status === 'u' || p.status === 's' ? '#f87171' : '#fbbf24') + '; margin-top: 2px;">⚠️ ' + p.news.replace(/"/g, '&quot;') + '</div>' : '';

    return \`
      <div class="picker-player-row">
        <div class="picker-player-info" style="flex:1;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="badge-pos badge-\${getPosBadgeClass(p.pos)}">\${getPosName(p.pos)}</span>
            <strong style="color:#fff; font-size:13px;">\${p.name}</strong>
            <span style="font-size:11px; color:#94a3b8;">\${p.team}</span>
            \${availBadge}
          </div>
          <span style="font-size:11px; color:#64748b; display:block; margin-top:2px;">\${p.selected_by}% Owned • £\${p.cost.toFixed(1)}m</span>
          \${newsHtml}
        </div>

        <div class="picker-player-stats">
          <strong style="color:#38bdf8; font-size:13px;">\${p.proj.toFixed(1)} EP</strong>
          \${btnHtml}
        </div>
      </div>
    \`;
  }).join('');
}

function populateCaptainSelectors(starters, captain, vice) {
  const capSelect = document.getElementById('myteam-select-captain');
  const viceSelect = document.getElementById('myteam-select-vice');
  if (!capSelect || !viceSelect) return;

  if (starters.length === 0) {
    capSelect.innerHTML = '<option value=\"\">No starters drafted</option>';
    viceSelect.innerHTML = '<option value=\"\">No starters drafted</option>';
    return;
  }

  capSelect.innerHTML = starters.map(p => \`
    <option value="\${p.id}" \${p.isCaptain ? 'selected' : ''}>\${p.name} (\${p.team} • £\${p.cost.toFixed(1)}m • \${p.proj.toFixed(1)} EP)</option>
  \`).join('');

  viceSelect.innerHTML = starters.map(p => \`
    <option value="\${p.id}" \${p.isVice ? 'selected' : ''}>\${p.name} (\${p.team} • £\${p.cost.toFixed(1)}m • \${p.proj.toFixed(1)} EP)</option>
  \`).join('');
}

// ------------------------------------------
// RENDER: SCOUTING
// ------------------------------------------
function renderScouting() {
  const filter = state.scoutingFilter;
  let filtered = PLAYERS.filter(p => {
    if (filter.pos !== 'all' && p.pos !== parseInt(filter.pos)) return false;
    if (p.cost > filter.maxPrice) return false;
    if (filter.availability === 'available' && p.status !== 'a') return false;
    if (filter.availability === 'flagged' && p.status === 'a') return false;
    if (filter.search && !p.name.toLowerCase().includes(filter.search.toLowerCase()) && !p.team.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  filtered.sort((a, b) => b.proj - a.proj);

  const container = document.getElementById('scouting-players-grid');
  if (!container) return;

  container.innerHTML = filtered.map(p => {
    const rating = calculateRating(p);
    const availBadge = getAvailabilityBadge(p);
    const newsHtml = p.news ? '<div style="font-size: 11px; color: ' + (p.status === 'i' || p.status === 'u' || p.status === 's' ? '#f87171' : '#fbbf24') + '; margin-top: 6px; padding: 4px 8px; background: rgba(0,0,0,0.3); border-radius: 4px;">⚠️ ' + p.news.replace(/"/g, '&quot;') + '</div>' : '';

    return \`
      <div class="panel" style="padding:16px; margin-bottom:0;" onclick="openPlayerModal(\${p.id})">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
          <div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span class="badge-pos badge-\${getPosBadgeClass(p.pos)}">\${getPosName(p.pos)}</span>
              <strong style="font-size:14px; color:#fff;">\${p.name}</strong>
              <span style="font-size:11px; color:#94a3b8;">\${p.team}</span>
              \${availBadge}
            </div>
            <div style="font-size:11px; color:#64748b; font-family:var(--font-mono); margin-top:2px;">
              £\${p.cost.toFixed(1)}m • \${p.selected_by}% Owned
            </div>
            \${newsHtml}
          </div>
          <div style="text-align:right;">
            <span style="font-size:16px; font-weight:800; font-family:var(--font-mono); color:#38bdf8;">\${p.proj.toFixed(2)}</span>
            <span style="font-size:10px; color:#94a3b8; display:block;">GW3 EP</span>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px; margin-top:8px;">
          <span style="font-size:10px; font-weight:700; color:\${rating.badgeColor}; font-family:var(--font-mono); text-transform:uppercase;">
            ● \${rating.label}
          </span>
          <span style="font-size:11px; font-family:var(--font-mono); color:#fff; font-weight:700;">
            Score: \${rating.overall}/10
          </span>
        </div>
      </div>
    \`;
  }).join('');
}

// ------------------------------------------
// RENDER: PLAYER COMPARISON
// ------------------------------------------
function renderComparison() {
  const pA = state.comparePlayerA || PLAYERS[0];
  const pB = state.comparePlayerB || PLAYERS[1];

  const rA = calculateRating(pA);
  const rB = calculateRating(pB);

  document.getElementById('comp-card-a').innerHTML = generateComparisonPlayerHTML(pA, rA);
  document.getElementById('comp-card-b').innerHTML = generateComparisonPlayerHTML(pB, rB);

  const delta = pA.proj - pB.proj;
  const betterPlayer = delta >= 0 ? pA : pB;
  const verdictText = delta >= 0 
    ? \`\${pA.name} is projected for +\${Math.abs(delta).toFixed(2)} more expected points than \${pB.name}. He provides elite goal volume under the 2026/27 model.\`
    : \`\${pB.name} is projected for +\${Math.abs(delta).toFixed(2)} more expected points than \${pA.name}, offering higher attacking upside.\`;

  document.getElementById('comp-verdict-banner').innerHTML = \`
    <div style="display:flex; align-items:center; gap:10px;">
      <span style="font-size:20px;">💡</span>
      <div>
        <strong style="color:#fff; font-size:13px;">Algorithmic Recommendation: Choose \${betterPlayer.name}</strong>
        <p style="font-size:12px; color:#cbd5e1; margin:2px 0 0 0;">\${verdictText}</p>
      </div>
    </div>
  \`;
}

function generateComparisonPlayerHTML(p, r) {
  const availBadge = getAvailabilityBadge(p);
  const newsHtml = p.news ? '<div style="font-size: 11px; color: ' + (p.status === 'i' || p.status === 'u' || p.status === 's' ? '#f87171' : '#fbbf24') + '; margin-top: 6px; padding: 4px 8px; background: rgba(0,0,0,0.3); border-radius: 4px;">⚠️ ' + p.news.replace(/"/g, '&quot;') + '</div>' : '';

  return \`
    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
      <div>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span class="badge-pos badge-\${getPosBadgeClass(p.pos)}">\${getPosName(p.pos)}</span>
          <strong style="font-size:16px; color:#fff;">\${p.name}</strong>
          \${availBadge}
        </div>
        <span style="font-size:11px; color:#94a3b8;">\${p.team} • £\${p.cost.toFixed(1)}m</span>
        \${newsHtml}
      </div>
      <div style="text-align:right;">
        <span style="font-size:20px; font-weight:800; font-family:var(--font-mono); color:#38bdf8;">\${p.proj.toFixed(2)}</span>
        <span style="font-size:10px; color:#94a3b8; display:block;">GW3 EXP PTS</span>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:8px; font-size:12px; font-family:var(--font-mono); margin-top:12px;">
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#94a3b8;">Overall Score</span>
        <strong style="color:#fff;">\${r.overall} / 10</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#94a3b8;">Value Rating</span>
        <strong style="color:#10b981;">\${r.value} / 10</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#94a3b8;">Reliability</span>
        <strong style="color:#fff;">\${r.reliability} / 10</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#94a3b8;">Minutes Played</span>
        <strong style="color:#fff;">\${p.mins}' (\${p.starts} starts)</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#94a3b8;">Underlying xG / xA</span>
        <strong style="color:#38bdf8;">\${p.xG} xG / \${p.xA} xA</strong>
      </div>
    </div>
  \`;
}

// ------------------------------------------
// RENDER: DECISION SIMULATOR
// ------------------------------------------
function renderSimulator() {
  const pIn = state.simInPlayer;
  const pOut = state.simOutPlayer;

  const pointDelta = pIn.proj - pOut.proj;
  const costDelta = pIn.cost - pOut.cost;

  document.getElementById('sim-pt-delta').innerText = \`\${pointDelta >= 0 ? '+' : ''}\${pointDelta.toFixed(2)} pts\`;
  document.getElementById('sim-pt-delta').style.color = pointDelta >= 0 ? '#10b981' : '#ef4444';
  
  document.getElementById('sim-cost-delta').innerText = \`\${costDelta > 0 ? '+' : ''}£\${costDelta.toFixed(1)}m\`;
  document.getElementById('sim-cost-delta').style.color = costDelta <= 0 ? '#10b981' : '#fff';

  const verdictTitle = pointDelta > 0.5 ? 'RECOMMENDED TRANSFER' : pointDelta > 0 ? 'MARGINAL GAIN' : 'UNFAVORABLE TRANSFER';
  const verdictColor = pointDelta > 0 ? '#10b981' : '#ef4444';

  document.getElementById('sim-verdict-box').innerHTML = \`
    <div style="padding:14px; border-radius:10px; background:\${verdictColor}10; border:1px solid \${verdictColor}30;">
      <strong style="color:\${verdictColor}; font-size:12px; text-transform:uppercase; font-family:var(--font-mono);">● \${verdictTitle}</strong>
      <p style="font-size:12px; color:#cbd5e1; margin:4px 0 0 0; line-height:1.5;">
        Swapping <strong>\${pOut.name}</strong> out for <strong>\${pIn.name}</strong> projects a net change of 
        <strong style="color:\${verdictColor}">\${pointDelta >= 0 ? '+' : ''}\${pointDelta.toFixed(2)} expected points</strong> 
        with a budget impact of £\${Math.abs(costDelta).toFixed(1)}m \${costDelta > 0 ? 'spent' : 'saved'}.
      </p>
    </div>
  \`;
}

// ------------------------------------------
// MODAL HANDLERS
// ------------------------------------------
function openPlayerModal(playerId) {
  const p = getPlayer(playerId);
  if (!p) return;

  const r = calculateRating(p);
  const modalBody = document.getElementById('player-modal-content');
  if (!modalBody) return;

  const inSquad = state.myTeam.some(x => x.id === p.id);
  const availBadge = getAvailabilityBadge(p);

  let availBanner = '';
  if (p.status === 'i' || p.status === 'u' || p.status === 's' || p.chance === 0) {
    availBanner = \`
      <div class="modal-avail-banner is-injured">
        <span style="font-size:18px;">🔴</span>
        <div>
          <strong style="color:#fca5a5; text-transform:uppercase; font-family:var(--font-mono);">
            \${p.status === 's' ? 'Suspended' : p.status === 'u' ? 'Unavailable / Transferred' : 'Injury Report'} (0% Chance of Playing)
          </strong>
          <p style="margin:2px 0 0 0; color:#fecaca;">\${p.news || 'Player is unavailable for the upcoming fixture.'}</p>
        </div>
      </div>
    \`;
  } else if (p.status === 'd' || (p.chance !== null && p.chance < 100)) {
    availBanner = \`
      <div class="modal-avail-banner is-doubt">
        <span style="font-size:18px;">🟡</span>
        <div>
          <strong style="color:#fde68a; text-transform:uppercase; font-family:var(--font-mono);">
            Availability Doubt (\${p.chance !== null ? p.chance : 50}% Chance of Playing)
          </strong>
          <p style="margin:2px 0 0 0; color:#fef3c7;">\${p.news || 'Player is doubtful for the upcoming fixture.'}</p>
        </div>
      </div>
    \`;
  }

  modalBody.innerHTML = \`
    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
      <div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="badge-pos badge-\${getPosBadgeClass(p.pos)}">\${getPosName(p.pos)}</span>
          <h3 style="font-size:20px; font-weight:800; color:#fff; margin:0;">\${p.name}</h3>
          \${availBadge}
        </div>
        <span style="font-size:12px; color:#94a3b8;">\${p.team} • Current Cost: £\${p.cost.toFixed(1)}m</span>
      </div>
      <div style="text-align:right;">
        <span style="font-size:24px; font-weight:800; font-family:var(--font-mono); color:#38bdf8;">\${p.proj.toFixed(2)}</span>
        <span style="font-size:10px; color:#94a3b8; display:block;">GW3 EXP PTS</span>
      </div>
    </div>

    \${availBanner}

    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:10px; padding:14px; margin-bottom:16px;">
      <strong style="font-size:11px; text-transform:uppercase; color:#38bdf8; font-family:var(--font-mono); display:block; margin-bottom:6px;">Season To Date (GW1+GW2 Completed)</strong>
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; text-align:center; font-family:var(--font-mono); margin-top:8px;">
        <div style="background:#090a0f; padding:8px; border-radius:6px;">
          <span style="font-size:10px; color:#64748b; display:block;">POINTS</span>
          <strong style="color:#fff; font-size:14px;">\${p.total}</strong>
        </div>
        <div style="background:#090a0f; padding:8px; border-radius:6px;">
          <span style="font-size:10px; color:#64748b; display:block;">MINUTES</span>
          <strong style="color:#fff; font-size:14px;">\${p.mins}'</strong>
        </div>
        <div style="background:#090a0f; padding:8px; border-radius:6px;">
          <span style="font-size:10px; color:#64748b; display:block;">GOALS</span>
          <strong style="color:#fff; font-size:14px;">\${p.g}</strong>
        </div>
        <div style="background:#090a0f; padding:8px; border-radius:6px;">
          <span style="font-size:10px; color:#64748b; display:block;">xG / xA</span>
          <strong style="color:#38bdf8; font-size:12px;">\${p.xG}</strong>
        </div>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:8px; margin-top:16px;">
      \${inSquad ? \`
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <button class="btn btn-secondary" onclick="setCaptainById(\${p.id}); closeModal('player-modal');">
            ⭐ Make Captain (2x)
          </button>
          <button class="btn btn-secondary" onclick="setViceCaptainById(\${p.id}); closeModal('player-modal');">
            🛡️ Make Vice-Captain
          </button>
        </div>
        <button class="btn btn-danger" style="width:100%; margin-top:4px;" onclick="removePlayerFromMyTeam(\${p.id}); closeModal('player-modal');">
          🗑️ Remove From My Team
        </button>
      \` : \`
        <button class="btn btn-primary" style="width:100%; padding:10px;" onclick="addPlayerToMyTeam(\${p.id}); closeModal('player-modal');">
          + Add to My Team Squad
        </button>
      \`}
    </div>
  \`;

  document.getElementById('player-modal').classList.add('open');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('open');
}

// ==========================================
// 4. INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  renderOptimalSquad();
  renderMyTeam();
});
`;

fs.writeFileSync('prototype/script.js', scriptContent);
console.log('Successfully wrote prototype/script.js with availability indicators and news');
