import { describe, expect, it } from "vitest";
import { MENU_FIXTURE } from "./menuFixture";
import { SEED_ORDERS_FILE } from "./seedOrders";

describe("Appendix fixtures", () => {
  it("loads the Build Your Breakfast menu fixture with 5 groups, 4 rules, and 12 stocked ingredients", () => {
    expect(MENU_FIXTURE.basePricePoisha).toBe(25000);
    expect(MENU_FIXTURE.groups).toHaveLength(5);
    expect(MENU_FIXTURE.rules).toHaveLength(4);
    expect(MENU_FIXTURE.ingredients).toHaveLength(12);
  });

  it("loads 6 seed orders whose option IDs all exist in the menu fixture", () => {
    const validOptionIds = new Set(
      MENU_FIXTURE.groups.flatMap((g) => g.options.map((o) => o.id))
    );

    expect(SEED_ORDERS_FILE.orders).toHaveLength(6);
    for (const order of SEED_ORDERS_FILE.orders) {
      for (const line of order.lines) {
        for (const optionId of Object.keys(line.options)) {
          expect(validOptionIds.has(optionId)).toBe(true);
        }
      }
    }
  });
});
