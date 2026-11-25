import { priceCart, priceSeedOrder } from "@/engine/pricing";
import { validate } from "@/engine/rules";
import {
  checkStockAvailability,
  computeLineIngredients,
  computeRemainingStock,
} from "@/engine/stock";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import { SEED_ORDERS_FILE } from "@/mocks/seedOrders";
import type {
  CartItem,
  CartState,
  ConfigSelections,
  MenuFixture,
  Order,
  PaymentMethod,
} from "@/types/order";

export const SERVER_STORAGE_KEY = "smart_order_builder_server_v1";
export const RESERVATION_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_SERVER_CLOCK_OFFSET_MS = 90 * 1000;

interface PersistedServerState {
  menu: MenuFixture;
  cart: CartState;
  soldByIngredient: Record<string, number>;
  orders: Order[];
  nextOrderSeq: number;
  idempotencyCartItems: Record<string, CartItem>;
  idempotencyCheckouts: Record<string, Order>;
}

export interface ServerBehaviorConfig {
  clockOffsetMs: number;
  priceLatencyMinMs: number;
  priceLatencyMaxMs: number;
  priceFailureRate: number;
  nextReserveShouldFail: boolean;
  randomFn: () => number;
}

const defaultBehavior: ServerBehaviorConfig = {
  clockOffsetMs: DEFAULT_SERVER_CLOCK_OFFSET_MS,
  priceLatencyMinMs: 200,
  priceLatencyMaxMs: 1500,
  priceFailureRate: 0.15,
  nextReserveShouldFail: false,
  randomFn: () => Math.random(),
};

let behavior: ServerBehaviorConfig = { ...defaultBehavior };
let memoryState: PersistedServerState | null = null;
let itemSeq = 1;

function cloneMenu(menu: MenuFixture): MenuFixture {
  return JSON.parse(JSON.stringify(menu)) as MenuFixture;
}

function createInitialState(menu: MenuFixture = MENU_FIXTURE): PersistedServerState {
  const seededOrders = SEED_ORDERS_FILE.orders.map((seed) =>
    priceSeedOrder(seed, menu)
  );
  return {
    menu: cloneMenu(menu),
    cart: {
      items: [],
      couponCode: null,
      version: 1,
    },
    soldByIngredient: {},
    orders: seededOrders,
    nextOrderSeq: 1007,
    idempotencyCartItems: {},
    idempotencyCheckouts: {},
  };
}

function readStorage(): PersistedServerState | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SERVER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as PersistedServerState;
  } catch {
    return null;
  }
}

function writeStorage(state: PersistedServerState): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in mock environment
  }
}

function getState(): PersistedServerState {
  const fromStorage = readStorage();
  if (fromStorage) {
    memoryState = fromStorage;
    return fromStorage;
  }
  if (!memoryState) {
    memoryState = createInitialState();
    writeStorage(memoryState);
  }
  return memoryState;
}

function saveState(state: PersistedServerState): void {
  memoryState = state;
  writeStorage(state);
}

export function getServerNowMs(): number {
  return Date.now() + behavior.clockOffsetMs;
}

export function getServerNowIso(): string {
  return new Date(getServerNowMs()).toISOString();
}

export function configureMockServerBehavior(
  partial: Partial<ServerBehaviorConfig>
): void {
  behavior = { ...behavior, ...partial };
}

export function resetMockServerState(options?: {
  menu?: MenuFixture;
  keepBehavior?: boolean;
}): void {
  if (!options?.keepBehavior) {
    behavior = { ...defaultBehavior };
  }
  const initial = createInitialState(options?.menu ?? MENU_FIXTURE);
  itemSeq = 1;
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(SERVER_STORAGE_KEY);
  }
  saveState(initial);
}

export function sweepExpiredReservations(state: PersistedServerState): boolean {
  const nowMs = getServerNowMs();
  let changed = false;
  for (const item of state.cart.items) {
    if (item.status === "active" && Date.parse(item.expiresAt) <= nowMs) {
      item.status = "expired";
      changed = true;
    }
  }
  if (changed) {
    state.cart.version += 1;
    saveState(state);
  }
  return changed;
}

