import {
  Bot,
  LayoutGrid,
  Receipt,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Footer from "./Footer";
import { Navbar } from "./Navbar";

type SectionId = "pos-builder" | "orders-section" | "assistant-section";

const NAV_ITEMS: Array<{
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "pos-builder", label: "Order Builder & Cart", icon: LayoutGrid },
  { id: "orders-section", label: "Orders & Export", icon: Receipt },
  { id: "assistant-section", label: "Sales Assistant", icon: Bot },
];

const Layout: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionId>("pos-builder");

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "") as SectionId;
      if (
        hash === "pos-builder" ||
        hash === "orders-section" ||
        hash === "assistant-section"
      ) {
        setActiveSection(hash);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
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

          <nav className="mt-8 space-y-1.5" aria-label="Dashboard sections">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Workspace
            </p>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-slate-800 text-white shadow-xs ring-1 ring-white/10"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-amber-400" : "text-slate-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </a>
              );
            })}
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
        <Navbar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
        />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
