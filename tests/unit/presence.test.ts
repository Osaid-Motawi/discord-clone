import { describe, it, expect } from "vitest";
import { isOnline, PRESENCE_STALE_MS } from "../../src/lib/presence";

// T021 — presence online/offline threshold (SC-003).
describe("isOnline", () => {
  const now = 1_000_000;

  it("is online at the same instant", () => {
    expect(isOnline(now, now)).toBe(true);
  });

  it("is online just inside the staleness window", () => {
    expect(isOnline(now - (PRESENCE_STALE_MS - 1), now)).toBe(true);
  });

  it("is offline exactly at the threshold", () => {
    expect(isOnline(now - PRESENCE_STALE_MS, now)).toBe(false);
  });

  it("is offline well past the threshold", () => {
    expect(isOnline(now - (PRESENCE_STALE_MS + 60_000), now)).toBe(false);
  });

  it("treats a never-seen user (lastSeen 0) as offline", () => {
    expect(isOnline(0, now)).toBe(false);
  });
});
