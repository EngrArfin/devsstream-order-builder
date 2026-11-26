import {
  LayoutGrid,
  Receipt,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { FloatingSalesAssistant } from "@/components/assistant/FloatingSalesAssistant";
import { WorkspaceContext } from "@/context/WorkspaceContext";
import { fetchMenu, fetchOrders } from "@/lib/api";
import type { MenuFixture, Order } from "@/types/order";
import Footer from "./Footer";
import { Navbar } from "./Navbar";

const Layout: React.FC = () => {
  const [menu, setMenu] = useState<MenuFixture | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchMenu(), fetchOrders()])
      .then(([menuRes, ordersRes]) => {
        if (!active) {
          return;
        }
        setMenu(menuRes.menu);
        setOrders(ordersRes.orders);
      })
      .catch(() => {
        // Pages handle and surface load errors directly
      });
    return () => {
      active = false;
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      menu,
      orders,
      setWorkspaceMenu: setMenu,
      setWorkspaceOrders: setOrders,
    }),
    [menu, orders]
  );

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-100/80 text-slate-900">
        {/* Fixed Desktop Dashboard Sidebar */}
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:justify-between border-r border-slate-800 bg-slate-950 text-slate-200">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-sm">
                <UtensilsCrossed className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <span className="block truncate text-sm font-bold tracking-tight text-white">
                  Smart Order Builder
                </span>
                <span className="block truncate text-[11px] text-slate-400">
                  Staff POS Console
                </span>
              </div>
            </div>

            <nav className="mt-8 space-y-1.5" aria-label="Dashboard routes">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Workspace
              </p>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-slate-800 text-white shadow-xs ring-1 ring-white/10"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <LayoutGrid
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-amber-400" : "text-slate-400"
                      }`}
                    />
                    <span>Order Builder & Cart</span>
                  </>
                )}
              </NavLink>
              <NavLink
                to="/orders"
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-slate-800 text-white shadow-xs ring-1 ring-white/10"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Receipt
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-amber-400" : "text-slate-400"
                      }`}
                    />
                    <span>Orders & Export</span>
                  </>
                )}
              </NavLink>
            </nav>
          </div>

          <div className="p-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                Integer Poisha Engine
              </div>
              <p className="mt-1.5 leading-relaxed">
                Server-synced reservations, atomic stock swaps, and Gemini tool
                calling.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content Shell offset by fixed sidebar on desktop */}
        <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
          <Navbar />
          <main className="flex-1 pb-20">
            <Outlet />
          </main>
          <Footer />
        </div>

        {/* Floating Messenger-style Staff Sales Assistant */}
        <FloatingSalesAssistant orders={orders} menu={menu} />
      </div>
    </WorkspaceContext.Provider>
  );
};

export default Layout;
