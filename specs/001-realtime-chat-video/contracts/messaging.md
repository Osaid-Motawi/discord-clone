# Contract: Channel Messaging & Typing

Covers FR-016–FR-020 and FR-016a. Files: `convex/messages.ts`, `convex/typing.ts`.

## Messages — `convex/messages.ts`

### `messages.list` — paginated query
- **Auth**: `requireMember` (server of the channel).
- **Args**: `{ channelId, paginationOpts }` (Convex pagination).
- **Returns**: page of `Doc<'messages'>` ordered newest-first (`by_channel`, descending
  `_creationTime`), each enriched with author `{ name, image }`.
- **Behavior**: reactive + paginated → infinite scroll for history (FR-019, SC-006). New live
  messages arrive through the subscription without disturbing the scroll cursor.

### `messages.send` — mutation
- **Auth**: `requireMember` (server of the channel).
- **Args**: `{ channelId, content: string }`.
- **Returns**: `{ messageId }`.
- **Behavior**: validates `content` trimmed length 1–2000 (FR-016a); inserts with
  `authorId = caller`. Delivered to all channel subscribers in real time (FR-016, SC-002).
  Over-length content is rejected (FR-016a, US3 #8).

### `messages.edit` — mutation
- **Auth**: `requireMessageAuthor(messageId)`.
- **Args**: `{ messageId, content: string (1–2000) }`.
- **Returns**: `null`.
- **Behavior**: updates content and sets `editedAt = now` (⇒ shown as "edited", FR-018). Only
  the author may edit; others rejected (FR-018, US3 #5).

### `messages.remove` — mutation
- **Auth**: `requireMessageAuthor(messageId)`.
- **Args**: `{ messageId }`.
- **Returns**: `null`.
- **Behavior**: deletes the message; removed for all in real time (FR-018, US3 #4). Acting on an
  already-deleted message fails gracefully (edge case).

## Typing indicators — `convex/typing.ts`

### `typing.ping` — mutation
- **Auth**: `requireMember` (channel scope) — see also DM scope in direct-messages contract.
- **Args**: `{ scopeType: 'channel', scopeId: string }`.
- **Returns**: `null`.
- **Behavior**: upserts the caller's `typingIndicators` row with `updatedAt = now`. Called
  throttled (`TYPING_THROTTLE_MS`) while composing (FR-020, SC-004).

### `typing.stop` — mutation
- **Auth**: `requireMember`.
- **Args**: `{ scopeType, scopeId }`.
- **Returns**: `null`.
- **Behavior**: deletes the caller's typing row (explicit stop).

### `typing.list` — query
- **Auth**: `requireMember` (or `requireDMParticipant` for DM scope).
- **Args**: `{ scopeType, scopeId }`.
- **Returns**: `{ userId, name }[]` of users with a non-stale typing row (`now - updatedAt <
  TYPING_STALE_MS`), excluding the caller.
- **Behavior**: reactive typing indicator for the current view (FR-020). Stale rows are ignored
  and swept.
