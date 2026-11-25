import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import { OrderBuilder } from "./OrderBuilder";

function renderBuilder(
  overrides: Partial<React.ComponentProps<typeof OrderBuilder>> = {}
) {
  return render(
    <OrderBuilder
      menu={MENU_FIXTURE}
      selections={{}}
      quantity={1}
      cartItems={[]}
      soldByIngredient={{}}
      editingItemId={null}
      pricePreview={null}
      priceLoading={false}
      priceError={null}
      submitError={null}
      submitting={false}
      onChangeQuantity={vi.fn()}
      onChangeOptionQty={vi.fn()}
      onResetDraft={vi.fn()}
      onRetryPrice={vi.fn()}
      onSubmitItem={vi.fn()}
      {...overrides}
    />
  );
}

describe("OrderBuilder component", () => {
  it("lists all violations and disables Add to Cart when invalid (TC-04)", () => {
    renderBuilder({
      selections: {
        toast: 1,
        scrambled: 2,
        tofu: 1,
        bacon: 1,
        chili: 1,
        hollandaise: 1,
      },
    });

    expect(
      screen.getByText(/Tofu cannot be combined with Chicken Sausage or Beef Bacon/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Chili cannot be combined with Hollandaise/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeDisabled();
  });

  it("shows 0 more left and disables + button when ingredient stock is exhausted (TC-08)", () => {
    renderBuilder({
      cartItems: [
        {
          id: "c1",
          productId: MENU_FIXTURE.productId,
          quantity: 1,
          selections: {
            croissant: 1,
            omelette: 2,
            fried: 2,
            sausage: 1,
            bacon: 1,
            hashbrown: 1,
            mushroom: 1,
            hollandaise: 1,
          },
          createdAt: "2026-11-25T10:00:00+06:00",
          expiresAt: "2026-11-25T10:05:00+06:00",
          status: "active",
        },
        {
          id: "c2",
          productId: MENU_FIXTURE.productId,
          quantity: 2,
          selections: {
            paratha: 1,
            fried: 2,
            tofu: 1,
            cheese: 2,
            beans: 1,
            mushroom: 1,
            chili: 1,
          },
          createdAt: "2026-11-25T10:00:00+06:00",
          expiresAt: "2026-11-25T10:05:00+06:00",
          status: "active",
        },
      ],
    });

    expect(screen.getByTestId("stock-left-fried")).toHaveTextContent(
      "0 more left"
    );
    expect(screen.getByRole("button", { name: "Increase Fried" })).toBeDisabled();
    expect(screen.getByTestId("stock-left-ketchup")).toHaveTextContent(
      "Unlimited stock"
    );
  });

  it("offers Retry when async pricing preview fails without losing configuration", () => {
    const onRetryPrice = vi.fn();
    renderBuilder({
      selections: { toast: 1, scrambled: 2, sausage: 1 },
      priceError: "Pricing service failed. Please retry.",
      onRetryPrice,
    });

    expect(screen.getByTestId("option-qty-scrambled")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetryPrice).toHaveBeenCalledTimes(1);
  });
});
