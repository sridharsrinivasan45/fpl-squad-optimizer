# FPL Squad Decision Dashboard Walkthrough

The application has been successfully extended into an **FPL Decision Dashboard** with support for two primary operating modes: **Optimal Squad** (simultaneous 15-man solver) and **My Team** (manual draft builder and Starting XI/Bench optimizer).

---

## 1. Visual Walkthrough of App States

````carousel
![1. Initial Welcome Screen](file:///C:/Users/sridh/.gemini/antigravity/brain/0a222525-fb8f-4025-8e5e-d5602ca6971c/initial_screen_1785511766084.jpg)
<!-- slide -->
![2. My Team Mode Drafting Interface](file:///C:/Users/sridh/.gemini/antigravity/brain/0a222525-fb8f-4025-8e5e-d5602ca6971c/my_team_drafting_ui_1785761008596.jpg)
<!-- slide -->
![3. Corrected 15-Player Squad Results (With Pitch & Bench)](file:///C:/Users/sridh/.gemini/antigravity/brain/0a222525-fb8f-4025-8e5e-d5602ca6971c/fixed_dashboard_ui_1785513110208.jpg)
<!-- slide -->
![4. How to Use Guide Modal](file:///C:/Users/sridh/.gemini/antigravity/brain/0a222525-fb8f-4025-8e5e-d5602ca6971c/how_to_use_modal_1785511808088.jpg)
<!-- slide -->
![5. Intentionally Triggered Error State Banner](file:///C:/Users/sridh/.gemini/antigravity/brain/0a222525-fb8f-4025-8e5e-d5602ca6971c/error_state_ui_1785511823966.jpg)
````

---

## 2. Walkthrough of New Features

### A. Autocomplete Search & Filters (My Team Mode)
*   The drafting panel features an autocomplete search input that triggers filtered lists **only when 2 or more characters are typed**.
*   A filter row allows managers to narrow search results by specific positions: `GK`, `DEF`, `MID`, `FWD`, or `ALL`.
*   Drafting buttons check for duplicate additions, position quotas, and team selection limits dynamically.

### B. Live Validation Meters
*   **Cost Indicator**: A color-coded progress bar that shows budget utilization (out of £100.0m) and highlights red if the user exceeds the cap.
*   **Position Checklists**: Shows live counters (e.g. `GK: 1/2`, `DEF: 4/5`) and alerts if a quota is violated.
*   **Club Counts Grid**: Lists active selections from individual Premier League clubs (highlighting yellow when at the limit of 3, and red if exceeded).

### C. Point-First Auto-Sub Bench Priority Sorting
*   Enforces FPL auto-sub priority. Bench outfielders are sorted by **projected points descending (primary)**, and **availability percentage descending (secondary tie-breaker)**.
*   The Reserve Goalkeeper is appended to the end of the bench array.
*   In the visual dashboard, bench cards are clearly labeled with role badges: `Bench 1`, `Bench 2`, `Bench 3`, and `Reserve GK`.

### D. Refined Summary Cards
*   Post-optimization cards show **Budget Spent**, **Starting XI Expected Points**, **Projected Bench Points**, and the active **Starting XI Formation** (e.g., 3-5-2).
