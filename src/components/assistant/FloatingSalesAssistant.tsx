import { Bot, MessageCircle, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { SalesAssistantPanel } from "@/components/assistant/SalesAssistantPanel";
import { Badge } from "@/components/ui/badge";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import type { MenuFixture, Order } from "@/types/order";

interface FloatingSalesAssistantProps {
  orders: Order[];
  menu: MenuFixture | null;
}

export function FloatingSalesAssistant({
  orders,
  menu,
}: FloatingSalesAssistantProps) {
  const [open, setOpen] = useState<boolean>(false);
  const activeMenu = menu ?? MENU_FIXTURE;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {open && (
        <div
          role="dialog"
          aria-label="Staff Sales Assistant"
          className="w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[400px]"
        >
          <div className="flex items-center justify-between bg-slate-950 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-slate-950">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold leading-none">
                  Staff Sales Assistant
                </p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-300 leading-none">
                  <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                  Gemini Flash · {orders.length} live orders
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close sales assistant"
              className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3">
            <SalesAssistantPanel orders={orders} menu={activeMenu} compact />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Minimize sales assistant" : "Open sales assistant"}
        data-testid="floating-assistant-trigger"
        className="flex items-center gap-2.5 rounded-full bg-slate-950 px-4 py-3 text-xs font-semibold text-white shadow-xl ring-1 ring-white/15 transition-transform hover:scale-105 hover:bg-slate-900"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-slate-950">
          {open ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <MessageCircle className="h-3.5 w-3.5" />
          )}
        </span>
        <span>Sales Assistant</span>
        <Badge
          data-testid="assistant-live-orders-count"
          className="bg-white/15 px-1.5 py-0 text-[10px] font-bold text-amber-300 hover:bg-white/15"
        >
          {orders.length}
        </Badge>
      </button>
    </div>
  );
}
