import type { CartPricingResult } from "@/engine/pricing";
import type {
  CartItem,
  CartState,
  ConfigSelections,
  MenuFixture,
  Order,
  PaymentMethod,
  PricingCartLineInput,
  RuleViolation,
} from "@/types/order";
import type { StockShortage } from "@/engine/stock";

export interface ApiErrorPayload {
  code?: string;
  error?: string;
  violations?: RuleViolation[];
  shortages?: StockShortage[];
  cart?: CartState;
  remainingStock?: Record<string, number>;
  pricing?: CartPricingResult;
  serverTime?: string;
}

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function requestJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
  if (!response.ok) {
    throw new ApiError(response.status, data);
  }
  return data;
}

export interface MenuResponse {
  menu: MenuFixture;
  cart: CartState;
  remainingStock: Record<string, number>;
  soldByIngredient: Record<string, number>;
  pricing: CartPricingResult;
  serverTime: string;
}

export interface CartResponse {
  cart: CartState;
  remainingStock: Record<string, number>;
  pricing: CartPricingResult;
  serverTime: string;
}

export interface MutateCartItemResponse extends CartResponse {
  item: CartItem;
}

export interface PricePreviewResponse {
  pricing: CartPricingResult;
  serverTime: string;
}

export interface OrdersResponse {
  orders: Order[];
  serverTime: string;
}

export interface CheckoutResponse {
  order: Order;
  cart: CartState;
  remainingStock: Record<string, number>;
  orders: Order[];
  serverTime: string;
}

export function fetchMenu(): Promise<MenuResponse> {
  return requestJson<MenuResponse>("/api/menu");
}

export function fetchCart(): Promise<CartResponse> {
  return requestJson<CartResponse>("/api/cart");
}

export function fetchPricePreview(
  payload: { items: PricingCartLineInput[]; couponCode?: string | null },
  signal?: AbortSignal
): Promise<PricePreviewResponse> {
  return requestJson<PricePreviewResponse>("/api/price", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function addCartItem(payload: {
  idempotencyKey: string;
  selections: ConfigSelections;
  quantity: number;
  expectedVersion?: number;
}): Promise<MutateCartItemResponse> {
  return requestJson<MutateCartItemResponse>("/api/cart/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCartItem(
  itemId: string,
  payload: {
    selections: ConfigSelections;
    quantity: number;
    expectedVersion?: number;
  }
): Promise<MutateCartItemResponse> {
  return requestJson<MutateCartItemResponse>(`/api/cart/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteCartItem(
  itemId: string,
  expectedVersion?: number
): Promise<CartResponse> {
  return requestJson<CartResponse>(`/api/cart/items/${itemId}`, {
    method: "DELETE",
    body: JSON.stringify({ expectedVersion }),
  });
}

export function setCartCoupon(payload: {
  couponCode: string | null;
  expectedVersion?: number;
}): Promise<CartResponse> {
  return requestJson<CartResponse>("/api/cart/coupon", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitCheckout(payload: {
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
  couponCode?: string | null;
  expectedVersion?: number;
}): Promise<CheckoutResponse> {
  return requestJson<CheckoutResponse>("/api/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchOrders(): Promise<OrdersResponse> {
  return requestJson<OrdersResponse>("/api/orders");
}
