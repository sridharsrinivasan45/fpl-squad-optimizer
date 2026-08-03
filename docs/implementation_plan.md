# FPL Decision Dashboard Implementation Plan (My Team Mode)

## Goal Description
Extend the FPL Squad Optimizer into a decision dashboard by adding a **"My Team" mode**. This mode allows users to manually draft their own 15-player squad, validates it against official FPL constraints, and optimizes only their Starting XI, captaincy, and bench priority order using the existing projection engine and ILP solver.

Preserve the existing **"Optimal Squad" mode** exactly as it is now.

---

## Architectural Reuse Strategy

1. **Reusing the ILP Solver (`solveSquad`)**: 
   In "My Team" mode, the user builds a valid 15-man squad. When they click "Optimize My Team", we will pass **only this 15-player array** into the existing `solveSquad` function. 
   
   Because `solveSquad` has constraints requiring exactly 15 players (and exactly 2 GK, 5 DEF, 5 MID, 3 FWD), passing only those 15 players forces the solver to assign $x_i = 1$ (squad selection) to all of them. The solver then naturally optimizes the starting XI ($y_i = 1$) and captaincy selections within that fixed 15-player pool. This achieves $100\%$ reuse of the existing Simplex/Branch-and-Bound logic.

2. **Bench Priority Sorting**:
   Bench ordering will be sorted by **expected projected points descending** (primary sort) to maximize the potential points returned from auto-subs, with **availability rate (`chance_of_playing_next_round`) descending** as a secondary tie-breaker. This separates the goalkeeper (Reserve GK) and sorts the 3 outfielders as Bench 1, Bench 2, and Bench 3.

3. **Decoupled UI Flow**:
   The dashboard header will feature a toggle between **"Optimal Squad"** and **"My Team"**. 
   * "Optimal Squad" works exactly as before.
   * "My Team" presents a **Squad Builder** screen if no optimized result is present, and a **Results Pitch** screen once optimized, with an "Edit Squad" button to return to editing.

---

## Refinements Incorporated

1. **Autocomplete Search Trigger**: The player list search bar will act as an autocomplete query, displaying results only when the query string is at least **2 characters** long (saving browser rendering cycles and keeping the interface clean).
2. **Live Validation Metrics**: Instead of only error banners, the drafting panel will show live counts for:
   * Budget spent / remaining (out of £100.0m)
   * Position quotas (GK: X/2, DEF: Y/5, MID: Z/5, FWD: W/3)
   * Club counts (e.g. Arsenal: X/3, Chelsea: Y/3 - showing only clubs with at least 1 draft)
3. **Action Button Renaming**: The optimize button is named **"Optimize My Team"**.
4. **Post-Optimization Summary**: The summary cards will display:
   * Total Projected Points (Starting XI)
   * Active Formation (e.g., 3-4-3)
   * Recommended Captain and Vice-Captain (clearly marked)
   * Projected Bench Points (sum of the 4 bench players' projections)

---

## Proposed Changes

### Logic Components

#### [MODIFY] [fplSolver.ts](file:///C:/Users/sridh/.gemini/antigravity/scratch/fpl-squad-optimizer/src/utils/fplSolver.ts)
Update bench sorting inside `solveSquad` to enforce auto-sub priority ordering:
- Split bench players into GK (`element_type === 1`) and outfielders.
- Sort outfielders by `projected_points` descending (primary), and then by `chance_of_playing_next_round` descending (secondary tie-breaker).
- Recombine: outfielders first (representing Bench 1, 2, and 3), followed by the Goalkeeper (representing Reserve GK).

### UI Components

#### [MODIFY] [App.tsx](file:///C:/Users/sridh/.gemini/antigravity/scratch/fpl-squad-optimizer/src/App.tsx)
- Add states for `mode`, `myTeamSquad`, `myTeamResult`, `searchQuery`, `positionFilter`, etc.
- Add styled tabs to toggle between modes.
- Implement the "My Team" layout:
  - **Drafting State**: Autocomplete player search, add/remove handlers, live metric counters, and "Optimize My Team" action button.
  - **Results State**: Visual pitch, bench panel with priority tags (Bench 1, Bench 2, Bench 3, Reserve GK), and the expanded summary cards.
- Support `localStorage` caching to persist drafted teams across page reloads.

#### [MODIFY] [index.css](file:///C:/Users/sridh/.gemini/antigravity/scratch/fpl-squad-optimizer/src/index.css)
Add rules for toggles, search rows, progress gauges, and role badge indicators.
