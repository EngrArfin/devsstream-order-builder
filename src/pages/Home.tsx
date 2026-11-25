import { Clock, Package, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrderBuilder } from "@/components/order-builder/OrderBuilder";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CartPricingResult } from "@/engine/pricing";
import { getDhakaTimeParts } from "@/engine/pricing";
import { computeRemainingStock } from "@/engine/stock";
import { usePricePreview } from "@/hooks/usePricePreview";
import { useServerClock } from "@/hooks/useServerClock";
import { addCartItem, ApiError, fetchMenu } from "@/lib/api";
import type {
  CartState,
  ConfigSelections,
  MenuFixture,
} from "@/types/order";
import { formatPoishaAsBdt } from "@/utils/currency";

function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Home() {
  const [menu, setMenu] = useState<MenuFixture | null>(null);
  const [cart, setCart] = useState<CartState>({
    items: [],
    couponCode: null,
    version: 1,
  });
  const [soldByIngredient, setSoldByIngredient] = useState<
    Record<string, number>
  >({});
  const [cartPricing, setCartPricing] = useState<CartPricingResult | null>(null);
  const [loadingMenu, setLoadingMenu] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selections, setSelections] = useState<ConfigSelections>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pendingAddKeyRef = useRef<string>(makeIdempotencyKey());
  const { serverNowMs, syncServerTime } = useServerClock();

  const loadInitialMenu = useCallback(async () => {
    setLoadingMenu(true);
    setLoadError(null);
    try {
      const data = await fetchMenu();
      setMenu(data.menu);
      setCart(data.cart);
      setSoldByIngredient(data.soldByIngredient);
      setCartPricing(data.pricing);
      syncServerTime(data.serverTime);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load menu data."
      );
    } finally {
      setLoadingMenu(false);
    }
  }, [syncServerTime]);

  useEffect(() => {
    void loadInitialMenu();
  }, [loadInitialMenu]);

  const pricePreview = usePricePreview({
    selections,
    quantity,
    enabled: Boolean(menu),
    debounceMs: 300,
    onServerTime: syncServerTime,
  });

  const handleChangeOptionQty = useCallback((optionId: string, delta: number) => {
    setSubmitError(null);
    pendingAddKeyRef.current = makeIdempotencyKey();
    setSelections((prev) => {
      const nextQty = Math.max(0, (prev[optionId] ?? 0) + delta);
      const next = { ...prev };
      if (nextQty === 0) {
        delete next[optionId];
      } else {
        next[optionId] = nextQty;
      }
      return next;
    });
  }, []);

  const handleChangeQuantity = useCallback((nextQty: number) => {
    setSubmitError(null);
    pendingAddKeyRef.current = makeIdempotencyKey();
    setQuantity(nextQty);
  }, []);

  const handleResetDraft = useCallback(() => {
    setSubmitError(null);
    pendingAddKeyRef.current = makeIdempotencyKey();
    setSelections({});
    setQuantity(1);
  }, []);

  const handleAddToCart = useCallback(async () => {
    if (!menu || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await addCartItem({
        idempotencyKey: pendingAddKeyRef.current,
        selections,
        quantity,
        expectedVersion: cart.version,
      });
      setCart(res.cart);
      setCartPricing(res.pricing);
      syncServerTime(res.serverTime);
      pendingAddKeyRef.current = makeIdempotencyKey();
      setSelections({});
      setQuantity(1);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.payload.cart) {
          setCart(err.payload.cart);
        }
        if (err.payload.pricing) {
          setCartPricing(err.payload.pricing);
        }
        syncServerTime(err.payload.serverTime);
        setSubmitError(err.message);
      } else {
        setSubmitError("Failed to add item to cart. Please retry.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [cart.version, menu, quantity, selections, submitting, syncServerTime]);

  const optionNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (!menu) {
      return map;
    }
    for (const group of menu.groups) {
      for (const opt of group.options) {
        map.set(opt.id, opt.name);
      }
    }
    return map;
  }, [menu]);

  const remainingStock = useMemo(() => {
    if (!menu) {
      return {};
    }
    return computeRemainingStock(
      menu.ingredients,
      soldByIngredient,
      cart.items,
      menu.groups
    );
  }, [cart.items, menu, soldByIngredient]);

  const dhakaNow = getDhakaTimeParts(new Date(serverNowMs));

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Page Top Header */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Build Your Breakfast
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Live cross-group rules, shared ingredient reservations, and
            server-synced pricing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs sm:self-auto">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-slate-600">Server (Asia/Dhaka):</span>
          <span className="font-mono font-semibold text-slate-900">
            {dhakaNow.date} {dhakaNow.timeString}
          </span>
        </div>
      </div>

      {loadingMenu ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-2xs">
          Loading menu and ingredient stock…
        </div>
      ) : loadError || !menu ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {loadError ?? "Menu unavailable."}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <OrderBuilder
              menu={menu}
              selections={selections}
              quantity={quantity}
              cartItems={cart.items}
              soldByIngredient={soldByIngredient}
              pricePreview={pricePreview.pricing}
              priceLoading={pricePreview.loading}
              priceError={pricePreview.error}
              submitError={submitError}
              submitting={submitting}
              onChangeQuantity={handleChangeQuantity}
              onChangeOptionQty={handleChangeOptionQty}
              onResetDraft={handleResetDraft}
              onRetryPrice={pricePreview.retry}
              onSubmitItem={handleAddToCart}
            />
          </div>

          <aside className="space-y-4 lg:col-span-4">
            <div className="space-y-4 lg:sticky lg:top-20">
              {/* Cart Summary */}
              <Card className="border-slate-200/90 shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <ShoppingBag className="h-4 w-4 text-amber-600" />
                      Cart
                    </CardTitle>
                    <Badge variant="secondary" className="bg-slate-100">
                      {cart.items.length} item{cart.items.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4 text-sm">
                  {cart.items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
                      Your cart is empty. Configure an item on the left and
                      click Add to Cart.
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {cart.items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                        >
                          <div className="flex items-center justify-between font-semibold text-slate-900">
                            <span>
                              {menu.productName} × {item.quantity}
                            </span>
                            <Badge
                              variant={
                                item.status === "active"
                                  ? "secondary"
                                  : "destructive"
                              }
                              className="text-[10px] uppercase"
                            >
                              {item.status}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                            {Object.entries(item.selections)
                              .map(
                                ([optId, qty]) =>
                                  `${optionNameById.get(optId) ?? optId} ×${qty}`
                              )
                              .join(", ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}

                  {cartPricing && cart.items.length > 0 && (
                    <div className="space-y-1.5 border-t border-slate-200 pt-3 text-xs text-slate-700">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>
                          {formatPoishaAsBdt(cartPricing.pricing.subtotalPoisha)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-slate-900">
                        <span>Payable</span>
                        <span>
                          {formatPoishaAsBdt(cartPricing.pricing.payablePoisha, {
                            decimals: 0,
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Live Kitchen Stock Overview */}
              <Card className="border-slate-200/90 shadow-2xs">
                <CardHeader className="pb-2.5">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Package className="h-4 w-4 text-slate-500" />
                    Shared Kitchen Stock
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {menu.ingredients.map((ing) => {
                      const left = remainingStock[ing.id] ?? 0;
                      return (
                        <span
                          key={ing.id}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
                            left === 0
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : left <= 2
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="capitalize">{ing.name}:</span>
                          <span className="font-bold">{left}</span>
                        </span>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
