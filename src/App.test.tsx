import { render, screen, waitFor } from "@testing-library/react";
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
import { server } from "./mocks/server";
import {
  configureMockServerBehavior,
  resetMockServerState,
} from "./mocks/serverState";
import { routeConfig } from "./routes/Routes";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => {
  resetMockServerState();
  configureMockServerBehavior({
    priceLatencyMinMs: 0,
    priceLatencyMaxMs: 0,
    priceFailureRate: 0,
  });
});
afterEach(() => server.resetHandlers());

describe("App", () => {
  it("renders the layout and loads the Build Your Breakfast order builder", async () => {
    const router = createMemoryRouter(routeConfig, {
      initialEntries: ["/"],
    });
    render(<RouterProvider router={router} />);

    expect(
      screen.getByRole("link", { name: /smart order builder/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /build your breakfast/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Bread")).toBeInTheDocument();
    });
  });
});
