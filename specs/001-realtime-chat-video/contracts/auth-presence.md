# Contract: Auth, Profile & Presence

Covers FR-001–FR-004. Files: `convex/auth.ts`, `convex/users.ts`, `convex/presence.ts`.

## Authentication (Convex Auth — password provider)

Signup/login/logout are provided by Convex Auth's password provider and the
`@convex-dev/auth/react` client helpers (`useAuthActions().signIn` / `signOut`). The server
identity is resolved in every function via `getAuthUserId(ctx)` (from
`@convex-dev/auth/server`), wrapped by `requireUser(ctx)`. See research.md §0/§2 for the
verified setup and versions.

- **FR-001**: sign up, log in, log out via the password provider.
- **FR-004**: `requireUser` on every non-auth function → unauthenticated callers are rejected;
  the React app redirects unauthenticated users to the auth page (US1 scenario 5).

## Profile — `convex/users.ts`

### `users.me` — query
- **Auth**: `requireUser`.
- **Args**: none.
- **Returns**: `Doc<'users'>` for the caller.
- **Behavior**: current profile (name, avatar).

### `users.updateProfile` — mutation
- **Auth**: `requireUser`.
- **Args**: `{ name?: string (1–32), image?: string }`.
- **Returns**: `null`.
- **Behavior**: updates the caller's own display name (`name`) / avatar (`image`) on the
  `authTables` `users` row (FR-002). Validates name length.

### `users.get` — query
- **Auth**: `requireUser`.
- **Args**: `{ userId: Id<'users'> }`.
- **Returns**: public profile subset `{ _id, name, image }`.
- **Behavior**: resolve author/member profiles for display.

## Presence — `convex/presence.ts`

### `presence.heartbeat` — mutation
- **Auth**: `requireUser`.
- **Args**: none.
- **Returns**: `null`.
- **Behavior**: upserts the caller's `presence` row with `lastSeen = now`. Called every
  `PRESENCE_HEARTBEAT_MS` while connected and on focus/visibility change (FR-003).

### `presence.listForUsers` — query
- **Auth**: `requireUser`.
- **Args**: `{ userIds: Id<'users'>[] }`.
- **Returns**: `{ userId, isOnline }[]` where `isOnline = now - lastSeen < PRESENCE_STALE_MS`.
- **Behavior**: reactive online/offline for the member sidebar (FR-003, FR-008, SC-003). No
  polling — the view subscribes; heartbeats from others push updates.

### `presence.sweepStale` — internal mutation (scheduled)
- **Auth**: internal (no client access).
- **Behavior**: deletes/ages presence rows older than `PRESENCE_STALE_MS` to bound table size.

## Notes
- Presence derivation (`isOnline`) is implemented as a pure function in `src/lib/presence.ts`
  and unit-tested at the `PRESENCE_STALE_MS` boundary (Principle VI).
