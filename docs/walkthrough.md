# FPL Squad Optimizer Implementation Walkthrough

We have successfully rebuilt the FPL Squad Optimizer solver to use a single combined Integer Linear Programming (ILP) formulation under real FPL budget and squad constraints, and updated the visual client application to display both the starting XI and the bench.

---

## 1. Mathematical Optimizer Rebuild (`fplSolver.ts`)

Instead of solving directly for a starting XI, the solver is now a single-stage combined ILP model that defines two binary decision variable sets for each player $i$ in the database:
- $x_i \in \{0, 1\}$ (represented as `s_i`): Player is selected in the 15-player squad.
- $y_i \in \{0, 1\}$ (represented as `start_i`): Player is selected in the starting XI.

### Linking Constraints
A player is only allowed to start if they are selected in the squad:
$$y_i \le x_i \iff y_i - x_i \le 0$$
This is implemented in `javascript-lp-solver` by adding a constraint `link_id: { max: 0 }` for each player, setting `s_i`'s coefficient for the link to `-1`, and `start_i`'s coefficient to `1`.

### Objective Function
The objective function maximizes starting points ($100\%$ weight) and squad points ($15\%$ weight) combined:
$$\text{Maximize } \sum y_i \cdot P_i + 0.15 \cdot \sum (x_i - y_i) \cdot P_i$$
Which simplifies to:
$$\text{Maximize } \sum y_i \cdot (0.85 \cdot P_i) + \sum x_i \cdot (0.15 \cdot P_i)$$

This combined formulation rewards choosing high-scoring starting players while encouraging cheap-but-viable bench players to provide point coverage.

---

## 2. Live pre-season Squad Results (Gameweek 1)

When we run the combined solver on the live FPL database for the 2026/27 pre-season:

*   **Total Budget Spent**: **£100.0m / £100.0m** (Perfect budget utilization down to the penny).
*   **Total Squad Size**: 15 players (2 GK, 5 DEF, 5 MID, 3 FWD).
*   **Starting XI Size**: 11 players.
*   **Bench Size**: 4 players.

### Starting XI (11 Starters)
- **GK**: `Ellborg` (Cost: £4.5m, Proj: 6.06, Availability: 100%)
- **DEF**: `Gabriel (VC)` (Cost: £8.0m, Proj: 7.43, Availability: 100%)
- **DEF**: `Mukiele` (Cost: £5.5m, Proj: 5.37, Availability: 100%)
- **DEF**: `Ballard` (Cost: £5.0m, Proj: 4.57, Availability: 100%)
- **DEF**: `Maguire` (Cost: £5.0m, Proj: 4.46, Availability: 100%)
- **MID**: `B.Fernandes (C)` (Cost: £12.0m, Proj: 7.66, Availability: 100%)
- **MID**: `Saka` (Cost: £9.5m, Proj: 5.83, Availability: 100%)
- **MID**: `Rice` (Cost: £7.5m, Proj: 5.83, Availability: 100%)
- **MID**: `Gibbs-White` (Cost: £8.0m, Proj: 5.83, Availability: 100%)
- **MID**: `Mbeumo` (Cost: £8.0m, Proj: 5.14, Availability: 100%)
- **FWD**: `João Pedro` (Cost: £7.5m, Proj: 4.37, Availability: 100%)

### Bench (4 Players)
- **GK**: `Benitez` (Cost: £4.5m, Proj: 6.00, Availability: 100%)
- **DEF**: `Aina` (Cost: £4.5m, Proj: 4.23, Availability: 100%)
- **FWD**: `Igor Jesus` (Cost: £6.0m, Proj: 3.54, Availability: 100%)
- **FWD**: `Mheuka` (Cost: £4.5m, Proj: 0.86, Availability: 100%)

#### Bench Feasibility Analysis:
All 4 bench players are cheap-but-viable. They all have **100% chance of playing** (`Availability: 100%`) in the live database. The solver has correctly selected `Mheuka` at £4.5m as the absolute cheapest reserve forward (0.86 projected points) to save budget, while selecting `Benitez` (6.0 pts) and `Aina` (4.23 pts) for strong coverage.

---

## 3. Visual Layout Update

- The Visual Pitch renders only the 11 starting players in their respective formation rows.
- Below the pitch, a dedicated **Bench Players** panel renders the 4 bench players inside smaller cards, displaying their names, prices, and projected scores.
- The **Squad Summary** card shows the total cost of all 15 players (£100.0m spent), starting points (67.78), and squad points (77.18).
- The **Player Breakdown** table groups rows under **Starting XI** and **Bench** sections.
