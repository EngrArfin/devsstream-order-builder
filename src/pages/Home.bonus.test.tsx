import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { server } from "@/mocks/server";
import {
  configureMockServerBehavior,
  handleAddCartItem,
  resetMockServerState,
} from "@/mocks/serverState";
import Home from "./Home";

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

describe("Part G Bonus behaviors", () => {
  it("persists unfinished draft configuration across page refresh", async () => {
    const { unmount } = render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Bread")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Increase Croissant" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Omelette" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Increase item quantity" })
    );

    expect(screen.getByTestId("option-qty-croissant")).toHaveTextContent("1");
    expect(screen.getByTestId("option-qty-omelette")).toHaveTextContent("1");
    expect(screen.getByTestId("builder-item-qty")).toHaveTextContent("2");

    unmount();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Bread")).toBeInTheDocument();
    });
    expect(screen.getByTestId("option-qty-croissant")).toHaveTextContent("1");
    expect(screen.getByTestId("option-qty-omelette")).toHaveTextContent("1");
    expect(screen.getByTestId("builder-item-qty")).toHaveTextContent("2");
  });

  it("keeps only still-valid reservations on refresh (drops expired ones)", async () => {
    const { unmount } = render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Bread")).toBeInTheDocument();
    });

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

    // Advance server time beyond 5 minutes and simulate refresh
    configureMockServerBehavior({
      clockOffsetMs: 90_000 + 5 * 60 * 1000 + 2000,
    });
    unmount();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId("kitchen-stock-egg")).toHaveTextContent(
      /egg:\s*10/
    );
  });

  it("rejects stale tab mutation with 409 version conflict and reloads latest cart without losing draft", async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Bread")).toBeInTheDocument();
    });

    // Tab B adds an item directly on the server, bumping cart version from 1 -> 2
    handleAddCartItem({
      idempotencyKey: "tab-b-add",
      selections: { toast: 1, scrambled: 2, sausage: 1 },
      quantity: 1,
    });

    // Tab A still has stale version 1 and tries to add an item
    fireEvent.click(screen.getByRole("button", { name: "Increase Croissant" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Fried" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Fried" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Increase Beef Bacon" })
    );
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    await waitFor(() => {
      expect(screen.getByTestId("version-conflict-banner")).toBeInTheDocument();
    });

    // Tab A reloaded Tab B's cart item (1 item) AND preserved Tab A's draft selections
    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.getByTestId("option-qty-croissant")).toHaveTextContent("1");
  });
});
