// Framework-free time/formatting helpers (testable seam — Principle VI).

/** Format an epoch-ms timestamp as a short local time, e.g. "3:07 PM". */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Format an epoch-ms timestamp as a compact date+time for message headers. */
export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
