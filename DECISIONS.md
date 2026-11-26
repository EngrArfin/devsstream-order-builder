# Architecture & Design Decisions

These are the checkpoint answers (`C1`, `C2`) and design choices (`D1`–`D6`) I settled on before writing the engines and mock server.

---

## Checkpoints

### Checkpoint C1 — Float Risk and TC-06 VAT Rounding

If I store `679.50` as a normal JavaScript `Number` and multiply by percentages like `0.05` or `0.15`, binary floating-point drift shows up right on `.5` rounding edges. For instance, in JS `75.475 * 100` evaluates to `7547.499999999999`, so `Math.round(vat * 100) / 100` drops to `75.47` instead of `75.48`. Keeping every money value in integer poisha (`1 BDT = 100 poisha`) avoids decimal drift completely and lets me do half-up percentage rounding with integer math: `Math.floor((amount * rate + 50) / 100)`.

**TC-06 by hand (`B x1 + C x2`, server time `10:59:59` Asia/Dhaka):**
1. **Unit B:** `25000 + (6000 + 14000 + 6000 + 6000 + 9000 + 4000 + 3000 + 2500) = 75500` poisha (`755.00 BDT`). Extras = `2` (`< 3`), so P2 = `0`. Eggs = `4`, Protein = `2`, so P1 (`10%` off) gives `75500 - 7550 = 67950` poisha (`679.50 BDT`).
2. **Unit C:** `25000 + (2000 + 6000 + 5000 + 7000 + 2500 + 3000 + 1000) = 51500` poisha (`515.00 BDT`). Extras = `4` (`Cheese x2, Baked Beans x1, Mushroom x1`), so `floor(4 / 3) = 1` cheapest extra (`Baked Beans = 2500` poisha) is free -> `49000` poisha (`490.00 BDT`). Eggs = `2`, Protein = `1`, so P1 = `0`.
3. **Cart subtotal:** `67950 * 1 + 49000 * 2 = 165950` poisha (`1,659.50 BDT`).
4. **Cart discount:** `C1` gives `10000` poisha (`100.00 BDT`). `C2` (`MORNING15`, valid before `11:00`) is `15%` of `165950 = 24892.5` poisha, capped at `15000` poisha (`150.00 BDT`), so `C2` wins.
5. **Discounted subtotal:** `165950 - 15000 = 150950` poisha (`1,509.50 BDT`).
6. **VAT (`5%` half-up to nearest poisha):**
   `150950 * 5 = 754750` -> `754750 / 100 = 7547.5` poisha.
   Half-up: `Math.floor((754750 + 50) / 100) = Math.floor(754800 / 100) = 7548` poisha = **`75.48 BDT`**.
7. **Payable (half-up to whole BDT):**
   `150950 + 7548 = 158498` poisha (`1,584.98 BDT`) -> rounded half-up to whole BDT = `158500` poisha = **`1,585 BDT`**.

---

### Checkpoint C2 — Sales Assistant Supported Questions & Tool Functions

All numeric stats come from pure TypeScript functions over the live `Order[]` array in `src/engine/stats.ts`. Gemini Flash only picks the matching tool and phrases the returned values.

| Question | Tool Function | Inputs | Output Shape |
| :--- | :--- | :--- | :--- |
| How many orders? | `getOrderCount` | `none` | `{ totalOrders: number }` |
| What is our total revenue? | `getTotalRevenue` | `none` | `{ totalRevenuePoisha: number; totalRevenueBdt: number }` |
| What is the best-selling option (by units)? | `getBestSellingOption` | `{ limit?: number }` | `{ items: Array<{ optionId: string; optionName: string; totalUnits: number }> }` |
| Revenue by payment method? | `getRevenueByPaymentMethod` | `none` | `{ breakdown: Array<{ paymentMethod: "card" \| "bkash" \| "cash"; orderCount: number; revenuePoisha: number; revenueBdt: number }> }` |
| What is the average order value? | `getAverageOrderValue` | `none` | `{ orderCount: number; averageOrderValuePoisha: number; averageOrderValueBdt: number }` |
| How many orders actually got the coupon? | `getCouponUsageStats` | `{ code?: string }` | `{ code: string; appliedCount: number; rejectedCount: number; totalEnteredCount: number }` |
| Orders on a given date? | `getOrdersByDate` | `{ date: string }` (`YYYY-MM-DD`, `Asia/Dhaka`) | `{ date: string; orderCount: number; totalRevenuePoisha: number; totalRevenueBdt: number; orderIds: string[] }` |

