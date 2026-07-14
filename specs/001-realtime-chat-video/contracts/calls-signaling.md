# Contract: Calls & WebRTC Signaling

Covers FR-024–FR-032. Files: `convex/calls.ts`, `convex/signals.ts`. Client mesh logic lives in
`src/lib/webrtc/PeerMesh.ts` and `src/hooks/useCall.ts`.

## Calls — `convex/calls.ts`

### `calls.join` — mutation
- **Auth**: voice channel → `requireMember` (server of the channel); DM → `requireDMParticipant`.
- **Args**: `{ scopeType: 'channel' | 'dm', channelId?, threadId? }`.
- **Returns**: `{ callId }`.
- **Behavior**:
  1. **Single active call** (FR-032, US6 #8): delete any existing `callParticipants` row for the
     caller; if that empties their previous call, set it `active:false`.
  2. Find the active `call` for the scope or create one (`active:true`) (FR-024, US6 #1–2).
  3. **Capacity** (FR-025): reject if the call already has `MAX_CALL_PARTICIPANTS` (4) — edge
     case "voice channel at capacity".
  4. Insert a `callParticipants` row (`micEnabled:true`, `cameraEnabled:false`, `lastSeen:now`).

### `calls.leave` — mutation
- **Auth**: `requireCallAccess(callId)`.
- **Args**: `{ callId }`.
- **Returns**: `null`.
- **Behavior**: deletes the caller's participant row; if zero remain, set `active:false`
  (FR-028, US6 #5).

### `calls.heartbeat` — mutation
- **Auth**: `requireCallAccess(callId)`.
- **Args**: `{ callId }`.
- **Returns**: `null`.
- **Behavior**: refreshes the caller's `callParticipants.lastSeen`. Stale rows are treated as
  left (unexpected disconnect, FR-031, US6 #7) and swept.

### `calls.setMedia` — mutation
- **Auth**: `requireCallAccess(callId)`.
- **Args**: `{ callId, micEnabled?: boolean, cameraEnabled?: boolean }`.
- **Returns**: `null`.
- **Behavior**: updates the caller's mic/camera flags; reflected to other participants via the
  roster subscription within SC-005 (FR-026, FR-027, US6 #3).

### `calls.roster` — query
- **Auth**: `requireCallAccess(callId)`.
- **Args**: `{ callId }`.
- **Returns**: `{ userId, name, image, micEnabled, cameraEnabled }[]` of live participants.
- **Behavior**: drives video tiles and muted indicators (FR-027). "Speaking" is derived
  client-side from local `AudioContext` levels, not stored.

### `calls.connectedByChannel` — query
- **Auth**: `requireMember(serverId)`.
- **Args**: `{ serverId }`.
- **Returns**: `{ channelId, participants: { userId, name }[] }[]` for voice channels.
- **Behavior**: shows who is connected to each voice channel in the channel list (FR-029),
  updated in real time.

### `calls.sweepStale` — internal mutation (scheduled)
- **Auth**: internal.
- **Behavior**: removes `callParticipants` with stale `lastSeen`; deactivates empty calls;
  deletes orphan `signals` (FR-031).

## Signaling — `convex/signals.ts`

Replaces a Socket.io signaling server with Convex reads/writes (Research §8). `payload` carries
opaque SDP/ICE JSON — the one justified `string`/`any` external boundary (Principle III note).

### `signals.send` — mutation
- **Auth**: `requireCallAccess(callId)`.
- **Args**: `{ callId, toUserId, kind: 'offer'|'answer'|'candidate', payload: string }`.
- **Returns**: `null`.
- **Behavior**: inserts a directed signal (`fromUserId = caller`). One row per offer/answer/ICE
  candidate.

### `signals.inbox` — query
- **Auth**: `requireCallAccess(callId)`.
- **Args**: `{ callId }`.
- **Returns**: `Doc<'signals'>[]` where `toUserId = caller` (via `by_recipient`).
- **Behavior**: reactive delivery of signals addressed to the caller; the client feeds each into
  the matching `RTCPeerConnection`.

### `signals.ack` — mutation
- **Auth**: `requireCallAccess(callId)`.
- **Args**: `{ signalId }`.
- **Returns**: `null`.
- **Behavior**: deletes a consumed signal (recipient-owned cleanup).

## Client mesh flow (for reference — implemented in `src/lib/webrtc`)

Uses the **Perfect Negotiation** pattern (verified in research.md §7a), not a manual
caller/callee ordering.

1. On `calls.join`, subscribe to `calls.roster` and `signals.inbox`.
2. For each other participant, create an `RTCPeerConnection` with
   `iceServers: [{ urls: "stun:stun.l.google.com:19302" }]`. Assign the negotiation role
   deterministically per connection: `const polite = myUserId < remoteUserId`. Both peers run
   identical negotiation code — on `negotiationneeded`, call no-arg `setLocalDescription()` and
   send `pc.localDescription` as a `signals.send({ kind: 'offer' | 'answer', ... })`; the
   `polite` peer rolls back on collision while the impolite peer sets `ignoreOffer`. ICE
   candidates flow both ways as `kind: 'candidate'` via `signals.send`/`inbox`/`ack`.
3. Attach local `getUserMedia` tracks with `addTrack`; render remote tracks from `ontrack` as
   `VideoTile`s (FR-027). Derive the speaking indicator from
   `RTCRtpReceiver.getSynchronizationSources()[].audioLevel`.
4. `calls.setMedia` toggles are applied locally via `track.enabled` (no renegotiation) and
   mirrored to the roster.
5. On `connectionState === 'failed'`, call `pc.restartIce()` (routes through the same
   negotiation path); treat `'disconnected'` as transient (debounce).
6. Mesh is capped at 4 peers (≤3 connections each). STUN-only: strict-NAT peers may fail —
   surfaced as a per-peer connection error (documented v1 limitation).
