import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import type { Player } from '../utils/pointsProjection';
import { calculatePlayerRatings } from '../utils/recommendationEngine';

interface PlayerPickerProps {
  players: Player[];
  onSelect: (player: Player) => void;
  selectedPlayers?: Player[];
  placeholder?: string;
  myTeamSquad?: Player[];
  budgetRemaining?: number;
  validateMode?: 'my-team' | 'scouting' | 'comparison' | 'simulation';
  excludeIds?: number[];
  isPreSeason?: boolean;
}

export function PlayerPicker({
  players,
  onSelect,
  selectedPlayers = [],
  placeholder = 'Search or select player...',
  myTeamSquad = [],
  budgetRemaining,
  validateMode = 'my-team',
  excludeIds = [],
  isPreSeason = false
}: PlayerPickerProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [posFilter, setPosFilter] = useState<'all' | 1 | 2 | 3 | 4>('all');
  const [clubFilter, setClubFilter] = useState<string>('all');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset focus index when filtered list changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [searchQuery, posFilter, clubFilter]);

  // Extract unique club names
  const uniqueClubs = Array.from(new Set(players.map(p => p.team_name))).sort();

  // Validate FPL squad limits in real-time
  const validatePlayer = (player: Player): { valid: boolean; reason?: string; warningOnly?: boolean } => {
    if (selectedPlayers.some(p => p.id === player.id)) {
      return { valid: false, reason: 'Selected' };
    }
    if (excludeIds.includes(player.id)) {
      return { valid: false, reason: 'Excluded' };
    }

    if (validateMode === 'my-team') {
      const squad = myTeamSquad.length > 0 ? myTeamSquad : selectedPlayers;
      
      // Position quota limit
      const pos = player.element_type;
      const posLimits = [2, 5, 5, 3];
      const maxAllowed = posLimits[pos - 1] || 0;
      const currentPosCount = squad.filter(p => p.element_type === pos).length;
      if (currentPosCount >= maxAllowed) {
        return { valid: false, reason: 'Position Limit' };
      }

      // Club limit (max 3 per team)
      const clubCounts: Record<string, number> = {};
      squad.forEach(p => {
        clubCounts[p.team_name] = (clubCounts[p.team_name] || 0) + 1;
      });
      if (clubCounts[player.team_name] >= 3) {
        return { valid: false, reason: 'Club Limit' };
      }

      // Budget check
      if (budgetRemaining !== undefined && (player.now_cost / 10) > budgetRemaining) {
        return { valid: true, reason: 'Exceeds Budget', warningOnly: true };
      }
    }

    return { valid: true };
  };

  // Cascading filters pipeline
  const filteredPlayers = players
    .filter(player => {
      // 1. Position filter
      if (posFilter !== 'all' && player.element_type !== posFilter) return false;
      // 2. Club filter
      if (clubFilter !== 'all' && player.team_name !== clubFilter) return false;
      // 3. Search query filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return (
          player.web_name.toLowerCase().includes(query) ||
          player.team_name.toLowerCase().includes(query) ||
          player.team_short_name.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .map(player => ({
      player,
      validation: validatePlayer(player)
    }))
    .sort((a, b) => {
      // Prioritize available points
      const pointsDiff = b.player.projected_points - a.player.projected_points;
      if (Math.abs(pointsDiff) > 0.05) return pointsDiff;

      // Prioritize ratings
      const recA = calculatePlayerRatings(a.player, isPreSeason, 0);
      const recB = calculatePlayerRatings(b.player, isPreSeason, 0);
      const ratingDiff = recB.ratings.overallRating - recA.ratings.overallRating;
      if (Math.abs(ratingDiff) > 0.05) return ratingDiff;

      // Alphabetical tiebreaker
      return a.player.web_name.localeCompare(b.player.web_name);
    })
    .slice(0, 80); // Cap list at 80 items for performance

  // Handle keyboard interaction
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        setFocusedIndex(prev => (prev + 1 < filteredPlayers.length ? prev + 1 : prev));
        e.preventDefault();
        break;
      case 'ArrowUp':
        setFocusedIndex(prev => (prev - 1 >= 0 ? prev - 1 : 0));
        e.preventDefault();
        break;
      case 'Enter':
        if (filteredPlayers[focusedIndex]) {
          const item = filteredPlayers[focusedIndex];
          if (item.validation.valid) {
            handleSelectPlayer(item.player);
          }
        }
        e.preventDefault();
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        e.preventDefault();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const activeEl = dropdownRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  const handleSelectPlayer = (player: Player) => {
    onSelect(player);
    setSearchQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Cascading Filter Controls */}
      <div className="flex gap-2 mb-2 w-full">
        {/* Position Select */}
        <select
          value={posFilter}
          onChange={(e) => {
            const val = e.target.value;
            setPosFilter(val === 'all' ? 'all' : parseInt(val) as any);
          }}
          className="px-2 py-1.5 bg-[#151824] border border-[#1e2330] rounded-lg text-xs font-semibold text-gray-300 outline-none flex-1 cursor-pointer focus:border-[#38bdf8]"
        >
          <option value="all">All Positions</option>
          <option value="1">GK (Goalkeepers)</option>
          <option value="2">DEF (Defenders)</option>
          <option value="3">MID (Midfielders)</option>
          <option value="4">FWD (Forwards)</option>
        </select>

        {/* Club Select */}
        <select
          value={clubFilter}
          onChange={(e) => setClubFilter(e.target.value)}
          className="px-2 py-1.5 bg-[#151824] border border-[#1e2330] rounded-lg text-xs font-semibold text-gray-300 outline-none flex-1 cursor-pointer focus:border-[#38bdf8]"
        >
          <option value="all">All Clubs</option>
          {uniqueClubs.map(club => (
            <option key={club} value={club}>{club}</option>
          ))}
        </select>
      </div>

      {/* Input Selector Box */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="search-input"
          style={{ paddingLeft: '2.5rem' }}
        />
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>

      {/* Options Dropdown list overlay */}
      {isOpen && (
        <div 
          ref={dropdownRef} 
          className="absolute z-50 mt-1 w-full bg-[#0f111a] border border-[#1e2330] rounded-xl shadow-2xl overflow-y-auto custom-scrollbar"
          style={{ maxHeight: '280px', top: '100%' }}
        >
          {filteredPlayers.length === 0 ? (
            <div className="p-4 text-xs text-gray-500 text-center font-medium">No matching players found</div>
          ) : (
            filteredPlayers.map(({ player, validation }, idx) => {
              const posAbbr = ['GK', 'DEF', 'MID', 'FWD'][player.element_type - 1];
              const rec = calculatePlayerRatings(player, isPreSeason, 0);
              const isFocused = idx === focusedIndex;
              const hasInjury = player.chance_of_playing_next_round < 75;

              return (
                <div
                  key={player.id}
                  data-active={isFocused}
                  onClick={() => {
                    if (validation.valid) {
                      handleSelectPlayer(player);
                    }
                  }}
                  className={`flex items-center justify-between px-3 py-1.5 text-xs border-b border-[#1e2330]/50 transition-all cursor-pointer h-14 group ${
                    !validation.valid ? 'opacity-40 cursor-not-allowed bg-black/10' : ''
                  } ${isFocused ? 'bg-[rgba(56,189,248,0.06)]' : 'hover:bg-[rgba(255,255,255,0.02)]'}`}
                >
                  {/* Left Column: Player Face + Name + info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Player Photo: 32px diameter, subtle border, opacity transition */}
                    <div className="relative shrink-0 w-8 h-8 opacity-80 group-hover:opacity-100 transition-opacity">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[9px] border border-[rgba(255,255,255,0.08)] bg-[#151824] ${
                        player.element_type === 1 ? 'text-warning border-warning/20' :
                        player.element_type === 2 ? 'text-[#38bdf8] border-[#38bdf8]/20' :
                        player.element_type === 3 ? 'text-emerald-400 border-emerald-400/20' : 'text-purple-400 border-purple-400/20'
                      }`}>
                        {posAbbr}
                      </div>
                      <img
                        src={`https://resources.premierleague.com/premierleague/photos/players/110x140/p${player.code}.png`}
                        alt=""
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        className="absolute inset-0 w-8 h-8 rounded-full object-cover border border-[#1e2330] bg-[#151824]"
                      />
                      {hasInjury && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#f59e0b] rounded-full border border-[#0f111a] flex items-center justify-center text-[7px] font-bold text-black" title={player.news}>
                          !
                        </div>
                      )}
                    </div>
                    
                    {/* Metadata Rows */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
                      {/* Row 1: Player Name + Recommendation Badge */}
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate text-xs block">{player.web_name}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                          rec.categoryLabel.includes('Essential') || rec.categoryLabel.includes('Strong')
                            ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20'
                            : rec.categoryLabel.includes('Monitor') || rec.categoryLabel.includes('Differential')
                            ? 'bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20'
                            : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}>
                          {rec.categoryLabel}
                        </span>
                      </div>

                      {/* Row 2: Club abbreviation • Position • Price • Projected points */}
                      <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-bold text-gray-300 uppercase tracking-wider">{player.team_short_name}</span>
                        <span className="text-gray-600">•</span>
                        <span>{posAbbr}</span>
                        <span className="text-gray-600">•</span>
                        <span className="font-mono text-white">£{(player.now_cost / 10).toFixed(1)}m</span>
                        <span className="text-gray-600">•</span>
                        <span className="text-[#10b981] font-bold font-mono">{player.projected_points.toFixed(1)} EP</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Selection status indicators */}
                  <div className="text-right shrink-0">
                    {!validation.valid && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[#ef4444] font-semibold inline-block">
                        {validation.reason}
                      </span>
                    )}

                    {validation.valid && validation.reason === 'Exceeds Budget' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-[#f59e0b] font-semibold inline-block">
                        Exceeds Budget
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
