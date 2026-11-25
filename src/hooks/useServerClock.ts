import { useCallback, useEffect, useRef, useState } from "react";

export function useServerClock(initialServerTime?: string) {
  const offsetRef = useRef<number>(
    initialServerTime ? Date.parse(initialServerTime) - Date.now() : 0
  );
  const [serverNowMs, setServerNowMs] = useState<number>(() =>
    initialServerTime ? Date.parse(initialServerTime) : Date.now()
  );

  const syncServerTime = useCallback((serverTimeIso?: string) => {
    if (!serverTimeIso) {
      return;
    }
    const parsed = Date.parse(serverTimeIso);
    if (Number.isNaN(parsed)) {
      return;
    }
    offsetRef.current = parsed - Date.now();
    setServerNowMs(parsed);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setServerNowMs(Date.now() + offsetRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    serverNowMs,
    syncServerTime,
  };
}
