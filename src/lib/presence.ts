// Framework-free presence math (testable seam — Principle VI).
// Mirrors convex/model/validators.ts PRESENCE_* constants.

export const PRESENCE_HEARTBEAT_MS = 15_000;
export const PRESENCE_STALE_MS = 30_000;

/**
 * A user is online if their last heartbeat is within the staleness window.
 * Pure function so the online/offline boundary is unit-testable (SC-003).
 */
export function isOnline(lastSeen: number, now: number): boolean {
  return now - lastSeen < PRESENCE_STALE_MS;
}
