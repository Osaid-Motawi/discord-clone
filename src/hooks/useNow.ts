import { useEffect, useState } from "react";

/**
 * A local clock that ticks every `intervalMs`, so presence (and other time-derived
 * UI) re-evaluates as time passes — without polling the server (Constitution II).
 */
export function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
