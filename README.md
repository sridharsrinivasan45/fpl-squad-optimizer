# FPL Squad Optimizer

An AI-assisted Fantasy Premier League (FPL) decision-support system that combines player performance analysis, fixture difficulty, availability data, historical performance, and mathematical optimization to recommend an optimal squad and Gameweek XI.

The project is evolving from a rule-based FPL optimizer into a **research-driven player projection and decision-support system**, with emphasis on historical validation, walk-forward evaluation, and improved treatment of players with limited Premier League history.

---

## 1. What the System Currently Does

The production system:

- Evaluates the FPL player universe
- Projects expected points for upcoming Gameweeks
- Accounts for fixture difficulty and home/away advantage
- Incorporates player availability, injuries, suspensions and doubtful status
- Uses historical performance and recent form in player projections
- Uses Integer Linear Programming (ILP) to optimize squad selection
- Recommends an optimal 15-player squad
- Recommends an optimal Starting XI and bench
- Supports player comparisons and custom team analysis
- Provides an interactive decision-support dashboard

### Current Architecture

```text
                         FPL API
                            │
                            ▼
                    ┌─────────────────┐
                    │ Data Ingestion  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         Player Data      Fixtures      Availability
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                   ┌──────────────────┐
                   │ Projection Engine│
                   └────────┬─────────┘
                            │
             ┌──────────────┼───────────────┐
             ▼              ▼               ▼
       Historical       Current Form    Fixture Context
          Prior                            │
             │              │               │
             └──────────────┼───────────────┘
                            ▼
                  Playing Probability
                            │
                            ▼
                 Projected Player Points
                            │
                            ▼
                ┌─────────────────────┐
                │ ILP Optimization    │
                └──────────┬──────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
       Optimal Squad              Starting XI
             │                           │
             └─────────────┬─────────────┘
                           ▼
                  Decision Support
                       Dashboard
2. Research Extension

The central research question is:

Can an FPL player projection system be made more reliable by learning from historical player performance while avoiding look-ahead bias and appropriately handling players with limited Premier League history?

The research layer is designed to evaluate the existing production model rather than simply assume that its projections are accurate.

The research pipeline introduces:

Multi-season historical FPL data
Gameweek-level observations
Player-season histories
Player experience cohorts
Walk-forward backtesting
Feature completeness audits
Duplicate-observation checks
Historical model evaluation
Comparison between the existing production model and proposed improvements
Research Contribution
The research focuses on a practical problem in FPL player projection: players enter the Premier League with very different amounts of historical information. A model that treats an established player with several seasons of evidence the same way as a new or recently promoted player may produce poorly calibrated projections.

The project therefore investigates whether experience-aware priors, dynamically weighted historical information, recent form, and uncertainty estimates can improve player projections, particularly for players with limited Premier League history.

The proposed methods will be evaluated against the existing production model using walk-forward, out-of-sample backtesting, with performance compared across player-experience cohorts and across seasons.
3. Historical Dataset

Historical Gameweek-level FPL data currently covers:

2016/17 → 2025/26

The dataset contains approximately:

247,896 player-gameweek observations

and includes information such as:

Player
Gameweek
Team
Opponent
Home/away status
Player price
Minutes
FPL points
Goals
Assists
Clean sheets
Bonus
BPS
Influence
Creativity
Threat
ICT index
Player selection
Transfers in/out
Expected goals and assists where available

The historical dataset is used for research and backtesting and is intentionally kept separate from the lightweight production repository.

4. Player Experience Cohorts

A key research consideration is that not all players have the same amount of historical Premier League information available.

Players are therefore classified into experience cohorts:

No EPL History

Players without usable previous Premier League season data.

These players cannot reliably be treated in the same way as established FPL players.

One EPL Season

Players with only one completed Premier League season of historical information.

Their historical prior is relatively weak and may have high variance.

Two or More EPL Seasons

Players with multiple completed Premier League seasons.

These players provide substantially more historical information for estimating a baseline expectation.

This cohort structure is intended to support different approaches to prior formation and uncertainty rather than treating every player identically.

5. Walk-Forward Backtesting

A major component of the research methodology is walk-forward evaluation.

The model is evaluated using only information that would have been available before the Gameweek being predicted.

Conceptually:

Historical Data
      │
      ▼
Information available
before GW N
      │
      ▼
Generate projection
for GW N
      │
      ▼
Observe actual GW N
      │
      ▼
Update information
      │
      ▼
Generate projection
for GW N+1
      │
      ▼
Repeat

This prevents future information from leaking into historical predictions.

The objective is to answer:

How well would the model actually have performed if it had been operating during the season?

rather than:

How well does the model explain data after already seeing the season?

6. Current Research Infrastructure

The research/ directory contains the reproducible research pipeline.

Important components include:

Script	Purpose
collect-current-season.ts	Collects current-season player histories
collect-historical-seasons.ts	Collects historical player-season data
inspect-historical-schema.ts	Inspects historical data structure
inspect-gw-dataset.ts	Audits historical Gameweek datasets
analyse-player-cohorts.ts	Analyses player experience cohorts
build-walkforward-dataset.ts	Builds the walk-forward research dataset
audit-walkforward-dataset.ts	Checks dataset completeness and integrity
audit-walkforward-features.ts	Audits available model features
backtest-walkforward.ts	Runs walk-forward backtesting
backtest-current-model.ts	Evaluates the current production projection model
inspect-projection-model.ts	Inspects the production projection engine
investigate-duplicates.ts	Investigates duplicate player/Gameweek observations
7. Current Production Projection Model

The existing production projection engine is implemented in:

src/utils/pointsProjection.ts

The main projection function is:

calculateProjectedPoints(
    elements,
    teams,
    fixtures,
    currentGameweek
)

The existing model incorporates factors including:

Historical player performance
Recent form
Fixture difficulty
Home/away context
Playing probability
Player availability

The research objective is not to replace this model blindly.

Instead, the existing model provides the baseline against which alternative projection approaches can be evaluated.

8. Research Direction

The next stage of the project is to determine whether a more statistically robust projection framework can outperform the current production model.

Potential areas of investigation include:

1. Experience-aware priors

Different treatment for:

No EPL history
        ↓
One EPL season
        ↓
Multiple EPL seasons

rather than applying the same historical weighting to every player.

2. Dynamic historical weighting

Older seasons may contain useful information but may be less predictive than recent seasons.

The research can therefore evaluate whether historical observations should receive dynamically changing weights.

3. Form and prior interaction

Rather than simply combining historical prior and recent form using fixed weights, investigate whether the optimal weighting changes according to:

Player experience
Position
Minutes played
Sample size
Consistency
Recent performance
4. Uncertainty-aware projections

Two players with identical expected points may not have identical confidence levels.

The research can investigate whether uncertainty estimates improve decision-making, particularly for:

New players
Players with limited minutes
Players returning from injury
Players undergoing major role changes
5. Feature-based prediction

Historical FPL statistics can be evaluated as predictive features rather than simply descriptive statistics.

Possible inputs include:

Minutes
Starts
Goals
Assists
xG
xA
xGI
Fixture difficulty
Home/away status
Recent form
Historical consistency
Price
Availability
9. Evaluation Framework

The research should evaluate models using historical out-of-sample predictions.

Important evaluation dimensions include:

Player-level prediction accuracy

How close are projected points to actual FPL points?

Ranking quality

Does the model correctly identify high-performing players?

Value identification

Does the model identify players who provide strong projected points relative to price?

Squad-level performance

Does optimizing using model projections produce stronger squads?

Decision quality across player cohorts

Does the model behave differently—and better—for:

Established players
One-season players
New Premier League players?
Robustness

Does performance remain consistent across seasons rather than being driven by one particular year?

10. Research Philosophy

The project follows three principles:

No Look-Ahead Bias

A prediction for Gameweek N should only use information available before Gameweek N.

Reproducibility

Research results should be generated through scripts rather than manually selected examples.

Baseline First

The existing production model should be treated as a measurable baseline.

New methods should demonstrate improvement through out-of-sample testing rather than being adopted because they appear theoretically better.

11. Technology
React
TypeScript
Vite
JavaScript
Integer Linear Programming (ILP)
FPL API
Historical FPL datasets
HTML / CSS
12. Project Structure
fpl-squad-optimizer/
│
├── src/
│   └── utils/
│       ├── pointsProjection.ts
│       └── fplSolver.ts
│
├── research/
│   ├── analyse-player-cohorts.ts
│   ├── audit-walkforward-dataset.ts
│   ├── audit-walkforward-features.ts
│   ├── backtest-current-model.ts
│   ├── backtest-walkforward.ts
│   ├── build-walkforward-dataset.ts
│   ├── collect-current-season.ts
│   ├── collect-historical-seasons.ts
│   ├── inspect-gw-dataset.ts
│   ├── inspect-historical-schema.ts
│   ├── inspect-projection-model.ts
│   ├── investigate-duplicates.ts
│   └── player-season-observations.json
│
└── README.md

Large raw historical datasets and generated backtesting outputs are intentionally excluded from version control.

13. Current Status
Completed
Production FPL squad optimizer
Player projection engine
ILP squad optimization
Current-season data collection
Historical player-season dataset
Historical Gameweek dataset
Player experience cohort analysis
Walk-forward dataset construction
Dataset quality audits
Production-model inspection
Walk-forward backtesting infrastructure
In Progress
Quantitative evaluation of the current projection model
Identification of systematic weaknesses
Experience-aware projection methodology
Alternative model development
Out-of-sample model comparison
End Goal

Develop and validate a more robust, evidence-based FPL player projection and squad optimization framework that can demonstrate measurable improvement over the current baseline through historical walk-forward evaluation.
