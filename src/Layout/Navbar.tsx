import { UtensilsCrossed } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-amber-400 shadow-sm transition-transform group-hover:scale-105">
            <UtensilsCrossed className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-900 leading-none">
              Smart Order Builder
            </span>
            <span className="mt-0.5 text-[11px] font-medium text-slate-500 leading-none">
              Breakfast POS & Kitchen Stock
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 text-sm font-medium">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive
                ? "rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs"
                : "rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }
          >
            Order Builder
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
