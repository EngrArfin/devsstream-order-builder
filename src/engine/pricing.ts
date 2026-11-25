import type {
  CartPromo,
  ConfigSelections,
  CouponCartPromo,
  MenuFixture,
  MenuOption,
  Order,
  OrderCouponInfo,
  OrderPricingSummary,
  PricedOrderLine,
  PricingCartInput,
  PromoConfig,
  SeedOrder,
  ThresholdCartPromo,
} from "@/types/order";
import { roundHalfUpPercent, roundHalfUpToWholeBdt } from "@/utils/currency";

export interface CartPricingResult {
  items: PricedOrderLine[];
  coupon: OrderCouponInfo;
  pricing: OrderPricingSummary;
  evaluations: {
    c1DiscountPoisha: number;
    c2DiscountPoisha: number;
    dhakaTime: string;
  };
}

function buildOptionMap(menu: MenuFixture): {
  optionById: Map<string, MenuOption>;
  groupIdByOptionId: Map<string, string>;
} {
  const optionById = new Map<string, MenuOption>();
  const groupIdByOptionId = new Map<string, string>();

  for (const group of menu.groups) {
    for (const option of group.options) {
      optionById.set(option.id, option);
      groupIdByOptionId.set(option.id, group.id);
    }
  }

  return { optionById, groupIdByOptionId };
}

export function getDhakaTimeParts(isoOrDate: string | Date): {
  date: string;
  hour: number;
  minute: number;
  second: number;
  timeString: string;
} {
  const dateObj = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(dateObj);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hourStr = getPart("hour");
  const minuteStr = getPart("minute");
  const secondStr = getPart("second");

  return {
    date: `${year}-${month}-${day}`,
    hour: Number(hourStr),
    minute: Number(minuteStr),
    second: Number(secondStr),
    timeString: `${hourStr}:${minuteStr}:${secondStr}`,
  };
}

function priceUnitSelections(
  selections: ConfigSelections,
  quantity: number,
  menu: MenuFixture,
  promos: PromoConfig,
  optionById: Map<string, MenuOption>,
  groupIdByOptionId: Map<string, string>
): PricedOrderLine {
  let optionsSubtotalPoisha = 0;
  const groupUnits: Record<string, number> = {};
  const groupUnitPrices: Record<string, number[]> = {};

  for (const [optionId, rawQty] of Object.entries(selections)) {
    const qty = Math.max(0, rawQty);
    if (qty === 0) {
      continue;
    }
    const option = optionById.get(optionId);
    if (!option) {
      continue;
    }
    const groupId = groupIdByOptionId.get(optionId) ?? "";
    optionsSubtotalPoisha += option.pricePoisha * qty;
    groupUnits[groupId] = (groupUnits[groupId] ?? 0) + qty;
    if (!groupUnitPrices[groupId]) {
      groupUnitPrices[groupId] = [];
    }
    for (let i = 0; i < qty; i += 1) {
      groupUnitPrices[groupId].push(option.pricePoisha);
    }
  }

  // Step 1: Unit subtotal
  const unitSubtotalPoisha = menu.basePricePoisha + optionsSubtotalPoisha;

  // Step 2: Extras deal (buy X get cheapest free)
  let extrasDiscountPoisha = 0;
  for (const promo of promos.unitPromos) {
    if (promo.type !== "buyXGetCheapestFree" || promo.everyUnits <= 0) {
      continue;
    }
    const prices = [...(groupUnitPrices[promo.groupId] ?? [])].sort(
      (a, b) => a - b
    );
    const freeCount = Math.floor(prices.length / promo.everyUnits);
    for (let i = 0; i < freeCount; i += 1) {
      extrasDiscountPoisha += prices[i];
    }
  }
  const afterExtrasPoisha = unitSubtotalPoisha - extrasDiscountPoisha;

  // Step 3: Combo discount (% off Step 2 amount)
  let comboDiscountPoisha = 0;
  for (const promo of promos.unitPromos) {
    if (promo.type !== "groupComboPercent") {
      continue;
    }
    const qualifies = promo.conditions.every(
      (cond) => (groupUnits[cond.groupId] ?? 0) >= cond.minUnits
    );
    if (qualifies) {
      comboDiscountPoisha += roundHalfUpPercent(
        afterExtrasPoisha,
        promo.percentOff
      );
    }
  }

  const unitPricePoisha = Math.max(0, afterExtrasPoisha - comboDiscountPoisha);
  const lineTotalPoisha = unitPricePoisha * quantity;

  return {
    productId: menu.productId,
    productName: menu.productName,
    quantity,
    selections: { ...selections },
    unitSubtotalPoisha,
    extrasDiscountPoisha,
    comboDiscountPoisha,
    unitPricePoisha,
    lineTotalPoisha,
  };
}

function evaluateCartPromo(
  promo: CartPromo,
  subtotalPoisha: number,
  enteredCode: string | null,
  dhakaHour: number
): { discountPoisha: number; rejectionReason: string | null } {
  if (promo.type === "cartThresholdFixed") {
    const thresholdPromo: ThresholdCartPromo = promo;
    const discount =
      subtotalPoisha >= thresholdPromo.minSubtotalPoisha
        ? thresholdPromo.discountPoisha
        : 0;
    return { discountPoisha: discount, rejectionReason: null };
  }

  const couponPromo: CouponCartPromo = promo;
  if (!enteredCode) {
    return { discountPoisha: 0, rejectionReason: null };
  }
  if (enteredCode !== couponPromo.code.toUpperCase()) {
    return { discountPoisha: 0, rejectionReason: "Invalid coupon code" };
  }
  if (dhakaHour >= couponPromo.beforeHourDhaka) {
    return {
      discountPoisha: 0,
      rejectionReason: `Valid only before ${String(couponPromo.beforeHourDhaka).padStart(2, "0")}:00 (Asia/Dhaka)`,
    };
  }
  const raw = roundHalfUpPercent(subtotalPoisha, couponPromo.percentOff);
  return {
    discountPoisha: Math.min(raw, couponPromo.maxDiscountPoisha),
    rejectionReason: null,
  };
}

