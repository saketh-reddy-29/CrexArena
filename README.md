# Cricket Arena (CrexArena) — Advanced Ball-by-Ball Engine & 2D Tactical Field Simulator

A broadcast-quality cricket match simulation engine and interactive 2D stadium visualizer built with **React**, **TypeScript**, **Tailwind CSS**, **Framer Motion**, and **HTML5 Canvas / SVG**.

---

## 📌 Repository Architecture & Blueprint

> **NOTE FOR AI AGENTS & DEVELOPERS**: Read this section to understand the entire architecture without opening and inspecting multiple files.

```
CrexArena/
├── src/
│   ├── components/                 # UI Layer
│   │   ├── CricketActionVisualizer.tsx # 2D stadium, Canvas trajectory, fielders, AI Captain HUD
│   │   ├── PlayerSelectionDrawer.tsx # Modal drawer for manual openers, batter & bowler selection
│   │   ├── LiveMatchCenter.tsx     # Central match coordinator, broadcast scoreboard, timeline
│   │   ├── TeamSelection.tsx       # Tournament franchise / international team picker
│   │   ├── SquadSelection.tsx      # Squad roster management & budget
│   │   ├── PlayingXISelection.tsx  # Locked 11-player lineup selector
│   │   ├── TournamentHub.tsx       # Competition fixtures & points table
│   │   └── ...
│   │
│   ├── engine/                     # Cricket Simulation Core
│   │   ├── config/
│   │   │   └── MatchFormatConfig.ts    # Centralized rules, overs, caps, run distributions & DRS
│   │   ├── ai/
│   │   │   ├── AICaptainEngine.ts      # Bowler rotation, workload limits, tactical adjustments
│   │   │   ├── BatterDecisionEngine.ts # Settledness (0-100%), psychology, 7 batting intents
│   │   │   └── BowlingPlanEngine.ts    # Line, length, variation, risk profile, target zones
│   │   ├── core/
│   │   │   └── DeliveryResultFactory.ts# Single authoritative immutable DeliveryResult factory
│   │   ├── simulation/
│   │   │   └── probabilityEngine.ts    # Bounded multiplicative probability matrix
│   │   ├── strategy/
│   │   │   └── BowlerFieldStrategyEngine.ts # 2D coordinates, 30-yd ring split, tactical presets
│   │   └── models/
│   │       └── ArenaState.ts           # Format types ('T20' | 'ODI' | 'TEST') and match models
│   │
│   ├── lib/
│   │   ├── matchEngine.ts          # Match math, powerplay phases, DRS rules, Super Overs
│   │   ├── ratingEngine.ts         # Player attribute formulas and form multipliers
│   │   └── playerImages.ts         # Player headshot resolution and fallbacks
│   │
│   ├── stores/
│   │   └── useGameStore.ts         # Zustand global state (franchises, players, live match state)
│   │
│   ├── types/
│   │   ├── delivery.ts             # DeliveryResult, DeliveryLifecycle, BallTrajectoryPath
│   │   ├── match.ts                # PitchType, WeatherCondition, InningsData, DRSReview
│   │   └── common.ts               # Player, Franchise, SkillStats interfaces
│   │
│   └── tests/                      # Automated Vitest Suite (77 tests across 12 suites)
│       ├── formatConfig.test.ts          # Format overs, bowler caps, wicket probabilities & runs
│       ├── fieldMapCoordinates.test.ts   # Boundary clamping, pitch strip safety, left-hand mirroring
│       ├── singleSourceOfTruth.test.ts   # DeliveryResult immutability & replay safety
│       ├── aiTacticsAndBalancing.test.ts # All 14 tactical & balancing engine scenarios
│       ├── aiCaptainEngine.test.ts       # Bowler selection & tactical adjustments
│       ├── batterDecisionEngine.test.ts  # Settledness progression & intent adaptation
│       ├── bowlerFieldStrategy.test.ts   # Field presets & 30-yard restrictions
│       ├── deliveryLifecycle.test.ts     # Immutable lifecycle state machine
│       ├── engine.test.ts               # 10,000-ball calibration distribution
│       ├── actionVisualizer.test.ts      # Visualizer rendering & canvas hooks
│       └── playerProgression.test.ts     # Player ratings & fatigue
```

---

## ⚙️ Core Delivery Lifecycle State Machine

Every delivery progresses through **one authoritative, immutable pipeline**. A delivery is simulated **exactly once** — no secondary rolls in DRS or visualizer layers.

