import {
  AlertCircle,
  CheckCircle2,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CartPricingResult } from "@/engine/pricing";
import { getEffectiveGroupLimits, validate } from "@/engine/rules";
import { checkStockAvailability, getMaxAddableForOption } from "@/engine/stock";
import type {
  CartItem,
  ConfigSelections,
  MenuFixture,
  OptionGroup,
} from "@/types/order";
import { formatPoishaAsBdt } from "@/utils/currency";

interface OrderBuilderProps {
  menu: MenuFixture;
  selections: ConfigSelections;
  quantity: number;
  cartItems: CartItem[];
  soldByIngredient: Record<string, number>;
  editingItemId?: string | null;
  expiredEditNotice?: string | null;
  pricePreview: CartPricingResult | null;
  priceLoading: boolean;
  priceError: string | null;
  submitError: string | null;
  submitting: boolean;
  onChangeQuantity: (nextQty: number) => void;
  onChangeOptionQty: (optionId: string, delta: number) => void;
  onResetDraft: () => void;
  onRetryPrice: () => void;
  onSubmitItem: () => void;
  onCancelEdit?: () => void;
}

function formatGroupLimitLabel(
  group: OptionGroup,
  min: number | undefined,
  max: number | undefined,
  hasOverride: boolean
): string {
  const parts: string[] = [];
  if (min !== undefined && max !== undefined) {
    parts.push(min === max ? `Pick ${min}` : `${min}–${max}`);
  } else if (min !== undefined) {
    parts.push(`Min ${min}`);
  } else if (max !== undefined) {
    parts.push(`Max ${max}`);
  } else {
    parts.push("Optional");
  }

  if (group.step) {
    parts.push(`step ${group.step}`);
  }
  if (group.maxDistinct) {
    parts.push(`max ${group.maxDistinct} types`);
  }
  if (group.maxPerOption) {
    parts.push(`max ${group.maxPerOption}/item`);
  }
  if (hasOverride) {
    parts.push("override active");
  }
  return parts.join(" · ");
}

