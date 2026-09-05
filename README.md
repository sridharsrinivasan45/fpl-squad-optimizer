# FPL Squad Optimizer

An AI-assisted Fantasy Premier League (FPL) decision-support system that combines player performance analysis, fixture difficulty, availability data, and mathematical optimization to recommend an optimal squad and Gameweek XI.

## What It Does

- Evaluates the full FPL player universe
- Projects expected points for upcoming Gameweeks
- Accounts for fixture difficulty and home/away advantage
- Incorporates player availability, injuries, suspensions and doubtful status
- Uses Integer Linear Programming (ILP) to optimize squad selection
- Recommends an optimal Starting XI and bench
- Supports custom team analysis and player comparisons
- Benchmarks model projections against FPL performance benchmarks
- Provides an interactive standalone dashboard

## Key Features

### Squad Optimizer
Finds the highest-projected 15-player squad subject to FPL squad and budget constraints.

### Starting XI
Determines the optimal formation and Starting XI based on projected Gameweek points.

### Player Analysis
Compare players using projected points, price, form, availability and fixture context.

### Availability & Injuries
Integrates FPL availability data so injured, suspended and doubtful players are appropriately reflected in projections.

### Interactive Dashboard
The standalone prototype provides an interactive interface for squad building, player scouting and decision support.

## Technology

- React
- TypeScript
- Vite
- JavaScript
- Integer Linear Programming (ILP)
- FPL API
- HTML / CSS

## Architecture

```text
FPL API
   │
   ▼
Data Ingestion
   │
   ├── Player Data
   ├── Fixtures
   ├── Prices
   └── Availability
   │
   ▼
Projection Engine
   │
   ├── Historical Prior
   ├── Current Form
   ├── Fixture Difficulty
   ├── Home/Away
   └── Playing Probability
   │
   ▼
ILP Optimization Engine
   │
   ├── Budget Constraints
   ├── Squad Constraints
   ├── Position Constraints
   └── Club Constraints
   │
   ▼
Optimal Squad & Starting XI
   │
   ▼
Interactive Dashboard
