import { describe, expect, it } from "vitest";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import type { MenuFixture } from "@/types/order";
import { formatPoishaAsBdt, roundHalfUpPercent } from "@/utils/currency";
import { priceCart } from "./pricing";

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

describe("Pricing engine (priceCart)", () => {
  it("TC-05: computes exact unit prices for A (380.00), B (679.50), and C (490.00)", () => {
    const resA = priceCart(
      { items: [{ quantity: 1, selections: configA }] },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T12:00:00+06:00"
    );
    const resB = priceCart(
      { items: [{ quantity: 1, selections: configB }] },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T12:00:00+06:00"
    );
    const resC = priceCart(
      { items: [{ quantity: 1, selections: configC }] },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T12:00:00+06:00"
    );

    expect(resA.items[0].unitPricePoisha).toBe(38000);
    expect(resB.items[0].unitPricePoisha).toBe(67950);
    expect(resC.items[0].unitPricePoisha).toBe(49000);

    // TC-10 edited B (Omelette x1 + Fried x3) = 643.50 BDT
    const bEdited = { ...configB, omelette: 1, fried: 3 };
    const resBEdited = priceCart(
      { items: [{ quantity: 1, selections: bEdited }] },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T12:00:00+06:00"
    );
    expect(resBEdited.items[0].unitPricePoisha).toBe(64350);
  });

  it("TC-06: B x1 + C x2 at 10:59:59 applies MORNING15 (150.00), VAT 75.48, payable 1,585", () => {
    const result = priceCart(
      {
        items: [
          { quantity: 1, selections: configB },
          { quantity: 2, selections: configC },
        ],
        couponCode: "MORNING15",
      },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T10:59:59+06:00"
    );

    expect(result.pricing.subtotalPoisha).toBe(165950);
    expect(result.coupon.status).toBe("applied");
    expect(result.pricing.appliedPromoId).toBe("C2");
    expect(result.pricing.cartDiscountPoisha).toBe(15000);
    expect(result.pricing.vatPoisha).toBe(7548);
    expect(result.pricing.payableBdt).toBe(1585);
    expect(result.pricing.payablePoisha).toBe(158500);
  });

  it("TC-07: same cart at 11:00:00 rejects MORNING15, picks C1 (100.00), VAT 77.98, payable 1,637", () => {
    const result = priceCart(
      {
        items: [
          { quantity: 1, selections: configB },
          { quantity: 2, selections: configC },
        ],
        couponCode: "MORNING15",
      },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T11:00:00+06:00"
    );

    expect(result.pricing.subtotalPoisha).toBe(165950);
    expect(result.coupon.status).toBe("rejected");
    expect(result.pricing.appliedPromoId).toBe("C1");
    expect(result.pricing.cartDiscountPoisha).toBe(10000);
    expect(result.pricing.vatPoisha).toBe(7798);
    expect(result.pricing.payableBdt).toBe(1637);
  });

  it("checks Asia/Dhaka time even when serverTime is given in UTC", () => {
    // 04:59:59Z === 10:59:59+06:00 (Dhaka) -> valid MORNING15
    const before11 = priceCart(
      {
        items: [
          { quantity: 1, selections: configB },
          { quantity: 2, selections: configC },
        ],
        couponCode: "morning15",
      },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T04:59:59Z"
    );
    expect(before11.pricing.appliedPromoId).toBe("C2");
    expect(before11.pricing.payableBdt).toBe(1585);

    // 05:00:00Z === 11:00:00+06:00 (Dhaka) -> rejected
    const at11 = priceCart(
      {
        items: [
          { quantity: 1, selections: configB },
          { quantity: 2, selections: configC },
        ],
        couponCode: "MORNING15",
      },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T05:00:00Z"
    );
    expect(at11.pricing.appliedPromoId).toBe("C1");
    expect(at11.pricing.payableBdt).toBe(1637);
  });

  it("picks C1 on an exact tie between C1 and C2", () => {
    // Construct a custom fixture where subtotal = 120000, C1 = 15000, C2 = 15% of 100000 = 15000
    const customMenu: MenuFixture = {
      ...MENU_FIXTURE,
      basePricePoisha: 100000,
      promos: {
        ...MENU_FIXTURE.promos,
        cartPromos: [
          {
            id: "C1",
            name: "150 off >= 1000",
            type: "cartThresholdFixed",
            minSubtotalPoisha: 100000,
            discountPoisha: 15000,
          },
          {
            id: "C2",
            name: "MORNING15",
            type: "cartCouponPercent",
            code: "MORNING15",
            percentOff: 15,
            maxDiscountPoisha: 15000,
            beforeHourDhaka: 11,
          },
        ],
      },
    };

    const result = priceCart(
      { items: [{ quantity: 1, selections: {} }], couponCode: "MORNING15" },
      customMenu,
      customMenu.promos,
      "2026-11-25T09:00:00+06:00"
    );

    expect(result.evaluations.c1DiscountPoisha).toBe(15000);
    expect(result.evaluations.c2DiscountPoisha).toBe(15000);
    expect(result.pricing.appliedPromoId).toBe("C1");
    expect(result.coupon.status).toBe("rejected");
  });

  it("handles half-up rounding and BDT formatting helpers accurately", () => {
    expect(roundHalfUpPercent(150950, 5)).toBe(7548); // 7547.5 -> 7548
    expect(roundHalfUpPercent(155950, 5)).toBe(7798); // 7797.5 -> 7798
    expect(formatPoishaAsBdt(165950)).toBe("1,659.50 BDT");
    expect(formatPoishaAsBdt(158500, { decimals: 0 })).toBe("1,585 BDT");
  });
});