export function priceCart(
  cart: PricingCartInput,
  menu: MenuFixture,
  promos: PromoConfig = menu.promos,
  serverTime: string | Date = new Date()
): CartPricingResult {
  const { optionById, groupIdByOptionId } = buildOptionMap(menu);

  // Steps 1-4: Price each item and sum cart subtotal
  const pricedItems = cart.items.map((item) =>
    priceUnitSelections(
      item.selections,
      item.quantity,
      menu,
      promos,
      optionById,
      groupIdByOptionId
    )
  );
  const subtotalPoisha = pricedItems.reduce(
    (sum, item) => sum + item.lineTotalPoisha,
    0
  );

  const normalizedCoupon = cart.couponCode?.trim()
    ? cart.couponCode.trim().toUpperCase()
    : null;
  const dhaka = getDhakaTimeParts(serverTime);

  // Step 5: Pick the larger cart discount; on tie prefer threshold promo (C1)
  let bestPromo: CartPromo | null = null;
  let bestDiscountPoisha = 0;
  let c1DiscountPoisha = 0;
  let c2DiscountPoisha = 0;
  let couponTimeOrCodeRejection: string | null = null;

  const sortedPromos = [...promos.cartPromos].sort((a, b) => {
    if (a.type === b.type) {
      return 0;
    }
    return a.type === "cartThresholdFixed" ? -1 : 1;
  });

  for (const promo of sortedPromos) {
    const { discountPoisha, rejectionReason } = evaluateCartPromo(
      promo,
      subtotalPoisha,
      normalizedCoupon,
      dhaka.hour
    );

    if (promo.type === "cartThresholdFixed") {
      c1DiscountPoisha = Math.max(c1DiscountPoisha, discountPoisha);
    } else {
      c2DiscountPoisha = Math.max(c2DiscountPoisha, discountPoisha);
      if (rejectionReason) {
        couponTimeOrCodeRejection = rejectionReason;
      }
    }

    if (discountPoisha > bestDiscountPoisha) {
      bestDiscountPoisha = discountPoisha;
      bestPromo = promo;
    }
  }

  let coupon: OrderCouponInfo;
  if (!normalizedCoupon) {
    coupon = { code: null, status: "none", reason: null };
  } else if (
    bestPromo?.type === "cartCouponPercent" &&
    bestPromo.code.toUpperCase() === normalizedCoupon &&
    bestDiscountPoisha > 0
  ) {
    coupon = { code: normalizedCoupon, status: "applied", reason: null };
  } else if (couponTimeOrCodeRejection) {
    coupon = {
      code: normalizedCoupon,
      status: "rejected",
      reason: couponTimeOrCodeRejection,
    };
  } else {
    const knownCouponPromo = promos.cartPromos.find(
      (p): p is CouponCartPromo =>
        p.type === "cartCouponPercent" &&
        p.code.toUpperCase() === normalizedCoupon
    );
    coupon = {
      code: normalizedCoupon,
      status: "rejected",
      reason: knownCouponPromo
        ? `${bestPromo?.id ?? "Another"} discount provided equal or greater savings`
        : "Invalid coupon code",
    };
  }

  // Step 6: VAT and whole-BDT payable rounding
  const discountedSubtotalPoisha = Math.max(
    0,
    subtotalPoisha - bestDiscountPoisha
  );
  const vatPoisha = roundHalfUpPercent(
    discountedSubtotalPoisha,
    promos.vatPercent
  );
  const payableBeforeRoundPoisha = discountedSubtotalPoisha + vatPoisha;
  const payableBdt = roundHalfUpToWholeBdt(payableBeforeRoundPoisha);
  const payablePoisha = payableBdt * 100;

  return {
    items: pricedItems,
    coupon,
    pricing: {
      subtotalPoisha,
      appliedPromoId: bestDiscountPoisha > 0 ? (bestPromo?.id ?? null) : null,
      cartDiscountPoisha: bestDiscountPoisha,
      discountedSubtotalPoisha,
      vatPoisha,
      payablePoisha,
      payableBdt,
    },
    evaluations: {
      c1DiscountPoisha,
      c2DiscountPoisha,
      dhakaTime: dhaka.timeString,
    },
  };
}

export function priceSeedOrder(seedOrder: SeedOrder, menu: MenuFixture): Order {
  const result = priceCart(
    {
      items: seedOrder.lines.map((line) => ({
        quantity: line.qty,
        selections: line.options,
      })),
      couponCode: seedOrder.couponCode,
    },
    menu,
    menu.promos,
    seedOrder.createdAt
  );

  return {
    id: seedOrder.id,
    createdAt: seedOrder.createdAt,
    paymentMethod: seedOrder.paymentMethod,
    moneyUnit: "poisha",
    items: result.items,
    coupon: result.coupon,
    pricing: result.pricing,
  };
}
