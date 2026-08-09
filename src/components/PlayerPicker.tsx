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
  onOpenChange?: (isOpen: boolean) => void;
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
  isPreSeason = false,
  onOpenChange
}: PlayerPickerProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [animateOpen, setAnimateOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [posFilter, setPosFilter] = useState<'all' | 1 | 2 | 3 | 4>('all');
  const [clubFilter, setClubFilter] = useState<string>('all');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Notify parent component of open state changes
  useEffect(() => {
    if (onOpenChange) {
      onOpenChange(isOpen);
    }
    if (isOpen) {
      const timer = setTimeout(() => setAnimateOpen(true), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimateOpen(false);
    }
  }, [isOpen, onOpenChange]);

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

  // Reset focus index when filters change
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

  // Base filtered players list
  const baseFiltered = players.filter(player => {
    if (posFilter !== 'all' && player.element_type !== posFilter) return false;
    if (clubFilter !== 'all' && player.team_name !== clubFilter) return false;
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      return (
        player.web_name.toLowerCase().includes(query) ||
        player.team_name.toLowerCase().includes(query) ||
        player.team_short_name.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Sort helper
  const sortPlayers = (list: Player[]) => {
    return [...list].sort((a, b) => {
      const pointsDiff = b.projected_points - a.projected_points;
      if (Math.abs(pointsDiff) > 0.05) return pointsDiff;

      const recA = calculatePlayerRatings(a, isPreSeason, 0);
      const recB = calculatePlayerRatings(b, isPreSeason, 0);
      const ratingDiff = recB.ratings.overallRating - recA.ratings.overallRating;
      if (Math.abs(ratingDiff) > 0.05) return ratingDiff;

      return a.web_name.localeCompare(b.web_name);
    });
  };

  // Compile final items list with headers if appropriate
  interface RenderItem {
    type: 'header' | 'player';
    label?: string;
    key: string;
    player?: Player;
    validation?: { valid: boolean; reason?: string; warningOnly?: boolean };
  }

  let itemsToRender: RenderItem[] = [];

  if (searchQuery.trim() === '' && posFilter === 'all' && clubFilter === 'all') {
    const sorted = sortPlayers(players);
    const popular = sorted.slice(0, 5);
    const others = sorted.slice(5, 80);

    itemsToRender.push({ type: 'header', label: 'Popular Picks (Highest Projected)', key: 'hdr-popular' });
    popular.forEach(p => {
      itemsToRender.push({ type: 'player', player: p, validation: validatePlayer(p), key: `popular-${p.id}` });
    });

    itemsToRender.push({ type: 'header', label: 'All Players', key: 'hdr-all' });
    others.forEach(p => {
      itemsToRender.push({ type: 'player', player: p, validation: validatePlayer(p), key: `all-${p.id}` });
    });
  } else {
    const sorted = sortPlayers(baseFiltered).slice(0, 80);
    sorted.forEach(p => {
      itemsToRender.push({ type: 'player', player: p, validation: validatePlayer(p), key: `search-${p.id}` });
    });
  }

  // Extract only player items for keyboard navigation index map
  const playerItems = itemsToRender.filter(item => item.type === 'player');

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
        setFocusedIndex(prev => (prev + 1 < playerItems.length ? prev + 1 : prev));
        e.preventDefault();
        break;
      case 'ArrowUp':
        setFocusedIndex(prev => (prev - 1 >= 0 ? prev - 1 : 0));
        e.preventDefault();
        break;
      case 'Enter':
        if (playerItems[focusedIndex]) {
          const item = playerItems[focusedIndex];
          if (item.player && item.validation?.valid) {
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

  let playerIdxCounter = 0;

  return (
    <div ref={containerRef} className="relative w-full text-left">
      {/* Cascading Filter Controls */}
      <div className="flex gap-2.5 mb-3 w-full">
        {/* Position Select */}
        <select
          value={posFilter}
          onChange={(e) => {
            const val = e.target.value;
            setPosFilter(val === 'all' ? 'all' : parseInt(val) as any);
          }}
          className="px-2.5 py-2 bg-[#151824] border border-[#1e2330] rounded-xl text-xs font-semibold text-gray-300 outline-none flex-1 cursor-pointer focus:border-[#38bdf8] transition-all"
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
          className="px-2.5 py-2 bg-[#151824] border border-[#1e2330] rounded-xl text-xs font-semibold text-gray-300 outline-none flex-1 cursor-pointer focus:border-[#38bdf8] transition-all"
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
          className="search-input w-full"
          style={{ paddingLeft: '2.5rem' }}
        />
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>

      {/* Options Dropdown list overlay */}
      {isOpen && (
        <div 
          ref={dropdownRef} 
          className={`absolute z-50 mt-1.5 w-full bg-[#0f111a] border border-[#1e2330] rounded-xl shadow-2xl overflow-y-auto custom-scrollbar transition-all duration-150 ease-out origin-top ${
            animateOpen ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-95 pointer-events-none'
          }`}
          style={{ maxHeight: '320px', top: '100%', left: 0, right: 0 }}
        >
          {itemsToRender.length === 0 ? (
            <div className="p-4 text-xs text-gray-500 text-center font-medium">No matching players found</div>
          ) : (
            itemsToRender.map((item) => {
              if (item.type === 'header') {
                return (
                  <div key={item.key} className="px-3 py-2 text-[9px] text-gray-500 font-bold uppercase tracking-wider border-b border-[#1e2330]/30 text-left bg-black/20 select-none">
                    {item.label}
                  </div>
                );
              }

              const player = item.player!;
              const validation = item.validation!;
              const posAbbr = ['GK', 'DEF', 'MID', 'FWD'][player.element_type - 1];
              const rec = calculatePlayerRatings(player, isPreSeason, 0);
              
              const isFocused = playerIdxCounter === focusedIndex;
              playerIdxCounter++;

              const hasInjury = player.chance_of_playing_next_round < 75;

              return (
                <div
                  key={item.key}
                  data-active={isFocused}
                  onClick={() => {
                    if (validation.valid) {
                      handleSelectPlayer(player);
                    }
                  }}
                  className={`flex items-center justify-between px-3 py-1.5 border-b border-[#1e2330]/30 transition-all cursor-pointer h-[60px] group ${
                    !validation.valid ? 'opacity-40 cursor-not-allowed bg-black/10' : ''
                  } ${isFocused ? 'bg-[rgba(56,189,248,0.06)] border-l-2 border-l-[#38bdf8]' : 'hover:bg-[rgba(255,255,255,0.02)]'}`}
                >
                  {/* LEFT: Clean Position Badge */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[10px] border border-[rgba(255,255,255,0.08)] bg-[#151824] ${
                      player.element_type === 1 ? 'text-warning border-warning/20' :
                      player.element_type === 2 ? 'text-[#38bdf8] border-[#38bdf8]/20' :
                      player.element_type === 3 ? 'text-emerald-400 border-emerald-400/20' : 'text-purple-400 border-purple-400/20'
                    }`}>
                      {posAbbr}
                    </div>
                  </div>

                  {/* CENTER: Player Name + Club • Position • Price */}
                  <div className="flex-1 min-w-0 text-left px-3">
                    <span className="font-semibold text-white text-xs block truncate">{player.web_name}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5 truncate">
                      {player.team_name} • {posAbbr} • £{(player.now_cost / 10).toFixed(1)}m
                    </span>
                  </div>

                  {/* RIGHT: Projected points + Recommendation badge + news flag */}
                  <div className="flex items-center gap-3 shrink-0 text-right">
                    {hasInjury && (
                      <div className="w-5 h-5 bg-yellow-500/10 border border-yellow-500/30 rounded-full flex items-center justify-center text-[10px] font-bold text-[#f59e0b] shrink-0" title={player.news}>
                        !
                      </div>
                    )}

                    <div className="flex flex-col items-end">
                      <span className="text-[#10b981] font-bold font-mono text-xs">{player.projected_points.toFixed(1)} EP</span>
                      
                      {!validation.valid ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[#ef4444] font-semibold mt-0.5 shrink-0 block">
                          {validation.reason}
                        </span>
                      ) : validation.reason === 'Exceeds Budget' ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-[#f59e0b] font-semibold mt-0.5 shrink-0 block">
                          Exceeds Budget
                        </span>
                      ) : (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mt-0.5 shrink-0 block ${
                          rec.categoryLabel.includes('Essential') || rec.categoryLabel.includes('Strong')
                            ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20'
                            : rec.categoryLabel.includes('Monitor') || rec.categoryLabel.includes('Differential')
                            ? 'bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20'
                            : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}>
                          {rec.categoryLabel}
                        </span>
                      )}
                    </div>
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
