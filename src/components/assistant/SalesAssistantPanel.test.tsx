import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { priceSeedOrder } from "@/engine/pricing";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import { SEED_ORDERS_FILE } from "@/mocks/seedOrders";
import { SalesAssistantPanel } from "./SalesAssistantPanel";

const seedOrders = SEED_ORDERS_FILE.orders.map((s) =>
  priceSeedOrder(s, MENU_FIXTURE)
);

describe("SalesAssistantPanel UI", () => {
  it("reflects new checkout count immediately without reload (TC-18) and handles TC-20", async () => {
    const mockAsk = vi.fn(async ({ question, orders }) => {
      if (/how many orders/i.test(question)) {
        return {
          reply: `Total orders: ${orders.length}`,
          toolsCalled: ["getOrderCount"],
        };
      }
      return {
        reply: "Customer details are not stored in order records, so I cannot know.",
        toolsCalled: [],
      };
    });

    const { rerender } = render(
      <SalesAssistantPanel
        orders={seedOrders}
        menu={MENU_FIXTURE}
        askFn={mockAsk}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "How many orders?" }));
    await waitFor(() => {
      expect(screen.getByText("Total orders: 6")).toBeInTheDocument();
    });

    // Simulate checkout adding 1 order without unmounting/reloading
    rerender(
      <SalesAssistantPanel
        orders={[...seedOrders, { ...seedOrders[0], id: "ORD-1007" }]}
        menu={MENU_FIXTURE}
        askFn={mockAsk}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "How many orders?" }));
    await waitFor(() => {
      expect(screen.getByText("Total orders: 7")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Who is our best customer?" })
    );
    await waitFor(() => {
      expect(
        screen.getByText(/customer details are not stored/i)
      ).toBeInTheDocument();
    });
  });
});
