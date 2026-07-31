# FPL Squad Optimizer Task Checklist (Combined 15-Man Squad)

- `[x]` Stage 1: Implement Combined ILP Solver
  - `[x]` Rebuild `src/utils/fplSolver.ts` with single combined ILP (squad variables, starter variables, linking constraints, 0.15 bench objective weights)
  - `[x]` Update `test-solver.ts` with 20 mock players to verify the new mathematical formulation
  - `[x]` Execute the test script to verify constraints are satisfied
- `[x]` Stage 2: Update UI for 15-Player Display
  - `[x]` Rebuild `src/App.tsx` layout to show starting XI on the pitch, and the 4 bench players below the pitch
  - `[x]` Group player breakdown table into Starters and Bench sections
  - `[x]` Update squad summary card to show the cost of all 15 players, and starting XI points vs squad points
- `[x]` Stage 3: Verification & Launch
  - `[x]` Compile/build checking with `npm run build`
  - `[x]` Launch and verify live pre-season optimization squad selections, budget utilization, and bench players' availability rates
