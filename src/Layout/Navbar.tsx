import { Bot, LayoutGrid, Receipt, UtensilsCrossed } from "lucide-react";
import { Link } from "react-router-dom";

interface NavbarProps {
  activeSection?: "pos-builder" | "orders-section" | "assistant-section";
  onSelectSection?: (
    section: "pos-builder" | "orders-section" | "assistant-section"
  ) => void;
}

export function Navbar({
  activeSection = "pos-builder",
  onSelectSection,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 lg:hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-amber-400 shadow-xs">
            <UtensilsCrossed className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-slate-900 leading-none">
              Smart Order Builder
            </span>
            <span className="mt-0.5 text-[10px] font-medium text-slate-500 leading-none">
              POS & Staff Dashboard
            </span>
          </div>
        </Link>

        <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          <span>POS Workspace · Live Kitchen Stock & Pricing</span>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto text-xs font-medium">
          <a
            href="#pos-builder"
            onClick={() => onSelectSection?.("pos-builder")}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
              activeSection === "pos-builder"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Order POS</span>
          </a>
          <a
            href="#orders-section"
            onClick={() => onSelectSection?.("orders-section")}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
              activeSection === "orders-section"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Orders</span>
          </a>
          <a
            href="#assistant-section"
            onClick={() => onSelectSection?.("assistant-section")}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
              activeSection === "assistant-section"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>Assistant</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
