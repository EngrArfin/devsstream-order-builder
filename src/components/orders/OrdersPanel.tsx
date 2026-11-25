import { Download, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDhakaTimeParts } from "@/engine/pricing";
import type { Order } from "@/types/order";
import { formatPoishaAsBdt } from "@/utils/currency";

interface OrdersPanelProps {
  orders: Order[];
}

export function buildOrdersExportJson(orders: Order[]): string {
  return JSON.stringify(orders, null, 2);
}

export function OrdersPanel({ orders }: OrdersPanelProps) {
  const handleDownload = () => {
    const json = buildOrdersExportJson(orders);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "orders.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const displayOrders = [...orders].reverse();

  return (
    <Card className="border-slate-200/90 shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-slate-700" />
          <CardTitle className="text-base font-semibold">
            Orders History
          </CardTitle>
          <Badge variant="secondary" data-testid="orders-count-badge">
            {orders.length}
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg text-xs font-semibold"
          onClick={handleDownload}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Download orders.json
        </Button>
      </CardHeader>

      <CardContent className="pt-4">
        {displayOrders.length === 0 ? (
          <p className="text-sm text-slate-500">No orders recorded yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {displayOrders.map((order) => {
              const dhaka = getDhakaTimeParts(order.createdAt);
              return (
                <div
                  key={order.id}
                  data-testid={`order-card-${order.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{order.id}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {order.paymentMethod}
                      </Badge>
                      <span className="font-bold text-slate-900">
                        {formatPoishaAsBdt(order.pricing.payablePoisha, {
                          decimals: 0,
                        })}
                      </span>
                    </div>
                  </div>

                  <p className="mt-1 text-slate-500">
                    {dhaka.date} {dhaka.timeString} (Asia/Dhaka)
                  </p>

                  <ul className="mt-2 space-y-1 text-slate-700">
                    {order.items.map((line, idx) => (
                      <li key={idx}>
                        • {line.productName} × {line.quantity} (
                        {formatPoishaAsBdt(line.lineTotalPoisha)})
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-2 text-[11px] text-slate-600">
                    <span>
                      Subtotal:{" "}
                      {formatPoishaAsBdt(order.pricing.subtotalPoisha)}
                    </span>
                    <span>
                      VAT: {formatPoishaAsBdt(order.pricing.vatPoisha)}
                    </span>
                    {order.coupon.code && (
                      <Badge
                        variant={
                          order.coupon.status === "applied"
                            ? "secondary"
                            : "outline"
                        }
                        className={
                          order.coupon.status === "applied"
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-amber-800"
                        }
                      >
                        {order.coupon.code} ({order.coupon.status})
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
