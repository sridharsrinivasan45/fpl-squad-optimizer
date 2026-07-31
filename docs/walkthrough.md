# FPL Squad Optimizer Implementation Walkthrough

We have successfully built, compiled, and launched the full-stack FPL Squad Optimizer application. Below is the step-by-step visual tour of the user interface.

---

## 1. Visual Walkthrough of App States

````carousel
![1. Initial Welcome Screen](file:///C:/Users/sridh/.gemini/antigravity/brain/0a222525-fb8f-4025-8e5e-d5602ca6971c/initial_screen_1785511766084.jpg)
<!-- slide -->
![2. Loading State (Crunching Numbers)](file:///C:/Users/sridh/.gemini/antigravity/brain/0a222525-fb8f-4025-8e5e-d5602ca6971c/loading_state_1785511780412.jpg)
<!-- slide -->
![3. Corrected 15-Player Squad Results (With Pitch & Bench)](file:///C:/Users/sridh/.gemini/antigravity/brain/0a222525-fb8f-4025-8e5e-d5602ca6971c/fixed_dashboard_ui_1785513110208.jpg)
<!-- slide -->
![4. How to Use Guide Modal](file:///C:/Users/sridh/.gemini/antigravity/brain/0a222525-fb8f-4025-8e5e-d5602ca6971c/how_to_use_modal_1785511808088.jpg)
<!-- slide -->
![5. Intentionally Triggered Error State Banner](file:///C:/Users/sridh/.gemini/antigravity/brain/0a222525-fb8f-4025-8e5e-d5602ca6971c/error_state_ui_1785511823966.jpg)
````

---

## 2. Project Architecture & Logic

- **Backend (`server.js`)**: An Express.js proxy server running in the background on port `3001` that forwards `/api/*` endpoints to the official FPL server with custom headers (avoiding CORS blocks) and serves compiled Vite static files.
- **Frontend Client (`src/`)**: A React + TypeScript dev server running on port `3000` that proxies backend API requests.
- **Optimizer (`fplSolver.ts`)**: Models squad selection using a combined Integer Linear Programming (ILP) formulation ($y_i \le x_i$) to optimize both the 15-man squad and the starting XI simultaneously, weighting bench players' points at $15\%$ in the objective.
- **Pre-season Fallback**: Switches to previous season Points Per Game (PPG) baseline when live form values are reset to 0.0, alerting the manager with a pre-season dashboard banner.
- **Injury warning**: Highlights doubtful or injured players in tooltips and tables if availability is $< 75\%$.
- **SPA Fallback Routing**: Handles all navigation fallbacks correctly in `server.js` using path-to-regexp v6 compatible catch-all formats.
