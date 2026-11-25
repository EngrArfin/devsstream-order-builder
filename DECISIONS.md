# Architecture & Design Decisions

This document records the checkpoints (`C1`, `C2`) and design decisions (`D1`–`D6`) for the Smart Order Builder before implementation.

---

## Checkpoints

### Checkpoint C1 — Float Risk and TC-06 VAT Rounding

Storing `679.50` and running percentage math with JavaScript `Number` floats is risky because IEEE-754 binary floating-point cannot represent decimal fractions like `0.05`, `0.10`, or `0.15` exactly. For example, in JavaScript `75.475 * 100` evaluates to `7547.499999999999`, so calling `Math.round(vat * 100) / 100` at a `.5` boundary can round down to `75.47` instead of `75.48`. Keeping every monetary amount in integer poisha (`1 BDT = 100 poisha`) avoids decimal drift and lets us apply exact integer half-up division: `Math.floor((amount * rate + 50) / 100)`.

**TC-06 hand calculation (`B x1 + C x2`, server time `10:59:59` Asia/Dhaka):**
1. **Unit price of B:** `25000 + (6000 + 14000 + 6000 + 6000 + 9000 + 4000 + 3000 + 2500) = 75500` poisha (`755.00 BDT`). Extras = `2` units (`< 3`), so P2 = `0`. Eggs = `4`, Protein = `2`, so P1 (`10%` off) gives `75500 - 7550 = 67950` poisha (`679.50 BDT`).
2. **Unit price of C:** `25000 + (2000 + 6000 + 5000 + 7000 + 2500 + 3000 + 1000) = 51500` poisha (`515.00 BDT`). Extras = `4` units (`Cheese x2, Baked Beans x1, Mushroom x1`), so `floor(4 / 3) = 1` cheapest extra (`Baked Beans = 2500` poisha) is free -> `49000` poisha (`490.00 BDT`). Eggs = `2`, Protein = `1`, so P1 = `0`.
3. **Cart subtotal:** `67950 * 1 + 49000 * 2 = 165950` poisha (`1,659.50 BDT`).
4. **Cart discount:** `C1` gives `10000` poisha (`100.00 BDT`). `C2` (`MORNING15`, valid before `11:00`) is `15%` of `165950 = 24892.5` poisha, capped at `15000` poisha (`150.00 BDT`). `C2` wins.
5. **Discounted subtotal:** `165950 - 15000 = 150950` poisha (`1,509.50 BDT`).
6. **VAT (`5%` half-up to nearest poisha):**
   `150950 * 5 = 754750` -> `754750 / 100 = 7547.5` poisha.
   Half-up rounding: `Math.floor((754750 + 50) / 100) = Math.floor(754800 / 100) = 7548` poisha = **`75.48 BDT`**.
7. **Final payable (half-up to whole BDT):**
   `150950 + 7548 = 158498` poisha (`1,584.98 BDT`) -> rounded half-up to whole BDT = `158500` poisha = **`1,585 BDT`**.

---

### Checkpoint C2 — Sales Assistant Supported Questions & Tool Functions

All stats tools are pure TypeScript functions operating on the live `Order[]` list. Gemini Flash only selects which tool to invoke and turns the returned JSON into a natural-language response.

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
When Tab A tries to save an edited item after Tab B has taken the remaining eggs, the mock server detects the shortage during the atomic net-difference check and rejects the `PATCH` request with `409 Conflict`, returning the exact short ingredients (for example, `Short: 2 egg`) and the latest server stock snapshot. Tab A surfaces that conflict error inline and keeps the user in edit mode with all their current selections untouched, so nothing they clicked or typed is lost. The user can then adjust the conflicting egg options or cancel the edit cleanly without rebuilding the item from scratch.

### D2 — When Prices and Promotions Lock
Prices and promotions are not locked when an item is added to the cart; they are recalculated from the server's `serverTime` and only locked when checkout creates the final order. This keeps the pricing engine consistent with TC-06 and TC-07, where the exact same cart qualifies for `MORNING15` at `10:59:59` (`1,585 BDT`) and loses it one second later at `11:00:00` (`1,637 BDT`). Once checkout succeeds, the calculated totals are stored permanently on the order JSON so historical orders never shift if menu prices or promo rules change later.

### D3 — Reservation Expiry Mid-Edit
If a cart item's 5-minute reservation expires while the user is editing it, the server releases the item's held stock and marks that cart entry read-only (removable, not editable). When the client timer reaches zero or the user clicks Save and receives an expired error from the server, the UI displays a clear banner explaining that the reservation timed out and the original cart row is now expired. Instead of wiping out the editor, we keep the user's unsaved selections in the builder and offer a "Reserve as New Item" action so they do not lose their configuration and can re-reserve if stock is still available.

### D4 — Order ID, Timestamp, and Double-Click Prevention
The mock server generates both the `orderId` and `createdAt` timestamp using its authoritative clock, since checkout pricing and the `11:00` promo cutoff depend on server time rather than the browser clock. To prevent a quick double-click on Pay from creating duplicate orders, the client generates one `idempotencyKey` per checkout attempt and disables the Pay button while the request is in flight. On the server side, the checkout endpoint records processed idempotency keys and returns the already-created order if the same key is submitted twice, ensuring stock is never deducted twice and the cart stays empty.

### D5 — Handling Missing Customer Data in the Sales Assistant
Order records do not store customer names, emails, or IDs, and none of the assistant's tool functions expose customer fields. The Gemini system prompt explicitly instructs the model to treat tool results as the only source of truth and to state clearly when a requested metric is unavailable in the data rather than guessing. When asked "Who is our best customer?", the assistant answers directly that customer information is not recorded in the order data, so it cannot identify a top customer.

### D6 — Stored Order JSON Shape
All monetary amounts in stored orders use integer **poisha** (`1 BDT = 100 poisha`) with explicit `*Poisha` field names (plus `payableBdt` as the whole-BDT rounded integer) so exported JSON stays exact and matches `priceCart`. To preserve coupon auditability (needed for Q8 and the assistant's coupon stats), each order includes a `coupon` object recording the entered `code`, whether it was `"applied"`, `"rejected"`, or `"none"`, and a short `reason` when rejected (such as `"After 11:00 cutoff"` or `"C1 gave larger discount"`).

```json
{
  "id": "ord-1001",
  "createdAt": "2026-11-24T10:59:59+06:00",
  "paymentMethod": "bkash",
  "moneyUnit": "poisha",
  "items": [
    {
      "productId": "build-your-breakfast",
      "productName": "Build Your Breakfast",
      "quantity": 1,
      "selections": {
        "croissant": 1,
        "omelette": 2,
        "fried": 2,
        "sausage": 1,
        "bacon": 1,
        "hashbrown": 1,
        "mushroom": 1,
        "hollandaise": 1
      },
      "unitSubtotalPoisha": 75500,
      "extrasDiscountPoisha": 0,
      "comboDiscountPoisha": 7550,
      "unitPricePoisha": 67950,
      "lineTotalPoisha": 67950
    }
  ],
  "coupon": {
    "code": "MORNING15",
    "status": "applied",
    "reason": null
  },
  "pricing": {
    "subtotalPoisha": 165950,
    "appliedPromoId": "C2",
    "cartDiscountPoisha": 15000,
    "discountedSubtotalPoisha": 150950,
    "vatPoisha": 7548,
    "payablePoisha": 158500,
    "payableBdt": 1585
  }
}
```
