import { describe, expect, it } from "vitest";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import type { CartItem } from "@/types/order";
import {
  checkStockAvailability,
  computeRemainingStock,
  getMaxAddableForOption,
} from "./stock";

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

function makeCartItem(
  id: string,
  selections: Record<string, number>,
  quantity: number,
  status: "active" | "expired" = "active"
): CartItem {
  return {
    id,
    productId: MENU_FIXTURE.productId,
    quantity,
    selections,
    createdAt: "2026-11-25T10:00:00+06:00",
    expiresAt: "2026-11-25T10:05:00+06:00",
    status,
  };
}

describe("Shared ingredient stock engine", () => {
  it("TC-08: reports remaining stock after B x1 + C x2 and blocks new items needing eggs", () => {
    const cart = [
      makeCartItem("item-b", configB, 1),
      makeCartItem("item-c", configC, 2),
    ];

    const remaining = computeRemainingStock(
      MENU_FIXTURE.ingredients,
      {},
      cart,
      MENU_FIXTURE.groups
    );

    expect(remaining.egg).toBe(0);
    expect(remaining.cheese).toBe(0);
    expect(remaining.croissant).toBe(1);

    expect(
      getMaxAddableForOption("fried", {}, 1, MENU_FIXTURE, {}, cart)
    ).toBe(0);
    expect(
      getMaxAddableForOption("scrambled", {}, 1, MENU_FIXTURE, {}, cart)
    ).toBe(0);
    expect(
      getMaxAddableForOption("omelette", {}, 1, MENU_FIXTURE, {}, cart)
    ).toBe(0);
    expect(
      getMaxAddableForOption("ketchup", {}, 1, MENU_FIXTURE, {}, cart)
    ).toBe(Number.POSITIVE_INFINITY);

    const newEggCheck = checkStockAvailability(
      { toast: 1, fried: 2, sausage: 1 },
      1,
      MENU_FIXTURE,
      {},
      cart
    );
    expect(newEggCheck.ok).toBe(false);
    expect(newEggCheck.message).toBe("Short: 2 egg");
  });

  it("TC-09: editing B to Omelette x3 + Fried x1 counts B's 6 eggs as available and reports Short: 1 egg", () => {
    const cart = [
      makeCartItem("item-b", configB, 1),
      makeCartItem("item-c", configC, 2),
    ];

    const updatedB = {
      ...configB,
      omelette: 3,
      fried: 1,
    };

    const result = checkStockAvailability(
      updatedB,
      1,
      MENU_FIXTURE,
      {},
      cart,
      "item-b"
    );

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Short: 1 egg");
  });

  it("TC-10: editing B to Omelette x1 + Fried x3 is allowed and leaves 1 egg remaining", () => {
    const itemB = makeCartItem("item-b", configB, 1);
    const itemC = makeCartItem("item-c", configC, 2);
    const cart = [itemB, itemC];

    const updatedB = {
      ...configB,
      omelette: 1,
      fried: 3,
    };

    const check = checkStockAvailability(
      updatedB,
      1,
      MENU_FIXTURE,
      {},
      cart,
      "item-b"
    );
    expect(check.ok).toBe(true);
    expect(check.shortages).toEqual([]);

    const updatedCart = [makeCartItem("item-b", updatedB, 1), itemC];
    const remainingAfter = computeRemainingStock(
      MENU_FIXTURE.ingredients,
      {},
      updatedCart,
      MENU_FIXTURE.groups
    );
    expect(remainingAfter.egg).toBe(1);
  });

  it("TC-11: changing C quantity from 2 to 3 reports all shortages (Short: 2 egg, 2 cheese)", () => {
    const cart = [
      makeCartItem("item-b", configB, 1),
      makeCartItem("item-c", configC, 2),
    ];

    const check = checkStockAvailability(
      configC,
      3,
      MENU_FIXTURE,
      {},
      cart,
      "item-c"
    );

    expect(check.ok).toBe(false);
    expect(check.message).toBe("Short: 2 egg, 2 cheese");
  });

  it("ignores expired cart reservations and accounts for sold stock", () => {
    const cart = [makeCartItem("item-expired", configB, 1, "expired")];
    const remaining = computeRemainingStock(
      MENU_FIXTURE.ingredients,
      { egg: 2 },
      cart,
      MENU_FIXTURE.groups
    );

    expect(remaining.egg).toBe(8);
    expect(remaining.croissant).toBe(2);
  });

  it("computes remaining addable units while building an item with quantity > 1", () => {
    expect(
      getMaxAddableForOption(
        "omelette",
        { fried: 2 },
        2,
        MENU_FIXTURE,
        {},
        []
      )
    ).toBe(1); // 10 total eggs - (2 * 2) = 6 left; at qty 2, 1 omelette needs 4 eggs
  });
});
