import { AlertTriangle, Award, Banknote, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  getBestSellingOption,
  getOrderCount,
  getTotalRevenue,
} from "@/engine/stats";
import type { MenuFixture, Order } from "@/types/order";
import { formatPoishaAsBdt } from "@/utils/currency";

interface DashboardKpiBarProps {
  orders: Order[];
  menu: MenuFixture;
  remainingStock: Record<string, number>;
  activeCartCount: number;
}

export function DashboardKpiBar({
  orders,
  menu,
  remainingStock,
  activeCartCount,
}: DashboardKpiBarProps) {
  const { totalOrders } = getOrderCount(orders);
  const { totalRevenuePoisha } = getTotalRevenue(orders);
  const topOption = getBestSellingOption(orders, menu, 1).items[0];

  const lowStockCount = menu.ingredients.filter(
    (ing) => (remainingStock[ing.id] ?? 0) <= 2
  ).length;
  const outOfStockCount = menu.ingredients.filter(
    (ing) => (remainingStock[ing.id] ?? 0) === 0
  ).length;

  return (
    <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 xl:grid-cols-4">
      <Card className="border-slate-200/90 bg-white shadow-2xs">
        <CardContent className="flex items-center justify-between pt-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Orders
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {totalOrders}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {activeCartCount} active in cart
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <ShoppingCart className="h-5 w-5" />
          </span>
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 bg-white shadow-2xs">
        <CardContent className="flex items-center justify-between pt-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Revenue
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {formatPoishaAsBdt(totalRevenuePoisha, { decimals: 0 })}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Seed + live checkouts
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Banknote className="h-5 w-5" />
          </span>
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 bg-white shadow-2xs">
        <CardContent className="flex items-center justify-between pt-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Best-Selling Option
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {topOption ? topOption.optionName : "—"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {topOption ? `${topOption.totalUnits} units sold` : "No sales yet"}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Award className="h-5 w-5" />
          </span>
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 bg-white shadow-2xs">
        <CardContent className="flex items-center justify-between pt-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Stock Alerts
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {lowStockCount}
            </p>
            <p
              className={`mt-0.5 text-xs ${
                outOfStockCount > 0
                  ? "font-medium text-rose-600"
                  : "text-slate-500"
              }`}
            >
              {outOfStockCount > 0
                ? `${outOfStockCount} out of stock`
                : lowStockCount > 0
                  ? "Ingredients running low"
                  : "All ingredients healthy"}
            </p>
          </div>
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              outOfStockCount > 0
                ? "bg-rose-50 text-rose-600"
                : lowStockCount > 0
                  ? "bg-amber-50 text-amber-600"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
