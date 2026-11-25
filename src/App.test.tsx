import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { routeConfig } from "./routes/Routes";

describe("App", () => {
  it("renders the layout and Build Your Breakfast page", () => {
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
  });
});
