# Smart Order Builder

A frontend order-building and POS simulation app for **Build Your Breakfast** orders. It validates custom item combinations through a generic rules engine, tracks ingredient-level shared stock with timed reservations, calculates pricing in integer poisha, persists orders as JSON via a mock API, and includes a staff sales assistant powered by Gemini function calling.

## Project Overview

This application models a configurable breakfast ordering flow and back-of-house sales assistant without a real backend:

- **Data-driven menu & rules:** Option groups, limits, cross-group constraints, ingredient stock, and promotions are loaded from the mock API rather than hardcoded in UI components.
- **Shared ingredient stock:** Multiple items in the cart and the active builder share a common pool of ingredient quantities, with atomic reservations and 5-minute server-clock expiries.
- **Deterministic pricing:** All money calculations run in integer poisha (`1 BDT = 100 poisha`) with explicit half-up rounding and server-time promotion cutoffs.
- **Orders & analytics assistant:** Completed checkouts convert reserved stock into sold stock, persist orders alongside seeded history (`orders.seed.json`), and expose pure aggregation functions to a Gemini Flash assistant via tool calling.

## Installation

Make sure Node.js (v18+) and npm are installed.

```bash
npm install
```

## Environment Variables

Create a `.env.local` file in the project root (see `.env.example` once added) and provide your Google AI Studio Gemini API key:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

Do not commit `.env.local` or any real API keys to git.

## Development Command

Start the Vite development server:

```bash
npm run dev
```

Other helpful scripts in `package.json`:

```bash
npm run build   # Type-check with tsc -b and build for production
npm run lint    # Run ESLint across the project
npm run preview # Preview the production build locally
```

## Test Command

Automated tests use **Vitest** and **React Testing Library** (to be configured in the test setup step):

```bash
npm test
```

*(Note: `vitest` and the `test` script will be added to `package.json` as the engine and acceptance test suite are wired up.)*

## Architecture

The codebase separates pure domain logic from React state and the mock server layer:

- **Pure domain engines (`src/engine/` — planned):** Framework-free TypeScript functions for rule validation, ingredient stock calculation, integer-poisha pricing, and order analytics. Both the UI and the mock API import the same pure functions so client previews and server mutations never drift.
- **Mock API layer (MSW / in-memory store — planned):** Serves the Appendix A fixture, handles `/price` async previews (300 ms debounce on client, simulated latency & failure), manages atomic reservations with idempotency keys, syncs server clock offset (`+90s`), and persists orders in `localStorage` seeded from `orders.seed.json`.
- **UI & state (`src/`):** Built with React, strict TypeScript (`tsconfig.app.json`), Vite, and Tailwind CSS + Radix UI primitives (`src/components/ui`). State keeps draft configurations, cart items with server-synced expiry timers, and the sales chat panel cleanly separated.

## Rules Engine Explanation

`validate(config, groups, rules)` is a pure, fixture-driven validator that collects **all** violations across the active configuration instead of failing fast on the first error:

- **Group limits:** Checks `min`, `max`, `step` (total selected quantity must be divisible by `step`), `maxDistinct` (number of unique options picked), and `maxPerOption`.
- **Cross-group rules:**
  - `requires`: An option requires at least one option from a target list to be selected.
  - `excludes`: Incompatible options cannot be selected together.
  - `overrideLimit`: Selecting a trigger option overrides a target group's base `max` limit (the override takes precedence over the base group limit).
- Every violation returns the offending `groupId` or `ruleId` and a clear message; adding to cart remains blocked while any violation exists.

## Stock Engine Explanation

Stock is tracked per raw ingredient (e.g., `egg`, `cheese`, `croissant`) rather than per menu option:

- **Shared pool:** Total available stock equals initial stock minus sold stock and active (unexpired) reservations across the cart, plus any units currently held by the item being edited.
- **Per-option availability:** For each option, the engine computes how many additional units can still be added given current selections, item quantity (`1–3`), and remaining ingredient stock, disabling options at `0`.
- **Net-difference editing:** When editing an existing cart item, the item's own reserved ingredients count toward its available budget so users can rebalance choices (e.g., swapping Egg styles) without triggering false shortages.
- **Shortage reporting:** When blocked, every short ingredient is listed with the exact missing unit count (e.g., `Short: 2 egg, 2 cheese`).

## Pricing Engine Explanation

`priceCart(cart, menu, promos, serverTime)` runs in integer poisha (`1 BDT = 100 poisha`) in six strict steps:

1. **Unit subtotal:** `basePrice + sum(optionPrice * optionQty)`.
2. **Extras deal (`P2`):** For every 3 extra units in a unit, the cheapest extra unit is free (`floor(extraUnits / 3)` cheapest units deducted).
3. **Combo discount (`P1`):** If `eggs >= 4` and `protein >= 2`, apply `10%` off the Step 2 amount (half-up to nearest poisha).
4. **Line & cart subtotal:** `lineTotal = unitPrice * itemQuantity`; `cartSubtotal = sum(lineTotals)`.
5. **Cart-level discount:** Evaluate `C1` (`100 BDT` off when `subtotal >= 1,200 BDT`) and `C2` (`MORNING15`: `15%` off subtotal capped at `150 BDT`, valid strictly before `11:00` in `Asia/Dhaka` server time). Apply whichever gives the larger discount (tie-breaker: `C1`).
6. **VAT & payable:** Apply `5%` VAT on the discounted subtotal (half-up to nearest poisha), add to discounted subtotal, and round the final payable half-up to whole BDT.

## Gemini Tools Explanation

The staff sales assistant uses the Gemini Flash API with **function calling** rather than sending raw order JSON to the model:

- All numeric answers (order count, total revenue, best-selling option by units, revenue by payment method, average order value, count of orders that received `MORNING15`, and orders on a given date) are computed by pure TypeScript stats functions over the live in-memory/persisted orders store.
- Gemini selects the appropriate tool and formats the returned structured result into plain English (or Bangla).
- Questions outside what the stored order schema supports (such as customer names) are refused explicitly without guessing, and API/key/rate-limit (`429`) errors surface clear user-facing messages.

## Trade-offs

- **Integer poisha vs. floating point:** Storing and calculating everything in integer poisha adds conversion formatting at the UI edge, but avoids binary floating-point drift (such as `.5` rounding errors) during percentage discounts and VAT.
- **MSW / in-memory store vs. backend service:** Keeps the project zero-backend and reproducible in the browser, at the cost of persistence being scoped to browser storage (`localStorage`) rather than a multi-device database.
- **Shared pure engines:** Sharing validation, stock, and pricing logic between the mock server and UI avoids duplicate rules, though real production systems would still re-verify everything server-side.

## Unfinished Features

This repository is being built incrementally step by step. Currently pending implementation:

- [ ] Part A: Generic Rules Engine & builder UI integration
- [ ] Part B: Ingredient-based shared stock calculation & shortage reporting
- [ ] Part C: Integer-poisha Pricing Engine & debounced `/price` preview with race-condition protection
- [ ] Part D: MSW mock API, idempotent Cart & 5-minute server-clock reservations
- [ ] Part E: Atomic Checkout, `orders.seed.json` hydration, and `orders.json` export
- [ ] Part F: Gemini Flash sales assistant with function calling & error handling
- [ ] Part G (Bonus): Refresh reservation recovery, multi-tab optimistic concurrency versioning, and draft persistence
- [ ] `DECISIONS.md`, `ANSWERS.md`, `.env.example`, and full Vitest / RTL acceptance suite (`TC-01` – `TC-20`)

## Actual Hours Spent

- **In progress** — currently tracking hours per step (will be updated with exact total hours before final submission).
