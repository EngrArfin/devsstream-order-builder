import { useCallback, useEffect, useState } from "react";
import { DashboardKpiBar } from "@/components/dashboard/DashboardKpiBar";
import { OrdersPanel } from "@/components/orders/OrdersPanel";
import { useWorkspaceContext } from "@/context/WorkspaceContext";
import { fetchMenu, fetchOrders } from "@/lib/api";
import type { MenuFixture, Order } from "@/types/order";

export default function OrdersPage() {
  const workspace = useWorkspaceContext();
  const [menu, setMenu] = useState<MenuFixture | null>(
    workspace?.menu ?? null
  );
  const [orders, setOrders] = useState<Order[]>(workspace?.orders ?? []);
  const [remainingStock, setRemainingStock] = useState<Record<string, number>>(
    {}
  );
  const [activeCartCount, setActiveCartCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrdersPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [menuRes, ordersRes] = await Promise.all([
        fetchMenu(),
        fetchOrders(),
      ]);
      setMenu(menuRes.menu);
      setOrders(ordersRes.orders);
      setRemainingStock(menuRes.remainingStock);
      setActiveCartCount(
        menuRes.cart.items.filter((i) => i.status === "active").length
      );
      workspace?.setWorkspaceMenu(menuRes.menu);
      workspace?.setWorkspaceOrders(ordersRes.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void loadOrdersPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="mb-5 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Orders & Export
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Review seed and completed orders priced in integer poisha, or export
          the full history as JSON.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-2xs">
          Loading order history…
        </div>
      ) : error || !menu ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error ?? "Orders unavailable."}
        </div>
      ) : (
        <div className="space-y-6">
          <DashboardKpiBar
            orders={orders}
            menu={menu}
            remainingStock={remainingStock}
            activeCartCount={activeCartCount}
          />
          <OrdersPanel orders={orders} />
        </div>
      )}
    </section>
  );
}
