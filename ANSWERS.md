# Assessment Answers (Section 10)

All values below were generated directly by running our rules, stock, pricing, and stats engines against Appendix A and `orders.seed.json`.

**Command to reproduce & print all answers:**

```bash
npx vitest run src/engine/answers.test.ts
```

*(Also tested across the full suite via `npm test`.)*

---

## Q1. Maximum number of item C from an empty cart & limiting ingredient

- **Maximum quantity:** **2** units of item C
- **Limiting ingredient:** **`cheese`**
- **Reason:** Each unit of C uses `2 cheese`, and initial `cheese` stock is `4` (`4 / 2 = 2`). Trying to add 3 units of C requires `6 cheese` (`Short: 2 cheese`), while `egg` (`6 <= 10`), `paratha` (`3 <= 10`), `tofu` (`3 <= 5`), `baked beans` (`3 <= 8`), and `mushroom` (`3 <= 6`) still have enough stock.

---

## Q2. Cheapest valid configuration and its unit price

- **Configuration:** `Toast x1`, `Fried x2`, `Tofu x1` (0 extras, 0 sauce)
- **Unit price:** **`360.00 BDT`** (`36000` poisha)
  - Base `250.00` + Toast `0.00` + Fried (`30.00 × 2 = 60.00`) + Tofu `50.00` = `360.00 BDT`

---

## Q3. Cart = `A x3` at `10:30` and `11:30` (Asia/Dhaka)

*(Assuming `MORNING15` coupon is entered so the 11:00 cutoff applies; without a coupon both times yield `1,197 BDT`.)*

### Step-by-step working at `10:30`

1. **Unit price of A (`Toast x1, Scrambled x2, Chicken Sausage x1, Ketchup x1`):**
   - Base `25000` + Toast `0` + Scrambled (`3500 × 2 = 7000`) + Chicken Sausage `6000` + Ketchup `0` = `38000` poisha (`380.00 BDT`).
   - Extras = `0` (`P2 = 0`), Eggs = `2 < 4` (`P1 = 0`).
2. **Cart subtotal (`A x3`):**
   - `38000 × 3 = 114000` poisha (**`1,140.00 BDT`**).
3. **Cart discount comparison at `10:30`:**
   - `C1` (`100 BDT` off when `subtotal >= 1,200 BDT`): `0` (because `1,140.00 < 1,200.00`).
   - `C2` (`MORNING15`, valid before `11:00`): `15%` of `114000 = 17100` poisha (`171.00 BDT`), capped at `15000` poisha (`150.00 BDT`).
   - Chosen discount: **`C2 (MORNING15) = 150.00 BDT`**.
4. **Discounted subtotal:**
   - `114000 - 15000 = 99000` poisha (**`990.00 BDT`**).
5. **VAT (`5%` half-up to nearest poisha):**
   - `Math.floor((99000 * 5 + 50) / 100) = 4950` poisha (**`49.50 BDT`**).
6. **Payable (rounded half-up to whole BDT):**
   - `99000 + 4950 = 103950` poisha (`1,039.50 BDT`) -> `Math.floor((103950 + 50) / 100)` = **`1,040 BDT`**.

### Step-by-step working at `11:30`

1. **Subtotal:** `114000` poisha (**`1,140.00 BDT`**).
2. **Cart discount comparison at `11:30`:**
   - `C1`: `0` (`1,140.00 < 1,200.00`).
   - `C2` (`MORNING15`): rejected because `11:30 >= 11:00` (`Asia/Dhaka`).
   - Chosen discount: **None (`0.00 BDT`)**.
3. **Discounted subtotal:** `114000` poisha (**`1,140.00 BDT`**).
4. **VAT (`5%`):** `Math.floor((114000 * 5 + 50) / 100) = 5700` poisha (**`57.00 BDT`**).
5. **Payable:** `114000 + 5700 = 119700` poisha -> **`1,197 BDT`**.

---

## Q4. Payable after TC-10 at `11:30`