export function getRemainingStockSnapshot(state: PersistedServerState) {
  return computeRemainingStock(
    state.menu.ingredients,
    state.soldByIngredient,
    state.cart.items,
    state.menu.groups
  );
}

export function getActiveCartPricing(state: PersistedServerState) {
  const activeItems = state.cart.items.filter((i) => i.status === "active");
  return priceCart(
    { items: activeItems, couponCode: state.cart.couponCode },
    state.menu,
    state.menu.promos,
    getServerNowIso()
  );
}

export function getMockServerBehavior(): ServerBehaviorConfig {
  return behavior;
}

export function handleGetMenu() {
  const state = getState();
  sweepExpiredReservations(state);
  return {
    status: 200,
    body: {
      menu: state.menu,
      cart: state.cart,
      remainingStock: getRemainingStockSnapshot(state),
      soldByIngredient: state.soldByIngredient,
      pricing: getActiveCartPricing(state),
      serverTime: getServerNowIso(),
    },
  };
}

export function handleGetCart() {
  const state = getState();
  sweepExpiredReservations(state);
  return {
    status: 200,
    body: {
      cart: state.cart,
      remainingStock: getRemainingStockSnapshot(state),
      pricing: getActiveCartPricing(state),
      serverTime: getServerNowIso(),
    },
  };
}

export function handlePricePreview(input: {
  items: Array<{ id?: string; quantity: number; selections: ConfigSelections }>;
  couponCode?: string | null;
}) {
  const state = getState();
  sweepExpiredReservations(state);
  const serverTime = getServerNowIso();
  const pricing = priceCart(input, state.menu, state.menu.promos, serverTime);
  return {
    status: 200,
    body: {
      pricing,
      serverTime,
    },
  };
}

export function handleAddCartItem(input: {
  idempotencyKey: string;
  selections: ConfigSelections;
  quantity: number;
  expectedVersion?: number;
}) {
  const state = getState();
  sweepExpiredReservations(state);
  const serverTime = getServerNowIso();

  if (input.idempotencyKey && state.idempotencyCartItems[input.idempotencyKey]) {
    const existingItem = state.idempotencyCartItems[input.idempotencyKey];
    return {
      status: 200,
      body: {
        item: existingItem,
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        pricing: getActiveCartPricing(state),
        serverTime,
      },
    };
  }

  if (
    input.expectedVersion !== undefined &&
    input.expectedVersion !== state.cart.version
  ) {
    return {
      status: 409,
      body: {
        code: "VERSION_CONFLICT",
        error: "Cart changed in another tab. Reloading latest state.",
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        pricing: getActiveCartPricing(state),
        serverTime,
      },
    };
  }

  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > state.menu.maxItemQuantity
  ) {
    return {
      status: 422,
      body: {
        code: "INVALID_QUANTITY",
        error: `Quantity must be between 1 and ${state.menu.maxItemQuantity}`,
        serverTime,
      },
    };
  }

  const violations = validate(
    input.selections,
    state.menu.groups,
    state.menu.rules
  );
  if (violations.length > 0) {
    return {
      status: 422,
      body: {
        code: "VALIDATION_ERROR",
        violations,
        error: violations.map((v) => v.message).join("; "),
        serverTime,
      },
    };
  }

  if (behavior.nextReserveShouldFail) {
    behavior.nextReserveShouldFail = false;
    return {
      status: 500,
      body: {
        code: "RESERVE_FAILED",
        error: "Reservation failed mid-way. No stock was held.",
        serverTime,
      },
    };
  }

  const stockCheck = checkStockAvailability(
    input.selections,
    input.quantity,
    state.menu,
    state.soldByIngredient,
    state.cart.items
  );
  if (!stockCheck.ok) {
    return {
      status: 409,
      body: {
        code: "INSUFFICIENT_STOCK",
        error: stockCheck.message ?? "Insufficient ingredient stock",
        shortages: stockCheck.shortages,
        remainingStock: stockCheck.availableByIngredient,
        serverTime,
      },
    };
  }

  const nowMs = getServerNowMs();
  const newItem: CartItem = {
    id: `cart-item-${Date.now()}-${itemSeq++}`,
    productId: state.menu.productId,
    quantity: input.quantity,
    selections: { ...input.selections },
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + RESERVATION_TTL_MS).toISOString(),
    status: "active",
  };

  state.cart.items.push(newItem);
  state.cart.version += 1;
  if (input.idempotencyKey) {
    state.idempotencyCartItems[input.idempotencyKey] = newItem;
  }
  saveState(state);

  return {
    status: 201,
    body: {
      item: newItem,
      cart: state.cart,
      remainingStock: getRemainingStockSnapshot(state),
      pricing: getActiveCartPricing(state),
      serverTime: new Date(nowMs).toISOString(),
    },
  };
}

