import { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  HelpCircle, 
  Loader2, 
  DollarSign, 
  Award, 
  TrendingUp, 
  UserCheck, 
  Users, 
  AlertTriangle,
  Flame,
  Calendar,
  X
} from 'lucide-react';
import { calculateProjectedPoints } from './utils/pointsProjection';
import type { Player } from './utils/pointsProjection';
import { solveSquad } from './utils/fplSolver';
import type { SolverResult } from './utils/fplSolver';

function App() {
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<{ message: string; action: string } | null>(null);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [isPreSeason, setIsPreSeason] = useState<boolean>(false);
  const [gameweekName, setGameweekName] = useState<string>('');
  const [showHowToUse, setShowHowToUse] = useState<boolean>(false);

  // FPL Decision Dashboard state additions
  const [mode, setMode] = useState<'optimal' | 'my-team'>('optimal');
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [myTeamSquad, setMyTeamSquad] = useState<Player[]>(() => {
    try {
      const saved = localStorage.getItem('fpl_optimizer_my_team');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [myTeamResult, setMyTeamResult] = useState<SolverResult | null>(null);

  // Search autocomplete states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<'all' | 'gk' | 'def' | 'mid' | 'fwd'>('all');

  // Load database on mount
  const loadInitialData = async (force: boolean = false): Promise<Player[]> => {
    if (allPlayers.length > 0 && !force) {
      return allPlayers;
    }

    setLoading(true);
    setError(null);
    setLoadingMessage('Fetching live player database from FPL API...');

    try {
      const bootstrapRes = await fetch('/api/bootstrap-static');
      if (!bootstrapRes.ok) {
        throw new Error(`bootstrap-static fetch failed with HTTP ${bootstrapRes.status}: ${bootstrapRes.statusText}`);
      }
      const bootstrapData = await bootstrapRes.json();

      if (!bootstrapData.elements || !bootstrapData.teams || !bootstrapData.events) {
        throw new Error('Incomplete data received from FPL bootstrap-static. Missing elements or teams.');
      }

      setLoadingMessage('Fetching current fixture schedules & difficulty ratings...');
      const fixturesRes = await fetch('/api/fixtures');
      if (!fixturesRes.ok) {
        throw new Error(`fixtures fetch failed with HTTP ${fixturesRes.status}: ${fixturesRes.statusText}`);
      }
      const fixturesData = await fixturesRes.json();

      if (!Array.isArray(fixturesData)) {
        throw new Error('Incomplete fixtures data received. Response is not an array.');
      }

      const currentEvent = bootstrapData.events.find((e: any) => e.is_current) 
                        || bootstrapData.events.find((e: any) => e.is_next) 
                        || bootstrapData.events[0];
      
      const gwId = currentEvent ? currentEvent.id : 1;
      const gwName = currentEvent ? currentEvent.name : `Gameweek ${gwId}`;
      setGameweekName(gwName);

      const projection = calculateProjectedPoints(
        bootstrapData.elements,
        bootstrapData.teams,
        fixturesData,
        gwId
      );

      setIsPreSeason(projection.isPreSeason);
      setAllPlayers(projection.players);
      return projection.players;
    } catch (err: any) {
      console.error(err);
      setError({
        message: err.message || 'An unexpected error occurred during execution.',
        action: 'Please ensure that your Express backend is running (npm run server) and that you are connected to the internet. If the FPL server is throttled or experiencing downtime, please try again in a few minutes.'
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData().catch(() => {});
  }, []);

  const fetchAndOptimize = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const players = await loadInitialData();
      
      setLoading(true);
      setLoadingMessage('Running Simplex & Branch-and-Cut optimization model...');
      
      // Delay slightly for visual pacing
      await new Promise(resolve => setTimeout(resolve, 600));

      const solverResult = solveSquad(players);

      if (!solverResult.feasible) {
        throw new Error('The optimizer could not find a feasible selection matching all formation, budget, and squad limit rules.');
      }

      setResult(solverResult);
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch failed')) {
        setError({
          message: err.message || 'Optimization failed.',
          action: 'Adjust search queries or constraints and try again.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const optimizeMyTeam = async () => {
    if (myTeamSquad.length !== 15) return;
    setLoading(true);
    setError(null);
    setLoadingMessage('Optimizing Starting XI & Bench Order for My Team...');

    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      const solverResult = solveSquad(myTeamSquad);
      if (!solverResult.feasible) {
        throw new Error('Could not optimize Starting XI. Please make sure the selected 15 players satisfy positions: 2 GK, 5 DEF, 5 MID, 3 FWD.');
      }
      setMyTeamResult(solverResult);
    } catch (err: any) {
      setError({
        message: err.message || 'Optimization failed.',
        action: 'Ensure your drafted squad is valid under FPL rules and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Live drafting methods
  const addPlayerToMyTeam = (player: Player) => {
    if (myTeamSquad.some(p => p.id === player.id)) return;
    if (myTeamSquad.length >= 15) return;
    
    const pos = player.element_type;
    const currentPosCount = myTeamSquad.filter(p => p.element_type === pos).length;
    const maxPos = pos === 1 ? 2 : pos === 2 ? 5 : pos === 3 ? 5 : 3;
    if (currentPosCount >= maxPos) return;

    const clubCount = myTeamSquad.filter(p => p.team === player.team).length;
    if (clubCount >= 3) return;

    const newSquad = [...myTeamSquad, player];
    setMyTeamSquad(newSquad);
    localStorage.setItem('fpl_optimizer_my_team', JSON.stringify(newSquad));
    setMyTeamResult(null);
  };

  const removePlayerFromMyTeam = (playerId: number) => {
    const newSquad = myTeamSquad.filter(p => p.id !== playerId);
    setMyTeamSquad(newSquad);
    localStorage.setItem('fpl_optimizer_my_team', JSON.stringify(newSquad));
    setMyTeamResult(null);
  };

  // Resolve active result
  const activeResult = mode === 'optimal' ? result : myTeamResult;

  // Group starters by position
  const gks = activeResult?.starters.filter(p => p.element_type === 1) || [];
  const defs = activeResult?.starters.filter(p => p.element_type === 2) || [];
  const mids = activeResult?.starters.filter(p => p.element_type === 3) || [];
  const fwds = activeResult?.starters.filter(p => p.element_type === 4) || [];

  const renderPlayerRow = (player: Player, isStarter: boolean) => {
    const positionNames: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    const isCap = player.id === activeResult?.captain?.id;
    const isVc = player.id === activeResult?.viceCaptain?.id;
    const hasInjuryWarning = player.chance_of_playing_next_round < 75;

    return (
      <tr key={player.id}>
        <td>
          <div className="flex flex-col">
            <span className="font-semibold text-white flex items-center gap-1.5">
              {player.web_name}
              {isStarter && isCap && <span className="text-[9px] bg-[#e74c3c] text-white px-1 rounded font-bold">C</span>}
              {isStarter && isVc && <span className="text-[9px] bg-[#34495e] text-white px-1 rounded font-bold">VC</span>}
            </span>
            {hasInjuryWarning && (
              <span className="text-[9px] text-[#f7b731] font-semibold flex items-center gap-0.5 mt-0.5">
                🤕 {player.chance_of_playing_next_round}% chance
              </span>
            )}
          </div>
        </td>
        <td className="text-gray-400 font-mono text-xs">{positionNames[player.element_type]}</td>
        <td className="text-gray-300 text-xs">{player.team_short_name}</td>
        <td className="text-gray-300 font-mono text-xs">£{(player.now_cost / 10).toFixed(1)}m</td>
        <td className="text-gray-400 font-mono text-xs">{isPreSeason ? player.form.toFixed(1) : player.form.toFixed(1)}</td>
        <td className="text-[#02c39a] font-bold font-mono text-xs">{player.projected_points}</td>
      </tr>
    );
  };

  // Live validation calculations for myTeamSquad
  const myTeamCost = myTeamSquad.reduce((acc, p) => acc + p.now_cost, 0); // in tenths, e.g. 985
  const myTeamCostMillions = myTeamCost / 10;
  const budgetRemaining = 100.0 - myTeamCostMillions;

  const gkCount = myTeamSquad.filter(p => p.element_type === 1).length;
  const defCount = myTeamSquad.filter(p => p.element_type === 2).length;
  const midCount = myTeamSquad.filter(p => p.element_type === 3).length;
  const fwdCount = myTeamSquad.filter(p => p.element_type === 4).length;

  // Club limits (max 3 per team)
  const clubCounts: Record<string, number> = {};
  myTeamSquad.forEach(p => {
    clubCounts[p.team_name] = (clubCounts[p.team_name] || 0) + 1;
  });

  // Check if squad is valid
  const isMyTeamValid = 
    myTeamSquad.length === 15 &&
    gkCount === 2 &&
    defCount === 5 &&
    midCount === 5 &&
    fwdCount === 3 &&
    myTeamCost <= 1000 &&
    Object.values(clubCounts).every(c => c <= 3);

  return (
    <div className="min-h-screen pb-12">
      {/* Top Navigation / Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="logo-section">
            <div className="logo-icon-wrapper">
              <Flame className="logo-icon" />
            </div>
            <div>
              <h1 className="logo-title">FPL OPTIMIZER</h1>
              <span className="logo-subtitle">COMBINED 15-MAN SOLVER</span>
            </div>
          </div>
          <div className="header-actions">
            {/* Mode Toggle */}
            <div className="mode-toggle-container">
              <button
                onClick={() => {
                  setMode('optimal');
                  setError(null);
                }}
                className={`mode-toggle-btn ${mode === 'optimal' ? 'active' : ''}`}
              >
                Optimal Squad
              </button>
              <button
                onClick={() => {
                  setMode('my-team');
                  setError(null);
                }}
                className={`mode-toggle-btn ${mode === 'my-team' ? 'active' : ''}`}
              >
                My Team
              </button>
            </div>
            <button 
              onClick={() => setShowHowToUse(true)}
              className="btn-outline"
            >
              <HelpCircle className="w-4 h-4" />
              How to Use
            </button>
            {mode === 'optimal' && (
              <button
                onClick={fetchAndOptimize}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get This Week's XI"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        
        {/* Info Banner when Pre-season Mode is Active */}
        {activeResult && (
          <div className={`banner-panel ${isPreSeason ? 'banner-preseason' : 'banner-inseason'}`}>
            {isPreSeason ? (
              <>
                <AlertTriangle className="w-6 h-6 text-[#f7b731] shrink-0" />
                <div>
                  <h4 className="text-white font-semibold text-sm m-0">Pre-season Projection Mode Active</h4>
                  <p className="text-xs text-gray-400 m-0 mt-1">
                    FPL player form values are reset to 0.0 before Gameweek 1. The projection engine has automatically fallen back to using last season's <strong>Points Per Game (PPG)</strong> as the baseline score. Fixture difficulty multipliers are still applied normally.
                  </p>
                </div>
              </>
            ) : (
              <>
                <UserCheck className="w-6 h-6 text-[#02c39a] shrink-0" />
                <div>
                  <h4 className="text-white font-semibold text-sm m-0">In-season Live Mode Active</h4>
                  <p className="text-xs text-gray-400 m-0 mt-1">
                    Projections are calculated based on active, real-time player <strong>form</strong> (last 30 days performance average) from the official FPL database, adjusted for fixture difficulties.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Welcome Area when no result is loaded */}
        {!result && !loading && !error && mode === 'optimal' && (
          <div className="glass-panel text-center py-16 max-w-2xl mx-auto mt-12">
            <Flame className="w-16 h-16 text-[#02c39a] mx-auto mb-4 opacity-80" />
            <h2 className="text-2xl font-bold text-white mb-2">Optimize Your Squad for the Current Gameweek</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-8">
              Analyze player data directly from the official Premier League API. Find the mathematically optimal 15-player squad and starting XI using our combined integer linear programming optimizer.
            </p>
            <button
              onClick={fetchAndOptimize}
              className="btn-primary btn-large pulse-btn mx-auto"
            >
              Get This Week's XI
            </button>
          </div>
        )}

        {/* Squad Builder Drafting Area for My Team Mode */}
        {mode === 'my-team' && !myTeamResult && !loading && !error && (
          <div className="dashboard-grid">
            {/* Left Column: Autocomplete Search + Drafted Roster List */}
            <div className="grid-left-col">
              <div className="glass-panel">
                <h4 className="text-white font-bold text-sm mb-4 tracking-wider text-left">DRAFT YOUR 15-PLAYER SQUAD</h4>
                
                <div className="search-picker-card">
                  <div className="search-input-wrapper">
                    <input
                      type="text"
                      placeholder="Search players by name or club (min 2 characters)..."
                      className="search-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="search-filters-row">
                    {['all', 'gk', 'def', 'mid', 'fwd'].map((pos) => (
                      <button
                        key={pos}
                        onClick={() => setPositionFilter(pos as any)}
                        className={`filter-chip ${positionFilter === pos ? 'active' : ''}`}
                      >
                        {pos.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {searchQuery.length >= 2 ? (
                    <div className="autocomplete-dropdown custom-scrollbar">
                      {(() => {
                        const q = searchQuery.toLowerCase();
                        const posMap: Record<string, number> = { gk: 1, def: 2, mid: 3, fwd: 4 };
                        const filtered = allPlayers.filter(p => {
                          const matchesQuery = p.web_name.toLowerCase().includes(q) || 
                                               p.team_name.toLowerCase().includes(q) || 
                                               p.team_short_name.toLowerCase().includes(q);
                          if (!matchesQuery) return false;
                          if (positionFilter !== 'all' && p.element_type !== posMap[positionFilter]) return false;
                          return true;
                        });

                        if (filtered.length === 0) {
                          return <div className="p-4 text-xs text-gray-400 text-center">No matching players found</div>;
                        }

                        return filtered.slice(0, 10).map((player) => {
                          const isAdded = myTeamSquad.some(p => p.id === player.id);
                          const posNames = ['GK', 'DEF', 'MID', 'FWD'];
                          const posName = posNames[player.element_type - 1];
                          
                          const currentPosCount = myTeamSquad.filter(p => p.element_type === player.element_type).length;
                          const maxPos = player.element_type === 1 ? 2 : player.element_type === 2 ? 5 : player.element_type === 3 ? 5 : 3;
                          const isPosFull = currentPosCount >= maxPos;
                          
                          const clubCount = myTeamSquad.filter(p => p.team === player.team).length;
                          const isClubFull = clubCount >= 3;
                          
                          const isSquadFull = myTeamSquad.length >= 15;
                          
                          const canAdd = !isAdded && !isPosFull && !isClubFull && !isSquadFull;

                          let disableReason = '';
                          if (isAdded) disableReason = 'Added';
                          else if (isSquadFull) disableReason = 'Squad Full';
                          else if (isPosFull) disableReason = `${posName} Full`;
                          else if (isClubFull) disableReason = 'Club Max 3';

                          return (
                            <div key={player.id} className="dropdown-row">
                              <div className="player-row-details">
                                <span className="player-row-name">{player.web_name}</span>
                                <span className="player-row-sub">
                                  {posName} | {player.team_short_name} | £{(player.now_cost / 10).toFixed(1)}m | Proj: {player.projected_points} pts
                                </span>
                              </div>
                              <button
                                disabled={!canAdd}
                                onClick={() => {
                                  addPlayerToMyTeam(player);
                                  setSearchQuery('');
                                }}
                                className="btn-add-player"
                              >
                                {disableReason || 'Add'}
                              </button>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="p-4 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] border-dashed rounded-xl text-center text-xs text-gray-400">
                      Type at least 2 characters to search for players...
                    </div>
                  )}
                </div>

                <div className="border-t border-[rgba(255,255,255,0.08)] pt-4">
                  <h5 className="text-white font-bold text-xs uppercase tracking-wider mb-2 text-left">Drafted Roster ({myTeamSquad.length} / 15)</h5>
                  {myTeamSquad.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500 italic">No players drafted yet. Use the search bar above to build your squad.</div>
                  ) : (
                    <div className="roster-list custom-scrollbar" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                      {myTeamSquad
                        .sort((a, b) => {
                          if (a.element_type !== b.element_type) return a.element_type - b.element_type;
                          return b.projected_points - a.projected_points;
                        })
                        .map((player) => {
                          const posNames = ['GK', 'DEF', 'MID', 'FWD'];
                          const posName = posNames[player.element_type - 1];
                          return (
                            <div key={player.id} className="roster-item">
                              <div className="text-left">
                                <span className="font-semibold text-white text-xs block">{player.web_name}</span>
                                <span className="text-[10px] text-gray-400">
                                  {posName} | {player.team_short_name} | £{(player.now_cost / 10).toFixed(1)}m | Proj: {player.projected_points} pts
                                </span>
                              </div>
                              <button
                                onClick={() => removePlayerFromMyTeam(player.id)}
                                className="btn-remove-player"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Validation Metrics Panel */}
            <div className="grid-right-col">
              <div className="glass-panel">
                <h4 className="text-white font-bold text-sm mb-4 tracking-wider text-left">SQUAD VALIDATION</h4>
                
                <div className="validation-card text-left">
                  {/* Budget Meter */}
                  <div>
                    <div className="validation-metric-row">
                      <span className="validation-metric-label">Squad Cost</span>
                      <span className="validation-metric-value">£{myTeamCostMillions.toFixed(1)}m / £100.0m</span>
                    </div>
                    <div className="validation-progress-bg">
                      <div 
                        className={`validation-progress-fill ${myTeamCost > 1000 ? 'over' : ''}`}
                        style={{ width: `${Math.min((myTeamCost / 1000) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-1">
                      {budgetRemaining >= 0 
                        ? `£${budgetRemaining.toFixed(1)}m remaining` 
                        : `£${Math.abs(budgetRemaining).toFixed(1)}m over budget!`}
                    </span>
                  </div>

                  <hr className="border-[rgba(255,255,255,0.06)]" />

                  {/* Position Quotas */}
                  <div className="flex flex-col gap-3">
                    <div className="validation-metric-row">
                      <span className="validation-metric-label">Positions Selected</span>
                      <span className="validation-metric-value">{myTeamSquad.length} / 15 Players</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Goalkeepers (GK)</span>
                        <span className={`font-bold ${gkCount === 2 ? 'text-[#02c39a]' : gkCount > 2 ? 'text-[#e74c3c]' : 'text-white'}`}>{gkCount} / 2</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Defenders (DEF)</span>
                        <span className={`font-bold ${defCount === 5 ? 'text-[#02c39a]' : defCount > 5 ? 'text-[#e74c3c]' : 'text-white'}`}>{defCount} / 5</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Midfielders (MID)</span>
                        <span className={`font-bold ${midCount === 5 ? 'text-[#02c39a]' : midCount > 5 ? 'text-[#e74c3c]' : 'text-white'}`}>{midCount} / 5</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Forwards (FWD)</span>
                        <span className={`font-bold ${fwdCount === 3 ? 'text-[#02c39a]' : fwdCount > 3 ? 'text-[#e74c3c]' : 'text-white'}`}>{fwdCount} / 3</span>
                      </div>
                    </div>
                  </div>

                  <hr className="border-[rgba(255,255,255,0.06)]" />

                  {/* Club Limits */}
                  <div>
                    <div className="validation-metric-row">
                      <span className="validation-metric-label">Club Counts</span>
                      <span className="text-xs text-gray-400">(Max 3 per club)</span>
                    </div>
                    
                    {Object.keys(clubCounts).length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-500 italic">No clubs selected.</div>
                    ) : (
                      <div className="club-counts-grid custom-scrollbar" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                        {Object.entries(clubCounts).map(([teamName, count]) => {
                          const hasError = count > 3;
                          return (
                            <div 
                              key={teamName} 
                              className={`club-count-badge ${hasError ? 'error' : count === 3 ? 'warning' : ''}`}
                            >
                              {teamName}: {count}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  disabled={!isMyTeamValid}
                  onClick={optimizeMyTeam}
                  className="btn-primary w-full justify-center mt-8 py-3 text-base"
                >
                  Optimize My Team
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="glass-panel text-center py-16 max-w-md mx-auto mt-12">
            <Loader2 className="w-12 h-12 text-[#02c39a] animate-spin mx-auto mb-4" />
            <h3 className="text-white font-semibold text-lg mb-1">Crunching Numbers...</h3>
            <p className="text-gray-400 text-sm">{loadingMessage}</p>
          </div>
        )}

        {/* Error boundary / panel */}
        {error && (
          <div className="glass-panel max-w-xl mx-auto border-t-4 border-t-[#eb4d4b] mt-12">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-[#eb4d4b] shrink-0" />
              <div>
                <h3 className="text-white font-bold text-base m-0">Failed to Retrieve FPL Squad</h3>
                <p className="text-gray-300 text-sm mt-2 font-semibold">Error details:</p>
                <div className="bg-[rgba(235,77,75,0.08)] border border-[rgba(235,77,75,0.2)] rounded-lg p-3 text-xs text-[#ff7675] font-mono whitespace-normal mb-3">
                  {error.message}
                </div>
                <p className="text-gray-400 text-xs mt-2 font-semibold">What to do:</p>
                <p className="text-gray-400 text-xs m-0">{error.action}</p>
                <button
                  onClick={mode === 'optimal' ? fetchAndOptimize : optimizeMyTeam}
                  className="mt-4 px-4 py-2 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.15)] text-white text-sm font-semibold rounded-lg transition-all"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Grid when solution loaded */}
        {activeResult && !loading && (
          <div className="dashboard-grid">
            
            {/* LEFT COLUMN: Visual Football Pitch + Bench row (8 columns) */}
            <div className="grid-left-col">
              
              {/* Squad Header */}
              <div className="squad-title-row">
                <div>
                  <h3 className="text-lg font-bold text-white m-0">Optimal Starting XI</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>Selected for {gameweekName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {mode === 'my-team' && (
                    <button
                      onClick={() => setMyTeamResult(null)}
                      className="btn-outline"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                    >
                      Edit Squad
                    </button>
                  )}
                  <div className="formation-badge">
                    {defs.length}-{mids.length}-{fwds.length} Formation
                  </div>
                </div>
              </div>

              {/* Pitch Visual */}
              <div className="pitch-container">
                <div className="pitch-half-line"></div>
                <div className="pitch-center-circle"></div>
                <div className="pitch-box-top"></div>
                <div className="pitch-box-bottom"></div>

                {/* GK Row (Position 1) */}
                <div className="pitch-row" style={{ height: '22%' }}>
                  {gks.map(player => (
                    <PlayerPitchCard 
                      key={player.id} 
                      player={player} 
                      captainId={activeResult.captain?.id} 
                      viceCaptainId={activeResult.viceCaptain?.id} 
                    />
                  ))}
                </div>

                {/* DEF Row (Position 2) */}
                <div className="pitch-row" style={{ height: '26%' }}>
                  {defs.map(player => (
                    <PlayerPitchCard 
                      key={player.id} 
                      player={player} 
                      captainId={activeResult.captain?.id} 
                      viceCaptainId={activeResult.viceCaptain?.id} 
                    />
                  ))}
                </div>

                {/* MID Row (Position 3) */}
                <div className="pitch-row" style={{ height: '26%' }}>
                  {mids.map(player => (
                    <PlayerPitchCard 
                      key={player.id} 
                      player={player} 
                      captainId={activeResult.captain?.id} 
                      viceCaptainId={activeResult.viceCaptain?.id} 
                    />
                  ))}
                </div>

                {/* FWD Row (Position 4) */}
                <div className="pitch-row" style={{ height: '26%' }}>
                  {fwds.map(player => (
                    <PlayerPitchCard 
                      key={player.id} 
                      player={player} 
                      captainId={activeResult.captain?.id} 
                      viceCaptainId={activeResult.viceCaptain?.id} 
                    />
                  ))}
                </div>
              </div>

              {/* Bench Row Panel */}
              <div className="glass-panel">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-[#3a86c8]" />
                  <h4 className="text-white font-bold text-sm m-0">Bench Players</h4>
                </div>
                <div className="bench-grid">
                  {activeResult.bench.map((player, idx) => {
                    const posClasses = ['gk', 'def', 'mid', 'fwd'];
                    const posClass = posClasses[player.element_type - 1] || 'mid';
                    const hasInjuryWarning = player.chance_of_playing_next_round < 75;

                    const benchLabel = player.element_type === 1 
                      ? 'Reserve GK' 
                      : `Bench ${idx + 1}`;

                    return (
                      <div 
                        key={player.id} 
                        className="bench-card info-trigger"
                        data-tooltip={`Name: ${player.web_name}\nClub: ${player.team_name}\nPrice: £${(player.now_cost / 10).toFixed(1)}m\nAvailability: ${player.chance_of_playing_next_round}%\nProjected Points: ${player.projected_points}`}
                      >
                        <span className="bench-role-label">{benchLabel}</span>
                        <div className={`w-8 h-8 rounded-full mb-1.5 flex items-center justify-center font-bold text-xs text-white pitch-shirt ${posClass}`} style={{ marginTop: '8px' }}>
                          {player.web_name[0]}
                          {hasInjuryWarning && <div className="badge-warning">!</div>}
                        </div>
                        <span className="text-xs font-semibold text-white block truncate w-full">{player.web_name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">£{(player.now_cost / 10).toFixed(1)}m</span>
                        <span className="text-xs font-bold text-[#02c39a] mt-1">{player.projected_points} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tie-breaker Notifications Panel */}
              <div className="glass-panel">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-[#3a86c8]" />
                  <h4 className="text-white font-bold text-sm m-0">Tie-Breaking Resolution Notes</h4>
                </div>
                {activeResult.alternatives.length === 0 ? (
                  <p className="text-xs text-gray-400 m-0">
                    No points projection ties occurred for the selected positions in this squad configuration.
                  </p>
                ) : (
                  <div className="tiebreaker-container">
                    {activeResult.alternatives.map((alt, idx) => (
                      <div key={idx} className="tiebreaker-item">
                        <strong>Tie Resolved:</strong> Selected <strong>{alt.selectedPlayerName}</strong> over <strong>{alt.alternativePlayerName}</strong> for the squad. Both players projected at <strong>{alt.projectedPoints}</strong> points, but {alt.selectedPlayerName} was selected due to a lower ownership percentage (<strong>{alt.selectedOwnership}%</strong> vs <strong>{alt.alternativeOwnership}%</strong>).
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT COLUMN: Squad Statistics + List Breakdown (5 columns) */}
            <div className="grid-right-col">
              
              {/* Summary Numbers Card */}
              <div className="glass-panel">
                <h4 className="text-white font-bold text-sm mb-4 tracking-wider">SQUAD SUMMARY</h4>
                
                <div className="metrics-row">
                  <div className="metric-card">
                    <div className="metric-card-title">
                      <DollarSign className="w-3.5 h-3.5 text-[#02c39a]" />
                      <span>Budget Spent</span>
                    </div>
                    <span className="metric-card-value">£{activeResult.totalCost}m</span>
                    <span className="metric-card-subtext">out of £100.0m limit</span>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-title">
                      <TrendingUp className="w-3.5 h-3.5 text-[#02c39a]" />
                      <span>Starting Points</span>
                    </div>
                    <span className="metric-card-value" style={{ color: '#02c39a' }}>{activeResult.totalProjectedPoints}</span>
                    <span className="metric-card-subtext">Starting XI Expected</span>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-title">
                      <Users className="w-3.5 h-3.5 text-[#3a86c8]" />
                      <span>Bench Points</span>
                    </div>
                    <span className="metric-card-value" style={{ color: '#3a86c8' }}>
                      {Math.round(activeResult.bench.reduce((acc, p) => acc + p.projected_points, 0) * 100) / 100}
                    </span>
                    <span className="metric-card-subtext">Bench Expected</span>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-title">
                      <Calendar className="w-3.5 h-3.5 text-[#f7b731]" />
                      <span>Formation</span>
                    </div>
                    <span className="metric-card-value">{defs.length}-{mids.length}-{fwds.length}</span>
                    <span className="metric-card-subtext">Starting Structure</span>
                  </div>
                </div>

                <div className="metric-full-row">
                  <span className="text-xs text-gray-400">Total 15-Man Squad Projected Points:</span>
                  <span className="text-sm font-bold text-white">{activeResult.squadProjectedPoints}</span>
                </div>

                <div className="captain-panel">
                  <div className="captain-card">
                    <Award className="w-8 h-8 text-[#02c39a]" />
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Suggested Captain</div>
                      <div className="text-sm font-bold text-white">{activeResult.captain?.web_name} ({activeResult.captain?.projected_points} pts)</div>
                      <div className="text-[10px] text-gray-400">Vice-Captain: {activeResult.viceCaptain?.web_name} ({activeResult.viceCaptain?.projected_points} pts)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Roster Table List */}
              <div className="glass-panel">
                <h4 className="text-white font-bold text-sm mb-4 tracking-wider">PLAYER BREAKDOWN</h4>
                
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Pos</th>
                        <th>Club</th>
                        <th>Price</th>
                        <th>{isPreSeason ? 'PPG' : 'Form'}</th>
                        <th>Proj Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="row-category-starters">
                        <td colSpan={6}>Starting XI (11 Players)</td>
                      </tr>
                      {activeResult.starters.map((player) => renderPlayerRow(player, true))}
                      
                      <tr className="row-category-bench">
                        <td colSpan={6}>Bench (4 Players)</td>
                      </tr>
                      {activeResult.bench.map((player) => renderPlayerRow(player, false))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* How to Use Modal */}
      {showHowToUse && (
        <div className="modal-overlay">
          <div className="modal-content relative">
            <button 
              onClick={() => setShowHowToUse(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#02c39a]" />
              How to Use FPL Squad Optimizer
            </h3>
            
            <div className="flex flex-col gap-4 text-sm text-gray-300">
              <div className="flex gap-3">
                <div className="bg-[#02c39a]/10 text-[#02c39a] w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 text-xs mt-0.5">1</div>
                <div>
                  <h5 className="text-white font-semibold m-0 text-sm">Initialize Data Load</h5>
                  <p className="m-0 mt-1 text-gray-400 text-xs">
                    Click the **"Get This Week's XI"** button in the header. This signals the Node.js backend server to query the live Premier League database.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="bg-[#02c39a]/10 text-[#02c39a] w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 text-xs mt-0.5">2</div>
                <div>
                  <h5 className="text-white font-semibold m-0 text-sm">Points Projection Processing</h5>
                  <p className="m-0 mt-1 text-gray-400 text-xs">
                    The app maps current team fixture difficulties (FDR) and combines them with player form and playing availability rates to project individual gameweek scores.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="bg-[#02c39a]/10 text-[#02c39a] w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 text-xs mt-0.5">3</div>
                <div>
                  <h5 className="text-white font-semibold m-0 text-sm">Combined 15-Man ILP Optimization</h5>
                  <p className="m-0 mt-1 text-gray-400 text-xs">
                    Using a single combined Integer Linear Programming (ILP) formulation, the solver selects a 15-man squad within the £100m budget and club constraints, and simultaneously picks the starting 11 to maximize total starting points + 15% of bench points.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="bg-[#02c39a]/10 text-[#02c39a] w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 text-xs mt-0.5">4</div>
                <div>
                  <h5 className="text-white font-semibold m-0 text-sm">Review Recommended Squad</h5>
                  <p className="m-0 mt-1 text-gray-400 text-xs">
                    Inspect the starting 11 on the pitch, review the 4 bench players in the bench panel, and look out for suggested Captain (C) and Vice-Captain (VC) selections.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[rgba(255,255,255,0.08)] flex justify-end">
              <button 
                onClick={() => setShowHowToUse(false)}
                className="px-5 py-2 bg-[#02c39a] hover:bg-[#02a481] text-black font-semibold text-sm rounded-lg transition-all cursor-pointer"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Pitch Card
interface PitchCardProps {
  player: Player;
  captainId?: number;
  viceCaptainId?: number;
}

function PlayerPitchCard({ player, captainId, viceCaptainId }: PitchCardProps) {
  const isCap = player.id === captainId;
  const isVc = player.id === viceCaptainId;
  const positionClasses = ['gk', 'def', 'mid', 'fwd'];
  const posClass = positionClasses[player.element_type - 1] || 'mid';
  const hasInjuryWarning = player.chance_of_playing_next_round < 75;

  const tooltipText = `Name: ${player.web_name}\nClub: ${player.team_name}\nPrice: £${(player.now_cost / 10).toFixed(1)}m\nAvailability: ${player.chance_of_playing_next_round}%\nProjected Points: ${player.projected_points}`;

  return (
    <div 
      className="pitch-player-card info-trigger" 
      data-tooltip={tooltipText}
    >
      <div className={`pitch-shirt ${posClass}`}>
        {player.web_name[0]}
        {isCap && <div className="badge-c">C</div>}
        {isVc && <div className="badge-vc">VC</div>}
        {hasInjuryWarning && <div className="badge-warning">!</div>}
      </div>
      <div className="pitch-player-info">
        <span className="pitch-player-name">{player.web_name}</span>
        <span className="pitch-player-points">{player.projected_points} pts</span>
      </div>
    </div>
  );
}

export default App;
