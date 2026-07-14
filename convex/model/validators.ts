// Shared constants and argument validators (data-model.md "Documented constants").

export const PRESENCE_HEARTBEAT_MS = 15_000; // client heartbeat cadence
export const PRESENCE_STALE_MS = 30_000; // online/offline threshold (SC-003)
export const TYPING_THROTTLE_MS = 3_000; // typing upsert cadence
export const TYPING_STALE_MS = 5_000; // typing clear threshold (SC-004)
export const MESSAGE_PAGE_SIZE = 30; // infinite-scroll batch (SC-006)
export const MAX_CALL_PARTICIPANTS = 4; // mesh cap (FR-025)
export const CALL_HEARTBEAT_MS = 10_000; // client call-heartbeat cadence
export const CALL_STALE_MS = 20_000; // unexpected-disconnect threshold (FR-031)
export const MESSAGE_MAX_CHARS = 2000; // message length (FR-016a)
export const DISPLAY_NAME_MAX_CHARS = 32; // display name (FR-002)
export const SERVER_NAME_MAX_CHARS = 64; // server name (FR-005)
export const CHANNEL_NAME_MAX_CHARS = 64; // channel name (FR-013)

/** Trim and enforce 1..max on a name-like field; throws on empty/over-length. */
export function normalizeName(raw: string, max: number, label: string): string {
  const value = raw.trim();
  if (value.length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
  if (value.length > max) {
    throw new Error(`${label} exceeds ${max} characters.`);
  }
  return value;
}

/**
 * Validate and normalize message content (FR-016a). Trims, then enforces 1..2000.
 * Throws on empty or over-length content.
 */
export function normalizeMessageContent(raw: string): string {
  const content = raw.trim();
  if (content.length === 0) {
    throw new Error("Message cannot be empty.");
  }
  if (content.length > MESSAGE_MAX_CHARS) {
    throw new Error(`Message exceeds ${MESSAGE_MAX_CHARS} characters.`);
  }
  return content;
}

/**
 * Validate and normalize a display name (FR-002). Trims, then enforces 1..32.
 */
export function normalizeDisplayName(raw: string): string {
  const name = raw.trim();
  if (name.length === 0) {
    throw new Error("Display name cannot be empty.");
  }
  if (name.length > DISPLAY_NAME_MAX_CHARS) {
    throw new Error(`Display name exceeds ${DISPLAY_NAME_MAX_CHARS} characters.`);
  }
  return name;
}

/** Canonical ordering for a DM pair so a thread is unique per unordered pair (FR-023). */
export function canonicalPair<T extends string>(a: T, b: T): [T, T] {
  return a < b ? [a, b] : [b, a];
}
