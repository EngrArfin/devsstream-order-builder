# Smart Order Builder

A frontend order-building and POS simulation app for **Build Your Breakfast** orders. It validates custom item combinations through a generic rules engine, tracks ingredient-level shared stock with timed reservations, calculates pricing in integer poisha, persists orders as JSON via an MSW mock API, and includes a staff sales assistant powered by Gemini function calling.

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

Copy `.env.example` to `.env.local` in the project root and add your Google AI Studio Gemini API key:

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

Run the full automated Vitest + React Testing Library suite with one command:

```bash
npm test
```

To print the verified Section 10 (`ANSWERS.md`) calculations directly from the engines:

```bash
npx vitest run src/engine/answers.test.ts
```

## Architecture

The codebase separates pure domain logic from React state and the mock server layer:

- **Pure domain engines (`src/engine/`):** Framework-free TypeScript functions in `rules.ts`, `stock.ts`, `pricing.ts`, and `stats.ts`. Both the UI and the mock server import the same pure functions so client previews and server mutations stay consistent.
- **Mock API layer (`src/mocks/`):** MSW handlers (`handlers.ts`, `browser.ts`, `server.ts`) backed by `serverState.ts`. It serves the Appendix A fixture (`menuFixture.ts`), simulates `/api/price` latency (`200–1500 ms`) and `15%` random failures, manages atomic reservations with idempotency keys, runs the server clock `+90s` ahead of the browser, and persists orders, cart versions, and sold stock in `localStorage` seeded from `orders.seed.json`.
- **Assistant & UI (`src/services/`, `src/hooks/`, `src/components/`, `src/pages/`):** Built with React, strict TypeScript (`tsconfig.app.json`), Vite, Tailwind CSS, and Radix UI primitives. `usePricePreview` handles 300 ms debouncing and stale-request cancellation, `useServerClock` tracks server offset for countdowns, and `geminiAssistant.ts` handles Gemini Flash tool calling.

## Rules Engine Explanation

`validate(config, groups, rules)` in `src/engine/rules.ts` is a pure, fixture-driven validator that collects **all** violations across the active configuration instead of failing fast on the first error:

- **Group limits:** Checks `min`, `max`, `step` (total selected quantity must be divisible by `step`), `maxDistinct` (number of unique options picked), and `maxPerOption`.
- **Cross-group rules:**
  - `requires`: An option requires at least one option from a target list to be selected.
  - `excludes`: Incompatible options cannot be selected together.
  - `overrideLimit`: Selecting a trigger option overrides a target group's base limits (resolved via `getEffectiveGroupLimits`, taking precedence over base limits).
- Every violation returns the offending `groupId` or `ruleId` and a human-readable message; adding to cart stays disabled while any violation exists.

## Stock Engine Explanation

Stock is tracked per raw ingredient (e.g., `egg`, `cheese`, `croissant`) in `src/engine/stock.ts` rather than per menu option:

- **Shared pool:** Remaining stock equals initial stock minus sold stock and active (unexpired) reservations across the cart.
- **Per-option availability:** `getMaxAddableForOption` computes how many additional units of an option can still be added given current draft selections, item quantity (`1–3`), and remaining ingredient stock, disabling `+` at `0`.
- **Net-difference editing:** When editing an existing cart item (`excludeCartItemId`), the item's own reserved ingredients count toward its available budget so users can rebalance choices without double-counting or false shortages.
- **Shortage reporting:** `checkStockAvailability` lists every short ingredient with its exact missing unit count (e.g., `Short: 2 egg, 2 cheese`).

## Pricing Engine Explanation

`priceCart(cart, menu, promos, serverTime)` in `src/engine/pricing.ts` runs in integer poisha (`1 BDT = 100 poisha`) in six strict steps:

1. **Unit subtotal:** `basePrice + sum(optionPrice * optionQty)`.
2. **Extras deal (`P2`):** For every 3 extra units in a unit, the cheapest extra unit is free (`floor(extraUnits / 3)` cheapest units deducted).
3. **Combo discount (`P1`):** If `eggs >= 4` and `protein >= 2`, apply `10%` off the Step 2 amount (half-up to nearest poisha).
4. **Line & cart subtotal:** `lineTotal = unitPrice * itemQuantity`; `cartSubtotal = sum(lineTotals)`.
5. **Cart-level discount:** Evaluate `C1` (`100 BDT` off when `subtotal >= 1,200 BDT`) and `C2` (`MORNING15`: `15%` off subtotal capped at `150 BDT`, valid strictly before `11:00` in `Asia/Dhaka` server time). Apply whichever gives the larger discount (tie-breaker: `C1`).
6. **VAT & payable:** Apply `5%` VAT on the discounted subtotal (half-up to nearest poisha), add to discounted subtotal, and round the final payable half-up to whole BDT.

## Gemini Tools Explanation

The staff sales assistant (`src/services/geminiAssistant.ts`) uses the Gemini Flash API with **function calling** rather than sending raw order JSON to the model:

- All numeric answers are computed by pure TypeScript functions in `src/engine/stats.ts` (`getOrderCount`, `getTotalRevenue`, `getBestSellingOption`, `getRevenueByPaymentMethod`, `getAverageOrderValue`, `getCouponUsageStats`, `getOrdersByDate`) over the live `Order[]` array.
- Gemini selects the appropriate tool and phrases the returned structured JSON into plain English (or Bangla).
- Questions outside the order schema (such as customer names) are refused explicitly without guessing, and missing keys, invalid keys, quota errors (`429`), and network failures display clear messages.

## Trade-offs

- **Integer poisha vs. floating point:** Calculating in integer poisha requires formatting conversion at the UI boundary, but eliminates IEEE-754 floating-point drift (such as `75.475 * 100 === 7547.499999999999`) during percentage discounts and VAT.
- **MSW + `localStorage` vs. real backend:** Keeps the project zero-backend and reproducible locally, at the trade-off that persistence and multi-tab version sync are scoped to one browser profile rather than across separate devices.
- **Shared pure engines:** Sharing validation, stock, and pricing logic between the mock server and UI avoids duplicate rules, though real production systems would still treat client checks as hints and re-verify on a real backend.

## Unfinished Features

All core requirements (**Parts A–F**), Bonus features (**Part G**), `DECISIONS.md`, `ANSWERS.md`, `.env.example`, and the automated test suite covering **TC-01`–`TC-20** are implemented:

- [x] Part A: Generic Rules Engine & data-driven builder UI
- [x] Part B: Ingredient-based shared stock, net-difference edits & shortage reporting
- [x] Part C: Integer-poisha Pricing Engine & debounced `/price` preview with stale-response cancellation
- [x] Part D: MSW mock API, idempotent Cart & 5-minute server-clock (`+90s`) reservations
- [x] Part E: Atomic Checkout, `orders.seed.json` hydration, and `orders.json` export
- [x] Part F: Gemini Flash sales assistant with function calling & error handling
- [x] Part G (Bonus): Refresh valid-reservation recovery, multi-tab optimistic version conflict detection, and draft persistence
- [x] `DECISIONS.md`, `ANSWERS.md`, `.env.example`, and Vitest / RTL tests (`TC-01`–`TC-20`)

*Minor non-goals left out by design:* Real payment gateway integration (card/bKash fields are label-only per brief) and remote multi-device database sync (mock server uses browser `localStorage`).

## Actual Hours Spent

- **~6.5 hours total** across setup, design decisions, domain engines, MSW mock API, React UI, Gemini function-calling integration, bonus persistence/concurrency, and test verification.
