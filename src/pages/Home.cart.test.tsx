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

describe("Home Cart & Edit Reservation Flow", () => {
  it("adds a valid item, enters edit mode, swaps eggs, and updates shared stock (TC-10)", async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Bread")).toBeInTheDocument();
    });

    // Build item A: Toast x1, Scrambled x2, Chicken Sausage x1
    fireEvent.click(screen.getByRole("button", { name: "Increase Toast" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Scrambled" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Scrambled" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Increase Chicken Sausage" })
    );

    // Click Add to Cart rapidly 3 times (TC-13)
    const addBtn = screen.getByRole("button", { name: /add to cart/i });
    fireEvent.click(addBtn);
    fireEvent.click(addBtn);
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText("1 item")).toBeInTheDocument();
    });
    expect(screen.getByTestId("kitchen-stock-egg")).toHaveTextContent(
      /egg:\s*8/
    );

    // Edit item and change Scrambled 2 -> Omelette 1 + Fried 1 (uses 3 eggs total => 7 left)
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(
      screen.getByRole("button", { name: /save changes/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Decrease Scrambled" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease Scrambled" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Omelette" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Fried" }));

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByTestId("kitchen-stock-egg")).toHaveTextContent(
        /egg:\s*7/
      );
    });
  });

  it("D3: preserves unsaved configuration with Reserve as New Item if reservation expires mid-edit", async () => {
    render(<Home />);

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
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    // User modifies draft while editing
    fireEvent.click(screen.getByRole("button", { name: "Increase Hash Brown" }));

    // Server clock advances past 5:00 TTL
    configureMockServerBehavior({
      clockOffsetMs: 90_000 + 5 * 60 * 1000 + 2000,
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Reservation expired while editing")
      ).toBeInTheDocument();
    });

    // Unsaved draft (including Hash Brown) is preserved and button offers Reserve as New Item
    expect(screen.getByTestId("option-qty-hashbrown")).toHaveTextContent("1");
    expect(
      screen.getByRole("button", { name: /reserve as new item/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("TC-14: keeps configuration and lets Retry succeed when reserve call fails mid-way", async () => {
    configureMockServerBehavior({ nextReserveShouldFail: true });
    render(<Home />);

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
      expect(
        screen.getByText(/Reservation failed mid-way/i)
      ).toBeInTheDocument();
    });
    // Stock stayed untouched and user selections are still kept
    expect(screen.getByTestId("kitchen-stock-egg")).toHaveTextContent(
      /egg:\s*10/
    );
    expect(screen.getByTestId("option-qty-scrambled")).toHaveTextContent("2");

    // Retry succeeds
    fireEvent.click(
      screen.getByRole("button", { name: /retry add to cart/i })
    );

    await waitFor(() => {
      expect(screen.getByText("1 item")).toBeInTheDocument();
    });
    expect(screen.getByTestId("kitchen-stock-egg")).toHaveTextContent(
      /egg:\s*8/
    );
  });
});