export function OrderBuilder({
  menu,
  selections,
  quantity,
  cartItems,
  soldByIngredient,
  editingItemId,
  expiredEditNotice,
  pricePreview,
  priceLoading,
  priceError,
  submitError,
  submitting,
  onChangeQuantity,
  onChangeOptionQty,
  onResetDraft,
  onRetryPrice,
  onSubmitItem,
  onCancelEdit,
}: OrderBuilderProps) {
  const violations = validate(selections, menu.groups, menu.rules);
  const stockCheck = checkStockAvailability(
    selections,
    quantity,
    menu,
    soldByIngredient,
    cartItems,
    editingItemId ?? undefined
  );

  const ingredientNameMap = new Map(
    menu.ingredients.map((ing) => [ing.id, ing.name])
  );

  const canSubmit = violations.length === 0 && stockCheck.ok && !submitting;
  const linePreview = pricePreview?.items[0] ?? null;

  const hasAnySelection = Object.values(selections).some((qty) => qty > 0);
  const hasHardConflict =
    !stockCheck.ok ||
    Boolean(submitError) ||
    violations.some((v) => v.kind === "rule" || hasAnySelection);

  return (
    <div className="space-y-5">
      {expiredEditNotice && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 border-l-4 border-l-amber-500 bg-amber-50 p-4 text-sm text-amber-950 shadow-2xs"
        >
          <p className="font-semibold">Reservation expired while editing</p>
          <p className="mt-1 text-xs sm:text-sm">{expiredEditNotice}</p>
        </div>
      )}

      {editingItemId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950">
          <span className="font-medium">
            Editing existing cart item — your current allocation counts toward
            stock.
          </span>
          {onCancelEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 bg-white text-xs"
              onClick={onCancelEdit}
              disabled={submitting}
            >
              Cancel Edit
            </Button>
          )}
        </div>
      )}

      {/* Product Banner Card */}
      <Card className="overflow-hidden border-slate-200/90 shadow-xs">
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl font-bold tracking-tight text-slate-900">
                {menu.productName}
              </CardTitle>
              <Badge
                variant="secondary"
                className="bg-amber-50 text-amber-800 border border-amber-200/80"
              >
                Base {formatPoishaAsBdt(menu.basePricePoisha)}
              </Badge>
            </div>
            <CardDescription className="mt-1 text-slate-600">
              Select options across each group. Discounts and ingredient limits
              update automatically.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Qty
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-lg bg-white"
                aria-label="Decrease item quantity"
                disabled={quantity <= 1 || submitting}
                onClick={() => onChangeQuantity(Math.max(1, quantity - 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span
                className="w-6 text-center text-sm font-bold text-slate-900"
                data-testid="builder-item-qty"
              >
                {quantity}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-lg bg-white"
                aria-label="Increase item quantity"
                disabled={quantity >= menu.maxItemQuantity || submitting}
                onClick={() =>
                  onChangeQuantity(Math.min(menu.maxItemQuantity, quantity + 1))
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl text-slate-600 hover:text-slate-900"
              onClick={onResetDraft}
              disabled={submitting}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Option Groups */}
      <div className="space-y-4">
        {menu.groups.map((group) => {
          const limits = getEffectiveGroupLimits(group, selections, menu.rules);
          const groupTotal = group.options.reduce(
            (sum, opt) => sum + (selections[opt.id] ?? 0),
            0
          );
          const hasOverride = Boolean(
            limits.maxOverrideRule || limits.minOverrideRule
          );
          const groupHasError = violations.some((v) => v.id === group.id);

          return (
            <Card
              key={group.id}
              className={`border-slate-200/90 shadow-2xs transition-colors ${groupHasError ? "border-rose-300/90" : ""
                }`}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-4 w-1 rounded-full ${groupTotal > 0 ? "bg-amber-500" : "bg-slate-300"
                        }`}
                    />
                    <CardTitle className="text-base font-semibold text-slate-900">
                      {group.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={hasOverride ? "default" : "secondary"}
                      className={
                        hasOverride
                          ? "bg-amber-600 text-white hover:bg-amber-600"
                          : "bg-slate-100 text-slate-700"
                      }
                    >
                      {formatGroupLimitLabel(
                        group,
                        limits.min,
                        limits.max,
                        hasOverride
                      )}
                    </Badge>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${groupTotal > 0
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-500"
                        }`}
                    >
                      Selected: {groupTotal}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {group.options.map((option) => {
                  const qty = selections[option.id] ?? 0;
                  const maxAddable = getMaxAddableForOption(
                    option.id,
                    selections,
                    quantity,
                    menu,
                    soldByIngredient,
                    cartItems,
                    editingItemId ?? undefined
                  );
                  const ingredientTags = Object.entries(option.ingredients)
                    .filter(([, amount]) => amount > 0)
                    .map(
                      ([ingId, amount]) =>
                        `${amount} ${ingredientNameMap.get(ingId) ?? ingId}`
                    );

                  const isInfinite = !Number.isFinite(maxAddable);
                  const addableLabel = isInfinite
                    ? "Unlimited stock"
                    : `${maxAddable} more left`;

                  return (
                    <div
                      key={option.id}
                      className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${qty > 0
                        ? "border-amber-500 bg-amber-50/40 ring-1 ring-amber-500/20 shadow-2xs"
                        : maxAddable === 0
                          ? "border-slate-200 bg-slate-50/80 opacity-80"
                          : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-2xs"
                        }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {option.name}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${option.pricePoisha === 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            {option.pricePoisha === 0
                              ? "Included"
                              : `+${formatPoishaAsBdt(option.pricePoisha)}`}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                          <span
                            className={
                              maxAddable === 0
                                ? "font-semibold text-rose-600"
                                : isInfinite
                                  ? "text-emerald-700"
                                  : "font-medium text-slate-600"
                            }
                            data-testid={`stock-left-${option.id}`}
                          >
                            {addableLabel}
                          </span>
                          {ingredientTags.length > 0 && (
                            <span className="text-slate-400">
                              · {ingredientTags.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full border-slate-300 bg-white hover:bg-slate-100"
                          aria-label={`Decrease ${option.name}`}
                          disabled={qty <= 0 || submitting}
                          onClick={() => onChangeOptionQty(option.id, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span
                          className={`w-7 text-center text-sm font-bold ${qty > 0 ? "text-amber-700" : "text-slate-500"
                            }`}
                          data-testid={`option-qty-${option.id}`}
                        >
                          {qty}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full border-slate-300 bg-white hover:bg-slate-100"
                          aria-label={`Increase ${option.name}`}
                          disabled={maxAddable === 0 || submitting}
                          onClick={() => onChangeOptionQty(option.id, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Validation & Stock Status */}
      {violations.length > 0 || !stockCheck.ok || submitError ? (
        <div
          role="alert"
          className={`space-y-2 rounded-xl border border-l-4 p-4 text-sm shadow-2xs ${hasHardConflict
            ? "border-rose-200 border-l-rose-500 bg-rose-50/90 text-rose-900"
            : "border-amber-200 border-l-amber-500 bg-amber-50/80 text-amber-950"
            }`}
        >
          {violations.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertCircle
                  className={`h-4 w-4 shrink-0 ${hasHardConflict ? "text-rose-600" : "text-amber-600"
                    }`}
                />
                {hasHardConflict
                  ? `Configuration rules (${violations.length})`
                  : `Required selections remaining (${violations.length})`}
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs sm:text-sm">
                {violations.map((v, idx) => (
                  <li key={`${v.id}-${idx}`}>{v.message}</li>
                ))}
              </ul>
            </div>
          )}

          {!stockCheck.ok && stockCheck.message && (
            <p
              className="font-semibold text-rose-900"
              data-testid="stock-shortage-message"
            >
              {stockCheck.message}
            </p>
          )}

          {submitError && (
            <p className="font-medium text-rose-950">{submitError}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          All configuration rules and ingredient stock checks passed. Ready to
          add to cart.
        </div>
      )}

      {/* Async Price Preview & Sticky Primary CTA */}
      <Card className="sticky bottom-20 z-20 border-slate-300/90 bg-white/95 shadow-lg backdrop-blur-md lg:bottom-3">
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Live Item Price Preview
            </p>

            {priceError ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-rose-600">
                  {priceError}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={onRetryPrice}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
            ) : priceLoading ? (
              <p className="text-sm font-medium text-slate-500 animate-pulse">
                Calculating price…
              </p>
            ) : linePreview ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p
                    className="text-2xl font-bold tracking-tight text-slate-900"
                    data-testid="preview-line-total"
                  >
                    {formatPoishaAsBdt(linePreview.lineTotalPoisha)}
                  </p>
                  <span className="text-xs font-medium text-slate-500">
                    ({formatPoishaAsBdt(linePreview.unitPricePoisha)} ×{" "}
                    {quantity})
                  </span>
                </div>
                {(linePreview.extrasDiscountPoisha > 0 ||
                  linePreview.comboDiscountPoisha > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {linePreview.extrasDiscountPoisha > 0 && (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
                          <Sparkles className="mr-1 h-3 w-3" />
                          P2 Extras -{formatPoishaAsBdt(linePreview.extrasDiscountPoisha)}
                        </Badge>
                      )}
                      {linePreview.comboDiscountPoisha > 0 && (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
                          <Sparkles className="mr-1 h-3 w-3" />
                          P1 Combo -{formatPoishaAsBdt(linePreview.comboDiscountPoisha)}
                        </Badge>
                      )}
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {!canSubmit && violations.length > 0 && !submitting && (
              <span className="text-xs font-medium text-amber-700">
                {violations.length} rule{violations.length === 1 ? "" : "s"} remaining
              </span>
            )}
            {editingItemId && onCancelEdit && (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl sm:w-auto"
                onClick={onCancelEdit}
                disabled={submitting}
              >
                Cancel Edit
              </Button>
            )}
            <Button
              type="button"
              size="lg"
              className="w-full rounded-xl bg-slate-900 px-6 font-semibold text-white shadow-sm hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100 sm:w-auto"
              onClick={onSubmitItem}
              disabled={!canSubmit}
            >
              {submitting
                ? "Reserving…"
                : editingItemId
                  ? "Save Changes"
                  : expiredEditNotice
                    ? "Reserve as New Item"
                    : submitError
                      ? "Retry Add to Cart"
                      : "Add to Cart"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
