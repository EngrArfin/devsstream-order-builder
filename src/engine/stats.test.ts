import { describe, expect, it } from "vitest";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import { SEED_ORDERS_FILE } from "@/mocks/seedOrders";
import { priceSeedOrder } from "./pricing";
import {
  getAverageOrderValue,
  getBestSellingOption,
  getCouponUsageStats,
  getOrderCount,
  getOrdersByDate,
  getRevenueByPaymentMethod,
  getTotalRevenue,
} from "./stats";

const seedOrders = SEED_ORDERS_FILE.orders.map((seed) =>
  priceSeedOrder(seed, MENU_FIXTURE)
);

describe("Sales stats engine against seed orders", () => {
  it("counts all 6 seed orders and computes each order payable and total revenue", () => {
    expect(getOrderCount(seedOrders)).toEqual({ totalOrders: 6 });

    const byId = Object.fromEntries(
      seedOrders.map((o) => [o.id, o.pricing.payableBdt])
    );
    // ORD-1001: A x1 (380), 09:15 MORNING15 (-57) => 323 * 1.05 = 339.15 => 339
    expect(byId["ORD-1001"]).toBe(339);
    // ORD-1002: B x1 (679.50), 12:40 no promo => 679.50 * 1.05 = 713.475 -> 713.48 => 713
    expect(byId["ORD-1002"]).toBe(713);
    // ORD-1003: C x2 + A x1 = 980 + 380 = 1360, 10:05 MORNING15 (-150) => 1210 * 1.05 = 1270.50 => 1271
    expect(byId["ORD-1003"]).toBe(1271);
    // ORD-1004: Toast + Omelette x2 (140) + Bacon (90) + Hashbrown(40) + Beans(25) + Mushroom(30) => 250+325=575, P2 (-25)=550, P1=0, 19:30 no promo => 550 * 1.05 = 577.50 => 578
    expect(byId["ORD-1004"]).toBe(578);
    // ORD-1005: (250+20+70+120+25=485)*2 = 970, 08:50 MORNING15 (-145.50) => 824.50 * 1.05 = 865.725 -> 865.73 => 866
    expect(byId["ORD-1005"]).toBe(866);
    // ORD-1006: B (679.50) + (250+60+60+50+70=490) = 1169.50 (<1200 so C1=0), 13:10 MORNING15 rejected => 1169.50 * 1.05 = 1227.975 -> 1227.98 => 1228
    expect(byId["ORD-1006"]).toBe(1228);

    const revenue = getTotalRevenue(seedOrders);
    expect(revenue.totalRevenueBdt).toBe(339 + 713 + 1271 + 578 + 866 + 1228);
    expect(revenue.totalRevenuePoisha).toBe(revenue.totalRevenueBdt * 100);
  });

  it("finds best-selling option by total units (line qty x option qty)", () => {
    const top = getBestSellingOption(seedOrders, MENU_FIXTURE, 3);
    // fried: ORD-1002(2) + ORD-1003(2*2=4) + ORD-1006(2+2=4) = 10
    // scrambled: ORD-1001(2) + ORD-1003(2) + ORD-1005(2*2=4) = 8
    expect(top.items[0]).toEqual({
      optionId: "fried",
      optionName: "Fried",
      totalUnits: 10,
    });
  });

  it("computes revenue by payment method and average order value", () => {
    const byPayment = getRevenueByPaymentMethod(seedOrders);
    const card = byPayment.breakdown.find((b) => b.paymentMethod === "card")!;
    const bkash = byPayment.breakdown.find((b) => b.paymentMethod === "bkash")!;
    const cash = byPayment.breakdown.find((b) => b.paymentMethod === "cash")!;

    expect(card).toEqual({
      paymentMethod: "card",
      orderCount: 3,
      revenuePoisha: (339 + 578 + 1228) * 100,
      revenueBdt: 2145,
    });
    expect(bkash).toEqual({
      paymentMethod: "bkash",
      orderCount: 2,
      revenuePoisha: (713 + 866) * 100,
      revenueBdt: 1579,
    });
    expect(cash).toEqual({
      paymentMethod: "cash",
      orderCount: 1,
      revenuePoisha: 127100,
      revenueBdt: 1271,
    });

    const aov = getAverageOrderValue(seedOrders);
    expect(aov.orderCount).toBe(6);
    expect(aov.averageOrderValuePoisha).toBe(Math.round(499500 / 6));
    expect(aov.averageOrderValueBdt).toBe(832.5);
  });

  it("counts MORNING15 coupon usage vs rejected entries", () => {
    // Entered in ORD-1001 (applied), ORD-1003 (applied), ORD-1005 (applied), ORD-1006 (rejected: 13:10)
    expect(getCouponUsageStats(seedOrders, "MORNING15")).toEqual({
      code: "MORNING15",
      appliedCount: 3,
      rejectedCount: 1,
      totalEnteredCount: 4,
    });
  });

  it("filters orders by Asia/Dhaka date", () => {
    expect(getOrdersByDate(seedOrders, "2026-11-20")).toEqual({
      date: "2026-11-20",
      orderCount: 2,
      totalRevenuePoisha: (339 + 713) * 100,
      totalRevenueBdt: 1052,
      orderIds: ["ORD-1001", "ORD-1002"],
    });
    expect(getOrdersByDate(seedOrders, "2026-11-22").orderIds).toEqual([
      "ORD-1005",
      "ORD-1006",
    ]);
  });
});
