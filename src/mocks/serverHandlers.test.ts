import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { server } from "./server";
import {
  configureMockServerBehavior,
  resetMockServerState,
} from "./serverState";

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

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => {
  resetMockServerState();
  configureMockServerBehavior({
    priceLatencyMinMs: 0,
    priceLatencyMaxMs: 0,
    priceFailureRate: 0,
  });
});
afterEach(() => server.resetHandlers());

describe("MSW mock API handlers (Parts D & E)", () => {
  it("serves serverTime 90 seconds ahead of browser clock and 6 priced seed orders", async () => {
    const beforeMs = Date.now();
    const res = await fetch("/api/menu");
    const data = await res.json();
    const afterMs = Date.now();

    const serverMs = Date.parse(data.serverTime);
    expect(serverMs - afterMs).toBeGreaterThanOrEqual(89_000);
    expect(serverMs - beforeMs).toBeLessThanOrEqual(91_000);

    const ordersRes = await fetch("/api/orders");
    const ordersData = await ordersRes.json();
    expect(ordersData.orders).toHaveLength(6);
    expect(ordersData.orders[0].pricing.payableBdt).toBe(339);
  });

  it("TC-13: clicking Add to Cart 3 times with same idempotencyKey creates exactly one cart item", async () => {
    const payload = {
      idempotencyKey: "add-key-1",
      selections: configA,
      quantity: 1,
    };

    const [r1, r2, r3] = await Promise.all([
      fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);

    const cartRes = await fetch("/api/cart");
    const cartData = await cartRes.json();
    expect(cartData.cart.items).toHaveLength(1);
    expect(cartData.remainingStock.egg).toBe(8);
  });

  it("TC-14: failed reserve leaves no phantom stock held and Retry works", async () => {
    configureMockServerBehavior({ nextReserveShouldFail: true });

    const failRes = await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "retry-key-1",
        selections: configB,
        quantity: 1,
      }),
    });
    expect(failRes.status).toBe(500);

    const cartAfterFail = await (await fetch("/api/cart")).json();
    expect(cartAfterFail.cart.items).toHaveLength(0);
    expect(cartAfterFail.remainingStock.egg).toBe(10);

    const retryRes = await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "retry-key-1",
        selections: configB,
        quantity: 1,
      }),
    });
    expect(retryRes.status).toBe(201);
    const retryData = await retryRes.json();
    expect(retryData.cart.items).toHaveLength(1);
    expect(retryData.remainingStock.egg).toBe(4);
  });

  it("TC-15: reservation expires after 5:00 server time, releasing stock and blocking edits", async () => {
    const addRes = await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "exp-key-1",
        selections: configA,
        quantity: 1,
      }),
    });
    const added = await addRes.json();
    const itemId = added.item.id;
    expect(added.remainingStock.egg).toBe(8);

    // Advance server clock by 5 minutes + 1 second (from +90s to +391s)
    configureMockServerBehavior({
      clockOffsetMs: 90_000 + 5 * 60 * 1000 + 1000,
    });

    const cartData = await (await fetch("/api/cart")).json();
    expect(cartData.cart.items[0].status).toBe("expired");
    expect(cartData.remainingStock.egg).toBe(10);

    const editRes = await fetch(`/api/cart/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: configA, quantity: 2 }),
    });
    expect(editRes.status).toBe(410);

    const delRes = await fetch(`/api/cart/items/${itemId}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);
    const afterDelete = await delRes.json();
    expect(afterDelete.cart.items).toHaveLength(0);
  });

  it("TC-16: Pay clicked twice quickly creates exactly one order, empties cart, and keeps sold stock deducted", async () => {
    await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "pay-prep-1",
        selections: configA,
        quantity: 2,
      }),
    });

    const payPayload = {
      paymentMethod: "bkash",
      idempotencyKey: "checkout-key-1",
    };

    const [p1, p2] = await Promise.all([
      fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payPayload),
      }),
      fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payPayload),
      }),
    ]);

    expect(p1.ok).toBe(true);
    expect(p2.ok).toBe(true);

    const ordersData = await (await fetch("/api/orders")).json();
    expect(ordersData.orders).toHaveLength(7);

    const menuData = await (await fetch("/api/menu")).json();
    expect(menuData.cart.items).toHaveLength(0);
    expect(menuData.remainingStock.egg).toBe(6);
  });
});
