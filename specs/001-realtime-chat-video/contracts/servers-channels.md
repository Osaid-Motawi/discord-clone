# Contract: Servers, Invites, Membership & Channels

Covers FR-005–FR-015 and FR-010a. Files: `convex/servers.ts`, `convex/channels.ts`.

## Servers — `convex/servers.ts`

### `servers.create` — mutation
- **Auth**: `requireUser`.
- **Args**: `{ name: string (1–64), imageUrl?: string }`.
- **Returns**: `{ serverId, defaultChannelId }`.
- **Behavior**: creates the server (caller = `ownerId`), an initial `serverMembers` row with
  `role:'owner'`, a default `channels` row (`name:'general'`, `type:'text'`, `isDefault:true`),
  and an initial `inviteCode`. (FR-005, FR-011)

### `servers.listMine` — query
- **Auth**: `requireUser`.
- **Returns**: `Doc<'servers'>[]` the caller is a member of (for the server rail).
- **Behavior**: joins `serverMembers.by_user` → `servers`.

### `servers.get` — query
- **Auth**: `requireMember(serverId)`.
- **Args**: `{ serverId }`.
- **Returns**: `Doc<'servers'>`.

### `servers.listMembers` — query
- **Auth**: `requireMember(serverId)`.
- **Args**: `{ serverId }`.
- **Returns**: `{ userId, name, image, role }[]` (member sidebar; combine with
  `presence.listForUsers` for online status). (FR-008)

### `servers.rename` — mutation
- **Auth**: `requireOwner(serverId)`.
- **Args**: `{ serverId, name: string (1–64) }`.
- **Returns**: `null`.
- **Behavior**: renames; all members' `servers.get` subscriptions update live (FR-009, US2 #5).
  Non-owners rejected (FR-009, US2 #7).

### `servers.generateInvite` — mutation
- **Auth**: `requireOwner(serverId)`.
- **Args**: `{ serverId }`.
- **Returns**: `{ inviteCode }`.
- **Behavior**: sets a new `inviteCode`, invalidating the previous one (FR-006, Assumptions).

### `servers.joinByInvite` — mutation
- **Auth**: `requireUser`.
- **Args**: `{ inviteCode: string }`.
- **Returns**: `{ serverId }`.
- **Behavior**: looks up server by `by_invite`; if found and caller not already a member, adds a
  `serverMembers` row (`role:'member'`). Rejects invalid/unknown codes (FR-007). Idempotent for
  existing members.

### `servers.removeMember` — mutation
- **Auth**: `requireOwner(serverId)`.
- **Args**: `{ serverId, userId }`.
- **Returns**: `null`.
- **Behavior**: deletes the target's `serverMembers` row; drops them from that server's active
  calls; **keeps** their authored messages (FR-010a, US2 #8). Rejects removing the owner.
  Removed member's `servers.get`/`listMembers` subscriptions stop returning the server (FR-010).

### `servers.remove` — mutation
- **Auth**: `requireOwner(serverId)`.
- **Args**: `{ serverId }`.
- **Returns**: `null`.
- **Behavior**: disbands the server — cascade delete channels (+ messages, calls, signals),
  members. (Assumptions: owner deletes to disband.)

## Channels — `convex/channels.ts`

### `channels.list` — query
- **Auth**: `requireMember(serverId)`.
- **Args**: `{ serverId }`.
- **Returns**: `Doc<'channels'>[]` (all channels — every member sees all, FR-012). For voice
  channels, the client also reads `calls.roster` for connected members (FR-029).

### `channels.create` — mutation
- **Auth**: `requireOwner(serverId)`.
- **Args**: `{ serverId, name: string (1–64), type: 'text' | 'voice' }`.
- **Returns**: `{ channelId }`.
- **Behavior**: adds a channel; appears live for all members (FR-013, FR-015, US4 #3).

### `channels.rename` — mutation
- **Auth**: `requireOwner(serverId)` (derived from the channel's server).
- **Args**: `{ channelId, name: string (1–64) }`.
- **Returns**: `null`.
- **Behavior**: renames; live update to all members (FR-013, FR-015, US4 #4).

### `channels.remove` — mutation
- **Auth**: `requireOwner(serverId)`.
- **Args**: `{ channelId }`.
- **Returns**: `null`.
- **Behavior**: deletes the channel and cascades: all its `messages` (FR-014), and any active
  `call` + `callParticipants` + `signals` for a voice channel. Live removal for all members
  (FR-015, US4 #5).

## Non-owner enforcement
All create/rename/delete/remove mutations use `requireOwner` and reject members (FR-009,
FR-013, US2 #7, US4 #6) server-side — the client also hides these controls, but authorization
is enforced on the server (Principle IV).
