import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { buildOrdersExportJson } from "@/components/orders/OrdersPanel";
import { server } from "@/mocks/server";
import {
  configureMockServerBehavior,
  resetMockServerState,
} from "@/mocks/serverState";
import { routeConfig } from "@/routes/Routes";
import type { Order } from "@/types/order";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => {
  window.localStorage.clear();
  resetMockServerState();
  configureMockServerBehavior({
    priceLatencyMinMs: 0,
    priceLatencyMaxMs: 0,
    priceFailureRate: 0,
  });
});
afterEach(() => server.resetHandlers());

describe("Home Checkout & Orders Route Flow", () => {
  it("TC-16, TC-17 & TC-18: checks out via Pay, updates floating assistant live without reload, navigates to /orders, persists on refresh, and exports valid D6 JSON", async () => {
    const router = createMemoryRouter(routeConfig, {
      initialEntries: ["/"],
    });
    const { unmount } = render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByText("Bread")).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("assistant-live-orders-count")
    ).toHaveTextContent("6");

    // Build item A (Toast x1, Scrambled x2, Chicken Sausage x1)
    fireEvent.click(screen.getByRole("button", { name: "Increase Toast" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Scrambled" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Scrambled" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Increase Chicken Sausage" })
    );

    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    await waitFor(() => {
      expect(screen.getByText("1 item")).toBeInTheDocument();
    });

    // Apply coupon MORNING15
    fireEvent.change(screen.getByLabelText(/promo \/ coupon code/i), {
      target: { value: "MORNING15" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));

    await waitFor(() => {
      expect(screen.getByTestId("coupon-status")).toBeInTheDocument();
    });

    // Choose bKash and click Pay twice quickly (TC-16)
    fireEvent.click(screen.getByRole("button", { name: "bKash" }));
    const payBtn = screen.getByRole("button", { name: /^pay /i });
    fireEvent.click(payBtn);
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(
        screen.getByTestId("assistant-live-orders-count")
      ).toHaveTextContent("7");
    });

    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByTestId("kitchen-stock-egg")).toHaveTextContent(
      /egg:\s*8/
    );

    // Navigate to /orders route via sidebar link (client-side, no reload)
    fireEvent.click(screen.getAllByRole("link", { name: /orders & export/i })[0]);

    await waitFor(() => {
      expect(screen.getByTestId("orders-count-badge")).toHaveTextContent("7");
    });
    expect(screen.getByTestId("order-card-ORD-1007")).toBeInTheDocument();

    // Simulate page refresh on /orders
    unmount();
    const refreshedRouter = createMemoryRouter(routeConfig, {
      initialEntries: ["/orders"],
    });
    render(<RouterProvider router={refreshedRouter} />);

    await waitFor(() => {
      expect(screen.getByTestId("orders-count-badge")).toHaveTextContent("7");
    });
    expect(screen.getByTestId("order-card-ORD-1007")).toBeInTheDocument();

    // Verify exported JSON matches D6 schema
    const ordersRes = await fetch("/api/orders");
    const ordersData = (await ordersRes.json()) as { orders: Order[] };
    const exportedJson = buildOrdersExportJson(ordersData.orders);
    const parsed = JSON.parse(exportedJson) as Order[];

    expect(parsed).toHaveLength(7);
    const created = parsed[6];
    expect(created.id).toBe("ORD-1007");
    expect(created.moneyUnit).toBe("poisha");
    expect(created.paymentMethod).toBe("bkash");
    expect(created.coupon.code).toBe("MORNING15");
    expect(created.pricing.payablePoisha).toBe(created.pricing.payableBdt * 100);
  });
});