export function handleUpdateCartItem(
  itemId: string,
  input: {
    selections: ConfigSelections;
    quantity: number;
    expectedVersion?: number;
  }
) {
  const state = getState();
  sweepExpiredReservations(state);
  const serverTime = getServerNowIso();

  const item = state.cart.items.find((i) => i.id === itemId);
  if (!item) {
    return {
      status: 404,
      body: {
        code: "NOT_FOUND",
        error: "Cart item not found.",
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        serverTime,
      },
    };
  }

  if (
    input.expectedVersion !== undefined &&
    input.expectedVersion !== state.cart.version
  ) {
    return {
      status: 409,
      body: {
        code: "VERSION_CONFLICT",
        error: "Cart changed in another tab. Reloading latest state.",
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        pricing: getActiveCartPricing(state),
        serverTime,
      },
    };
  }

  if (item.status === "expired") {
    return {
      status: 410,
      body: {
        code: "RESERVATION_EXPIRED",
        error: "Reservation expired while editing. Stock was released.",
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        pricing: getActiveCartPricing(state),
        serverTime,
      },
    };
  }

  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > state.menu.maxItemQuantity
  ) {
    return {
      status: 422,
      body: {
        code: "INVALID_QUANTITY",
        error: `Quantity must be between 1 and ${state.menu.maxItemQuantity}`,
        serverTime,
      },
    };
  }

  const violations = validate(
    input.selections,
    state.menu.groups,
    state.menu.rules
  );
  if (violations.length > 0) {
    return {
      status: 422,
      body: {
        code: "VALIDATION_ERROR",
        violations,
        error: violations.map((v) => v.message).join("; "),
        serverTime,
      },
    };
  }

  const stockCheck = checkStockAvailability(
    input.selections,
    input.quantity,
    state.menu,
    state.soldByIngredient,
    state.cart.items,
    item.id
  );
  if (!stockCheck.ok) {
    return {
      status: 409,
      body: {
        code: "INSUFFICIENT_STOCK",
        error: stockCheck.message ?? "Insufficient ingredient stock",
        shortages: stockCheck.shortages,
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        pricing: getActiveCartPricing(state),
        serverTime,
      },
    };
  }

  item.selections = { ...input.selections };
  item.quantity = input.quantity;
  state.cart.version += 1;
  saveState(state);

  return {
    status: 200,
    body: {
      item,
      cart: state.cart,
      remainingStock: getRemainingStockSnapshot(state),
      pricing: getActiveCartPricing(state),
      serverTime,
    },
  };
}

export function handleDeleteCartItem(
  itemId: string,
  expectedVersion?: number
) {
  const state = getState();
  sweepExpiredReservations(state);
  const serverTime = getServerNowIso();

  if (
    expectedVersion !== undefined &&
    expectedVersion !== state.cart.version
  ) {
    return {
      status: 409,
      body: {
        code: "VERSION_CONFLICT",
        error: "Cart changed in another tab. Reloading latest state.",
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        pricing: getActiveCartPricing(state),
        serverTime,
      },
    };
  }

  const index = state.cart.items.findIndex((i) => i.id === itemId);
  if (index === -1) {
    return {
      status: 404,
      body: {
        code: "NOT_FOUND",
        error: "Cart item not found.",
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        serverTime,
      },
    };
  }

  state.cart.items.splice(index, 1);
  state.cart.version += 1;
  saveState(state);

  return {
    status: 200,
    body: {
      cart: state.cart,
      remainingStock: getRemainingStockSnapshot(state),
      pricing: getActiveCartPricing(state),
      serverTime,
    },
  };
}

