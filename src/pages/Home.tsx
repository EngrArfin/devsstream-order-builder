import { Clock, Package } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartPanel } from "@/components/cart/CartPanel";
import { CheckoutPanel } from "@/components/checkout/CheckoutPanel";
import { OrderBuilder } from "@/components/order-builder/OrderBuilder";
import { OrdersPanel } from "@/components/orders/OrdersPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CartPricingResult } from "@/engine/pricing";
import { getDhakaTimeParts } from "@/engine/pricing";
import { computeRemainingStock } from "@/engine/stock";
import { usePricePreview } from "@/hooks/usePricePreview";
import { useServerClock } from "@/hooks/useServerClock";
import {
  addCartItem,
  ApiError,
  deleteCartItem,
  fetchCart,
  fetchMenu,
  fetchOrders,
  setCartCoupon,
  submitCheckout,
  updateCartItem,
} from "@/lib/api";
import type {
  CartItem,
  CartState,
  ConfigSelections,
  MenuFixture,
  Order,
  PaymentMethod,
} from "@/types/order";

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingMenu, setLoadingMenu] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selections, setSelections] = useState<ConfigSelections>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [expiredEditNotice, setExpiredEditNotice] = useState<string | null>(
    null
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [couponUpdating, setCouponUpdating] = useState<boolean>(false);
  const [paying, setPaying] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<Order | null>(null);

  const pendingAddKeyRef = useRef<string>(makeIdempotencyKey());
  const pendingCheckoutKeyRef = useRef<string>(makeIdempotencyKey());
  const syncedExpiredIdsRef = useRef<Set<string>>(new Set());
  const { serverNowMs, syncServerTime } = useServerClock();

  const loadInitialData = useCallback(async () => {
    setLoadingMenu(true);
    setLoadError(null);
    try {
      const [menuData, ordersData] = await Promise.all([
        fetchMenu(),
        fetchOrders(),
      ]);
      setMenu(menuData.menu);
      setCart(menuData.cart);
      setSoldByIngredient(menuData.soldByIngredient);
      setCartPricing(menuData.pricing);
      setOrders(ordersData.orders);
      syncServerTime(menuData.serverTime);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load menu data."
      );
    } finally {
      setLoadingMenu(false);
    }
  }, [syncServerTime]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Auto-sync with server when any active item passes its server-time expiry
  useEffect(() => {
    const newlyExpired = cart.items.filter(
      (item) =>
        item.status === "active" &&
        Date.parse(item.expiresAt) <= serverNowMs &&
        !syncedExpiredIdsRef.current.has(item.id)
    );
    if (newlyExpired.length === 0) {
      return;
    }

    for (const item of newlyExpired) {
      syncedExpiredIdsRef.current.add(item.id);
    }

    void fetchCart()
      .then((res) => {
        setCart(res.cart);
        setSoldByIngredient(res.soldByIngredient);
        setCartPricing(res.pricing);
        syncServerTime(res.serverTime);

        if (editingItemId) {
          const edited = res.cart.items.find((i) => i.id === editingItemId);
          if (!edited || edited.status === "expired") {
            setEditingItemId(null);
            setExpiredEditNotice(
              "The item's 5-minute reservation expired while you were editing. Your unsaved choices are kept below — click 'Reserve as New Item' to reserve fresh stock."
            );
          }
        }
      })
      .catch(() => {
        // Ignore transient sync error; next action will sync with server
      });
  }, [cart.items, editingItemId, serverNowMs, syncServerTime]);

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
    setExpiredEditNotice(null);
    pendingAddKeyRef.current = makeIdempotencyKey();
    setSelections({});
    setQuantity(1);
  }, []);

  const handleStartEdit = useCallback((item: CartItem) => {
    if (item.status !== "active") {
      return;
    }
    setSubmitError(null);
    setCartError(null);
    setExpiredEditNotice(null);
    setEditingItemId(item.id);
    setSelections({ ...item.selections });
    setQuantity(item.quantity);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingItemId(null);
    setSubmitError(null);
    setExpiredEditNotice(null);
    pendingAddKeyRef.current = makeIdempotencyKey();
    setSelections({});
    setQuantity(1);
  }, []);

  const handleSubmitBuilder = useCallback(async () => {
    if (!menu || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setCartError(null);
    setCheckoutError(null);
    setLastCreatedOrder(null);

    try {
      if (editingItemId) {
        const res = await updateCartItem(editingItemId, {
          selections,
          quantity,
          expectedVersion: cart.version,
        });
        setCart(res.cart);
        setSoldByIngredient(res.soldByIngredient);
        setCartPricing(res.pricing);
        syncServerTime(res.serverTime);
        setEditingItemId(null);
        setExpiredEditNotice(null);
        pendingAddKeyRef.current = makeIdempotencyKey();
        pendingCheckoutKeyRef.current = makeIdempotencyKey();
        setSelections({});
        setQuantity(1);
      } else {
        const res = await addCartItem({
          idempotencyKey: pendingAddKeyRef.current,
          selections,
          quantity,
          expectedVersion: cart.version,
        });
        setCart(res.cart);
        setSoldByIngredient(res.soldByIngredient);
        setCartPricing(res.pricing);
        syncServerTime(res.serverTime);
        setExpiredEditNotice(null);
        pendingAddKeyRef.current = makeIdempotencyKey();
        pendingCheckoutKeyRef.current = makeIdempotencyKey();
        setSelections({});
        setQuantity(1);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.payload.cart) {
          setCart(err.payload.cart);
        }
        if (err.payload.soldByIngredient) {
          setSoldByIngredient(err.payload.soldByIngredient);
        }
        if (err.payload.pricing) {
          setCartPricing(err.payload.pricing);
        }
        syncServerTime(err.payload.serverTime);

        if (err.payload.code === "RESERVATION_EXPIRED" && editingItemId) {
          setEditingItemId(null);
          setExpiredEditNotice(
            "This reservation expired while editing and its stock was released. Your unsaved choices are kept below — click 'Reserve as New Item' if stock is available."
          );
          pendingAddKeyRef.current = makeIdempotencyKey();
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError("Request failed. Your choices were kept — please retry.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    cart.version,
    editingItemId,
    menu,
    quantity,
    selections,
    submitting,
    syncServerTime,
  ]);

  const handleUpdateCartItemQty = useCallback(
    async (item: CartItem, nextQty: number) => {
      if (item.status !== "active" || busyItemId) {
        return;
      }
      setBusyItemId(item.id);
      setCartError(null);
      try {
        const res = await updateCartItem(item.id, {
          selections: item.selections,
          quantity: nextQty,
          expectedVersion: cart.version,
        });
        setCart(res.cart);
        setSoldByIngredient(res.soldByIngredient);
        setCartPricing(res.pricing);
        syncServerTime(res.serverTime);
        pendingCheckoutKeyRef.current = makeIdempotencyKey();
        if (editingItemId === item.id) {
          setQuantity(nextQty);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.payload.cart) {
            setCart(err.payload.cart);
          }
          if (err.payload.soldByIngredient) {
            setSoldByIngredient(err.payload.soldByIngredient);
          }
          if (err.payload.pricing) {
            setCartPricing(err.payload.pricing);
          }
          syncServerTime(err.payload.serverTime);
          setCartError(err.message);
        } else {
          setCartError("Failed to update quantity.");
        }
      } finally {
        setBusyItemId(null);
      }
    },
    [busyItemId, cart.version, editingItemId, syncServerTime]
  );

  const handleRemoveCartItem = useCallback(
    async (itemId: string) => {
      if (busyItemId) {
        return;
      }
      setBusyItemId(itemId);
      setCartError(null);
      try {
        const res = await deleteCartItem(itemId, cart.version);
        setCart(res.cart);
        setSoldByIngredient(res.soldByIngredient);
        setCartPricing(res.pricing);
        syncServerTime(res.serverTime);
        pendingCheckoutKeyRef.current = makeIdempotencyKey();
        if (editingItemId === itemId) {
          setEditingItemId(null);
          setSelections({});
          setQuantity(1);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.payload.cart) {
            setCart(err.payload.cart);
          }
          if (err.payload.soldByIngredient) {
            setSoldByIngredient(err.payload.soldByIngredient);
          }
          if (err.payload.pricing) {
            setCartPricing(err.payload.pricing);
          }
          syncServerTime(err.payload.serverTime);
          setCartError(err.message);
        } else {
          setCartError("Failed to remove item.");
        }
      } finally {
        setBusyItemId(null);
      }
    },
    [busyItemId, cart.version, editingItemId, syncServerTime]
  );

  const handleApplyCoupon = useCallback(
    async (code: string | null) => {
      if (couponUpdating) {
        return;
      }
      setCouponUpdating(true);
      setCheckoutError(null);
      try {
        const res = await setCartCoupon({
          couponCode: code,
          expectedVersion: cart.version,
        });
        setCart(res.cart);
        setSoldByIngredient(res.soldByIngredient);
        setCartPricing(res.pricing);
        syncServerTime(res.serverTime);
        pendingCheckoutKeyRef.current = makeIdempotencyKey();
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.payload.cart) {
            setCart(err.payload.cart);
          }
          if (err.payload.pricing) {
            setCartPricing(err.payload.pricing);
          }
          syncServerTime(err.payload.serverTime);
          setCheckoutError(err.message);
        } else {
          setCheckoutError("Failed to update coupon.");
        }
      } finally {
        setCouponUpdating(false);
      }
    },
    [cart.version, couponUpdating, syncServerTime]
  );

  const handleCheckout = useCallback(
    async (paymentMethod: PaymentMethod) => {
      if (paying) {
        return;
      }
      setPaying(true);
      setCheckoutError(null);
      try {
        const res = await submitCheckout({
          paymentMethod,
          idempotencyKey: pendingCheckoutKeyRef.current,
          couponCode: cart.couponCode,
          expectedVersion: cart.version,
        });
        setCart(res.cart);
        setSoldByIngredient(res.soldByIngredient);
        setCartPricing(res.pricing);
        setOrders(res.orders);
        setLastCreatedOrder(res.order);
        syncServerTime(res.serverTime);
        pendingCheckoutKeyRef.current = makeIdempotencyKey();
        if (editingItemId) {
          setEditingItemId(null);
          setSelections({});
          setQuantity(1);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.payload.cart) {
            setCart(err.payload.cart);
          }
          if (err.payload.soldByIngredient) {
            setSoldByIngredient(err.payload.soldByIngredient);
          }
          if (err.payload.pricing) {
            setCartPricing(err.payload.pricing);
          }
          syncServerTime(err.payload.serverTime);
          setCheckoutError(err.message);
        } else {
          setCheckoutError("Checkout failed. Please retry.");
        }
      } finally {
        setPaying(false);
      }
    },
    [cart.couponCode, cart.version, editingItemId, paying, syncServerTime]
  );

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
        <div className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <OrderBuilder
                menu={menu}
                selections={selections}
                quantity={quantity}
                cartItems={cart.items}
                soldByIngredient={soldByIngredient}
                editingItemId={editingItemId}
                expiredEditNotice={expiredEditNotice}
                pricePreview={pricePreview.pricing}
                priceLoading={pricePreview.loading}
                priceError={pricePreview.error}
                submitError={submitError}
                submitting={submitting}
                onChangeQuantity={handleChangeQuantity}
                onChangeOptionQty={handleChangeOptionQty}
                onResetDraft={handleResetDraft}
                onRetryPrice={pricePreview.retry}
                onSubmitItem={handleSubmitBuilder}
                onCancelEdit={handleCancelEdit}
              />
            </div>

            <aside className="space-y-4 lg:col-span-4">
              <div className="space-y-4 lg:sticky lg:top-20">
                <CartPanel
                  menu={menu}
                  cart={cart}
                  cartPricing={cartPricing}
                  serverNowMs={serverNowMs}
                  editingItemId={editingItemId}
                  busyItemId={busyItemId}
                  cartError={cartError}
                  onEditItem={handleStartEdit}
                  onUpdateItemQty={handleUpdateCartItemQty}
                  onRemoveItem={handleRemoveCartItem}
                />

                <CheckoutPanel
                  menu={menu}
                  cart={cart}
                  cartPricing={cartPricing}
                  paying={paying}
                  couponUpdating={couponUpdating}
                  checkoutError={checkoutError}
                  lastCreatedOrder={lastCreatedOrder}
                  onApplyCoupon={handleApplyCoupon}
                  onPay={handleCheckout}
                />

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
                            data-testid={`kitchen-stock-${ing.id}`}
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

          <OrdersPanel orders={orders} />
        </div>
      )}
    </section>
  );
}
