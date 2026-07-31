# FPL Squad Optimizer Dashboard Implementation Plan (Single Combined ILP)

## Goal Description
Rebuild the FPL optimizer solver to use a single combined Integer Linear Programming (ILP) formulation that simultaneously solves for both the 15-man squad and the starting XI. This ensures that the 15-man squad is selected specifically to maximize starting points while valuing bench coverage.

---

## Combined ILP Mathematical Formulation

We define two binary variables for each player $i$ in the database:
- $x_i \in \{0, 1\}$: Player $i$ is selected in the **15-man squad** (variable: `s_i`).
- $y_i \in \{0, 1\}$: Player $i$ is selected in the **starting XI** (variable: `start_i`).

### Objective Function
We maximize the combined projected points, weighting starting points at $100\%$ and bench points at $15\%$:
$$\text{Maximize } \sum y_i \cdot \text{effective\_points}_i + 0.15 \cdot \sum (x_i - y_i) \cdot \text{effective\_points}_i$$

Algebrically simplified, this is equivalent to:
$$\text{Maximize } \sum y_i \cdot (0.85 \cdot \text{effective\_points}_i) + \sum x_i \cdot (0.15 \cdot \text{effective\_points}_i)$$

*This formulation rewards selecting high-performing starting players while encouraging robust, cheap bench players for coverage rather than zero-value fillers.*

### Constraints
1. **Linking Constraint**: A player can only start if they are selected in the 15-man squad:
   $$y_i \le x_i \iff y_i - x_i \le 0 \quad (\forall i)$$
2. **Squad Composition Constraints**:
   - Total squad size: $\sum x_i = 15$
   - Position limits: $\sum_{i \in GK} x_i = 2$, $\sum_{i \in DEF} x_i = 5$, $\sum_{i \in MID} x_i = 5$, $\sum_{i \in FWD} x_i = 3$
   - Total Cost: $\sum x_i \cdot \text{cost}_i \le 1000$ (in tenths, i.e., £100.0m)
   - Club limits: For each Premier League team $T$, $\sum_{i \in T} x_i \le 3$
3. **Starting XI Constraints**:
   - Total starters: $\sum y_i = 11$
   - Formation limits: $\sum_{i \in GK} y_i = 1$, $3 \le \sum_{i \in DEF} y_i \le 5$, $2 \le \sum_{i \in MID} y_i \le 5$, $1 \le \sum_{i \in FWD} y_i \le 3$

---

## Proposed Changes

### Setup and Environment
We will continue using `javascript-lp-solver` within React, TypeScript, and Express.

### Logic Components

#### [MODIFY] [fplSolver.ts](file:///C:/Users/sridh/.gemini/antigravity/scratch/fpl-squad-optimizer/src/utils/fplSolver.ts)
Rebuild the solver function:
`export function solveSquad(players: Player[], budget: number = 1000): SolverResult`

- Build the single combined ILP model:
  - **Variables**: Create `s_id` and `start_id` for each valid player in the database.
  - **Linking**: For each player, add constraint `link_id: { max: 0 }`. In the variable definitions, set `s_id` coefficient for `link_id` to `-1` and `start_id` to `1`.
  - **Constraints**:
    - `cost: { max: budget }` (assigned to squad variables `s_id`)
    - `team_T: { max: 3 }` (assigned to squad variables `s_id`)
    - Squad size: `squad_size: { equal: 15 }`, and position squad constraints (`gk_sq: { equal: 2 }`, `def_sq: { equal: 5 }`, etc.)
    - Starter size: `starter_size: { equal: 11 }`, and position starter constraints (`gk_st: { equal: 1 }`, `def_st: { min: 3, max: 5 }`, etc.)
- Extract `starters` (where `start_id === 1`) and `bench` (where `s_id === 1` and `start_id === 0`).
- Update `SolverResult` interface:
  ```typescript
  export interface SolverResult {
    feasible: boolean;
    squad: Player[];
    starters: Player[];
    bench: Player[];
    captain: Player | null;
    viceCaptain: Player | null;
    totalCost: number; // cost of all 15 players
    totalProjectedPoints: number; // starters points sum
    squadProjectedPoints: number; // squad points sum
    alternatives: any[];
  }
  ```

### UI Components

#### [MODIFY] [App.tsx](file:///C:/Users/sridh/.gemini/antigravity/scratch/fpl-squad-optimizer/src/App.tsx)
- Render the 11 starting players in their positions on the soccer pitch.
- Render the 4 bench players in a dedicated section directly below the pitch.
- Group the roster breakdown table into two sections: "Starting XI (11)" and "Bench (4)".
- Update stats summary cards to display the cost of all 15 players (out of £100m) and the starting XI projected points.

### Test Component

#### [MODIFY] [test-solver.ts](file:///C:/Users/sridh/.gemini/antigravity/scratch/fpl-squad-optimizer/test-solver.ts)
Expand the mock database to 20 players to cover the 15-man selection and starter selection, verifying the combined ILP formulation and correctness.

---

## Verification Plan

### Automated Tests
Run `npx tsx test-solver.ts` to verify:
- Output squad size = 15 (2 GK, 5 DEF, 5 MID, 3 FWD)
- Starting XI size = 11 (1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD)
- Bench size = 4
- Combined cost of all 15 players $\le$ budget.
- Max 3 players per club in the 15-player squad.

### Manual Verification
1. Open the app and click "Get This Week's XI".
2. Verify the visual layout shows 11 players on the pitch, and 4 players on the bench.
3. Verify that the cost summary adds up to the cost of all 15 players and is under £100m.