export function handleSetCoupon(input: {
  couponCode: string | null;
  expectedVersion?: number;
}) {
  const state = getState();
  sweepExpiredReservations(state);
  const serverTime = getServerNowIso();

  if (
    input.expectedVersion !== undefined &&
    input.expectedVersion !== state.cart.version
  ) {
    return {
      status: 409,
      body: {
        code: "VERSION_CONFLICT",
        error: "Cart changed in another tab. Reloading latest state.",
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        pricing: getActiveCartPricing(state),
        serverTime,
      },
    };
  }

  state.cart.couponCode = input.couponCode?.trim() || null;
  state.cart.version += 1;
  saveState(state);

  return {
    status: 200,
    body: {
      cart: state.cart,
      remainingStock: getRemainingStockSnapshot(state),
      pricing: getActiveCartPricing(state),
      serverTime,
    },
  };
}

export function handleCheckout(input: {
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  couponCode?: string | null;
  expectedVersion?: number;
}) {
  const state = getState();
  sweepExpiredReservations(state);
  const serverTime = getServerNowIso();

  if (input.idempotencyKey && state.idempotencyCheckouts[input.idempotencyKey]) {
    return {
      status: 200,
      body: {
        order: state.idempotencyCheckouts[input.idempotencyKey],
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        orders: state.orders,
        serverTime,
      },
    };
  }

  if (
    input.expectedVersion !== undefined &&
    input.expectedVersion !== state.cart.version
  ) {
    return {
      status: 409,
      body: {
        code: "VERSION_CONFLICT",
        error: "Cart changed in another tab. Reloading latest state.",
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        pricing: getActiveCartPricing(state),
        serverTime,
      },
    };
  }

  const activeItems = state.cart.items.filter((i) => i.status === "active");
  if (activeItems.length === 0) {
    return {
      status: 400,
      body: {
        code: "EMPTY_CART",
        error: "No active items in cart to checkout.",
        cart: state.cart,
        remainingStock: getRemainingStockSnapshot(state),
        serverTime,
      },
    };
  }

  const couponCode =
    input.couponCode !== undefined ? input.couponCode : state.cart.couponCode;
  const pricingResult = priceCart(
    { items: activeItems, couponCode },
    state.menu,
    state.menu.promos,
    serverTime
  );

  // Convert active reserved stock into sold stock atomically
  for (const item of activeItems) {
    const usage = computeLineIngredients(
      item.selections,
      item.quantity,
      state.menu.groups
    );
    for (const [ingredientId, amount] of Object.entries(usage)) {
      state.soldByIngredient[ingredientId] =
        (state.soldByIngredient[ingredientId] ?? 0) + amount;
    }
  }

  const newOrder: Order = {
    id: `ORD-${state.nextOrderSeq++}`,
    createdAt: serverTime,
    paymentMethod: input.paymentMethod,
    moneyUnit: "poisha",
    items: pricingResult.items,
    coupon: pricingResult.coupon,
    pricing: pricingResult.pricing,
  };

  state.orders.push(newOrder);
  state.cart.items = [];
  state.cart.couponCode = null;
  state.cart.version += 1;

  if (input.idempotencyKey) {
    state.idempotencyCheckouts[input.idempotencyKey] = newOrder;
  }
  saveState(state);

  return {
    status: 201,
    body: {
      order: newOrder,
      cart: state.cart,
      remainingStock: getRemainingStockSnapshot(state),
      orders: state.orders,
      serverTime,
    },
  };
}

export function handleGetOrders() {
  const state = getState();
  sweepExpiredReservations(state);
  return {
    status: 200,
    body: {
      orders: state.orders,
      serverTime: getServerNowIso(),
    },
  };
}
