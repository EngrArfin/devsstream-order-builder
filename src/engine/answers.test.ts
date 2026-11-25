import { describe, expect, it } from "vitest";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import { SEED_ORDERS_FILE } from "@/mocks/seedOrders";
import { priceCart, priceSeedOrder } from "./pricing";
import { validate } from "./rules";
import {
  getBestSellingOption,
  getCouponUsageStats,
  getRevenueByPaymentMethod,
  getTotalRevenue,
} from "./stats";
import { checkStockAvailability } from "./stock";

const configA = { toast: 1, scrambled: 2, sausage: 1, ketchup: 1 };
const configB = {
  croissant: 1,
  omelette: 2,
  fried: 2,
  sausage: 1,
  bacon: 1,
  hashbrown: 1,
  mushroom: 1,
  hollandaise: 1,
};
const configC = {
  paratha: 1,
  fried: 2,
  tofu: 1,
  cheese: 2,
  beans: 1,
  mushroom: 1,
  chili: 1,
};

describe("Assessment Section 10 Answers (Q1-Q8)", () => {
  it("computes and prints Q1 through Q8 using our own engines", () => {
    // Q1: Maximum number of item C from empty cart
    let maxC = 0;
    let q1Shortage: string | null = null;
    for (let qty = 1; qty <= 10; qty += 1) {
      const check = checkStockAvailability(configC, qty, MENU_FIXTURE, {}, []);
      if (check.ok) {
        maxC = qty;
      } else {
        q1Shortage = check.message;
        break;
      }
    }
    expect(maxC).toBe(2);
    expect(q1Shortage).toContain("cheese");

    // Q2: Cheapest valid configuration
    // Search valid combinations of 1 bread, min eggs (2), 1 protein, 0 extras, 0 sauce
    let cheapestPricePoisha = Number.POSITIVE_INFINITY;
    let cheapestConfig: Record<string, number> = {};
    const breads = MENU_FIXTURE.groups[0].options;
    const eggs = MENU_FIXTURE.groups[1].options;
    const proteins = MENU_FIXTURE.groups[2].options;

    for (const bread of breads) {
      for (const protein of proteins) {
        for (const e1 of eggs) {
          for (const e2 of eggs) {
            const candidate: Record<string, number> = {
              [bread.id]: 1,
              [protein.id]: 1,
            };
            candidate[e1.id] = (candidate[e1.id] ?? 0) + 1;
            candidate[e2.id] = (candidate[e2.id] ?? 0) + 1;
            if (
              validate(candidate, MENU_FIXTURE.groups, MENU_FIXTURE.rules)
                .length === 0
            ) {
              const priced = priceCart(
                { items: [{ quantity: 1, selections: candidate }] },
                MENU_FIXTURE,
                MENU_FIXTURE.promos,
                "2026-11-25T12:00:00+06:00"
              );
              if (priced.items[0].unitPricePoisha < cheapestPricePoisha) {
                cheapestPricePoisha = priced.items[0].unitPricePoisha;
                cheapestConfig = candidate;
              }
            }
          }
        }
      }
    }
    expect(cheapestPricePoisha).toBe(36000);

    // Q3: Cart = A x3 at 10:30 and 11:30 (with MORNING15)
    const q3At1030 = priceCart(
      { items: [{ quantity: 3, selections: configA }], couponCode: "MORNING15" },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T10:30:00+06:00"
    );
    const q3At1130 = priceCart(
      { items: [{ quantity: 3, selections: configA }], couponCode: "MORNING15" },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T11:30:00+06:00"
    );
    expect(q3At1030.pricing.payableBdt).toBe(1040);
    expect(q3At1130.pricing.payableBdt).toBe(1197);

    // Q4: After TC-10 (B with Omelette x1 + Fried x3, plus C x2) at 11:30
    const bEdited = { ...configB, omelette: 1, fried: 3 };
    const q4 = priceCart(
      {
        items: [
          { quantity: 1, selections: bEdited },
          { quantity: 2, selections: configC },
        ],
        couponCode: "MORNING15",
      },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T11:30:00+06:00"
    );
    expect(q4.pricing.payableBdt).toBe(1600);

    // Q5-Q8: Seed orders
    const seedOrders = SEED_ORDERS_FILE.orders.map((o) =>
      priceSeedOrder(o, MENU_FIXTURE)
    );
    const totalRev = getTotalRevenue(seedOrders);
    const bestOption = getBestSellingOption(seedOrders, MENU_FIXTURE, 3);
    const byPayment = getRevenueByPaymentMethod(seedOrders);
    const couponStats = getCouponUsageStats(seedOrders, "MORNING15");

    console.log("Q1:", { maxC, q1Shortage });
    console.log("Q2:", { cheapestConfig, unitPriceBdt: cheapestPricePoisha / 100 });
    console.log("Q3_1030:", q3At1030.pricing);
    console.log("Q3_1130:", q3At1130.pricing);
    console.log("Q4:", q4.pricing);
    console.log(
      "Q5:",
      seedOrders.map((o) => ({ id: o.id, payableBdt: o.pricing.payableBdt })),
      "Total:",
      totalRev.totalRevenueBdt
    );
    console.log("Q6:", bestOption.items);
    console.log("Q7:", byPayment.breakdown);
    console.log("Q8:", couponStats);
  });
});