---

## Decision Points

### D1 — Concurrent Tab Stock Conflict During Edit
When Tab A clicks Save after Tab B has taken the remaining eggs, the mock server catches the shortage during its atomic net-difference check and rejects the `PATCH` call with `409 Conflict` (or `VERSION_CONFLICT` if the cart version moved). The response sends back the exact short ingredients (like `Short: 2 egg`) along with the latest cart and stock snapshot. On Tab A, I show that conflict banner inline and leave the builder in edit mode with everything the user already selected untouched. That way nothing they typed or clicked gets wiped out, and they can reduce the egg count or cancel the edit.

### D2 — When Prices and Promotions Lock
I do not lock prices or promos when an item goes into the cart; everything stays live against the server's `serverTime` and only locks when checkout creates the order. That matches TC-06 and TC-07 directly: the same `B x1 + C x2` cart gets `MORNING15` at `10:59:59` (`1,585 BDT`), and if checkout runs at `11:00:00` the coupon is dropped and `C1` applies (`1,637 BDT`). Once checkout succeeds, the final totals are saved onto the order JSON so old orders never change later.

### D3 — Reservation Expiry Mid-Edit
If an item's 5-minute reservation runs out while the user is editing it, the server releases its held stock and marks that cart row as expired (read-only, so it can only be removed). When the countdown hits zero or the user clicks Save and gets a `410` expired response, I exit edit mode on that old row and show a banner explaining that the reservation timed out. Instead of clearing the form, I keep their unsaved selections in the builder and switch the submit button to "Reserve as New Item" so they can re-reserve if stock is still left.

### D4 — Order ID, Timestamp, and Double-Click Prevention
The mock server creates both the `orderId` and `createdAt` timestamp from its own clock, because the `11:00` promo cutoff and order history depend on server time rather than the browser clock. To stop a fast double-click on Pay from placing two orders, the client generates one `idempotencyKey` per checkout attempt and disables the Pay button while the request is running. On the server side, `/api/checkout` remembers processed idempotency keys and returns the first created order if the same key arrives again, so stock is never deducted twice.

### D5 — Handling Missing Customer Data in the Sales Assistant
Stored orders do not have any customer name, phone, or user ID, and none of the stats tools return customer fields. In the Gemini system instructions, I explicitly tell the model what fields exist on an order and instruct it never to invent names or numbers outside tool results. So when someone asks "Who is our best customer?", the assistant answers plainly that customer information is not stored in the order records and refuses to guess.

### D6 — Stored Order JSON Shape
Every money field in stored orders uses integer **poisha** (`1 BDT = 100 poisha`) with `*Poisha` names, plus `payableBdt` as the whole-BDT rounded figure, matching `priceCart` directly. To keep track of coupons that were entered at checkout but rejected (needed for Q8 and the coupon stats tool), each order stores a `coupon` object with `code`, `status` (`"applied"`, `"rejected"`, or `"none"`), and `reason`.

```json
{
  "id": "ORD-1001",
  "createdAt": "2026-11-20T09:15:00+06:00",
  "paymentMethod": "card",
  "moneyUnit": "poisha",
  "items": [
    {
      "productId": "build-your-breakfast",
      "productName": "Build Your Breakfast",
      "quantity": 1,
      "selections": {
        "toast": 1,
        "scrambled": 2,
        "sausage": 1,
        "ketchup": 1
      },
      "unitSubtotalPoisha": 38000,
      "extrasDiscountPoisha": 0,
      "comboDiscountPoisha": 0,
      "unitPricePoisha": 38000,
      "lineTotalPoisha": 38000
    }
  ],
  "coupon": {
    "code": "MORNING15",
    "status": "applied",
    "reason": null
  },
  "pricing": {
    "subtotalPoisha": 38000,
    "appliedPromoId": "C2",
    "cartDiscountPoisha": 5700,
    "discountedSubtotalPoisha": 32300,
    "vatPoisha": 1615,
    "payablePoisha": 33900,
    "payableBdt": 339
  }
}
```
