import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { priceCart } from "@/engine/pricing";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import type { CartItem } from "@/types/order";
import { CartPanel } from "./CartPanel";

const sampleSelections = { toast: 1, scrambled: 2, sausage: 1, ketchup: 1 };

describe("CartPanel", () => {
  it("renders server-synced MM:SS countdown for active item", () => {
    const serverNowIso = "2026-11-25T10:01:30.000Z";
    const expiresAtIso = "2026-11-25T10:05:00.000Z"; // 03:30 remaining
    const item: CartItem = {
      id: "item-1",
      productId: MENU_FIXTURE.productId,
      quantity: 1,
      selections: sampleSelections,
      createdAt: "2026-11-25T10:00:00.000Z",
      expiresAt: expiresAtIso,
      status: "active",
    };

    const pricing = priceCart(
      { items: [item] },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      serverNowIso
    );

    render(
      <CartPanel
        menu={MENU_FIXTURE}
        cart={{ items: [item], couponCode: null, version: 1 }}
        cartPricing={pricing}
        serverNowMs={Date.parse(serverNowIso)}
        editingItemId={null}
        busyItemId={null}
        cartError={null}
        onEditItem={vi.fn()}
        onUpdateItemQty={vi.fn()}
        onRemoveItem={vi.fn()}
      />
    );

    expect(screen.getByTestId("cart-timer-item-1")).toHaveTextContent("03:30");
    expect(screen.getByRole("button", { name: /edit/i })).toBeEnabled();
  });

  it("renders expired items as read-only (no Edit or qty buttons, Remove allowed)", () => {
    const onRemove = vi.fn();
    const expiredItem: CartItem = {
      id: "item-exp",
      productId: MENU_FIXTURE.productId,
      quantity: 2,
      selections: sampleSelections,
      createdAt: "2026-11-25T10:00:00.000Z",
      expiresAt: "2026-11-25T10:05:00.000Z",
      status: "expired",
    };

    render(
      <CartPanel
        menu={MENU_FIXTURE}
        cart={{ items: [expiredItem], couponCode: null, version: 2 }}
        cartPricing={null}
        serverNowMs={Date.parse("2026-11-25T10:06:00.000Z")}
        editingItemId={null}
        busyItemId={null}
        cartError={null}
        onEditItem={vi.fn()}
        onUpdateItemQty={vi.fn()}
        onRemoveItem={onRemove}
      />
    );

    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /increase quantity/i })
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /remove item-exp/i }));
    expect(onRemove).toHaveBeenCalledWith("item-exp");
  });
});
