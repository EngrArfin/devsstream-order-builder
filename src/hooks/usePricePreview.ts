import { useCallback, useEffect, useRef, useState } from "react";
import type { CartPricingResult } from "@/engine/pricing";
import { fetchPricePreview } from "@/lib/api";
import type { ConfigSelections } from "@/types/order";

export interface UsePricePreviewOptions {
  selections: ConfigSelections;
  quantity: number;
  enabled: boolean;
  debounceMs?: number;
  onServerTime?: (serverTime: string) => void;
}

export interface UsePricePreviewState {
  pricing: CartPricingResult | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function usePricePreview({
  selections,
  quantity,
  enabled,
  debounceMs = 300,
  onServerTime,
}: UsePricePreviewOptions): UsePricePreviewState {
  const [pricing, setPricing] = useState<CartPricingResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState<number>(0);

  const latestRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onServerTimeRef = useRef(onServerTime);

  useEffect(() => {
    onServerTimeRef.current = onServerTime;
  }, [onServerTime]);

  const selectionsKey = JSON.stringify(
    Object.entries(selections)
      .filter(([, qty]) => qty > 0)
      .sort(([a], [b]) => a.localeCompare(b))
  );

  const retry = useCallback(() => {
    setRetryTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);

    const timerId = window.setTimeout(async () => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const parsedSelections = Object.fromEntries(
          JSON.parse(selectionsKey) as Array<[string, number]>
        );
        const res = await fetchPricePreview(
          {
            items: [{ quantity, selections: parsedSelections }],
          },
          controller.signal
        );

        if (
          controller.signal.aborted ||
          requestId !== latestRequestIdRef.current
        ) {
          return;
        }

        setPricing(res.pricing);
        setError(null);
        setLoading(false);
        onServerTimeRef.current?.(res.serverTime);
      } catch (err) {
        if (controller.signal.aborted || (err as Error).name === "AbortError") {
          return;
        }
        if (requestId !== latestRequestIdRef.current) {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load price preview."
        );
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timerId);
      abortControllerRef.current?.abort();
    };
  }, [enabled, selectionsKey, quantity, debounceMs, retryTick]);

  return {
    pricing,
    loading,
    error,
    retry,
  };
}
