import { delay, http, HttpResponse } from "msw";
import type { ConfigSelections, PaymentMethod } from "@/types/order";
import {
  getMockServerBehavior,
  getServerNowIso,
  handleAddCartItem,
  handleCheckout,
  handleDeleteCartItem,
  handleGetCart,
  handleGetMenu,
  handleGetOrders,
  handlePricePreview,
  handleSetCoupon,
  handleUpdateCartItem,
} from "./serverState";

export const handlers = [
  http.get("/api/menu", () => {
    const res = handleGetMenu();
    return HttpResponse.json(res.body, { status: res.status });
  }),

  http.get("/api/cart", () => {
    const res = handleGetCart();
    return HttpResponse.json(res.body, { status: res.status });
  }),

  http.post("/api/price", async ({ request }) => {
    const {
      priceLatencyMinMs,
      priceLatencyMaxMs,
      priceFailureRate,
      randomFn,
    } = getMockServerBehavior();

    const span = Math.max(0, priceLatencyMaxMs - priceLatencyMinMs);
    const waitMs = priceLatencyMinMs + Math.floor(randomFn() * (span + 1));
    if (waitMs > 0) {
      await delay(waitMs);
    }

    if (randomFn() < priceFailureRate) {
      return HttpResponse.json(
        {
          code: "PRICE_UNAVAILABLE",
          error: "Pricing service failed. Please retry.",
          serverTime: getServerNowIso(),
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      items: Array<{ id?: string; quantity: number; selections: ConfigSelections }>;
      couponCode?: string | null;
    };
    const res = handlePricePreview(body);
    return HttpResponse.json(res.body, { status: res.status });
  }),

  http.post("/api/cart/items", async ({ request }) => {
    const body = (await request.json()) as {
      idempotencyKey: string;
      selections: ConfigSelections;
      quantity: number;
      expectedVersion?: number;
    };
    const res = handleAddCartItem(body);
    return HttpResponse.json(res.body, { status: res.status });
  }),

  http.patch("/api/cart/items/:id", async ({ params, request }) => {
    const body = (await request.json()) as {
      selections: ConfigSelections;
      quantity: number;
      expectedVersion?: number;
    };
    const res = handleUpdateCartItem(String(params.id), body);
    return HttpResponse.json(res.body, { status: res.status });
  }),

  http.delete("/api/cart/items/:id", async ({ params, request }) => {
    let expectedVersion: number | undefined;
    try {
      const text = await request.text();
      if (text) {
        const parsed = JSON.parse(text) as { expectedVersion?: number };
        expectedVersion = parsed.expectedVersion;
      }
    } catch {
      expectedVersion = undefined;
    }
    const res = handleDeleteCartItem(String(params.id), expectedVersion);
    return HttpResponse.json(res.body, { status: res.status });
  }),

  http.post("/api/cart/coupon", async ({ request }) => {
    const body = (await request.json()) as {
      couponCode: string | null;
      expectedVersion?: number;
    };
    const res = handleSetCoupon(body);
    return HttpResponse.json(res.body, { status: res.status });
  }),

  http.post("/api/checkout", async ({ request }) => {
    const body = (await request.json()) as {
      paymentMethod: PaymentMethod;
      idempotencyKey: string;
      couponCode?: string | null;
      expectedVersion?: number;
    };
    const res = handleCheckout(body);
    return HttpResponse.json(res.body, { status: res.status });
  }),

  http.get("/api/orders", () => {
    const res = handleGetOrders();
    return HttpResponse.json(res.body, { status: res.status });
  }),
];
