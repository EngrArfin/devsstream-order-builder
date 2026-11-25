import {
  AlertCircle,
  Clock,
  Minus,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CartPricingResult } from "@/engine/pricing";
import type { CartItem, CartState, MenuFixture } from "@/types/order";
import { formatPoishaAsBdt } from "@/utils/currency";

interface CartPanelProps {
  menu: MenuFixture;
  cart: CartState;
  cartPricing: CartPricingResult | null;
  serverNowMs: number;
  editingItemId: string | null;
  busyItemId: string | null;
  cartError: string | null;
  onEditItem: (item: CartItem) => void;
  onUpdateItemQty: (item: CartItem, nextQty: number) => void;
  onRemoveItem: (itemId: string) => void;
}

export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function CartPanel({
  menu,
  cart,
  cartPricing,
  serverNowMs,
  editingItemId,
  busyItemId,
  cartError,
  onEditItem,
  onUpdateItemQty,
  onRemoveItem,
}: CartPanelProps) {
  const optionNameById = new Map<string, string>();
  for (const group of menu.groups) {
    for (const opt of group.options) {
      optionNameById.set(opt.id, opt.name);
    }
  }

  // Match active items in cart to priced lines in cartPricing (which only prices active items)
  const pricedByActiveIndex: Array<
    CartPricingResult["items"][number] | undefined
  > = [];
  let activeCursor = 0;
  for (const item of cart.items) {
    if (item.status === "active") {
      pricedByActiveIndex.push(cartPricing?.items[activeCursor]);
      activeCursor += 1;
    } else {
      pricedByActiveIndex.push(undefined);
    }
  }

  return (
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
        {cartError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
            <span>{cartError}</span>
          </div>
        )}

        {cart.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
            Your cart is empty. Configure an item on the left and click Add to
            Cart.
          </div>
        ) : (
          <ul className="space-y-3">
            {cart.items.map((item, idx) => {
              const isExpired = item.status === "expired";
              const isEditing = editingItemId === item.id;
              const isBusy = busyItemId === item.id;
              const remainingMs = Math.max(
                0,
                Date.parse(item.expiresAt) - serverNowMs
              );
              const isUrgent = !isExpired && remainingMs <= 60_000;
              const pricedLine = pricedByActiveIndex[idx];

              return (
                <li
                  key={item.id}
                  data-testid={`cart-item-${item.id}`}
                  className={`rounded-xl border p-3 transition-colors ${
                    isExpired
                      ? "border-slate-200 bg-slate-100/80 opacity-80"
                      : isEditing
                        ? "border-amber-500 bg-amber-50/50 ring-1 ring-amber-500/30"
                        : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-900">
                          {menu.productName}
                        </span>
                        {isEditing && (
                          <Badge className="bg-amber-600 text-[10px] text-white hover:bg-amber-600">
                            Editing
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {Object.entries(item.selections)
                          .map(
                            ([optId, qty]) =>
                              `${optionNameById.get(optId) ?? optId} ×${qty}`
                          )
                          .join(", ")}
                      </p>
                    </div>

                    {isExpired ? (
                      <Badge
                        variant="destructive"
                        className="shrink-0 text-[10px] uppercase"
                      >
                        Expired
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        data-testid={`cart-timer-${item.id}`}
                        className={`shrink-0 font-mono text-[11px] ${
                          isUrgent
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        <Clock className="mr-1 h-3 w-3" />
                        {formatCountdown(remainingMs)}
                      </Badge>
                    )}
                  </div>

                  {isExpired && (
                    <p className="mt-1.5 text-[11px] font-medium text-rose-700">
                      Reservation expired · stock released (read-only)
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5">
                    {!isExpired ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-md bg-white"
                          aria-label={`Decrease quantity for ${item.id}`}
                          disabled={item.quantity <= 1 || isBusy}
                          onClick={() =>
                            onUpdateItemQty(item, Math.max(1, item.quantity - 1))
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span
                          className="w-5 text-center text-xs font-bold text-slate-900"
                          data-testid={`cart-qty-${item.id}`}
                        >
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-md bg-white"
                          aria-label={`Increase quantity for ${item.id}`}
                          disabled={
                            item.quantity >= menu.maxItemQuantity || isBusy
                          }
                          onClick={() =>
                            onUpdateItemQty(
                              item,
                              Math.min(menu.maxItemQuantity, item.quantity + 1)
                            )
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Qty {item.quantity}
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      {pricedLine && (
                        <span className="mr-1 text-xs font-bold text-slate-900">
                          {formatPoishaAsBdt(pricedLine.lineTotalPoisha)}
                        </span>
                      )}

                      {!isExpired && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={isBusy}
                          onClick={() => onEditItem(item)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        aria-label={`Remove ${item.id}`}
                        disabled={isBusy}
                        onClick={() => onRemoveItem(item.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
