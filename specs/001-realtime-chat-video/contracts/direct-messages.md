# Contract: Direct Messages

Covers FR-021–FR-023. File: `convex/directMessages.ts`.

## Threads

### `directMessages.openThread` — mutation (find-or-create)
- **Auth**: `requireUser`.
- **Args**: `{ otherUserId: Id<'users'> }`.
- **Returns**: `{ threadId }`.
- **Behavior**: verifies caller and `otherUserId` share ≥1 server (FR-021); rejects otherwise
  (US5 #4). Canonicalizes the pair (sorted `userA`,`userB`) and looks up `by_pair`. Returns the
  existing thread if present, else creates one — never a duplicate (FR-023, US5 #5).

### `directMessages.listThreads` — query
- **Auth**: `requireUser`.
- **Returns**: `{ threadId, otherUser: { _id, name, image } }[]` for the caller (DM list).
- **Behavior**: reads `by_userA` + `by_userB` for the caller.

## Messages (same rules as channel messages — FR-022)

### `directMessages.list` — paginated query
- **Auth**: `requireDMParticipant(threadId)`.
- **Args**: `{ threadId, paginationOpts }`.
- **Returns**: page of `Doc<'directMessages'>` newest-first (`by_thread`), enriched with author
  profile.
- **Behavior**: reactive infinite-scroll history (FR-022).

### `directMessages.send` — mutation
- **Auth**: `requireDMParticipant(threadId)`.
- **Args**: `{ threadId, content: string (1–2000) }`.
- **Returns**: `{ messageId }`.
- **Behavior**: validates length (FR-016a); inserts `authorId = caller`; delivered live to both
  participants (FR-022, US5 #2).

### `directMessages.edit` — mutation
- **Auth**: `requireMessageAuthor` (DM variant — author of the DM message) **and**
  `requireDMParticipant(threadId)`.
- **Args**: `{ messageId, content: string (1–2000) }`.
- **Returns**: `null`.
- **Behavior**: updates content, sets `editedAt` (marks edited) (FR-022, US5 #3).

### `directMessages.remove` — mutation
- **Auth**: author of the DM message.
- **Args**: `{ messageId }`.
- **Returns**: `null`.
- **Behavior**: deletes; removed live for both (FR-022).

## Typing in DMs
Reuses `typing.ping` / `typing.stop` / `typing.list` with `scopeType:'dm'`, `scopeId:threadId`
and the `requireDMParticipant` guard (FR-020 in DM context).
