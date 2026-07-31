import { useState } from 'react';
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

  const fetchAndOptimize = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Fetch bootstrap-static data via local Express proxy
      setLoadingMessage('Fetching live player database from FPL API...');
      const bootstrapRes = await fetch('/api/bootstrap-static');
      if (!bootstrapRes.ok) {
        throw new Error(`bootstrap-static fetch failed with HTTP ${bootstrapRes.status}: ${bootstrapRes.statusText}`);
      }
      const bootstrapData = await bootstrapRes.json();

      if (!bootstrapData.elements || !bootstrapData.teams || !bootstrapData.events) {
        throw new Error('Incomplete data received from FPL bootstrap-static. Missing elements or teams.');
      }

      // 2. Fetch fixtures data
      setLoadingMessage('Fetching current fixture schedules & difficulty ratings...');
      const fixturesRes = await fetch('/api/fixtures');
      if (!fixturesRes.ok) {
        throw new Error(`fixtures fetch failed with HTTP ${fixturesRes.status}: ${fixturesRes.statusText}`);
      }
      const fixturesData = await fixturesRes.json();

      if (!Array.isArray(fixturesData)) {
        throw new Error('Incomplete fixtures data received. Response is not an array.');
      }

      // 3. Determine Current Gameweek
      setLoadingMessage('Analyzing gameweek deadlines & fixtures...');
      const currentEvent = bootstrapData.events.find((e: any) => e.is_current) 
                        || bootstrapData.events.find((e: any) => e.is_next) 
                        || bootstrapData.events[0];
      
      const gwId = currentEvent ? currentEvent.id : 1;
      const gwName = currentEvent ? currentEvent.name : `Gameweek ${gwId}`;
      setGameweekName(gwName);

      // 4. Calculate Projected Points
      setLoadingMessage('Calculating projected points adjusted for form, FDR, and availability...');
      const projection = calculateProjectedPoints(
        bootstrapData.elements,
        bootstrapData.teams,
        fixturesData,
        gwId
      );

      setIsPreSeason(projection.isPreSeason);

      // 5. Run Integer Linear Programming Solver
      setLoadingMessage('Running Simplex & Branch-and-Cut optimization model...');
      
      // Delay slightly for visual pacing and to show the current phase of the loader
      await new Promise(resolve => setTimeout(resolve, 600));

      const solverResult = solveSquad(projection.players);

      if (!solverResult.feasible) {
        throw new Error('The optimizer could not find a feasible selection matching all formation, budget, and squad limit rules.');
      }

      setResult(solverResult);
    } catch (err: any) {
      console.error(err);
      setError({
        message: err.message || 'An unexpected error occurred during execution.',
        action: 'Please ensure that your Express backend is running (npm run server) and that you are connected to the internet. If the FPL server is throttled or experiencing downtime, please try again in a few minutes.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Group starters by position
  const gks = result?.starters.filter(p => p.element_type === 1) || [];
  const defs = result?.starters.filter(p => p.element_type === 2) || [];
  const mids = result?.starters.filter(p => p.element_type === 3) || [];
  const fwds = result?.starters.filter(p => p.element_type === 4) || [];

  const renderPlayerRow = (player: Player, isStarter: boolean) => {
    const positionNames: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    const isCap = player.id === result?.captain?.id;
    const isVc = player.id === result?.viceCaptain?.id;
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
            <button 
              onClick={() => setShowHowToUse(true)}
              className="btn-outline"
            >
              <HelpCircle className="w-4 h-4" />
              How to Use
            </button>
            <button
              onClick={fetchAndOptimize}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get This Week's XI"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        
        {/* Info Banner when Pre-season Mode is Active */}
        {result && (
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
        {!result && !loading && !error && (
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
                  onClick={fetchAndOptimize}
                  className="mt-4 px-4 py-2 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.15)] text-white text-sm font-semibold rounded-lg transition-all"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Grid when solution loaded */}
        {result && !loading && (
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
                <div className="formation-badge">
                  {defs.length}-{mids.length}-{fwds.length} Formation
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
                      captainId={result.captain?.id} 
                      viceCaptainId={result.viceCaptain?.id} 
                    />
                  ))}
                </div>

                {/* DEF Row (Position 2) */}
                <div className="pitch-row" style={{ height: '26%' }}>
                  {defs.map(player => (
                    <PlayerPitchCard 
                      key={player.id} 
                      player={player} 
                      captainId={result.captain?.id} 
                      viceCaptainId={result.viceCaptain?.id} 
                    />
                  ))}
                </div>

                {/* MID Row (Position 3) */}
                <div className="pitch-row" style={{ height: '26%' }}>
                  {mids.map(player => (
                    <PlayerPitchCard 
                      key={player.id} 
                      player={player} 
                      captainId={result.captain?.id} 
                      viceCaptainId={result.viceCaptain?.id} 
                    />
                  ))}
                </div>

                {/* FWD Row (Position 4) */}
                <div className="pitch-row" style={{ height: '26%' }}>
                  {fwds.map(player => (
                    <PlayerPitchCard 
                      key={player.id} 
                      player={player} 
                      captainId={result.captain?.id} 
                      viceCaptainId={result.viceCaptain?.id} 
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
                  {result.bench.map((player) => {
                    const posClasses = ['gk', 'def', 'mid', 'fwd'];
                    const posClass = posClasses[player.element_type - 1] || 'mid';
                    const hasInjuryWarning = player.chance_of_playing_next_round < 75;

                    return (
                      <div 
                        key={player.id} 
                        className="bench-card info-trigger"
                        data-tooltip={`Name: ${player.web_name}\nClub: ${player.team_name}\nPrice: £${(player.now_cost / 10).toFixed(1)}m\nAvailability: ${player.chance_of_playing_next_round}%\nProjected Points: ${player.projected_points}`}
                      >
                        <div className={`w-8 h-8 rounded-full mb-1.5 flex items-center justify-center font-bold text-xs text-white pitch-shirt ${posClass}`}>
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
                {result.alternatives.length === 0 ? (
                  <p className="text-xs text-gray-400 m-0">
                    No points projection ties occurred for the selected positions in this squad configuration.
                  </p>
                ) : (
                  <div className="tiebreaker-container">
                    {result.alternatives.map((alt, idx) => (
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
                    <span className="metric-card-value">£{result.totalCost}m</span>
                    <span className="metric-card-subtext">out of £100.0m limit</span>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-title">
                      <TrendingUp className="w-3.5 h-3.5 text-[#02c39a]" />
                      <span>Projected Points</span>
                    </div>
                    <span className="metric-card-value" style={{ color: '#02c39a' }}>{result.totalProjectedPoints}</span>
                    <span className="metric-card-subtext">Starting XI Sum</span>
                  </div>
                </div>

                <div className="metric-full-row">
                  <span className="text-xs text-gray-400">Total 15-Man Squad Projected Points:</span>
                  <span className="text-sm font-bold text-white">{result.squadProjectedPoints}</span>
                </div>

                <div className="captain-panel">
                  <div className="captain-card">
                    <Award className="w-8 h-8 text-[#02c39a]" />
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Suggested Captain</div>
                      <div className="text-sm font-bold text-white">{result.captain?.web_name} ({result.captain?.projected_points} pts)</div>
                      <div className="text-[10px] text-gray-400">Vice-Captain: {result.viceCaptain?.web_name} ({result.viceCaptain?.projected_points} pts)</div>
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
                      {result.starters.map((player) => renderPlayerRow(player, true))}
                      
                      <tr className="row-category-bench">
                        <td colSpan={6}>Bench (4 Players)</td>
                      </tr>
                      {result.bench.map((player) => renderPlayerRow(player, false))}
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
