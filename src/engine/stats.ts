import type { MenuFixture, MenuOption, Order, PaymentMethod } from "@/types/order";
import { getDhakaTimeParts } from "./pricing";

export interface OrderCountResult {
  totalOrders: number;
}

export interface TotalRevenueResult {
  totalRevenuePoisha: number;
  totalRevenueBdt: number;
}

export interface OptionSalesItem {
  optionId: string;
  optionName: string;
  totalUnits: number;
}

export interface BestSellingOptionResult {
  items: OptionSalesItem[];
}

export interface PaymentMethodBreakdownItem {
  paymentMethod: PaymentMethod;
  orderCount: number;
  revenuePoisha: number;
  revenueBdt: number;
}

export interface RevenueByPaymentMethodResult {
  breakdown: PaymentMethodBreakdownItem[];
}

export interface AverageOrderValueResult {
  orderCount: number;
  averageOrderValuePoisha: number;
  averageOrderValueBdt: number;
}

export interface CouponUsageStatsResult {
  code: string;
  appliedCount: number;
  rejectedCount: number;
  totalEnteredCount: number;
}

export interface OrdersByDateResult {
  date: string;
  orderCount: number;
  totalRevenuePoisha: number;
  totalRevenueBdt: number;
  orderIds: string[];
}

function buildOptionLookup(menu: MenuFixture): Map<string, MenuOption> {
  const lookup = new Map<string, MenuOption>();
  for (const group of menu.groups) {
    for (const option of group.options) {
      lookup.set(option.id, option);
    }
  }
  return lookup;
}

export function getOrderCount(orders: Order[]): OrderCountResult {
  return { totalOrders: orders.length };
}

export function getTotalRevenue(orders: Order[]): TotalRevenueResult {
  const totalRevenuePoisha = orders.reduce(
    (sum, order) => sum + order.pricing.payablePoisha,
    0
  );
  return {
    totalRevenuePoisha,
    totalRevenueBdt: totalRevenuePoisha / 100,
  };
}

export function getBestSellingOption(
  orders: Order[],
  menu: MenuFixture,
  limit = 1
): BestSellingOptionResult {
  const optionLookup = buildOptionLookup(menu);
  const unitCounts = new Map<string, number>();

  for (const order of orders) {
    for (const line of order.items) {
      for (const [optionId, qty] of Object.entries(line.selections)) {
        if (qty <= 0) {
          continue;
        }
        unitCounts.set(
          optionId,
          (unitCounts.get(optionId) ?? 0) + line.quantity * qty
        );
      }
    }
  }

  const sorted: OptionSalesItem[] = Array.from(unitCounts.entries())
    .map(([optionId, totalUnits]) => ({
      optionId,
      optionName: optionLookup.get(optionId)?.name ?? optionId,
      totalUnits,
    }))
    .sort((a, b) => {
      if (b.totalUnits !== a.totalUnits) {
        return b.totalUnits - a.totalUnits;
      }
      return a.optionId.localeCompare(b.optionId);
    });

  const safeLimit = Math.max(1, limit);
  return {
    items: sorted.slice(0, safeLimit),
  };
}

export function getRevenueByPaymentMethod(
  orders: Order[]
): RevenueByPaymentMethodResult {
  const methods: PaymentMethod[] = ["card", "bkash", "cash"];
  const statsMap = new Map<PaymentMethod, { orderCount: number; revenuePoisha: number }>();

  for (const method of methods) {
    statsMap.set(method, { orderCount: 0, revenuePoisha: 0 });
  }

  for (const order of orders) {
    const entry = statsMap.get(order.paymentMethod) ?? {
      orderCount: 0,
      revenuePoisha: 0,
    };
    entry.orderCount += 1;
    entry.revenuePoisha += order.pricing.payablePoisha;
    statsMap.set(order.paymentMethod, entry);
  }

  const breakdown: PaymentMethodBreakdownItem[] = methods.map((method) => {
    const entry = statsMap.get(method)!;
    return {
      paymentMethod: method,
      orderCount: entry.orderCount,
      revenuePoisha: entry.revenuePoisha,
      revenueBdt: entry.revenuePoisha / 100,
    };
  });

  return { breakdown };
}

export function getAverageOrderValue(orders: Order[]): AverageOrderValueResult {
  if (orders.length === 0) {
    return {
      orderCount: 0,
      averageOrderValuePoisha: 0,
      averageOrderValueBdt: 0,
    };
  }
  const totalRevenuePoisha = orders.reduce(
    (sum, order) => sum + order.pricing.payablePoisha,
    0
  );
  const averageOrderValuePoisha = Math.round(totalRevenuePoisha / orders.length);
  return {
    orderCount: orders.length,
    averageOrderValuePoisha,
    averageOrderValueBdt: Number((averageOrderValuePoisha / 100).toFixed(2)),
  };
}

export function getCouponUsageStats(
  orders: Order[],
  code = "MORNING15"
): CouponUsageStatsResult {
  const targetCode = code.trim().toUpperCase();
  let appliedCount = 0;
  let rejectedCount = 0;

  for (const order of orders) {
    if (order.coupon.code?.toUpperCase() !== targetCode) {
      continue;
    }
    if (order.coupon.status === "applied") {
      appliedCount += 1;
    } else if (order.coupon.status === "rejected") {
      rejectedCount += 1;
    }
  }

  return {
    code: targetCode,
    appliedCount,
    rejectedCount,
    totalEnteredCount: appliedCount + rejectedCount,
  };
}

export function getOrdersByDate(
  orders: Order[],
  date: string
): OrdersByDateResult {
  const targetDate = date.trim();
  const matching = orders.filter(
    (order) => getDhakaTimeParts(order.createdAt).date === targetDate
  );

  const totalRevenuePoisha = matching.reduce(
    (sum, order) => sum + order.pricing.payablePoisha,
    0
  );

  return {
    date: targetDate,
    orderCount: matching.length,
    totalRevenuePoisha,
    totalRevenueBdt: totalRevenuePoisha / 100,
    orderIds: matching.map((order) => order.id),
  };
}