```
       [READY]
          │
          ▼
 [DELIVERY_SIMULATION]  ──► DeliveryResultFactory computes single authoritative DeliveryResult
          │
          ▼
   [RESULT_LOCKED]      ──► Ball outcome, runs, wicket, and trajectory locked
          │
          ▼
 [BALL_PATH_PLAYBACK]   ──► Continuous 60fps Canvas/SVG animation (release -> pitch -> contact -> target)
          │
          ▼
  [DELIVERY_OUTCOME]    ──► Wicket, boundary, or extra splash overlay
          │
          ▼
    [SCORE_UPDATE]      ──► Scoreboard, commentary, partnership, and batter state committed
          │
          ▼
[FIELD_CHANGE_IF_REQ]   ──► If AI captain alters field, smooth animated fielder movement
          │
          ▼
    [FIELD_READY]       ──► Fielders settled in target coordinates
          │
          ▼
   [NEXT_DELIVERY]      ──► Over-end / strike rotation check
          │
          ▼
       [READY]
```

### The Immutable `DeliveryResult` Contract
Defined in [`src/types/delivery.ts`](file:///c:/Users/saket/Downloads/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/src/types/delivery.ts):
- `id`: Unique delivery UUID
- `strikerId`, `nonStrikerId`, `bowlerId`
- `legalBall`: `boolean` (false on Wide / No Ball)
- `batterRuns`: Runs credited to striker (0, 1, 2, 3, 4, 6)
- `extraRuns`: Wide, No Ball, Bye, Leg Bye runs
- `totalRuns`: `batterRuns + extraRuns`
- `wicket`: `boolean`
- `wicketType`: `'Bowled' | 'Caught' | 'Caught Behind' | 'LBW' | 'Run Out' | 'Stumped' | 'Timed Out' | 'Hit Wicket'`
- `shotType`: Shot name (e.g. `'Cover Drive'`, `'Forward Defensive'`, `'Pull Shot'`)
- `targetZone`: Wagon-wheel zone (`'COVER'`, `'MID_WICKET'`, `'SLIP'`, `'THIRD_MAN'`, etc.)
- `ballPath`: Trajectory coordinates (`start`, `bounce`, `contact`, `target`, `isAerial`)
- `resultType`: Standard delivery outcome code

---

## 🧠 AI Tactical Engines & Decision Matrix

### 1. Batter Decision Engine ([`src/engine/ai/BatterDecisionEngine.ts`](file:///c:/Users/saket/Downloads/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/src/engine/ai/BatterDecisionEngine.ts))
- **Settledness ($0-100\%$)**:
  - New incoming batter begins tentative ($10-18\%$).
  - Handled legal balls safely increase settledness ($+1.2$ for dots, $+2.4$ for singles, $+3.5$ for boundaries).
  - Smoothly plateaus around $90-94\%$.
  - Dismissal vulnerability naturally declines as settledness rises.
- **Batting Intent Spectrum**:
  - `SURVIVAL`: Maximum defense; blocks straight deliveries; reduces dismissal risk during collapses.
  - `DEFENSIVE`: Preserves wicket against quality bowling; attacks only genuine bad balls.
  - `SETTLING`: New batter assessing pitch pace and bounce.
  - `ROTATE_STRIKE`: Working singles into gaps to keep the scoreboard moving.
  - `NORMAL`: Standard balanced strokeplay.
  - `CONTROLLED_ATTACK`: Calculated boundary hitting into unprotected zones.
  - `ACCELERATE`: Maximum aggression with high boundary rate and proportionate dismissal risk.
- **Collapse Arrest**: When $\ge 3$ early wickets fall, batters automatically transition to `SURVIVAL` or `DEFENSIVE` to stabilize partnerships.

### 2. Bowling Plan Engine ([`src/engine/ai/BowlingPlanEngine.ts`](file:///c:/Users/saket/Downloads/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/src/engine/ai/BowlingPlanEngine.ts))
Selects intelligent plans based on bowler style, batter handedness (RHB/LHB), phase, and match situation:
- `ATTACK_STUMPS`: Hard length attacking top of off/middle.
- `FULL_OUTSIDE_OFF`: Tempting drive into the slip cordon.
- `GOOD_LENGTH_OFF_STUMP`: Channel of uncertainty.
- `SHORT_BODY_LINE`: Bouncer into rib cage with leg-side trap.
- `YORKER` & `WIDE_YORKER`: Death overs execution outside hitting arc.
- `SPIN_ATTACK` & `DEFENSIVE_LINE`: Flight vs drift variation.
- `DOT_BALL_PRESSURE`: Choking singles.

### 3. AI Captain Engine ([`src/engine/ai/AICaptainEngine.ts`](file:///c:/Users/saket/Downloads/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/src/engine/ai/AICaptainEngine.ts))
- **Bowler Rotation**: Respects format limits (T20: 4 overs, ODI: 10 overs, Test: uncapped) and avoids back-to-back overs.
- **Triggers**:
  - `OVER_END`: Selects fresh bowler and plan.
  - `WICKET_FALL`: Sets attacking slip cordon for new batter.
  - `BOUNDARY_CLUSTER`: Deploys boundary sweepers when $\ge 2$ boundaries occur in 6 balls.

---

## 🎮 Player vs AI Team Control Modes

In [`src/components/CricketActionVisualizer.tsx`](file:///c:/Users/saket/Downloads/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/src/components/CricketActionVisualizer.tsx) & [`src/components/LiveMatchCenter.tsx`](file:///c:/Users/saket/Downloads/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/src/components/LiveMatchCenter.tsx):

| Mode | Bowling Team Control | Batting Team Control | AI Overrides? |
|---|---|---|---|
| `MANUAL` | Player picks bowler, field presets, bowling plan. | Player selects batting intent button directly. | **No** (Strict manual priority) |
| `AI_RECOMMENDATIONS` | AI suggests bowler/plan with trade-off analysis. Player clicks **Apply** or **Dismiss**. | AI recommends intent; player can override anytime. | **No** (Player confirms) |
| `FULL_AUTO` | Autonomous AI bowler and field rotation. | Autonomous adaptive batting intent. | Autonomous simulation |

---

## 📊 Calibrated Probability Model

No arbitrary bonuses or post-wicket suppression dampeners. Calibrated base wicket probabilities:
- **Test**: $1.6\%$ per delivery ($\sim 1\text{ wkt} / 62.5\text{ balls}$)
- **ODI**: $2.2\%$ per delivery ($\sim 1\text{ wkt} / 45.4\text{ balls}$)
- **T20**: $2.8\%$ per delivery ($\sim 1\text{ wkt} / 35.7\text{ balls}$)

Multiplied by bounded, calibrated factors:
$$P(\text{wicket}) = P_{\text{base}} \times M_{\text{bat}} \times M_{\text{bowl}} \times M_{\text{plan}} \times M_{\text{matchup}} \times M_{\text{pitch}} \times M_{\text{intent}} \times M_{\text{context}}$$

All factors are strictly bounded within $[0.45, 1.80]$.

---

## 🏟️ 2D Broadcast Field Visualization

- **Circular Ground (600x600 coordinate plane)**: Pitch, bowling crease, batting crease, 30-yard inner circle ($R=130$), boundary rope ($R=268$).
- **Fielder Roles & Display Modes**:
  - `Standard`: Clean, broadcast-style circular markers without cluttering text pills on grass.
  - `Labels`: Displays high-contrast pills with fielding position names (`Slip 1`, `Cover`, `Mid-wicket`, `Long-on`, etc.).
  - Toggleable on the field canvas anytime via the top-left pill switch.
- **Unified Broadcast Header**:
  - Single authoritative scoreboard: `{runs}-{wickets} ({overs}.{balls} ov)`.
  - Format selector (`T20`, `ODI`, `TEST`), CRR, chase target & RRR, and match status.
  - Integrated playback controls: Play/Pause, Speed (`1x`, `1.5x`, `2x`), Replay last ball, Bowl/Skip.
  - Eliminates redundant cards and ensures the field map is the central focus.
- **Interactive Player Selection Drawer ([`src/components/PlayerSelectionDrawer.tsx`](file:///c:/Users/saket/Downloads/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/CrexArena-800797668a7b096a62f156dda84f4f23778a9515/src/components/PlayerSelectionDrawer.tsx))**:
  - Modal drawer overlay for user-controlled team actions.
  - Openers pair selection with striker / non-striker assignment.
  - Incoming batter selection (automatically filters out dismissed batters).
  - Bowler selection enforcing T20 4-over cap, ODI 10-over cap, prevents consecutive overs, and blocks pure batsmen / ordinary keepers from bowling.
  - One-tap `AI REC` accept with detailed tactical reasoning.
- **Animated Field Repositioning**: During tactical shifts, old and new positions connect via animated movement vectors while the next delivery is safely locked.
- **Bottom Panel Tabs**:
  - `FIELD MAP`: 30-yard ring compliance, off/leg balance, lawful fielder counts.
  - `BOWLER PLAN`: Line, length, variation, and tactical summary.
  - `SCORING ZONES`: 360° wagon wheel zone risk and coverage indicators.
  - `AI CAPTAIN`: Settledness gauge, concentration/confidence meters, head-to-head matchup, and tactical trade-offs.

---

## 🚀 Getting Started & CLI Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Runs at `http://localhost:3000/`.

### 3. Run Automated Vitest Test Suite
```bash
npm test
```
Executes all 65+ unit and scenario tests across all 9 test suites.

### 4. Production Build
```bash
npm run build
```
Generates production bundle in `dist/`.
