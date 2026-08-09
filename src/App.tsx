import { useState, useEffect, useMemo } from 'react';
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
import { calculatePlayerRatings } from './utils/recommendationEngine';
import { generateOptimizationExplanation } from './utils/explainabilityEngine';
import type { OptimizationExplanation } from './utils/explainabilityEngine';
import { comparePlayers, simulateDecision } from './utils/decisionSimulator';
import { PlayerPicker } from './components/PlayerPicker';
import { calculateChipVerdicts } from './utils/chipDecisionEngine';
import type { UserChipState } from './utils/chipDecisionEngine';

function App() {
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<{ message: string; action: string } | null>(null);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [isPreSeason, setIsPreSeason] = useState<boolean>(false);
  const [gameweekName, setGameweekName] = useState<string>('');
  const [showHowToUse, setShowHowToUse] = useState<boolean>(false);

  // Chip state additions
  const [bootstrapData, setBootstrapData] = useState<any>(null);
  const [fixturesData, setFixturesData] = useState<any[]>([]);
  const [currentGW, setCurrentGW] = useState<number>(1);
  const [chipState, setChipState] = useState<UserChipState>(() => {
    try {
      const saved = localStorage.getItem('fpl_optimizer_chip_state');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      wildcard_1: true,
      wildcard_2: true,
      freehit: true,
      triplecaptain: true,
      benchboost: true
    };
  });

  const updateChipState = (key: keyof UserChipState, val: boolean) => {
    setChipState(prev => {
      const updated = { ...prev, [key]: val };
      try {
        localStorage.setItem('fpl_optimizer_chip_state', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // FPL Decision Dashboard state additions
  const [mode, setMode] = useState<'optimal' | 'my-team' | 'scouting' | 'comparison' | 'simulation'>('optimal');
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
  
  // Explanation states
  const [optExplanation, setOptExplanation] = useState<OptimizationExplanation | null>(null);
  const [myTeamExplanation, setMyTeamExplanation] = useState<OptimizationExplanation | null>(null);

  // Comparison states
  const [compPlayerA, setCompPlayerA] = useState<Player | null>(null);
  const [compPlayerB, setCompPlayerB] = useState<Player | null>(null);

  // Simulation states
  const [simForcedPlayerIds, setSimForcedPlayerIds] = useState<number[]>([]);
  const [simExcludedPlayerIds, setSimExcludedPlayerIds] = useState<number[]>([]);
  const [simCustomBudgetLimit, setSimCustomBudgetLimit] = useState<number>(100.0);
  const [simRiskPreference, setSimRiskPreference] = useState<'safe' | 'balanced' | 'aggressive'>('balanced');

  // Scouting states
  const [scoutingPlayer, setScoutingPlayer] = useState<Player | null>(null);
  
  // UX states
  const [showAdvancedScout, setShowAdvancedScout] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'guide' | 'academy'>('guide');
  const [pickerActive, setPickerActive] = useState<boolean>(false);

  // Data Integrity & Cache States
  const [dataStatus, setDataStatus] = useState<'fresh' | 'cached' | 'unavailable'>('unavailable');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [dataWarnings, setDataWarnings] = useState<string[]>([]);

  // Sanity check player-team data mappings
  const validateFPLData = (players: Player[], teams: any[]): { valid: boolean; warnings: string[] } => {
    const warnings: string[] = [];
    const teamIds = new Set(teams.map((t: any) => t.id));
    
    teams.forEach((team: any) => {
      if (!team.id || isNaN(team.id)) {
        warnings.push(`Invalid Team entry detected: Missing or non-numeric ID.`);
      }
      if (!team.name || typeof team.name !== 'string') {
        warnings.push(`Team ID ${team.id} has an invalid or missing name.`);
      }
      if (!team.short_name || typeof team.short_name !== 'string') {
        warnings.push(`Team "${team.name}" has an invalid or missing short name.`);
      }
    });

    players.forEach((player: Player) => {
      if (!player.team || !teamIds.has(player.team)) {
        warnings.push(`Player "${player.web_name}" (ID: ${player.id}) is mapped to an invalid Team ID: "${player.team}".`);
      }
      if (!player.team_name || player.team_name === 'Unknown') {
        warnings.push(`Player "${player.web_name}" is missing a resolved team name.`);
      }
      if (!player.team_short_name || player.team_short_name === 'UNK') {
        warnings.push(`Player "${player.web_name}" is missing a resolved team abbreviation.`);
      }
      if (player.now_cost <= 0) {
        warnings.push(`Player "${player.web_name}" has an invalid price: £${(player.now_cost/10).toFixed(1)}m.`);
      }
      if (player.element_type < 1 || player.element_type > 4) {
        warnings.push(`Player "${player.web_name}" has an invalid position ID: ${player.element_type}.`);
      }
    });

    return {
      valid: warnings.length === 0,
      warnings
    };
  };

  // Load database on mount
  const loadInitialData = async (force: boolean = false): Promise<Player[]> => {
    if (allPlayers.length > 0 && !force) {
      return allPlayers;
    }

    setLoading(true);
    setError(null);
    setLoadingMessage('Resolving FPL player data cache...');

    try {
      let bootstrapData: any = null;
      let fixturesData: any = null;
      let isCached = false;
      let timestamp = Date.now();

      // Check cache first (self-healing mechanism for invalid/outdated schema)
      if (!force) {
        try {
          const cachedRaw = localStorage.getItem('fpl_optimizer_api_cache');
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            const age = Date.now() - cached.timestamp;
            // 10 minutes cache expiry limit
            if (age < 10 * 60 * 1000 && cached.bootstrapData && cached.fixturesData) {
              // Sanity check cached objects
              if (cached.bootstrapData.elements && cached.bootstrapData.teams && Array.isArray(cached.fixturesData)) {
                bootstrapData = cached.bootstrapData;
                fixturesData = cached.fixturesData;
                timestamp = cached.timestamp;
                isCached = true;
                console.log(`[Cache Hit] Reusing cached FPL data. Age: ${Math.round(age / 1000)}s`);
              } else {
                console.warn('Cached data failed validation checks. Invalidating cache.');
                localStorage.removeItem('fpl_optimizer_api_cache');
              }
            }
          }
        } catch (cacheErr) {
          console.warn('Failed to parse FPL cache:', cacheErr);
          try {
            localStorage.removeItem('fpl_optimizer_api_cache');
          } catch (e) {}
        }
      }

      if (!bootstrapData || !fixturesData) {
        setLoadingMessage('Fetching live player database from FPL API...');
        const bootstrapRes = await fetch('/api/bootstrap-static');
        if (!bootstrapRes.ok) {
          throw new Error(`bootstrap-static fetch failed with HTTP ${bootstrapRes.status}: ${bootstrapRes.statusText}`);
        }
        bootstrapData = await bootstrapRes.json();

        setLoadingMessage('Fetching current fixture schedules & difficulty ratings...');
        const fixturesRes = await fetch('/api/fixtures');
        if (!fixturesRes.ok) {
          throw new Error(`fixtures fetch failed with HTTP ${fixturesRes.status}: ${fixturesRes.statusText}`);
        }
        fixturesData = await fixturesRes.json();

        // Save to cache with QuotaExceededError protection
        timestamp = Date.now();
        try {
          localStorage.setItem('fpl_optimizer_api_cache', JSON.stringify({
            timestamp,
            bootstrapData,
            fixturesData
          }));
        } catch (cacheWriteErr) {
          console.warn('Failed to write FPL data to localStorage cache (possibly quota exceeded):', cacheWriteErr);
        }
        isCached = false;
        console.log('[Cache Miss] Fetched fresh FPL data.');
      }

      if (!bootstrapData.elements || !bootstrapData.teams || !bootstrapData.events) {
        throw new Error('Incomplete data received from FPL bootstrap-static. Missing elements, teams, or events.');
      }

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

      // Perform FPL Data Integrity checks
      const validation = validateFPLData(projection.players, bootstrapData.teams);
      setDataWarnings(validation.warnings);

      setIsPreSeason(projection.isPreSeason);
      setAllPlayers(projection.players);
      setDataStatus(isCached ? 'cached' : 'fresh');
      setLastUpdated(new Date(timestamp).toLocaleTimeString());
      setBootstrapData(bootstrapData);
      setFixturesData(fixturesData);
      setCurrentGW(gwId);

      // Sync and normalize the drafted squad with the fresh player data
      setMyTeamSquad((prevSquad) => {
        if (!prevSquad || prevSquad.length === 0) return [];
        const updated = prevSquad.map(saved => {
          const fresh = projection.players.find(p => p.id === saved.id);
          if (fresh) {
            // Transfer detection
            if (saved.team !== fresh.team) {
              console.log(`%c[FPL Transfer Audit] Player team changed: ${fresh.web_name}. Previous: ${saved.team_name} (ID: ${saved.team}), Current: ${fresh.team_name} (ID: ${fresh.team})`, 'color: #38bdf8; font-weight: bold;');
            }
            return fresh;
          }
          return saved;
        });
        try {
          localStorage.setItem('fpl_optimizer_my_team', JSON.stringify(updated));
        } catch (writeErr) {
          console.warn('Failed to write My Team to localStorage:', writeErr);
        }
        return updated;
      });

      return projection.players;
    } catch (err: any) {
      console.error(err);
      setDataStatus('unavailable');
      setError({
        message: err.message || 'An unexpected error occurred during FPL data loading.',
        action: 'Please ensure that your Express backend is running and you are connected to the internet.'
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshData = async (force: boolean = false) => {
    try {
      const players = await loadInitialData(force);
      
      // Rerun optimizer if results exist
      if (result) {
        setLoading(true);
        setLoadingMessage('Recalculating optimal lineup solver...');
        const solverResult = solveSquad(players);
        setResult(solverResult);
        const explanation = generateOptimizationExplanation(players, solverResult, isPreSeason);
        setOptExplanation(explanation);
      }
      
      if (myTeamSquad.length === 15) {
        setLoading(true);
        setLoadingMessage('Recalculating My Team optimization...');
        const solverResult = solveSquad(players, 1000, {
          forcedPlayerIds: myTeamSquad.map(p => p.id)
        });
        if (solverResult.feasible) {
          setMyTeamResult(solverResult);
          const explanation = generateOptimizationExplanation(players, solverResult, isPreSeason);
          setMyTeamExplanation(explanation);
        }
      }
    } catch (e) {
      console.error('Refresh recalculation failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefreshData(false).catch(() => {});
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
      // Run counterfactual optimizations to generate selection/exclusion explanations
      setLoadingMessage('Running counterfactual optimization runs to verify opportunity costs...');
      const explanation = generateOptimizationExplanation(players, solverResult, isPreSeason);
      setOptExplanation(explanation);
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
      
      setLoadingMessage('Running counterfactual optimizations for My Team...');
      const explanation = generateOptimizationExplanation(allPlayers, solverResult, isPreSeason);
      setMyTeamExplanation(explanation);
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
    try {
      localStorage.setItem('fpl_optimizer_my_team', JSON.stringify(newSquad));
    } catch (e) {
      console.warn('Failed to write My Team to localStorage:', e);
    }
    setMyTeamResult(null);
  };

  const removePlayerFromMyTeam = (playerId: number) => {
    const newSquad = myTeamSquad.filter(p => p.id !== playerId);
    setMyTeamSquad(newSquad);
    try {
      localStorage.setItem('fpl_optimizer_my_team', JSON.stringify(newSquad));
    } catch (e) {
      console.warn('Failed to write My Team to localStorage:', e);
    }
    setMyTeamResult(null);
  };

  // Resolve active result and explainability summaries
  const activeResult = mode === 'optimal' ? result : myTeamResult;
  const activeExplanation = mode === 'optimal' ? optExplanation : myTeamExplanation;
  const [activeExpPlayerId, setActiveExpPlayerId] = useState<number | null>(null);

  // Calculate Chip Verdicts dynamically
  const chipVerdicts = useMemo(() => {
    if (!bootstrapData || !fixturesData || fixturesData.length === 0 || myTeamSquad.length === 0) {
      return [];
    }
    return calculateChipVerdicts(
      allPlayers,
      bootstrapData,
      fixturesData,
      currentGW,
      myTeamSquad,
      chipState
    );
  }, [allPlayers, bootstrapData, fixturesData, currentGW, myTeamSquad, chipState]);

  const renderChipAdvisor = () => {
    if (myTeamSquad.length < 15) {
      return (
        <div className="glass-panel text-left animate-fade-in" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span>
              <h4 className="text-white font-bold text-xs uppercase tracking-wider m-0">Chip Advisor</h4>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">OFFLINE</span>
          </div>
          <div className="p-6 text-center text-xs text-gray-500 italic border border-dashed border-[rgba(255,255,255,0.06)] rounded-xl">
            Please draft a full 15-player squad to enable the personalized Chip Advisor decision engine.
          </div>
        </div>
      );
    }

    return (
      <div className="glass-panel text-left animate-fade-in" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
            <h4 className="text-white font-bold text-xs uppercase tracking-wider m-0">Chip Advisor</h4>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">DECISION SUPPORT SYSTEM</span>
        </div>

        {/* Chip Availability Toggles */}
        <div className="bg-[#151824] p-3 rounded-lg border border-[rgba(255,255,255,0.04)] mb-4">
          <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold mb-2">My Available Chips</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {currentGW <= 19 && (
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={chipState.wildcard_1}
                  onChange={(e) => updateChipState('wildcard_1', e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-[#02c39a] focus:ring-[#02c39a]"
                />
                <span>Wildcard (1st Half)</span>
              </label>
            )}
            {currentGW >= 20 && (
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={chipState.wildcard_2}
                  onChange={(e) => updateChipState('wildcard_2', e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-[#02c39a] focus:ring-[#02c39a]"
                />
                <span>Wildcard (2nd Half)</span>
              </label>
            )}
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={chipState.freehit}
                onChange={(e) => updateChipState('freehit', e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-[#02c39a] focus:ring-[#02c39a]"
              />
              <span>Free Hit</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={chipState.triplecaptain}
                onChange={(e) => updateChipState('triplecaptain', e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-[#02c39a] focus:ring-[#02c39a]"
              />
              <span>Triple Captain</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={chipState.benchboost}
                onChange={(e) => updateChipState('benchboost', e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-[#02c39a] focus:ring-[#02c39a]"
              />
              <span>Bench Boost</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {chipVerdicts.map((verdict) => {
            const isUse = verdict.verdict === 'USE NOW';
            const nameMap = {
              wildcard: 'Wildcard',
              freehit: 'Free Hit',
              triplecaptain: 'Triple Captain',
              benchboost: 'Bench Boost'
            };
            const chipName = nameMap[verdict.chipCode] || verdict.chipCode;

            return (
              <div key={verdict.chipCode} className="border border-[rgba(255,255,255,0.06)] rounded-xl p-3 bg-[rgba(255,255,255,0.02)]">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isUse ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
                      {chipName}
                    </span>
                    <span className={`text-xs font-bold ${isUse ? 'text-[#10b981]' : 'text-gray-400'}`}>
                      {verdict.verdict}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span>Advantage: <strong className="text-white font-mono">{verdict.advantage > 0 ? '+' : ''}{verdict.advantage.toFixed(1)}</strong></span>
                    <span className="text-gray-600">|</span>
                    <span className={`font-bold ${verdict.confidence === 'High' ? 'text-[#10b981]' : verdict.confidence === 'Medium' ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>
                      Certainty: {verdict.confidence}
                    </span>
                  </div>
                </div>
                
                <p className="text-[11px] text-gray-300 m-0 mt-1 leading-relaxed text-left">
                  {verdict.reason}
                </p>
                
                <details className="mt-2 group">
                  <summary className="text-[9px] text-gray-400 hover:text-white cursor-pointer select-none font-semibold flex items-center gap-1">
                    <span>💡 Advanced Details & Assumptions</span>
                  </summary>
                  <div className="mt-1.5 text-[10px] text-gray-500 space-y-1 pl-2.5 border-l border-[rgba(255,255,255,0.06)] leading-relaxed text-left">
                    <p className="m-0"><strong className="text-gray-400">What could change this:</strong> {verdict.sensitivity}</p>
                    <p className="m-0"><strong className="text-gray-400">Current expected value:</strong> +{verdict.currentValue.toFixed(1)} pts.</p>
                    <p className="m-0"><strong className="text-gray-400">Best identified opportunity:</strong> GW{verdict.bestFutureGW} (+{verdict.bestFutureValue.toFixed(1)} pts).</p>
                    {verdict.chipCode === 'wildcard' && (
                      <p className="m-0"><strong className="text-gray-400">Modelling Assumption:</strong> Evaluated using a 5-week rolling horizon. Projection Confidence Weights [1.0, 0.9, 0.8, 0.7, 0.6] applied to future weeks.</p>
                    )}
                    {verdict.chipCode === 'triplecaptain' && (
                      <p className="m-0"><strong className="text-gray-400">Safety Guard:</strong> Playing probability is only applied once at the fixture level (no double-counting).</p>
                    )}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
              <TrendingUp className="logo-icon" />
            </div>
            <div>
              <h1 className="logo-title">FPL ANALYTICS</h1>
              <span className="logo-subtitle">DECISION SUPPORT SYSTEM</span>
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
              <button
                onClick={() => {
                  setMode('scouting');
                  setError(null);
                }}
                className={`mode-toggle-btn ${mode === 'scouting' ? 'active' : ''}`}
              >
                Scouting
              </button>
              <button
                onClick={() => {
                  setMode('comparison');
                  setError(null);
                }}
                className={`mode-toggle-btn ${mode === 'comparison' ? 'active' : ''}`}
              >
                Comparison
              </button>
              <button
                onClick={() => {
                  setMode('simulation');
                  setError(null);
                }}
                className={`mode-toggle-btn ${mode === 'simulation' ? 'active' : ''}`}
              >
                Simulator
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

      {/* Data Integrity Status Bar */}
      <div className="bg-[#151824] border-b border-[#1e2330] py-2 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 text-gray-400">
            <span className="flex items-center gap-1.5 font-semibold text-white">
              {dataStatus === 'fresh' && <><span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block shrink-0"></span> Live / Fresh</>}
              {dataStatus === 'cached' && <><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] inline-block shrink-0"></span> Cached Data</>}
              {dataStatus === 'unavailable' && <><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] inline-block shrink-0"></span> Data Offline</>}
            </span>
            <span className="text-gray-600">|</span>
            <span>Last Updated: <span className="font-mono text-gray-200">{lastUpdated || 'Never'}</span></span>
            <span className="text-gray-600">|</span>
            <span>Active: <span className="font-semibold text-gray-200">{gameweekName || 'Loading...'}</span></span>
            {isPreSeason && (
              <>
                <span className="text-gray-600">|</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold">PRE-SEASON ACTIVE</span>
              </>
            )}
          </div>
          <button
            onClick={() => handleRefreshData(true)}
            disabled={loading}
            className="px-3 py-1 bg-[#1e2330] hover:bg-[#2e3548] border border-[rgba(255,255,255,0.05)] rounded-lg text-[11px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Data Validation Integrity Alerts */}
      {dataWarnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 py-3 px-6 text-xs text-left text-[#f59e0b] flex items-start gap-2.5 max-w-7xl mx-auto mt-4 rounded-xl">
          <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-1 text-white font-semibold">FPL Data Integrity Warnings Detected:</strong>
            <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto custom-scrollbar">
              {dataWarnings.slice(0, 3).map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
              {dataWarnings.length > 3 && (
                <li>... and {dataWarnings.length - 3} more integrity warnings. (Check developer console for full audit).</li>
              )}
            </ul>
          </div>
        </div>
      )}

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
                  <PlayerPicker
                    players={allPlayers}
                    onSelect={addPlayerToMyTeam}
                    selectedPlayers={myTeamSquad}
                    budgetRemaining={budgetRemaining}
                    myTeamSquad={myTeamSquad}
                    validateMode="my-team"
                    isPreSeason={isPreSeason}
                    placeholder="Search or select player to draft..."
                    onOpenChange={setPickerActive}
                  />
                </div>

                {!pickerActive && (
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
                )}
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
              
              {/* Chip Advisor Panel */}
              {renderChipAdvisor()}
            </div>
          </div>
        )}

        {mode === 'scouting' && !loading && !error && (
          <div className="dashboard-grid">
            {/* Left Column: Player Selector & Search */}
            <div className="grid-left-col">
              <div className="glass-panel">
                <h4 className="text-white font-bold text-sm mb-4 tracking-wider text-left">SEARCH PLAYER TO SCOUT</h4>
                        <div className="search-picker-card">
                  <PlayerPicker
                    players={allPlayers}
                    onSelect={(p) => setScoutingPlayer(p)}
                    validateMode="scouting"
                    isPreSeason={isPreSeason}
                    placeholder="Search or select player to scout..."
                    onOpenChange={setPickerActive}
                  />
                </div>

                {!pickerActive && (
                  <div className="border-t border-[rgba(255,255,255,0.08)] pt-4 mt-6">
                    <h5 className="text-white font-bold text-xs uppercase tracking-wider mb-3 text-left">TOP SCOUTING RECOMMENDATIONS</h5>
                    <div className="flex flex-col gap-2">
                      {allPlayers
                        .slice(0, 5)
                        .map(p => {
                          const rec = calculatePlayerRatings(p, isPreSeason, 0);
                          return (
                            <div 
                              key={p.id}
                              onClick={() => setScoutingPlayer(p)}
                              className="p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.05)] cursor-pointer flex justify-between items-center text-xs transition-all"
                            >
                              <div className="text-left">
                                <strong className="text-white">{p.web_name}</strong>
                                <span className="text-gray-400 block text-[10px]">{p.team_name} | £{(p.now_cost/10).toFixed(1)}m</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[#02c39a] font-bold block">{p.projected_points} pts</span>
                                <span className="text-[10px] text-gray-500">{rec.categoryLabel}</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Scouting Details Panel */}
            <div className="grid-right-col">
              {scoutingPlayer ? (() => {
                const rec = calculatePlayerRatings(scoutingPlayer, isPreSeason, 0);
                const posName = ['GK', 'DEF', 'MID', 'FWD'][scoutingPlayer.element_type - 1];
                const sentence = `${scoutingPlayer.web_name} is a £${(scoutingPlayer.now_cost / 10).toFixed(1)}m ${posName} from ${scoutingPlayer.team_name} carrying a ${scoutingPlayer.status === 'a' ? 'fit/available' : `flagged (${scoutingPlayer.news})`} status. We project him to return ${scoutingPlayer.projected_points} expected points, giving him a "${rec.categoryLabel}" verdict based on a ${rec.ratings.overallRating}/10 overall score.`;

                return (
                  <div className="flex flex-col gap-6">
                    
                    {/* Main Card */}
                    <div className="glass-panel text-left">
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold text-white m-0">{scoutingPlayer.web_name}</h2>
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[#02c39a]/10 text-[#02c39a]">
                              {posName}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{scoutingPlayer.team_name} • £{(scoutingPlayer.now_cost / 10).toFixed(1)}m</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-[#f7b731] block">
                            {'★'.repeat(rec.stars)}{'☆'.repeat(5 - rec.stars)}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">{rec.categoryLabel}</span>
                        </div>
                      </div>

                      {/* Executive Summary */}
                      <div className="bg-[rgba(2,195,154,0.04)] border border-[rgba(2,195,154,0.15)] rounded-xl p-4 mb-6">
                        <strong className="text-[#02c39a] text-[10px] uppercase tracking-wider block mb-1">In One Sentence</strong>
                        <p className="text-gray-300 text-xs m-0 leading-relaxed font-semibold">
                          {sentence}
                        </p>
                      </div>

                      {/* Educational Tags */}
                      {rec.educationalTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                          {rec.educationalTags.map(tag => (
                            <span key={tag} className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-gray-300">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Progressive Disclosure Toggle */}
                      <div className="mb-6">
                        <button
                          onClick={() => setShowAdvancedScout(!showAdvancedScout)}
                          className="w-full text-center py-2.5 border border-[rgba(255,255,255,0.08)] rounded-xl text-xs font-semibold text-gray-300 bg-[rgba(255,255,255,0.01)] hover:bg-[rgba(255,255,255,0.03)] transition-all cursor-pointer"
                        >
                          {showAdvancedScout ? "Hide Advanced Technical Metrics ▲" : "Show Advanced Technical Metrics ▼"}
                        </button>
                      </div>

                      {showAdvancedScout && (
                        <>
                          {/* Projection breakdown stats */}
                          <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Expected Points Breakdown</h4>
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                              <span className="text-[10px] text-gray-400 block uppercase">Base Projection</span>
                              <span className="text-lg font-bold text-white">{scoutingPlayer.breakdown?.baseProjection || scoutingPlayer.projected_points} pts</span>
                            </div>
                            <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                              <span className="text-[10px] text-gray-400 block uppercase">FDR Fixture Ease</span>
                              <span className={`text-lg font-bold ${scoutingPlayer.breakdown && scoutingPlayer.breakdown.fixtureAdjustment >= 0 ? 'text-[#02c39a]' : 'text-[#e74c3c]'}`}>
                                {scoutingPlayer.breakdown && scoutingPlayer.breakdown.fixtureAdjustment >= 0 ? '+' : ''}
                                {scoutingPlayer.breakdown?.fixtureAdjustment || 0}%
                              </span>
                            </div>
                          </div>

                          {/* Ratings Grid */}
                          <h4 className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-3">Decision Suitability Ratings</h4>
                          <div className="flex flex-col gap-3.5 mb-6">
                            {Object.entries(rec.ratings).map(([key, val]) => {
                              const displayLabel = key
                                .replace('Rating', '')
                                .replace(/([A-Z])/g, ' $1')
                                .replace(/^./, str => str.toUpperCase());
                              
                              return (
                                <div key={key} className="flex flex-col gap-1 text-xs">
                                  <div className="flex justify-between text-gray-300 font-medium">
                                    <span>{displayLabel}</span>
                                    <span className="font-mono text-white font-semibold">{val.toFixed(1)} / 10</span>
                                  </div>
                                  <div className="w-full h-1 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                                    <div 
                                      className="h-full transition-all duration-300" 
                                      style={{ 
                                        width: `${val * 10}%`,
                                        backgroundColor: val >= 8.0 ? '#10b981' : val >= 5.0 ? '#38bdf8' : '#ef4444' 
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {/* Confidence score */}
                      <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Projection Confidence</h4>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="relative w-12 h-12 flex items-center justify-center rounded-full bg-[rgba(2,195,154,0.05)] border-2 border-[#02c39a] font-bold text-sm text-[#02c39a]">
                          {scoutingPlayer.confidence}%
                        </div>
                        <div className="text-xs text-gray-400 leading-normal">
                          Confidence represents prediction reliability based on FPL data. Factors: playing probability (40%), minutes (30%), injury status (20%), and sample size (10%).
                        </div>
                      </div>

                      {/* Buy vs Caution bullet lists */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-[#02c39a] font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
                            <span>✓</span> Reasons to Buy
                          </h5>
                          <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
                            {rec.reasonsToBuy.map(r => (
                              <li key={r} className="text-xs text-gray-300 flex items-start gap-2">
                                <span className="text-[#02c39a] shrink-0">•</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h5 className="text-[#f7b731] font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
                            <span>!</span> Reasons for Caution
                          </h5>
                          <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
                            {rec.reasonsForCaution.map(r => (
                              <li key={r} className="text-xs text-gray-300 flex items-start gap-2">
                                <span className="text-[#f7b731] shrink-0">•</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                    </div>

                  </div>
                );
              })() : (
                <div className="glass-panel text-center py-20">
                  <UserCheck className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-60" />
                  <h4 className="text-white font-bold text-sm m-0">No Player Selected</h4>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto mt-2">
                    Search and select a player on the left panel to run deep-dive fantasy analytics, star recommendations, and coaching explanations.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'comparison' && !loading && !error && (
          <div className="dashboard-grid">
            {/* Left Column: Player Inputs */}
            <div className="grid-left-col">
              <div className="glass-panel">
                <h4 className="text-white font-bold text-sm mb-4 tracking-wider text-left">SELECT PLAYERS TO COMPARE</h4>
                
                {/* Search Player A */}
                <div className="mb-6">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2 text-left">Player A</label>
                  {compPlayerA ? (
                    <div className="p-3 bg-[rgba(2,195,154,0.05)] border border-[rgba(2,195,154,0.15)] rounded-xl flex justify-between items-center text-xs">
                      <div className="text-left">
                        <strong className="text-white text-sm">{compPlayerA.web_name}</strong>
                        <span className="text-gray-400 block text-[10px]">{compPlayerA.team_name} • £{(compPlayerA.now_cost/10).toFixed(1)}m</span>
                      </div>
                      <button 
                        onClick={() => { setCompPlayerA(null); }}
                        className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-[rgba(255,255,255,0.05)] text-[10px] font-bold"
                      >
                        Reset
                      </button>
                    </div>
                  ) : (
                    <div className="search-picker-card">
                      <PlayerPicker
                        players={allPlayers}
                        onSelect={(p) => setCompPlayerA(p)}
                        selectedPlayers={compPlayerB ? [compPlayerB] : []}
                        validateMode="comparison"
                        isPreSeason={isPreSeason}
                        placeholder="Search or select Player A..."
                        onOpenChange={setPickerActive}
                      />
                    </div>
                  )}
                </div>

                {/* Search Player B */}
                <div className="mb-6">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2 text-left">Player B</label>
                  {compPlayerB ? (
                    <div className="p-3 bg-[rgba(2,195,154,0.05)] border border-[rgba(2,195,154,0.15)] rounded-xl flex justify-between items-center text-xs">
                      <div className="text-left">
                        <strong className="text-white text-sm">{compPlayerB.web_name}</strong>
                        <span className="text-gray-400 block text-[10px]">{compPlayerB.team_name} • £{(compPlayerB.now_cost/10).toFixed(1)}m</span>
                      </div>
                      <button 
                        onClick={() => { setCompPlayerB(null); }}
                        className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-[rgba(255,255,255,0.05)] text-[10px] font-bold"
                      >
                        Reset
                      </button>
                    </div>
                  ) : (
                    <div className="search-picker-card">
                      <PlayerPicker
                        players={allPlayers}
                        onSelect={(p) => setCompPlayerB(p)}
                        selectedPlayers={compPlayerA ? [compPlayerA] : []}
                        validateMode="comparison"
                        isPreSeason={isPreSeason}
                        placeholder="Search or select Player B..."
                        onOpenChange={setPickerActive}
                      />
                    </div>
                  )}
                </div>

                {/* Popular comparison templates */}
                {!pickerActive && (
                  <div className="border-t border-[rgba(255,255,255,0.08)] pt-4 mt-6">
                    <h5 className="text-white font-bold text-xs uppercase tracking-wider mb-3 text-left">POPULAR COMPARISONS</h5>
                    <div className="flex flex-col gap-2">
                      {[
                        { nameA: 'Haaland', nameB: 'Salah' },
                        { nameA: 'Saka', nameB: 'Palmer' },
                        { nameA: 'Gabriel', nameB: 'Gvardiol' }
                      ].map((comp, idx) => {
                        const pA = allPlayers.find(p => p.web_name.toLowerCase().includes(comp.nameA.toLowerCase()));
                        const pB = allPlayers.find(p => p.web_name.toLowerCase().includes(comp.nameB.toLowerCase()));
                        if (!pA || !pB) return null;
                        return (
                          <button
                            key={idx}
                            onClick={() => { setCompPlayerA(pA); setCompPlayerB(pB); }}
                            className="w-full text-left p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.05)] text-xs text-gray-300 transition-all"
                          >
                            Compare <strong>{pA.web_name}</strong> vs <strong>{pB.web_name}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Right Column: Comparison Report */}
            <div className="grid-right-col">
              {compPlayerA && compPlayerB ? (() => {
                const report = comparePlayers(compPlayerA, compPlayerB, isPreSeason);
                return (
                  <div className="flex flex-col gap-6">
                    
                    {/* Verdict Card */}
                    <div className="glass-panel text-left">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold block mb-1.5">Comparison Decision Verdict</span>
                          <h2 className="text-xl font-bold text-white m-0 flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block shrink-0"></span>
                            {report.verdictLabel}
                          </h2>
                        </div>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed font-semibold bg-[rgba(56,189,248,0.04)] border border-[rgba(56,189,248,0.1)] rounded-xl p-4 m-0">
                        {report.verdictExplanation}
                      </p>
                    </div>

                    {/* Technical Metric comparison grid */}
                    <div className="glass-panel text-left">
                      <h4 className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-4">SIDE-BY-SIDE METRICS</h4>
                      <div className="custom-table-container">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>Metric</th>
                              <th className="text-center font-bold text-white">{compPlayerA.web_name}</th>
                              <th className="text-center font-bold text-white">{compPlayerB.web_name}</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="text-gray-400 font-medium">Expected Points</td>
                              <td className="text-center font-mono font-semibold text-white">{compPlayerA.projected_points} pts</td>
                              <td className="text-center font-mono font-semibold text-white">{compPlayerB.projected_points} pts</td>
                            </tr>
                            <tr>
                              <td className="text-gray-400 font-medium">Cost</td>
                              <td className="text-center font-mono text-white">£{(compPlayerA.now_cost/10).toFixed(1)}m</td>
                              <td className="text-center font-mono text-white">£{(compPlayerB.now_cost/10).toFixed(1)}m</td>
                            </tr>
                            <tr>
                              <td className="text-gray-400 font-medium">Ownership</td>
                              <td className="text-center font-mono text-white">{compPlayerA.selected_by_percent}%</td>
                              <td className="text-center font-mono text-white">{compPlayerB.selected_by_percent}%</td>
                            </tr>
                            <tr>
                              <td className="text-gray-400 font-semibold">Overall Fantasy Rating</td>
                              <td className="text-center font-mono font-bold text-[#10b981]">{report.ratingsA.ratings.overallRating.toFixed(1)} / 10</td>
                              <td className="text-center font-mono font-bold text-white">{report.ratingsB.ratings.overallRating.toFixed(1)} / 10</td>
                            </tr>
                            <tr>
                              <td className="text-gray-400">Value for Money Rating</td>
                              <td className="text-center font-mono">{report.ratingsA.ratings.valueRating.toFixed(1)}</td>
                              <td className="text-center font-mono">{report.ratingsB.ratings.valueRating.toFixed(1)}</td>
                            </tr>
                            <tr>
                              <td className="text-gray-400">Fixture Difficulty Rating</td>
                              <td className="text-center font-mono">{report.ratingsA.ratings.fixtureRating.toFixed(1)}</td>
                              <td className="text-center font-mono">{report.ratingsB.ratings.fixtureRating.toFixed(1)}</td>
                            </tr>
                            <tr>
                              <td className="text-gray-400">Starting Reliability Rating</td>
                              <td className="text-center font-mono">{report.ratingsA.ratings.reliabilityRating.toFixed(1)}</td>
                              <td className="text-center font-mono">{report.ratingsB.ratings.reliabilityRating.toFixed(1)}</td>
                            </tr>
                            <tr>
                              <td className="text-gray-400">Risk Safety Rating</td>
                              <td className="text-center font-mono">{report.ratingsA.ratings.riskRating.toFixed(1)}</td>
                              <td className="text-center font-mono">{report.ratingsB.ratings.riskRating.toFixed(1)}</td>
                            </tr>
                            <tr>
                              <td className="text-gray-400">Differential Rating</td>
                              <td className="text-center font-mono">{report.ratingsA.ratings.differentialRating.toFixed(1)}</td>
                              <td className="text-center font-mono">{report.ratingsB.ratings.differentialRating.toFixed(1)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Educational Answers / Head-to-Head */}
                    <div className="glass-panel text-left">
                      <h4 className="text-white font-bold text-sm mb-4 tracking-wider">HEAD-TO-HEAD DECISION QUESTIONS</h4>
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center text-xs p-3 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] rounded-lg">
                          <span className="text-gray-400 font-medium">Which player is safer?</span>
                          <strong className="text-white">{report.saferPlayer}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs p-3 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] rounded-lg">
                          <span className="text-gray-400 font-medium">Which player has a higher points ceiling?</span>
                          <strong className="text-white">{report.higherCeilingPlayer}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs p-3 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] rounded-lg">
                          <span className="text-gray-400 font-medium">Which player represents better value?</span>
                          <strong className="text-white">{report.betterValuePlayer}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs p-3 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] rounded-lg">
                          <span className="text-gray-400 font-medium">Which player is better for beginners?</span>
                          <strong className="text-white">{report.beginnerFriendlyPlayer}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs p-3 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] rounded-lg">
                          <span className="text-gray-400 font-medium">Which player is a better differential choice?</span>
                          <strong className="text-white">{report.differentialPlayer}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Strengths and Weaknesses side-by-side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="glass-panel text-left">
                        <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-4">{compPlayerA.web_name} Key Details</h4>
                        <div className="mb-4">
                          <strong className="text-[#02c39a] text-[10px] uppercase block mb-1">Strengths</strong>
                          <ul className="pl-4 m-0 text-xs text-gray-300 flex flex-col gap-1.5 list-disc">
                            {report.ratingsA.reasonsToBuy.map(s => <li key={s}>{s}</li>)}
                          </ul>
                        </div>
                        <div>
                          <strong className="text-[#f7b731] text-[10px] uppercase block mb-1">Caution Areas</strong>
                          <ul className="pl-4 m-0 text-xs text-gray-300 flex flex-col gap-1.5 list-disc">
                            {report.ratingsA.reasonsForCaution.map(s => <li key={s}>{s}</li>)}
                          </ul>
                        </div>
                      </div>

                      <div className="glass-panel text-left">
                        <h4 className="text-white font-bold text-xs uppercase tracking-wider mb-4">{compPlayerB.web_name} Key Details</h4>
                        <div className="mb-4">
                          <strong className="text-[#02c39a] text-[10px] uppercase block mb-1">Strengths</strong>
                          <ul className="pl-4 m-0 text-xs text-gray-300 flex flex-col gap-1.5 list-disc">
                            {report.ratingsB.reasonsToBuy.map(s => <li key={s}>{s}</li>)}
                          </ul>
                        </div>
                        <div>
                          <strong className="text-[#f7b731] text-[10px] uppercase block mb-1">Caution Areas</strong>
                          <ul className="pl-4 m-0 text-xs text-gray-300 flex flex-col gap-1.5 list-disc">
                            {report.ratingsB.reasonsForCaution.map(s => <li key={s}>{s}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })() : (
                <div className="glass-panel text-center py-24">
                  <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-60" />
                  <h4 className="text-white font-bold text-sm m-0">Select Two Players to Compare</h4>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto mt-2">
                    Search and pick two players on the left panel to trigger side-by-side rating comparisons, head-to-head decision results, and recommendations.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'simulation' && !loading && !error && (
          <div className="dashboard-grid">
            {/* Left Column: Simulator Controls */}
            <div className="grid-left-col">
              <div className="glass-panel">
                <h4 className="text-white font-bold text-sm mb-4 tracking-wider text-left">SIMULATOR CONTROLS</h4>
                
                {/* Risk Preference Toggle */}
                <div className="mb-6 text-left">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">Risk Preference</label>
                  <div className="flex gap-2">
                    {[
                      { key: 'safe', label: '🛡️ Safe', desc: 'Exponential starting penalty' },
                      { key: 'balanced', label: '⚖️ Balanced', desc: 'Baseline expected points' },
                      { key: 'aggressive', label: '🔥 Aggressive', desc: 'Square root starting boost' }
                    ].map((pref) => (
                      <button
                        key={pref.key}
                        onClick={() => setSimRiskPreference(pref.key as any)}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold flex-1 transition-all ${simRiskPreference === pref.key ? 'bg-[rgba(2,195,154,0.1)] border-[#02c39a] text-white' : 'bg-[rgba(255,255,255,0.01)] border-[rgba(255,255,255,0.04)] text-gray-400 hover:text-white'}`}
                        title={pref.desc}
                      >
                        {pref.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Budget Limit Override */}
                <div className="mb-6 text-left">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Available Squad Budget</label>
                    <span className="text-xs font-bold text-white">£{simCustomBudgetLimit.toFixed(1)}m</span>
                  </div>
                  <input
                    type="range"
                    min="95.0"
                    max="105.0"
                    step="0.2"
                    value={simCustomBudgetLimit}
                    onChange={(e) => setSimCustomBudgetLimit(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none bg-[rgba(255,255,255,0.08)] cursor-pointer accent-[#02c39a]"
                  />
                  <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                    <span>£95.0m</span>
                    <span>£100.0m (Standard)</span>
                    <span>£105.0m</span>
                  </div>
                </div>

                {/* Force Player selection picker */}
                <div className="mb-6 text-left">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">Force Player (Lock in Squad)</label>
                  <div className="search-picker-card">
                    <PlayerPicker
                      players={allPlayers}
                      onSelect={(p) => setSimForcedPlayerIds([...simForcedPlayerIds, p.id])}
                      selectedPlayers={allPlayers.filter(p => simForcedPlayerIds.includes(p.id) || simExcludedPlayerIds.includes(p.id))}
                      validateMode="simulation"
                      isPreSeason={isPreSeason}
                      placeholder="Search or select player to lock..."
                      onOpenChange={setPickerActive}
                    />
                  </div>
                  {!pickerActive && simForcedPlayerIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {simForcedPlayerIds.map(id => {
                        const p = allPlayers.find(x => x.id === id);
                        return (
                          <span key={id} className="px-2 py-1 rounded bg-[rgba(2,195,154,0.08)] border border-[rgba(2,195,154,0.2)] text-[10px] text-white flex items-center gap-1.5 font-bold">
                            🔒 {p?.web_name}
                            <button onClick={() => setSimForcedPlayerIds(simForcedPlayerIds.filter(x => x !== id))} className="text-[#e74c3c] font-bold">×</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Exclude Player selection picker */}
                <div className="mb-6 text-left">
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">Exclude Player (Lock Out of Squad)</label>
                  <div className="search-picker-card">
                    <PlayerPicker
                      players={allPlayers}
                      onSelect={(p) => setSimExcludedPlayerIds([...simExcludedPlayerIds, p.id])}
                      selectedPlayers={allPlayers.filter(p => simForcedPlayerIds.includes(p.id) || simExcludedPlayerIds.includes(p.id))}
                      validateMode="simulation"
                      isPreSeason={isPreSeason}
                      placeholder="Search or select player to exclude..."
                      onOpenChange={setPickerActive}
                    />
                  </div>
                  {!pickerActive && simExcludedPlayerIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {simExcludedPlayerIds.map(id => {
                        const p = allPlayers.find(x => x.id === id);
                        return (
                          <span key={id} className="px-2 py-1 rounded bg-[rgba(235,77,75,0.08)] border border-[rgba(235,77,75,0.2)] text-[10px] text-white flex items-center gap-1.5 font-bold">
                            🚫 {p?.web_name}
                            <button onClick={() => setSimExcludedPlayerIds(simExcludedPlayerIds.filter(x => x !== id))} className="text-[#e74c3c] font-bold">×</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Right Column: Re-optimized Simulation Output */}
            <div className="grid-right-col">
              {result ? (() => {
                // Compile simulator calculations
                const simPlayers = allPlayers.map(p => {
                  let prob = (p.chance_of_playing_next_round ?? 100) / 100;
                  if (simRiskPreference === 'safe') {
                    prob = Math.pow(prob, 2);
                  } else if (simRiskPreference === 'aggressive') {
                    prob = Math.sqrt(prob);
                  }
                  const baseProj = p.breakdown?.baseProjection || p.projected_points;
                  const fdrAdj = p.breakdown?.fixtureAdjustment || 0;
                  const homeAdj = p.breakdown?.homeAdvantage || 0;
                  const expectedPoints = Math.round(baseProj * (fdrAdj / 100 + 1) * (homeAdj / 100 + 1) * prob * 100) / 100;
                  return {
                    ...p,
                    projected_points: expectedPoints,
                    chance_of_playing_next_round: Math.round(prob * 100)
                  };
                });

                const simRes = simulateDecision(simPlayers, result, {
                  forcedPlayerIds: simForcedPlayerIds,
                  excludedPlayerIds: simExcludedPlayerIds,
                  customBudgetLimit: Math.round(simCustomBudgetLimit * 10)
                });

                const pillColorClass = simRes.verdictColor === 'green' ? 'bg-[#02c39a]/10 text-[#02c39a]' : simRes.verdictColor === 'yellow' ? 'bg-[#f7b731]/10 text-[#f7b731]' : 'bg-[#e74c3c]/10 text-[#e74c3c]';

                return (
                  <div className="flex flex-col gap-6">
                    
                    {/* Executive Impact Summary */}
                    <div className="glass-panel text-left">
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold block mb-1">Decision Simulator Result</span>
                          <h2 className="text-xl font-bold text-white m-0 flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${pillColorClass}`}>
                              {simRes.verdictLabel}
                            </span>
                          </h2>
                        </div>
                      </div>
                      
                      {simRes.feasible ? (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                              <span className="text-[10px] text-gray-400 block uppercase">Points Impact</span>
                              <span className={`text-lg font-bold ${simRes.pointsDelta >= 0 ? 'text-[#02c39a]' : 'text-[#e74c3c]'}`}>
                                {simRes.pointsDelta >= 0 ? '+' : ''}{simRes.pointsDelta.toFixed(1)} pts
                              </span>
                            </div>
                            <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                              <span className="text-[10px] text-gray-400 block uppercase">Simulated Expected</span>
                              <span className="text-lg font-bold text-white">{simRes.simulatedPoints} pts</span>
                            </div>
                            <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                              <span className="text-[10px] text-gray-400 block uppercase">Budget Spent</span>
                              <span className="text-lg font-bold text-white">£{simRes.simulatedCost.toFixed(1)}m</span>
                            </div>
                            <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                              <span className="text-[10px] text-gray-400 block uppercase">Budget Delta</span>
                              <span className={`text-lg font-bold ${simRes.costDelta <= 0 ? 'text-[#02c39a]' : 'text-white'}`}>
                                {simRes.costDelta > 0 ? '+' : ''}{simRes.costDelta.toFixed(1)}m
                              </span>
                            </div>
                          </div>

                          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] p-4 rounded-xl text-xs text-gray-300 leading-relaxed mb-6">
                            <strong>Intervention Rationale:</strong> {simRes.opportunityCostExplanation}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-left">
                            <div>
                              <strong className="text-[#02c39a] text-[10px] uppercase block mb-2">Benefits</strong>
                              {simRes.benefits.length > 0 ? (
                                <ul className="pl-4 m-0 text-xs text-gray-300 flex flex-col gap-1.5 list-disc">
                                  {simRes.benefits.map(b => <li key={b}>{b}</li>)}
                                </ul>
                              ) : (
                                <span className="text-xs text-gray-500 italic">No points or cost improvements.</span>
                              )}
                            </div>
                            <div>
                              <strong className="text-[#f7b731] text-[10px] uppercase block mb-2">Drawbacks & Overheads</strong>
                              {simRes.drawbacks.length > 0 ? (
                                <ul className="pl-4 m-0 text-xs text-gray-300 flex flex-col gap-1.5 list-disc">
                                  {simRes.drawbacks.map(d => <li key={d}>{d}</li>)}
                                </ul>
                              ) : (
                                <span className="text-xs text-gray-500 italic">No points or cost penalties.</span>
                              )}
                            </div>
                          </div>

                          <div className="p-3.5 bg-[rgba(2,195,154,0.04)] border border-[rgba(2,195,154,0.15)] rounded-xl text-xs text-gray-300">
                            <strong>💡 FPL Coach Tip:</strong> {simRes.educationalTip}
                          </div>
                        </>
                      ) : (
                        <div className="p-4 bg-[rgba(235,77,75,0.05)] border border-[rgba(235,77,75,0.15)] rounded-xl text-xs text-gray-300">
                          {simRes.drawbacks[0]}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })() : (
                <div className="glass-panel text-center py-20">
                  <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-60" />
                  <h4 className="text-white font-bold text-sm m-0">Baseline Squad Required</h4>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto mt-2">
                    Please navigate back to the "Optimal Squad" tab and run the baseline optimization model first, so the simulator can measure the points changes relative to the baseline optimum.
                  </p>
                </div>
              )}
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
              
              {/* Executive Decision Summary */}
              <div className="glass-panel text-left animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <h4 className="text-gray-400 font-bold text-xs uppercase tracking-wider m-0">Executive Decision Summary</h4>
                  <span className="text-[10px] text-gray-500 font-mono">MODEL STATUS: SOLVED (OPTIMAL)</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: '0.5rem' }}>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Projected Yield</span>
                    <span className="text-2xl font-bold text-[#10b981] font-mono">{activeResult.totalProjectedPoints.toFixed(1)} <span className="text-xs font-semibold text-gray-400">EP</span></span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Total Cost</span>
                    <span className="text-2xl font-bold text-white font-mono">£{activeResult.totalCost.toFixed(1)}m</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Active Formation</span>
                    <span className="text-2xl font-bold text-white font-mono">{defs.length}-{mids.length}-{fwds.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Captain Selected</span>
                    <span className="text-2xl font-bold text-white font-mono">{activeResult.captain?.web_name}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed m-0" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  The ILP solver selected {activeResult.starters.length} starters maximizing total points under a £100.0m limit. Captain choice is <strong className="text-white">{activeResult.captain?.web_name}</strong> due to their points expectation ({activeResult.captain?.projected_points} pts) and playing probability.
                </p>
              </div>
              
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

              {/* FPL Coach Corner */}
              <div className="glass-panel text-left animate-fade-in" style={{ marginTop: '1.5rem', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[#38bdf8]"></span>
                  <h4 className="text-gray-400 font-bold text-xs uppercase tracking-wider m-0">FPL Coach's Analysis</h4>
                </div>
                <div className="flex flex-col gap-2.5 text-xs text-gray-300">
                  <p className="m-0 leading-relaxed text-gray-400">
                    {isPreSeason 
                      ? "Pre-season mode is currently active. The projection engine uses historical minutes and baseline PPG stats. Focus on locked starters who are assured of 90 minutes in their early matches." 
                      : "Form multipliers are currently active. The solver prioritizes hot streaks and high PPG. Keep a close eye on late injury updates before finalizing your squad."}
                  </p>
                  {activeResult.totalCost > 99.0 && (
                    <p className="m-0 leading-relaxed text-[#f59e0b]">
                      <strong>High Budget Concentration:</strong> You have allocated £{activeResult.totalCost.toFixed(1)}m on this squad. While it maximizes immediate returns, it reduces your ability to fund price rises or future transfers.
                    </p>
                  )}
                  {activeResult.bench.reduce((acc, p) => acc + p.projected_points, 0) > 10 && (
                    <p className="m-0 leading-relaxed text-[#10b981]">
                      <strong>Strong Bench Security:</strong> Your bench contributes {Math.round(activeResult.bench.reduce((acc, p) => acc + p.projected_points, 0) * 10) / 10} points. This serves as an excellent hedge against unexpected rotations or starting delays.
                    </p>
                  )}
                </div>
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
              
              {/* Chip Advisor Panel */}
              {mode === 'my-team' && renderChipAdvisor()}

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

              {/* Optimization Explainability Panel */}
              {activeExplanation && (
                <div className="glass-panel text-left" style={{ marginTop: '1.5rem' }}>
                  <h4 className="text-white font-bold text-sm mb-4 tracking-wider">OPTIMIZATION DECISION ANALYSIS</h4>
                  
                  {/* Global Summary */}
                  <div className="text-xs text-gray-300 leading-relaxed mb-6 p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                    <strong className="text-[#02c39a] text-[10px] uppercase tracking-wider block mb-1">Mathematical Rationale</strong>
                    {activeExplanation.globalOptimalitySummary}
                  </div>

                  {/* Budget Sensitivity */}
                  <div className="mb-6">
                    <h5 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Budget Capital Sensitivity</h5>
                    <div className="p-3 bg-[rgba(235,77,75,0.02)] border border-[rgba(235,77,75,0.1)] rounded-xl text-xs text-gray-300">
                      <strong>£1.0m Budget Constraint Impact:</strong> {activeExplanation.budgetSensitivity.explanation}
                    </div>
                  </div>

                  {/* Selection Explanations */}
                  <div className="mb-6">
                    <h5 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Selected Starters Opportunity Cost</h5>
                    <p className="text-[10px] text-gray-400 mb-3">Click on any selected starter below to see their exact mathematical opportunity cost and optimal replacement if they were omitted from the squad.</p>
                    
                    <div className="flex flex-col gap-2">
                      {activeExplanation.selections.map((sel) => {
                        const player = activeResult.starters.find(p => p.id === sel.playerId);
                        if (!player) return null;
                        const isExpanded = activeExpPlayerId === sel.playerId;

                        return (
                          <div 
                            key={sel.playerId}
                            className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${isExpanded ? 'bg-[rgba(2,195,154,0.04)] border-[rgba(2,195,154,0.25)]' : 'bg-[rgba(255,255,255,0.01)] border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.03)]'}`}
                            onClick={() => setActiveExpPlayerId(isExpanded ? null : sel.playerId)}
                          >
                            <div className="flex justify-between items-center font-semibold">
                              <span className="text-white">{sel.web_name}</span>
                              <span className="text-[#02c39a] font-mono font-bold">-{sel.opportunityCost.toFixed(1)} pts cost</span>
                            </div>
                            
                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)] flex flex-col gap-2">
                                <div className="text-[11px] text-gray-300">
                                  <strong>Why Chosen:</strong>
                                  <ul className="list-disc pl-4 mt-1 flex flex-col gap-1 text-[10px] text-gray-400">
                                    {sel.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                  </ul>
                                </div>
                                {sel.replacement && (
                                  <div className="text-[11px] text-gray-300 bg-[rgba(255,255,255,0.02)] p-2 rounded-lg border border-[rgba(255,255,255,0.04)]">
                                    <strong>Closest Alternative:</strong> {sel.replacement.web_name}
                                    <div className="text-[10px] text-gray-400 mt-1">
                                      {sel.replacement.reason}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notable Exclusions */}
                  <div>
                    <h5 className="text-[#e74c3c] font-bold text-xs uppercase tracking-wider mb-2">Forced Premium Exclusions Penalty</h5>
                    <div className="flex flex-col gap-2">
                      {activeExplanation.exclusions.map((excl) => (
                        <div key={excl.playerId} className="p-2.5 rounded-lg bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] text-xs">
                          <div className="flex justify-between items-center font-semibold mb-1">
                            <span className="text-white">{excl.web_name} (£{(excl.cost / 10).toFixed(1)}m)</span>
                            <span className="text-[#e74c3c] font-mono">-{excl.pointsLoss.toFixed(1)} pts penalty</span>
                          </div>
                          <ul className="list-disc pl-4 text-[10px] text-gray-400 flex flex-col gap-1 mt-1">
                            {excl.reasons.map((r, i) => <li key={i}>{r}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </div>

          </div>
        )}

      </main>

      {/* How to Use Modal */}
      {showHowToUse && (
        <div className="modal-overlay">
          <div className="modal-content relative" style={{ maxWidth: '600px', width: '90%' }}>
            <button 
              onClick={() => { setShowHowToUse(false); setModalTab('guide'); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            
            {/* Modal Tabs */}
            <div className="flex border-b border-[rgba(255,255,255,0.08)] mb-5" style={{ gap: '1.5rem' }}>
              <button
                onClick={() => setModalTab('guide')}
                className={`pb-2.5 text-sm font-semibold transition-all border-b-2 cursor-pointer ${modalTab === 'guide' ? 'text-[#02c39a] border-[#02c39a]' : 'text-gray-400 border-transparent hover:text-white'}`}
              >
                📖 How to Use
              </button>
              <button
                onClick={() => setModalTab('academy')}
                className={`pb-2.5 text-sm font-semibold transition-all border-b-2 cursor-pointer ${modalTab === 'academy' ? 'text-[#02c39a] border-[#02c39a]' : 'text-gray-400 border-transparent hover:text-white'}`}
              >
                🎓 FPL Academy Glossary
              </button>
            </div>

            {modalTab === 'guide' ? (
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
            ) : (
              <div className="flex flex-col gap-4 text-xs text-gray-300 overflow-y-auto custom-scrollbar" style={{ maxHeight: '350px', textAlign: 'left' }}>
                <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                  <strong className="text-[#02c39a] block mb-1">Expected Points (EP)</strong>
                  <p className="m-0 text-gray-400">The average number of points we expect this player to score this gameweek. Calculated by combining historical starts, minutes played, status adjustments, and home/away fixture adjustments.</p>
                </div>
                <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                  <strong className="text-[#02c39a] block mb-1">Value for Money</strong>
                  <p className="m-0 text-gray-400">How many expected points you receive for every £1.0m spent. Useful for locating budget-enabling gems that allow upgrades in other positions.</p>
                </div>
                <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                  <strong className="text-[#02c39a] block mb-1">Fixture Difficulty (FDR)</strong>
                  <p className="m-0 text-gray-400">FPL's official index (1-5) representing the difficulty of the opponent. The projection engine scales baseline points by up to +20% for easy matchups (FDR 1) and discounts by up to -20% for difficult ones (FDR 5).</p>
                </div>
                <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                  <strong className="text-[#02c39a] block mb-1">Differential</strong>
                  <p className="m-0 text-gray-400">A player selected by very few managers (typically under 10% ownership). A differential choice can yield rapid rank gains if they return points because your mini-league competitors do not own them.</p>
                </div>
                <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                  <strong className="text-[#02c39a] block mb-1">Reliability (Starting Likelihood)</strong>
                  <p className="m-0 text-gray-400">Our metric combining injury flags and starts ratio. Highly reliable players have very low rotation risk, protecting your starting lineup from unexpected benches.</p>
                </div>
                <div className="p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl">
                  <strong className="text-[#02c39a] block mb-1">Captain & Vice-Captain</strong>
                  <p className="m-0 text-gray-400">The player designated as captain scores double points. The vice-captain is a backup whose score is doubled only if your captain fails to play any minutes.</p>
                </div>
              </div>
            )}

            <div className="mt-8 pt-4 border-t border-[rgba(255,255,255,0.08)] flex justify-end">
              <button 
                onClick={() => { setShowHowToUse(false); setModalTab('guide'); }}
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
  const positionAbbreviations = ['GK', 'DEF', 'MID', 'FWD'];
  const posAbbr = positionAbbreviations[player.element_type - 1] || 'MID';
  const hasInjuryWarning = player.chance_of_playing_next_round < 75;

  const tooltipText = `Name: ${player.web_name}\nClub: ${player.team_name}\nPrice: £${(player.now_cost / 10).toFixed(1)}m\nAvailability: ${player.chance_of_playing_next_round}%\nProjected Points: ${player.projected_points}`;

  return (
    <div 
      className="pitch-player-card info-trigger" 
      data-tooltip={tooltipText}
    >
      <div className={`pitch-shirt ${posClass}`}>
        {posAbbr}
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
