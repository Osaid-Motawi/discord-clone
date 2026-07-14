# Contracts: Convex Function API

**Feature**: 001-realtime-chat-video

The application's external interface is its set of Convex **queries** (reactive reads) and
**mutations** (writes), consumed from React via `useQuery` / `usePaginatedQuery` / `useMutation`.
There is no REST/GraphQL surface. Each contract file below lists the functions for one domain
with: signature (args → result), the authorization guard applied first (Principle IV), behavior,
and the spec requirements covered.

## Conventions

- **Reads** are `query` functions → reactive subscriptions (Principle II). **Writes** are
  `mutation` functions.
- Every function begins with an authorization guard from `convex/model/auth.ts`. A function
  that cannot establish authorization **throws** (rejects) — never returns partial data.
- Argument types use Convex validators (`v.*`); results use the generated `Doc<'table'>` types.
- `Id<'t'>` = a Convex document id for table `t`.

## Guards (`convex/model/auth.ts`)

| Guard | Rejects when | Used by |
|-------|--------------|---------|
| `requireUser(ctx)` → `userId` | Not authenticated | every function (FR-004) |
| `requireMember(ctx, serverId)` | Caller not a member of server | server/channel/message reads & sends |
| `requireOwner(ctx, serverId)` | Caller not the server owner | server rename/delete, member remove, channel CRUD |
| `requireMessageAuthor(ctx, messageId)` | Caller not the author | message edit/delete (FR-018) |
| `requireDMParticipant(ctx, threadId)` | Caller not in the DM pair | DM reads/writes/calls |
| `requireCallAccess(ctx, callId)` | Caller lacks access to the call's scope | call + signaling functions |

## Files

| File | Domain | Key FRs |
|------|--------|---------|
| [auth-presence.md](./auth-presence.md) | Auth, profile, online/offline presence | FR-001–FR-004 |
| [servers-channels.md](./servers-channels.md) | Servers, invites, membership, channels | FR-005–FR-015, FR-010a |
| [messaging.md](./messaging.md) | Channel messages, edit/delete, history, typing | FR-016–FR-020, FR-016a |
| [direct-messages.md](./direct-messages.md) | DM threads and DM messages | FR-021–FR-023 |
| [calls-signaling.md](./calls-signaling.md) | Calls, participants, WebRTC signaling | FR-024–FR-032 |