- Cart after TC-10: `B (Omelette x1 + Fried x3)` `x1` (`643.50 BDT`) + `C x2` (`490.00 × 2 = 980.00 BDT`)
- Subtotal: `1,623.50 BDT` (`162350` poisha)
- At `11:30`: `MORNING15` rejected, `C1` applies (`-100.00 BDT`) -> Discounted subtotal `1,523.50 BDT` (`152350` poisha)
- VAT (`5%`): `76.18 BDT` (`7618` poisha)
- **Payable:** **`1,600 BDT`** (`152350 + 7618 = 159968` poisha -> rounded half-up to `1600` BDT)

---

## Q5. Payable of each seed order & total revenue

| Order ID | Created At (`Asia/Dhaka`) | Payment | Payable (BDT) |
| :--- | :--- | :--- | ---: |
| `ORD-1001` | `2026-11-20T09:15:00+06:00` | `card` | `339` |
| `ORD-1002` | `2026-11-20T12:40:00+06:00` | `bkash` | `713` |
| `ORD-1003` | `2026-11-21T10:05:00+06:00` | `cash` | `1,271` |
| `ORD-1004` | `2026-11-21T19:30:00+06:00` | `card` | `578` |
| `ORD-1005` | `2026-11-22T08:50:00+06:00` | `bkash` | `866` |
| `ORD-1006` | `2026-11-22T13:10:00+06:00` | `card` | `1,228` |

- **Total revenue of all 6 seed orders:** **`4,995 BDT`** (`499500` poisha)

---

## Q6. Best-selling option across seed orders (by units)

- **Best-selling option:** **`Fried`** (`fried`) with **`10` units**
  - `ORD-1002`: `1 × 2 = 2`
  - `ORD-1003`: `2 × 2 = 4`
  - `ORD-1006`: `1 × 2 + 1 × 2 = 4`
  - *(Next highest: `Chicken Sausage` = `8` units, `Scrambled` = `8` units)*

---

## Q7. Payment method with the most revenue in seed orders

- **`card`** brought in the most revenue: **`2,145 BDT`** across 3 orders (`339 + 578 + 1,228`)
  - `bkash`: `1,579 BDT` (2 orders: `713 + 866`)
  - `cash`: `1,271 BDT` (1 order: `1,271`)

---

## Q8. How many seed orders actually received `MORNING15` & step-by-step explanation

- **Orders that actually received `MORNING15`:** **`3`** orders (`ORD-1001`, `ORD-1003`, `ORD-1005`)

### Breakdown of every seed order with `couponCode: "MORNING15"`

1. **`ORD-1001` (`2026-11-20T09:15:00+06:00`) — Applied:**
   - Subtotal = `380.00 BDT` (`< 1,200`, so `C1 = 0`).
   - Time is `09:15 < 11:00` (`Asia/Dhaka`), so `C2` gives `15%` of `380.00 = 57.00 BDT` (`C2` wins).
2. **`ORD-1003` (`2026-11-21T10:05:00+06:00`) — Applied:**
   - Lines: `C x2` (`980.00`) + `A x1` (`380.00`) -> Subtotal = `1,360.00 BDT`.
   - `C1 = 100.00 BDT`. Time is `10:05 < 11:00`, so `C2` = `min(15% of 1,360 = 204.00, 150.00) = 150.00 BDT`. `C2` beats `C1`.
3. **`ORD-1005` (`2026-11-22T08:50:00+06:00`) — Applied:**
   - Line (`qty: 2`): unit = `250 + 20 + 70 + 120 + 25 = 485.00 BDT`; Subtotal = `970.00 BDT` (`C1 = 0`).
   - Time is `08:50 < 11:00`, so `C2` gives `15%` of `970.00 = 145.50 BDT` (`C2` wins).
4. **`ORD-1006` (`2026-11-22T13:10:00+06:00`) — Rejected (did NOT get the discount):**
   - Although `couponCode: "MORNING15"` was entered, `createdAt` is `13:10:00+06:00`, which is after the strict `11:00` `Asia/Dhaka` cutoff.
   - `C2` is rejected (`0.00 BDT`); its subtotal is `679.50 + 490.00 = 1,169.50 BDT` (`< 1,200`, so `C1 = 0` as well), leaving discounted subtotal `1,169.50 BDT`, VAT `58.48 BDT`, and payable `1,228 BDT`.
