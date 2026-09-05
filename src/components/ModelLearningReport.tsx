import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  ArrowRight, 
  Activity, 
  ShieldAlert, 
  BarChart3, 
  Zap, 
  Flame, 
  Award 
} from 'lucide-react';
import type { Player } from '../utils/pointsProjection';
import type { SolverResult } from '../utils/fplSolver';

interface ModelLearningReportProps {
  allPlayers: Player[];
  currentResult: SolverResult | null;
  onNavigateToMode?: (mode: 'optimal' | 'my-team' | 'scouting' | 'comparison' | 'simulation') => void;
}

export const ModelLearningReport: React.FC<ModelLearningReportProps> = ({
  allPlayers: _allPlayers,
  currentResult: _currentResult,
  onNavigateToMode
}) => {
  const [activeTab, setActiveTab] = useState<'top10k' | 'overview' | 'misses' | 'surprises' | 'randomness' | 'learnings' | 'squad-comparison'>('top10k');

  // Baseline 57.97 Pre-season Lineup data
  const baselineSquad = [
    { name: 'Raya', team: 'ARS', pos: 'GK', cost: 6.0, proj: 5.40, gw1: 6, gw2: 1, total: 7, mins: 142, cs: 1, g: 0, a: 0, xG: 0.00, xA: 0.00, role: 'Starting XI' },
    { name: 'Gabriel', team: 'ARS', pos: 'DEF', cost: 8.0, proj: 4.50, gw1: 5, gw2: 1, total: 6, mins: 142, cs: 1, g: 0, a: 0, xG: 0.18, xA: 0.02, role: 'Starting XI' },
    { name: 'Guéhi', team: 'MCI', pos: 'DEF', cost: 6.0, proj: 3.45, gw1: 10, gw2: 2, total: 12, mins: 180, cs: 0, g: 1, a: 0, xG: 0.89, xA: 0.36, role: 'Starting XI' },
    { name: 'Tarkowski', team: 'EVE', pos: 'DEF', cost: 6.0, proj: 3.45, gw1: 6, gw2: 12, total: 18, mins: 180, cs: 1, g: 1, a: 0, xG: 0.15, xA: 0.01, role: 'Starting XI' },
    { name: 'Van Hecke', team: 'TOT', pos: 'DEF', cost: 5.0, proj: 2.88, gw1: 1, gw2: 1, total: 2, mins: 180, cs: 0, g: 0, a: 0, xG: 0.11, xA: 0.06, role: 'Starting XI' },
    { name: 'B. Fernandes', team: 'MUN', pos: 'MID', cost: 12.0, proj: 12.60, gw1: 4, gw2: 46, total: 50, mins: 180, cs: 0, g: 3, a: 1, xG: 2.10, xA: 0.74, role: 'Starting XI (C)' },
    { name: 'Semenyo', team: 'MCI', pos: 'MID', cost: 8.5, proj: 4.89, gw1: 2, gw2: 5, total: 7, mins: 180, cs: 0, g: 0, a: 1, xG: 0.12, xA: 0.59, role: 'Starting XI' },
    { name: 'Gibbs-White', team: 'NFO', pos: 'MID', cost: 7.9, proj: 4.60, gw1: 2, gw2: 13, total: 15, mins: 180, cs: 0, g: 1, a: 1, xG: 0.92, xA: 0.10, role: 'Starting XI' },
    { name: 'Rice', team: 'ARS', pos: 'MID', cost: 7.5, proj: 5.47, gw1: 3, gw2: 4, total: 7, mins: 119, cs: 1, g: 0, a: 0, xG: 0.07, xA: 0.17, role: 'Starting XI' },
    { name: 'Anderson', team: 'MCI', pos: 'MID', cost: 6.4, proj: 4.83, gw1: 2, gw2: 3, total: 5, mins: 143, cs: 0, g: 0, a: 0, xG: 0.07, xA: 0.47, role: 'Starting XI' },
    { name: 'Thiago', team: 'BRE', pos: 'FWD', cost: 8.0, proj: 4.60, gw1: 0, gw2: 2, total: 2, mins: 172, cs: 1, g: 0, a: 0, xG: 1.80, xA: 0.09, role: 'Starting XI' },
    { name: 'Mitchell', team: 'CRY', pos: 'DEF', cost: 4.5, proj: 2.59, gw1: 1, gw2: 0, total: 1, mins: 180, cs: 0, g: 0, a: 0, xG: 0.11, xA: 0.17, role: 'Bench 1' },
    { name: 'Emegha', team: 'CHE', pos: 'FWD', cost: 5.0, proj: 2.25, gw1: 0, gw2: 0, total: 0, mins: 0, cs: 0, g: 0, a: 0, xG: 0.00, xA: 0.00, role: 'Bench 2' },
    { name: 'Destan', team: 'HUL', pos: 'FWD', cost: 4.5, proj: 2.25, gw1: 0, gw2: 0, total: 0, mins: 0, cs: 0, g: 0, a: 0, xG: 0.00, xA: 0.00, role: 'Bench 3' },
    { name: 'Verbruggen', team: 'BHA', pos: 'GK', cost: 4.5, proj: 0.12, gw1: 6, gw2: 0, total: 6, mins: 180, cs: 1, g: 0, a: 0, xG: 0.00, xA: 0.00, role: 'Bench GK' }
  ];

  // League-wide surprise performers data
  const surprisePerformers = [
    { name: 'Rayan Cherki', team: 'MCI', pos: 'MID', cost: 7.6, points: 22, stats: '2G, 2A in 108 min', xG: '0.35', xA: '1.05', verdict: 'Explosive attacking playmaker; high per-minute return.' },
    { name: 'Semi Ajayi', team: 'HUL', pos: 'DEF', cost: 4.0, points: 20, stats: '1G, 2 Clean Sheets', xG: '0.52', xA: '0.00', verdict: 'Promoted team defensive outlier; 2 shutouts in 2 matches.' },
    { name: 'Cole Palmer', team: 'CHE', pos: 'MID', cost: 9.6, points: 20, stats: '2G, 1A (172 min)', xG: '0.94', xA: '0.32', verdict: 'Elite penalty-taker and central focal point.' },
    { name: 'João Pedro', team: 'CHE', pos: 'FWD', cost: 7.6, points: 20, stats: '2G, 2A (180 min)', xG: '1.86', xA: '0.10', verdict: 'High-threat starting forward with high goal involvement.' },
    { name: 'Konstantinos Tzolakis', team: 'HUL', pos: 'GK', cost: 4.5, points: 20, stats: '2 Clean Sheets, 8 Saves', xG: '0.00', xA: '0.00', verdict: 'Highest scoring goalkeeper in FPL across early gameweeks.' },
    { name: 'John Egan', team: 'HUL', pos: 'DEF', cost: 4.0, points: 17, stats: '2 Clean Sheets (180 min)', xG: '0.00', xA: '0.00', verdict: 'Budget backline anchor outperforming premium defense assets.' },
    { name: 'Erling Haaland', team: 'MCI', pos: 'FWD', cost: 15.5, points: 15, stats: '2 Goals (180 min)', xG: '1.40', xA: '0.00', verdict: 'Steady premium talisman delivering reliable returns.' }
  ];

  return (
    <div className="flex flex-col gap-6 text-left max-w-6xl mx-auto w-full animate-fade-in pb-16">
      
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #38bdf8' }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#38bdf8]/15 text-[#38bdf8] uppercase font-mono tracking-wider border border-[#38bdf8]/30">
                AUDIT & DIAGNOSTICS
              </span>
              <span className="text-gray-400 text-xs font-mono">• 2 Completed Gameweeks (2026/27)</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white m-0 tracking-tight flex items-center gap-2.5">
              <BarChart3 className="w-7 h-7 text-[#38bdf8]" />
              Model Learning & Audit Report
            </h2>
            <p className="text-sm text-gray-300 m-0 mt-1 max-w-2xl leading-relaxed">
              Evaluating the <strong>57.97-point Pre-Season Baseline</strong> against actual Gameweeks 1 & 2 results: diagnosing model misses, examining high-variance outliers, and deriving statistical updates.
            </p>
          </div>

          <div className="flex gap-2">
            {onNavigateToMode && (
              <button 
                onClick={() => onNavigateToMode('optimal')} 
                className="px-4 py-2 bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 border border-white/10"
              >
                View Live Optimal XI
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1. EXECUTIVE SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider font-mono">Pre-Season Baseline</span>
            <Sparkles className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">57.97 <span className="text-sm font-sans font-normal text-gray-400">pts</span></div>
          <div className="text-xs text-gray-400 mt-1">Starting XI Proj: <strong className="text-white">56.67 pts</strong></div>
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 font-mono">
            Calibrated Pre-Season Solver
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider font-mono">Actual GW1 Outcome</span>
            <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <div className="text-3xl font-extrabold text-[#f59e0b] font-mono">41.0 <span className="text-sm font-sans font-normal text-gray-400">pts</span></div>
          <div className="text-xs text-[#f59e0b] mt-1 font-semibold">-15.67 pts (-27.6% variance)</div>
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b] font-mono">
            Fernandes (C) & Thiago Blanked
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider font-mono">Actual GW2 Outcome</span>
            <Flame className="w-4 h-4 text-[#10b981]" />
          </div>
          <div className="text-3xl font-extrabold text-[#10b981] font-mono">90.0 <span className="text-sm font-sans font-normal text-gray-400">pts</span></div>
          <div className="text-xs text-[#10b981] mt-1 font-semibold">+33.33 pts (+58.8% explosion)</div>
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] font-mono">
            Fernandes (C) 46 pts + Gibbs-White
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider font-mono">2-GW Total Realized</span>
            <Award className="w-4 h-4 text-[#38bdf8]" />
          </div>
          <div className="text-3xl font-extrabold text-[#38bdf8] font-mono">131.0 <span className="text-sm font-sans font-normal text-gray-400">pts</span></div>
          <div className="text-xs text-gray-300 mt-1">Average: <strong className="text-[#10b981]">65.5 pts / GW</strong></div>
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-[#38bdf8]/10 border border-[#38bdf8]/20 text-[#38bdf8] font-mono">
            Above Target Average
          </span>
        </div>
      </div>

      {/* 2. "WHAT CHANGED?" THREE-STAGE TIMELINE */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 className="text-base font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#38bdf8]" />
          How Two Weeks of Football Informed the Model
        </h3>
        <p className="text-xs text-gray-400 mb-6 max-w-3xl">
          Tracing the evolution from pre-season priors to active data incorporation:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          
          {/* Stage 1 */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-xs font-bold font-mono">1</span>
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Pre-Season Prior</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1.5">Historical Anchor</h4>
              <p className="text-xs text-gray-400 leading-relaxed m-0">
                Prior projections based on £-cost, historical PPG, and pre-season tactical assumptions. Heavy 5-midfield structure with Fernandes anchor.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-gray-400 font-mono">
              Projection: <strong>57.97 EP</strong>
            </div>
          </div>

          {/* Stage 2 */}
          <div className="p-4 rounded-xl bg-[#f59e0b]/5 border border-[#f59e0b]/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] flex items-center justify-center text-xs font-bold font-mono">2</span>
                <span className="text-xs font-bold text-[#f59e0b] uppercase tracking-wider">GW1 Evidence</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1.5">Finishing Slump & Floor</h4>
              <p className="text-xs text-gray-400 leading-relaxed m-0">
                Squad scored 41 pts. Bruno Fernandes blanked (4 pts); Thiago generated 0.64 xG but scored 0 pts; CDMs produced expected low floors.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#f59e0b]/20 text-[11px] text-[#f59e0b] font-mono">
              Outcome: <strong>41.0 pts (-27.6%)</strong>
            </div>
          </div>

          {/* Stage 3 */}
          <div className="p-4 rounded-xl bg-[#10b981]/5 border border-[#10b981]/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-[#10b981]/20 text-[#10b981] flex items-center justify-center text-xs font-bold font-mono">3</span>
                <span className="text-xs font-bold text-[#10b981] uppercase tracking-wider">GW2 Evidence</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1.5">Premium Haul Explosion</h4>
              <p className="text-xs text-gray-400 leading-relaxed m-0">
                Squad exploded for 90 pts. Captain Fernandes recorded 23 pts (46 captained) with a hat-trick; Gibbs-White (13 pts) and Tarkowski (12 pts) hauled.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#10b981]/20 text-[11px] text-[#10b981] font-mono">
              Outcome: <strong>90.0 pts (+58.8%)</strong>
            </div>
          </div>

          {/* Stage 4 */}
          <div className="p-4 rounded-xl bg-[#38bdf8]/10 border border-[#38bdf8]/30 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] flex items-center justify-center text-xs font-bold font-mono">4</span>
                <span className="text-xs font-bold text-[#38bdf8] uppercase tracking-wider">Early-Season Model</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1.5">Sample-Size Blend</h4>
              <p className="text-xs text-gray-400 leading-relaxed m-0">
                60% Pre-season Prior / 40% Observed evidence. Separating noise (one-off goals) from process (xG, xA, starting minutes).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#38bdf8]/30 text-[11px] text-[#38bdf8] font-mono">
              Weighting: <strong>w = 0.60 Prior</strong>
            </div>
          </div>

        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <button 
          onClick={() => setActiveTab('top10k')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'top10k' 
              ? 'bg-[#38bdf8] text-black shadow-lg shadow-[#38bdf8]/20' 
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          🏆 Model vs. Top 10K Benchmark
        </button>
        <button 
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'overview' 
              ? 'bg-[#38bdf8] text-black shadow-lg shadow-[#38bdf8]/20' 
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          Starting XI Performance Table
        </button>
        <button 
          onClick={() => setActiveTab('misses')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'misses' 
              ? 'bg-[#38bdf8] text-black shadow-lg shadow-[#38bdf8]/20' 
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          Biggest Model Misses
        </button>
        <button 
          onClick={() => setActiveTab('surprises')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'surprises' 
              ? 'bg-[#38bdf8] text-black shadow-lg shadow-[#38bdf8]/20' 
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          League Surprise Performers
        </button>
        <button 
          onClick={() => setActiveTab('randomness')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'randomness' 
              ? 'bg-[#38bdf8] text-black shadow-lg shadow-[#38bdf8]/20' 
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          Model vs. Randomness
        </button>
        <button 
          onClick={() => setActiveTab('learnings')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'learnings' 
              ? 'bg-[#38bdf8] text-black shadow-lg shadow-[#38bdf8]/20' 
              : 'bg-white/5 text-gray-300 hover:bg-white/10'
          }`}
        >
          What Should the Model Learn?
        </button>
      </div>

      {/* TAB CONTENT 0: TOP 10K BENCHMARK */}
      {activeTab === 'top10k' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider m-0">Model vs. Global Top 10K Benchmark</h3>
              <p className="text-xs text-gray-400 mt-1 m-0">Authoritative empirical comparison against the top 10,000 managers in official FPL 2026/27 standings.</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#38bdf8]/10 border border-[#38bdf8]/30 text-[#38bdf8]">
              Official FPL API Data
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse font-mono">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase text-[11px]">
                  <th className="py-2.5 px-3">Gameweek</th>
                  <th className="py-2.5 px-3 text-right">Model Predicted XI</th>
                  <th className="py-2.5 px-3 text-right">Top 10K Average</th>
                  <th className="py-2.5 px-3 text-right">Diff vs Top 10K</th>
                  <th className="py-2.5 px-3 text-right font-bold text-white">Actual Model XI</th>
                  <th className="py-2.5 px-3 text-right">Prediction Error</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 font-semibold text-white">Gameweek 1</td>
                  <td className="py-3 px-3 text-right text-[#38bdf8]">56.67 pts</td>
                  <td className="py-3 px-3 text-right text-[#fbbf24]">80.16 pts</td>
                  <td className="py-3 px-3 text-right text-[#f87171] font-bold">-23.49 pts</td>
                  <td className="py-3 px-3 text-right font-bold text-white">41.00 pts</td>
                  <td className="py-3 px-3 text-right text-[#f87171]">-15.67 pts (-27.6%)</td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-[10.5px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      ✓ Completed
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 font-semibold text-white">Gameweek 2</td>
                  <td className="py-3 px-3 text-right text-[#38bdf8]">52.10 pts</td>
                  <td className="py-3 px-3 text-right text-[#fbbf24]">125.26 pts</td>
                  <td className="py-3 px-3 text-right text-[#f87171] font-bold">-73.16 pts</td>
                  <td className="py-3 px-3 text-right font-bold text-white">90.00 pts</td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-bold">+37.90 pts (+72.7%)</td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-[10.5px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      ✓ Completed
                    </span>
                  </td>
                </tr>
                <tr className="bg-white/[0.03] font-bold border-y border-white/10">
                  <td className="py-3 px-3 text-white">2-GW Cumulative</td>
                  <td className="py-3 px-3 text-right text-[#38bdf8]">108.77 pts</td>
                  <td className="py-3 px-3 text-right text-[#fbbf24]">205.43 pts</td>
                  <td className="py-3 px-3 text-right text-[#f87171]">-96.66 pts</td>
                  <td className="py-3 px-3 text-right text-white">131.00 pts</td>
                  <td className="py-3 px-3 text-right text-emerald-400">+22.23 pts (+20.4%)</td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-[10.5px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ✓ Evaluated
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors text-gray-400">
                  <td className="py-3 px-3 font-semibold text-[#38bdf8]">Gameweek 3</td>
                  <td className="py-3 px-3 text-right text-[#38bdf8] font-bold">66.51 pts</td>
                  <td className="py-3 px-3 text-right text-gray-500">Pending</td>
                  <td className="py-3 px-3 text-right text-gray-500">Pending</td>
                  <td className="py-3 px-3 text-right text-gray-500">Pending</td>
                  <td className="py-3 px-3 text-right text-gray-500">Pending</td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-[10.5px] px-2 py-0.5 rounded bg-[#38bdf8]/10 text-[#38bdf8] font-bold border border-[#38bdf8]/20">
                      ⏳ Active Horizon
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3.5 rounded-lg bg-black/40 border border-white/10 text-xs text-gray-300 leading-relaxed font-sans">
            <strong className="text-white block mb-1">📌 Methodology & Benchmark Definition:</strong>
            The <strong>Top 10K Benchmark</strong> represents the empirical average points achieved by the top 10,000 highest-ranked managers globally in the official 2026/27 FPL Overall League (League ID 314). In GW1–2, the Top 10K cohort is heavily skewed by early chip usage (814K Bench Boosts and 250K Triple Captains played in GW1; 338K Bench Boosts in GW2) and extreme variance in captaincy hauls. Unlike the global player average (50 pts in GW1, 79 pts in GW2), this benchmark measures the model against the upper competitive ceiling. Gameweek 3 Top 10K results are marked as <strong>Pending</strong> until all upcoming GW3 fixtures have finished.
          </div>
        </div>
      )}

      {/* TAB CONTENT 1: OVERVIEW TABLE */}
      {activeTab === 'overview' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider m-0">Pre-Season 57.97 Baseline: Player Audit</h3>
              <p className="text-xs text-gray-400 mt-1 m-0">Comparing each player's projected starting points against realized gameweek outcomes.</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-white/5 border border-white/10 text-gray-300">
              15 Players Tracked
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 font-mono uppercase text-[11px]">
                  <th className="py-2.5 px-3">Player</th>
                  <th className="py-2.5 px-2">Role</th>
                  <th className="py-2.5 px-2">Price</th>
                  <th className="py-2.5 px-2 text-right">GW1 Proj</th>
                  <th className="py-2.5 px-2 text-right">GW1 Act</th>
                  <th className="py-2.5 px-2 text-right">GW2 Act</th>
                  <th className="py-2.5 px-2 text-right font-bold text-white">2-GW Total</th>
                  <th className="py-2.5 px-2 text-center">Mins</th>
                  <th className="py-2.5 px-2 text-center">G / A</th>
                  <th className="py-2.5 px-2 text-right">xG / xA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {baselineSquad.map(p => {
                  const isCap = p.role.includes('(C)');
                  const isStarter = p.role.includes('Starting');
                  return (
                    <tr key={p.name} className={`hover:bg-white/[0.02] transition-colors ${!isStarter ? 'opacity-60' : ''}`}>
                      <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/10 text-gray-300">
                          {p.pos}
                        </span>
                        {p.name}
                        {isCap && <span className="text-[9px] bg-[#f59e0b]/20 text-[#f59e0b] px-1 py-0.2 rounded font-bold">C</span>}
                      </td>
                      <td className="py-2.5 px-2 text-gray-400 font-mono text-[11px]">{p.role}</td>
                      <td className="py-2.5 px-2 font-mono text-gray-300">£{p.cost.toFixed(1)}m</td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-gray-300">{p.proj.toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-gray-300">{p.gw1}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-gray-300">{p.gw2}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-[#38bdf8]">{p.total}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-gray-400">{p.mins}'</td>
                      <td className="py-2.5 px-2 text-center font-mono text-gray-300">{p.g}G / {p.a}A</td>
                      <td className="py-2.5 px-2 text-right font-mono text-gray-400">{p.xG} / {p.xA}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: BIGGEST MISSES */}
      {activeTab === 'misses' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Miss 1: Thiago */}
          <div className="glass-panel flex flex-col justify-between" style={{ padding: '24px', borderTop: '3px solid #ef4444' }}>
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ef4444]/15 text-[#ef4444] uppercase font-mono">
                  Finishing Noise
                </span>
                <span className="text-xs font-mono text-gray-400">BRE • FWD • £8.0m</span>
              </div>
              <h4 className="text-lg font-bold text-white mb-1">Thiago (Brentford)</h4>
              <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 font-mono text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px]">PROJECTED</span>
                  <span className="text-white font-bold text-sm">4.60 EP</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">ACTUAL (2 GWs)</span>
                  <span className="text-[#ef4444] font-bold text-sm">2 pts</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">MINUTES</span>
                  <span className="text-gray-300 font-bold">172 mins</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">UNDERLYING xG</span>
                  <span className="text-[#10b981] font-bold">1.80 xG</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed mb-0">
                <strong>Diagnosis:</strong> Process vs. Outcome divergence. Thiago recorded an elite <strong>1.80 xG</strong> (including a missed penalty in GW1). The model's tactical assumption of high chance volume was accurate; the finishing conversion experienced short-term stochastic failure.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-gray-400 italic">
              💡 Action: Retain prior weighting; do not prematurely penalize high-xG forwards.
            </div>
          </div>

          {/* Miss 2: Rice & Anderson */}
          <div className="glass-panel flex flex-col justify-between" style={{ padding: '24px', borderTop: '3px solid #f59e0b' }}>
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f59e0b]/15 text-[#f59e0b] uppercase font-mono">
                  Structural Overvaluation
                </span>
                <span className="text-xs font-mono text-gray-400">ARS / MCI • MIDs</span>
              </div>
              <h4 className="text-lg font-bold text-white mb-1">Declan Rice & Elliot Anderson</h4>
              <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 font-mono text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px]">PROJECTED</span>
                  <span className="text-white font-bold text-sm">~5.0 EP each</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">ACTUAL (2 GWs)</span>
                  <span className="text-[#f59e0b] font-bold text-sm">5 pts each</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">MINUTES</span>
                  <span className="text-gray-300 font-bold">119' / 143'</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">TOTAL xG</span>
                  <span className="text-[#ef4444] font-bold">0.07 xG each</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed mb-0">
                <strong>Diagnosis:</strong> Structural CDM overvaluation. Deep-lying midfielders without set-piece ownership produce a consistent 2-3 point appearance floor, but lack the open-play attacking ceiling to justify a 5.0+ EP projection.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-gray-400 italic">
              💡 Action: Down-weight price-based priors for players with deep tactical deployment.
            </div>
          </div>

          {/* Miss 3: Bench Forwards */}
          <div className="glass-panel flex flex-col justify-between" style={{ padding: '24px', borderTop: '3px solid #64748b' }}>
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-300 uppercase font-mono">
                  Playing-Time Bias
                </span>
                <span className="text-xs font-mono text-gray-400">CHE / HUL • FWDs</span>
              </div>
              <h4 className="text-lg font-bold text-white mb-1">Emegha & Destan (Bench)</h4>
              <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 font-mono text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px]">PROJECTED</span>
                  <span className="text-white font-bold text-sm">2.25 EP each</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">ACTUAL (2 GWs)</span>
                  <span className="text-gray-400 font-bold text-sm">0 pts</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">MINUTES</span>
                  <span className="text-[#ef4444] font-bold">0 mins</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">STARTS</span>
                  <span className="text-[#ef4444] font-bold">0 starts</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed mb-0">
                <strong>Diagnosis:</strong> Over-optimistic reserve minutes prior. Budget bench enablers (£4.5m–£5.0m) without established starting positions delivered zero minutes, undermining bench backup equity.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-gray-400 italic">
              💡 Action: Penalize reserve players rapidly when consecutive 0-minute team sheets occur.
            </div>
          </div>

        </div>
      )}

      {/* TAB CONTENT 3: SURPRISE PERFORMERS */}
      {activeTab === 'surprises' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider m-0">League-Wide Surprise Performers (GW1+GW2)</h3>
              <p className="text-xs text-gray-400 mt-1 m-0">Assets who outperformed pre-season expectations across the Premier League.</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b]">
              ⚠ Small Sample Size (2 GWs)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {surprisePerformers.map(p => (
              <div key={p.name} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-sm font-bold text-white m-0 flex items-center gap-2">
                      {p.name}
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/10 text-gray-300">
                        {p.pos} • {p.team}
                      </span>
                    </h4>
                    <span className="text-xs text-gray-400 font-mono">Price: £{p.cost.toFixed(1)}m</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-[#10b981] font-mono block">{p.points} pts</span>
                    <span className="text-[10px] text-gray-400">{p.stats}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-300 mt-2 pt-2 border-t border-white/5 m-0 leading-relaxed">
                  {p.verdict}
                </p>
                {p.team === 'HUL' && (
                  <div className="mt-2 text-[10px] text-[#f59e0b] bg-[#f59e0b]/10 p-1.5 rounded border border-[#f59e0b]/20 font-mono">
                    ⚠ Hull City Caution: Promoted defense overperformed priors, but sample is too small (2 GWs) to assume season-long elite defensive tier.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: MODEL VS RANDOMNESS */}
      {activeTab === 'randomness' && (
        <div className="glass-panel flex flex-col gap-6" style={{ padding: '24px' }}>
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#38bdf8]" />
              Separating Model Error from Stochastic Randomness
            </h3>
            <p className="text-xs text-gray-400 max-w-3xl leading-relaxed m-0">
              A central principle of decision science: <strong>ACTUAL RESULT ≠ EXPECTED RESULT</strong> and <strong>MODEL ERROR ≠ RANDOM OUTCOME VARIANCE</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Case Study 1 */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-[#10b981]/30">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-[#10b981]" />
                <h4 className="text-sm font-bold text-white m-0">Case A: Random Outcome Noise (Thiago)</h4>
              </div>
              <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
                <p>
                  • <strong>Model Prediction:</strong> 4.60 Expected Points.<br />
                  • <strong>Realized Yield:</strong> 2 total points across 172 minutes.<br />
                  • <strong>Underlying Process:</strong> 1.80 xG accumulated (penalty missed, 2 big chances).
                </p>
                <div className="p-3 rounded-lg bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] font-mono text-[11px]">
                  <strong>Mathematical Conclusion:</strong> The model was structurally sound. Generating 1.80 xG over 2 matches represents top-tier goal equity. Zero goals was a stochastic finishing anomaly, not a failure of player evaluation.
                </div>
              </div>
            </div>

            {/* Case Study 2 */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-[#ef4444]/30">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-5 h-5 text-[#ef4444]" />
                <h4 className="text-sm font-bold text-white m-0">Case B: Genuine Model Error (Declan Rice)</h4>
              </div>
              <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
                <p>
                  • <strong>Model Prediction:</strong> 5.47 Expected Points.<br />
                  • <strong>Realized Yield:</strong> 5 total points across 119 minutes.<br />
                  • <strong>Underlying Process:</strong> 0.07 xG and 0.17 xA accumulated.
                </p>
                <div className="p-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] font-mono text-[11px]">
                  <strong>Mathematical Conclusion:</strong> Structural model overvaluation. The baseline formula relied too heavily on price/historical status, projecting high attacking yield for a player with zero box entries and no penalty duties.
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB CONTENT 5: WHAT SHOULD THE MODEL LEARN? */}
      {activeTab === 'learnings' && (
        <div className="glass-panel flex flex-col gap-6" style={{ padding: '24px' }}>
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#38bdf8]" />
              Four Architectural Lessons from Gameweeks 1 & 2
            </h3>
            <p className="text-xs text-gray-400 max-w-3xl leading-relaxed m-0">
              How the FPL Decision Support System adapts its statistical models while safeguarding against small-sample overreaction:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] flex items-center justify-center text-xs font-bold font-mono">1</span>
                <h4 className="text-sm font-bold text-white m-0">Separate Process from Outcome</h4>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed m-0">
                Weight underlying process indicators (xG, xA, expected goals conceded) higher than noisy one-off goal deflections. Regress finishing outliers back toward underlying volume.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] flex items-center justify-center text-xs font-bold font-mono">2</span>
                <h4 className="text-sm font-bold text-white m-0">Update Tactical Roles Faster Than Points</h4>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed m-0">
                Adjust playing probabilities immediately when a player logs consecutive starts (180 mins) or consecutive benchings (0 mins), while updating scoring rate priors more gradually.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] flex items-center justify-center text-xs font-bold font-mono">3</span>
                <h4 className="text-sm font-bold text-white m-0">Sample-Size-Aware Prior Retention</h4>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed m-0">
                Maintain the decay transition floor: <strong>w = max(0.30, 1 - GW/5)</strong>. At GW2, retaining a 60% anchor on pre-season baseline prevents overhauling the squad based on 180 minutes.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] flex items-center justify-center text-xs font-bold font-mono">4</span>
                <h4 className="text-sm font-bold text-white m-0">Cautious Adjustment on Team Anomaly</h4>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed m-0">
                Flag surprise team runs (e.g. Hull City back-to-back clean sheets) as low-confidence early outliers until larger sample sizes verify sustained structural defensive superiority.
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
