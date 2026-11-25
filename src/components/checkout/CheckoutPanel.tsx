import { CheckCircle2, CreditCard, Tag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CartPricingResult } from "@/engine/pricing";
import type { CartState, MenuFixture, Order, PaymentMethod } from "@/types/order";
import { formatPoishaAsBdt } from "@/utils/currency";

interface CheckoutPanelProps {
  menu: MenuFixture;
  cart: CartState;
  cartPricing: CartPricingResult | null;
  paying: boolean;
  couponUpdating: boolean;
  checkoutError: string | null;
  lastCreatedOrder: Order | null;
  onApplyCoupon: (code: string | null) => void;
  onPay: (method: PaymentMethod) => void;
}

const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string }> = [
  { id: "card", label: "Card" },
  { id: "bkash", label: "bKash" },
  { id: "cash", label: "Cash" },
];

export function CheckoutPanel({
  menu,
  cart,
  cartPricing,
  paying,
  couponUpdating,
  checkoutError,
  lastCreatedOrder,
  onApplyCoupon,
  onPay,
}: CheckoutPanelProps) {
  const [couponInput, setCouponInput] = useState<string>(cart.couponCode ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");

  useEffect(() => {
    setCouponInput(cart.couponCode ?? "");
  }, [cart.couponCode]);

  const activeCount = cart.items.filter((i) => i.status === "active").length;
  const pricing = cartPricing?.pricing;
  const evaluations = cartPricing?.evaluations;
  const couponInfo = cartPricing?.coupon;

  const c1Promo = menu.promos.cartPromos.find(
    (p) => p.type === "cartThresholdFixed"
  );
  const c2Promo = menu.promos.cartPromos.find(
    (p) => p.type === "cartCouponPercent"
  );

  return (
    <Card className="border-slate-200/90 shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CreditCard className="h-4 w-4 text-slate-700" />
          Checkout & Pricing Breakdown
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 pt-4 text-sm">
        {/* Coupon Section */}
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            onApplyCoupon(couponInput.trim() || null);
          }}
        >
          <label
            htmlFor="coupon-input"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
          >
            <Tag className="h-3.5 w-3.5 text-slate-500" />
            Promo / Coupon Code
          </label>
          <div className="flex gap-2">
            <Input
              id="coupon-input"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="e.g. MORNING15"
              className="h-9 text-xs uppercase"
              disabled={couponUpdating || paying}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-semibold"
              disabled={couponUpdating || paying}
            >
              {couponUpdating ? "…" : "Apply"}
            </Button>
            {cart.couponCode && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-slate-500"
                aria-label="Clear coupon"
                disabled={couponUpdating || paying}
                onClick={() => onApplyCoupon(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {couponInfo && couponInfo.status === "applied" && (
            <p
              className="text-xs font-medium text-emerald-700"
              data-testid="coupon-status"
            >
              Coupon {couponInfo.code} applied!
            </p>
          )}
          {couponInfo && couponInfo.status === "rejected" && (
            <p
              className="text-xs font-medium text-amber-800"
              data-testid="coupon-status"
            >
              Coupon {couponInfo.code} not applied: {couponInfo.reason}
            </p>
          )}
        </form>

        {/* Full Breakdown */}
        {pricing && evaluations && activeCount > 0 ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
            <div className="flex justify-between text-slate-700">
              <span>Cart Subtotal</span>
              <span className="font-semibold" data-testid="breakdown-subtotal">
                {formatPoishaAsBdt(pricing.subtotalPoisha)}
              </span>
            </div>

            {c1Promo && (
              <div className="flex justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span>{c1Promo.id} Threshold Discount</span>
                  {pricing.appliedPromoId === c1Promo.id && (
                    <Badge className="bg-emerald-600 px-1.5 py-0 text-[10px] text-white">
                      Applied
                    </Badge>
                  )}
                </span>
                <span data-testid="breakdown-c1">
                  -{formatPoishaAsBdt(evaluations.c1DiscountPoisha)}
                </span>
              </div>
            )}

            {c2Promo && (
              <div className="flex justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span>
                    {c2Promo.id} ({c2Promo.code})
                  </span>
                  {pricing.appliedPromoId === c2Promo.id && (
                    <Badge className="bg-emerald-600 px-1.5 py-0 text-[10px] text-white">
                      Applied
                    </Badge>
                  )}
                </span>
                <span data-testid="breakdown-c2">
                  -{formatPoishaAsBdt(evaluations.c2DiscountPoisha)}
                </span>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-200 pt-2 text-slate-700">
              <span>Discounted Subtotal</span>
              <span className="font-medium">
                {formatPoishaAsBdt(pricing.discountedSubtotalPoisha)}
              </span>
            </div>

            <div className="flex justify-between text-slate-700">
              <span>VAT ({menu.promos.vatPercent}%)</span>
              <span data-testid="breakdown-vat">
                {formatPoishaAsBdt(pricing.vatPoisha)}
              </span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
              <span>Payable (rounded)</span>
              <span data-testid="breakdown-payable">
                {formatPoishaAsBdt(pricing.payablePoisha, { decimals: 0 })}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Add an active item to see the full pricing breakdown and pay.
          </p>
        )}

        {/* Payment Method Selector */}
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-slate-700">
            Payment Method
          </span>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((method) => {
              const selected = paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id)}
                  disabled={paying}
                  aria-pressed={selected}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {method.label}
                </button>
              );
            })}
          </div>
        </div>

        {checkoutError && (
          <p role="alert" className="text-xs font-medium text-rose-700">
            {checkoutError}
          </p>
        )}

        {lastCreatedOrder && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Order <strong>{lastCreatedOrder.id}</strong> placed (
              {formatPoishaAsBdt(lastCreatedOrder.pricing.payablePoisha, {
                decimals: 0,
              })}
              , {lastCreatedOrder.paymentMethod}).
            </span>
          </div>
        )}

        <Button
          type="button"
          className="w-full rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100"
          disabled={activeCount === 0 || paying}
          onClick={() => onPay(paymentMethod)}
        >
          {paying
            ? "Processing Order…"
            : pricing && activeCount > 0
              ? `Pay ${formatPoishaAsBdt(pricing.payablePoisha, { decimals: 0 })}`
              : "Pay"}
        </Button>
      </CardContent>
    </Card>
  );
}
