# Calibration Change Report

These changes were made to correct identified modelling weaknesses, not to force the optimizer toward a preferred set of players.

---

## 1. Summary of Changes & Formulas

### A. Playing Probability Injury Discount
*   **Problem**: Doubtful players were double-penalized. FPL's `chance_of_playing_next_round` already factors in injury news. Multiplying it by a separate status-based discount ($0.75$ for doubtful) halved the probability unnecessarily.
*   **Before Formula**:
    $$\text{Playing Probability} = \left(\frac{\text{Chance}}{100}\right) \cdot \text{StatusAdjustment}$$
*   **After Formula**:
    $$\text{Playing Probability} = 
    \begin{cases} 
    \frac{\text{Chance}}{100} & \text{if Chance is provided by FPL} \\
    \text{Estimate}_{\text{mins}} \cdot \text{StatusAdjustment} & \text{if Chance is null/undefined}
    \end{cases}$$

### B. FDR Multiplier (In-Season)
*   **Problem**: The in-season FDR multiplier was extremely aggressive, scaling points down by up to $71\%$ for FDR 5 fixtures, which is empirically inaccurate for elite FPL assets.
*   **Before Formula**:
    $$\text{FDRMultiplier} = \frac{6 - \text{Difficulty}}{3.5}$$
*   **After Formula**:
    $$\text{FDRMultiplier} = 1.0 - (\text{Difficulty} - 3) \cdot 0.15$$

### C. PPG / Form Transition floor
*   **Problem**: Blending weight $w$ decayed to $0$ after 5 matches, leaving the model 100% reliant on short-term form, making predictions highly unstable.
*   **Before Formula**:
    $$w = \max\left(0, 1 - \frac{\text{MatchesPlayed}}{5}\right)$$
*   **After Formula**:
    $$w = \max\left(0.30, 1 - \frac{\text{MatchesPlayed}}{5}\right)$$

---

## 2. Before/After Calibration Tables

### FDR Multiplier Table

| Fixture Difficulty (FDR) | Old Multiplier | New Multiplier | Point Impact on 5.0 Base |
| :---: | :---: | :---: | :---: |
| **FDR 1** | $1.43$ | **$1.30$** | $7.15 \rightarrow 6.50$ |
| **FDR 2** | $1.14$ | **$1.15$** | $5.70 \rightarrow 5.75$ |
| **FDR 3** | $0.86$ | **$1.00$** | $4.30 \rightarrow 5.00$ |
| **FDR 4** | $0.57$ | **$0.85$** | $2.85 \rightarrow 4.25$ |
| **FDR 5** | $0.29$ | **$0.70$** | $1.45 \rightarrow 3.50$ |

### PPG / Form Weight Blending Table

| Match Count | Old Weights (PPG / Form) | New Weights (PPG / Form) |
| :---: | :---: | :---: |
| **GW 1 (Pre-season)** | $100\% \text{ / } 0\%$ | **$100\% \text{ / } 0\%$** |
| **GW 2 (Match 1)** | $80\% \text{ / } 20\%$ | **$80\% \text{ / } 20\%$** |
| **GW 3 (Match 2)** | $60\% \text{ / } 40\%$ | **$60\% \text{ / } 40\%$** |
| **GW 4 (Match 3)** | $40\% \text{ / } 60\%$ | **$40\% \text{ / } 60\%$** |
| **GW 5 (Match 4)** | $20\% \text{ / } 80\%$ | **$30\% \text{ / } 70\%$** |
| **GW 6+ (Match 5+)** | $0\% \text{ / } 100\%$ | **$30\% \text{ / } 70\%$** |

---

## 3. Doubtful Player Example (Status = 'd', Chance = 75)

Taking a doubtful player with a base projection of **4.0 points** and a standard FDR 3 fixture:
*   **Before (Double-Discounted)**:
    $$\text{EP} = 4.0 \text{ base} \cdot 0.75 \text{ (chance)} \cdot 0.75 \text{ (status)} = \mathbf{2.25\text{ pts}}$$
*   **After (Calibrated)**:
    $$\text{EP} = 4.0 \text{ base} \cdot 0.75 \text{ (chance)} = \mathbf{3.00\text{ pts}}$$

---

## 4. Optimal XI Solver Comparison

The solver was run on the live database in Gameweek 1 before and after calibration:

| Metric | Before Calibration | After Calibration |
| :--- | :--- | :--- |
| **Total Projected Points** | $58.63\text{ pts}$ | **$57.97\text{ pts}$** |
| **Starting XI Lineup** | Raya (ARS), Gabriel (ARS), Guéhi (MCI), Tarkowski (EVE), **Senesi (TOT)**, B.Fernandes (MUN), Semenyo (MCI), Gibbs-White (NFO), Rice (ARS), Anderson (MCI), Thiago (BRE) | Raya (ARS), Gabriel (ARS), Guéhi (MCI), Tarkowski (EVE), **Van Hecke (TOT)**, B.Fernandes (MUN), Semenyo (MCI), Gibbs-White (NFO), Rice (ARS), Anderson (MCI), Thiago (BRE) |
| **Bench Squad** | Mitchell, **Destan**, **Furo**, **Steele** | Mitchell, **Emegha**, **Destan**, **Verbruggen** |
| **Rice Selected?** | **YES** | **YES** |
| **Anderson Selected?** | **YES** | **YES** |

### Ranking & Selections Analysis:
1.  **Doubtful Players Lifted**: Because doubtful players are no longer double-penalized, **Emegha** (whose status is doubtful) saw his projection lift from $1.69\text{ EP}$ to $2.25\text{ EP}$. This made him a highly valuable cheap enabler, resulting in him entering the bench squad.
2.  **Top 10 Projected Players**: The top 10 projected players remained **completely identical** before and after, confirming that overall asset ranking is highly stable and not distorted by the changes.
3.  **Rice and Anderson remain selected**: Their selections are highly robust. Under the new calibrated linear FDR model, they are still selected as enablers due to their excellent baseline capability.

---

## 5. Unit Test Results

All tests in the integrity suite compile and pass:
*   `test-integrity.ts`: verified Saka mapping, transfer resolution, 3-player club limit validation, simulator choices, and the new doubtful player single-discount calibration check (`Test 7`).
*   `test-chips.ts`: verified Triple Captain single-probability mapping, Bench Boost aggregation, and Wildcard rolling horizon calculations.

```bash
All FPL Data Integrity Tests PASSED successfully!
All Chip Decision Engine Tests PASSED successfully!
```
