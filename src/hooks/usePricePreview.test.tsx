import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { priceCart } from "@/engine/pricing";
import * as api from "@/lib/api";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import { usePricePreview } from "./usePricePreview";

describe("usePricePreview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("TC-12: ignores out-of-order responses so older pricing never overwrites newer configuration", async () => {
    let resolveFirst!: (value: api.PricePreviewResponse) => void;
    let resolveSecond!: (value: api.PricePreviewResponse) => void;

    const firstPricing = priceCart(
      { items: [{ quantity: 1, selections: { toast: 1, scrambled: 2, sausage: 1 } }] },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T12:00:00+06:00"
    );
    const secondPricing = priceCart(
      { items: [{ quantity: 1, selections: { croissant: 1, omelette: 2, bacon: 1 } }] },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T12:00:00+06:00"
    );

    const spy = vi
      .spyOn(api, "fetchPricePreview")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { result, rerender } = renderHook(
      ({ selections }) =>
        usePricePreview({
          selections,
          quantity: 1,
          enabled: true,
          debounceMs: 300,
        }),
      {
        initialProps: {
          selections: { toast: 1, scrambled: 2, sausage: 1 } as Record<string, number>,
        },
      }
    );

    // Fire first debounced request
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(spy).toHaveBeenCalledTimes(1);

    // Change configuration before first response resolves
    rerender({
      selections: { croissant: 1, omelette: 2, bacon: 1 },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(spy).toHaveBeenCalledTimes(2);

    // Second (newer) response resolves first
    await act(async () => {
      resolveSecond({
        pricing: secondPricing,
        serverTime: "2026-11-25T12:00:01+06:00",
      });
    });
    expect(result.current.pricing?.items[0].unitPricePoisha).toBe(
      secondPricing.items[0].unitPricePoisha
    );

    // First (stale) response resolves later -> must NOT overwrite newer price
    await act(async () => {
      resolveFirst({
        pricing: firstPricing,
        serverTime: "2026-11-25T12:00:00+06:00",
      });
    });
    expect(result.current.pricing?.items[0].unitPricePoisha).toBe(
      secondPricing.items[0].unitPricePoisha
    );
  });

  it("keeps state on error and supports Retry", async () => {
    const validPricing = priceCart(
      { items: [{ quantity: 1, selections: { toast: 1, scrambled: 2, sausage: 1 } }] },
      MENU_FIXTURE,
      MENU_FIXTURE.promos,
      "2026-11-25T12:00:00+06:00"
    );

    vi.spyOn(api, "fetchPricePreview")
      .mockRejectedValueOnce(new Error("Pricing service failed"))
      .mockResolvedValueOnce({
        pricing: validPricing,
        serverTime: "2026-11-25T12:00:02+06:00",
      });

    const { result } = renderHook(() =>
      usePricePreview({
        selections: { toast: 1, scrambled: 2, sausage: 1 },
        quantity: 1,
        enabled: true,
        debounceMs: 300,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.error).toBe("Pricing service failed");
    expect(result.current.loading).toBe(false);

    act(() => {
      result.current.retry();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.pricing?.items[0].unitPricePoisha).toBe(38000);
  });
});
