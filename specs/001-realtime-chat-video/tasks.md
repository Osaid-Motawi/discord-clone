---
description: "Task list for Real-Time Chat & Video Calling"
---

# Tasks: Real-Time Chat & Video Calling

**Input**: Design documents from `/specs/001-realtime-chat-video/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: This feature is NOT full-TDD. Per Constitution Principle VI ("Testable Seams"), the
critical flows **send message** and **join call** get smoke tests, plus focused unit tests for
`src/lib` logic and `convex-test` authorization tests for security-critical mutations. These are
the only test tasks included.

**Organization**: Tasks are grouped by user story (spec.md priorities P1→P3) so each story is an
independently testable, shippable increment (Constitution Principle V).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US7 (user-story phases only; Setup/Foundational/Polish carry no story label)
- File paths follow the structure in plan.md (Vite app at root `src/`, Convex in `convex/`)

## Reconciliation notes (from pre-task audit)

- **Story dependency**: **US6 (calls) depends on US4 (channel management)** — a new server has
  only a default *text* channel; voice channels are created in US4. US4 MUST precede US6.
- **Avatar / server image (FR-002, FR-005)**: v1 uses an **image URL string** (paste/enter a
  URL) stored in `users.image` / `servers.imageUrl`. **No file-upload / Convex storage in v1**
  (keeps scope minimal per Principle I). Revisit if uploads are wanted later.
- **Listen-only join (FR-026 / media-permission edge case)**: `PeerMesh` MUST tolerate an
  absent local media stream so a user who denies camera/mic can still join (T045).
- **Signaling robustness**: `signals.inbox` returns rows ordered by `_creationTime`; the client
  dedupes by `_id` and buffers ICE candidates until `remoteDescription` is set; call tiles tear
  down on roster change OR `connectionState==='failed'` (T044, T046, T048).
- **DM typing indicators** are included (US5) as part of "DMs behave like channels"; they reuse
  the `typing.*` functions with `scopeType:'dm'`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and toolchain.

- [X] T001 Initialize Vite + React 18 + TypeScript app at repo root (`package.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `vite.config.ts`)
- [X] T002 [P] Install & configure Tailwind with the Discord-like dark theme tokens in `tailwind.config.ts`, `postcss.config.js`, and `src/index.css`
- [X] T003 [P] Enable TypeScript strict mode in `tsconfig.json` (Constitution Principle III)
- [X] T004 [P] Configure ESLint + formatting (`.eslintrc.cjs`, scripts in `package.json`: `lint`, `typecheck`, `build`)
- [X] T005 Initialize Convex (`npx convex dev`), add the Convex client dep, create `.env.local` with `VITE_CONVEX_URL`, and add `.env.local` to `.gitignore` — local anonymous deployment provisioned (`convex/_generated` present)
- [X] T006 Initialize Convex Auth (`npx @convex-dev/auth`): scaffold `convex/auth.ts` (Password provider), `convex/auth.config.ts`, `convex/http.ts`; set `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` — keys/env set on the deployment
- [X] T007 [P] Set up testing toolchain in `vite.config.ts`: Vitest + React Testing Library + `convex-test`; create `tests/{unit,component,convex,smoke}/` directories

**Checkpoint**: `npm run dev` serves an empty app; `npx convex dev` connects; `npm test` runs.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, auth guards, and app shell that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 Define all 12 tables + indexes in `convex/schema.ts` per data-model.md: spread `...authTables`, override `users` (with `image`), and add `servers`, `serverMembers`, `channels`, `messages`, `directMessageThreads`, `directMessages`, `typingIndicators`, `presence`, `calls`, `callParticipants`, `signals` (every access-pattern index from data-model.md)
- [X] T009 [P] Implement authorization guards in `convex/model/auth.ts`: `requireUser` (via `getAuthUserId`), `requireMember`, `requireOwner`, `requireMessageAuthor`, `requireDMParticipant`, `requireCallAccess` (Constitution Principle IV)
- [X] T010 [P] Implement shared validators & constants in `convex/model/validators.ts` (`MESSAGE_MAX_CHARS=2000`, `MAX_CALL_PARTICIPANTS=4`, heartbeat/staleness/page-size constants from data-model.md)
- [X] T011 Wire `ConvexAuthProvider` + React Router in `src/main.tsx` and `src/router.tsx` (auth-gated routes → redirect unauthenticated users, FR-004)
- [X] T012 [P] Build app-shell layout in `src/components/layout/` (`AppShell`, `ServerRail`, `ChannelSidebar`, `MemberList` scaffolds — server rail → channel sidebar → main pane → member list)
- [X] T013 [P] Build common UI components in `src/components/common/` (`Avatar`, `Button`, `Modal`, `Spinner`, `EmptyState`)
- [X] T014 [P] Implement framework-free helpers: `src/lib/time.ts` (timestamp/relative-time) and `src/lib/presence.ts` (`isOnline` threshold — pure, unit-testable)

**Checkpoint**: Schema deploys; guards compile; app shell renders behind auth. Stories can begin.

---

## Phase 3: User Story 1 - Accounts, Identity & Presence (Priority: P1) 🎯 MVP

**Goal**: Sign up / log in, set display name + avatar, see others' online/offline status.

**Independent Test**: Register two accounts, log in on two sessions, confirm each sees the other
go online/offline within ~5s without refresh (spec US1).

- [X] T015 [P] [US1] Implement `convex/users.ts`: `me`, `get` (public subset `{_id,name,image}`), `updateProfile` (name 1–32, `image` URL)
- [X] T016 [P] [US1] Implement `convex/presence.ts`: `heartbeat` (upsert `lastSeen`), `listForUsers` (reactive `lastSeen`; client derives `isOnline`), `sweepStale` (internal) + `convex/crons.ts`
- [X] T017 [US1] Implement `src/hooks/useHeartbeat.ts` (presence heartbeat on interval + focus/visibility) + `src/hooks/useNow.ts` (local clock)
- [X] T018 [US1] Implement `src/pages/AuthPage.tsx` (signup/login via `useAuthActions`, password flow; sign-out in `CurrentUserBar`)
- [X] T019 [US1] Implement profile setup/edit UI (display name + avatar image URL) — `src/components/user/ProfileEditor.tsx` calling `users.updateProfile`; sign-up captures name/image via the Password `profile()` callback
- [X] T020 [US1] Wire presence display (`src/components/user/CurrentUserBar.tsx` + `HomePage`) + enforce auth-gated redirect in `src/router.tsx` (FR-004, US1 scenario 5)
- [X] T021 [P] [US1] Unit test `isOnline` threshold at the `PRESENCE_STALE_MS` boundary in `tests/unit/presence.test.ts`
- [X] T022 [P] [US1] `convex-test`: unauthenticated calls rejected + authenticated path + profile validation in `tests/convex/auth.test.ts` (FR-004)

**Checkpoint**: Auth + profile + presence work independently.

---

## Phase 4: User Story 2 - Servers & Membership (Priority: P1)

**Goal**: Create servers (owner + default #general), invite links, join, member sidebar, owner
rename/remove.

**Independent Test**: Create server as A, join as B via invite, both appear in sidebar with
status, rename + remove B as owner, B loses access; B's earlier messages persist (spec US2).

- [X] T023 [P] [US2] Implement `convex/servers.ts`: `create` (owner row + default `general` text channel + `inviteCode`), `listMine`, `get`, `listMembers` (`{userId,name,image,role}`), `rename` (owner), `generateInvite` (owner), `joinByInvite` (reject invalid/revoked), `removeMember` (owner; keep messages per FR-010a), `remove` (cascade delete)
- [X] T024 [US2] Implement `ServerRail` interactions in `src/components/server/ServerRail.tsx` (list `listMine`, create-server modal) — replaces the foundational layout scaffold
- [X] T025 [US2] Implement `MemberList` in `src/components/layout/MemberList.tsx` (members + live online status via `presence.listForUsers`)
- [X] T026 [US2] Implement invite generate + join-by-link flow (`InviteModal`, `src/pages/InviteAcceptPage.tsx`) and `src/pages/ServerPage.tsx`
- [X] T027 [US2] Implement owner controls UI (rename server, remove member) gated to owner (client hides; server enforces) — `ChannelSidebar` menu + `RenameServerModal` + `MemberList` remove
- [X] T028 [P] [US2] `convex-test` in `tests/convex/servers.test.ts`: owner-only rename/remove, invalid invite rejected, removed member loses access, authored messages retained (FR-009/010/010a, US2 #7/#8)

**Checkpoint**: Full server lifecycle + membership works on top of US1.

---

## Phase 5: User Story 3 - Real-Time Text Messaging (Priority: P1)

**Goal**: Send/receive real-time messages in a text channel, edit/delete own, newest-first
infinite scroll, typing indicators, 2000-char limit.

**Independent Test**: Two members in #general — send appears <1s for the other; edit marks
"(edited)"; delete removes for all; scroll loads history; typing indicator shows; >2000 blocked
(spec US3).

- [X] T029 [P] [US3] Implement `convex/messages.ts`: `list` (paginated newest-first via `.order("desc").paginate`), `send` (validate 1–2000), `edit` (set `editedAt`), `remove` — author-only for edit/remove
- [X] T030 [P] [US3] Implement `convex/typing.ts`: `ping`, `stop`, `list` (non-stale typers via client filter, exclude caller; channel + dm scopes)
- [X] T031 [US3] Implement `src/hooks/useInfiniteMessages.ts` (`usePaginatedQuery`, `loadMore` on scroll-to-top)
- [X] T032 [US3] Implement chat components in `src/components/chat/`: `MessageList`, `MessageItem` (name/avatar/timestamp/edited + edit/delete), `Composer` (typing ping + length guard), `TypingIndicator`
- [X] T033 [US3] Wire text channel view in `src/pages/ChannelView.tsx` (+ `channels.list`/`get` reads, sidebar channel list, default-channel redirect)
- [X] T034 [P] [US3] **Smoke test** `tests/smoke/send-message.test.ts`: `messages.send` → a second subscribed client observes the message (Principle VI)
- [X] T035 [P] [US3] `convex-test` `tests/convex/messages.test.ts`: non-author edit/delete rejected (FR-018), over-2000 rejected (FR-016a, US3 #8)

**Checkpoint**: MVP complete — a user can sign up, create/join a server, and chat in real time.

---

## Phase 6: User Story 4 - Channel Management (Priority: P2) — BLOCKS US6

**Goal**: Owner creates/renames/deletes text & voice channels; all members see all channels;
deleting a channel removes its messages.

**Independent Test**: Owner creates a text + a voice channel, renames each (live for all),
deletes the text channel and its messages disappear for everyone (spec US4).

- [X] T036 [P] [US4] Implement `convex/channels.ts`: `list`, `get`, `create` (text|voice, owner), `rename` (owner), `remove` (owner; cascade delete messages + calls/participants/signals via `convex/model/cascade.ts`, reused by `servers.remove`)
- [X] T037 [US4] Implement `ChannelSidebar` channel list (all members) + owner CRUD UI (`CreateChannelModal`, `RenameChannelModal`, per-channel delete)
- [X] T038 [P] [US4] `convex-test` `tests/convex/channels.test.ts`: owner-only CRUD (FR-013), delete cascades messages (FR-014), members see all channels (FR-012)

**Checkpoint**: Servers support multiple text/voice channels. Voice channels now exist for US6.

---

## Phase 7: User Story 5 - Direct Messages (Priority: P2)

**Goal**: 1-on-1 DMs between users who share a server; real-time; edit/delete; reuse existing
thread; DM typing.

**Independent Test**: Two users who share a server DM in real time; edit/delete work; reopening
a DM reuses the same thread; no shared server → not available (spec US5).

- [X] T039 [P] [US5] Implement `convex/directMessages.ts`: `openThread` (shared-server check + canonical-pair find-or-create), `listThreads`, `getThread`, `list` (paginated), `send`, `edit`, `remove`
- [X] T040 [US5] Implement `src/pages/DMPage.tsx` + DM list UI (sidebar DM list when no server + member-list "Message" action); reuses refactored chat components (`MessageListView`, `MessageItem`, `Composer`)
- [X] T041 [US5] Wire DM typing indicators (reuse `typing.*` with `scopeType:'dm'`, `requireDMParticipant`)
- [X] T042 [P] [US5] `convex-test` `tests/convex/dm.test.ts`: reuse existing thread / no duplicate (FR-023, US5 #5), no-shared-server rejected (US5 #4), author-only edit/delete, non-participant blocked
- [X] T042a [US5] *(post-v1 addition, FR-023a / US5 #7)* Unread DM badges: `directMessageThreads.lastReadA/lastReadB` schema fields, `directMessages.markRead`/`listThreads` unread count/`unreadTotal` queries, `UnreadBadge` component wired into `ChannelSidebar`'s DM list and `ServerRail`'s home icon, `DMPage` marks read on open + on new arrivals; tests in `tests/convex/dm.test.ts`

**Checkpoint**: Private messaging works alongside server channels.

---

## Phase 8: User Story 6 - Voice & Video Calls (Priority: P2) — depends on US4

**Goal**: Join a voice channel → mesh call (≤4); toggle mic/camera; video tiles; speaking/muted;
leave; channel list shows connected members; single active call; disconnect handling.

**Independent Test**: Two members join a voice channel, see each other's tiles, toggle mic/cam
(reflected <2s), channel list shows both, one leaves and drops off; joining another call moves
them; killed tab treated as left (spec US6).

- [X] T043 [P] [US6] Implement `convex/calls.ts`: `join` (single-active-call removal + capacity ≤4 + find-or-create call), `leave`, `heartbeat`, `setMedia`, `roster`, `connectedByChannel`, `sweepStale` (internal, wired into `convex/crons.ts`)
- [X] T044 [P] [US6] Implement `convex/signals.ts`: `send`, `inbox` (rows for caller, **ordered by `_creationTime`** via `.order("asc")`), `ack` (delete consumed)
- [X] T045 [US6] Implement `src/lib/webrtc/PeerMesh.ts`: Perfect Negotiation (`polite = myId<remoteId`, no-arg `setLocalDescription`, `ignoreOffer`/rollback), `restartIce()` on `connectionState==='failed'`, mic/cam via `track.enabled`, **tolerate absent local stream (listen-only join via recvonly transceivers)**
- [X] T046 [US6] Implement `src/lib/webrtc/signaling.ts`: map `signals` ↔ `RTCPeerConnection` (`processInboxSignals`), **dedupe by `_id`**; ICE-candidate buffering lives in `PeerMesh` (owns `pc.remoteDescription`)
- [X] T047 [US6] Implement `src/hooks/useCall.ts` (join/leave, subscribe `roster`+`signals.inbox`, drive `PeerMesh`, call heartbeat, speaking poll via `src/lib/webrtc/speaking.ts`)
- [X] T048 [US6] Implement call components in `src/components/call/`: `CallStage`, `VideoTile`, `CallControls` (mic/cam toggle, speaking via `getSynchronizationSources().audioLevel` + local `AnalyserNode`, muted indicator; tile teardown on roster change OR `connectionState==='failed'`)
- [X] T049 [US6] Show connected members per voice channel in `ChannelSidebar` (via `calls.connectedByChannel`, FR-029) + voice-channel join lobby in `ChannelView`
- [X] T050 [P] [US6] **Smoke test** `tests/smoke/join-call.test.ts`: `calls.join` → roster includes participant and signaling inbox is wired (Principle VI)
- [X] T051 [P] [US6] Unit test `tests/unit/peermesh.test.ts`: Perfect Negotiation glare → impolite sets `ignoreOffer`, polite rolls back; also covers ICE-candidate buffering and `restartIce()` on failure (mock `RTCPeerConnection`)
- [X] T052 [P] [US6] `convex-test` `tests/convex/calls.test.ts`: capacity >4 rejected (FR-025), single-active-call switch (FR-032), stale participant swept (FR-031), non-member join rejected

**Checkpoint**: Group voice/video calls work in voice channels.

---

## Phase 9: User Story 7 - 1-on-1 Video Calls from a DM (Priority: P3) — depends on US5, US6

**Goal**: Start/join a 1-on-1 video call from a DM with the same in-call controls.

**Independent Test**: In an open DM, one starts a video call, the other joins, both see video and
can toggle mic/cam and leave (spec US7).

- [X] T053 [US7] Add start/join 1-on-1 call from `src/pages/DMPage.tsx` using `useCall` with `scopeType:'dm'` (reuses `calls.join`/`leave`/`setMedia`); added `calls.activeForThread` query so the other participant reactively sees "Join Video Call" the instant a call starts (FR-030, US7 #1)
- [X] T054 [US7] Reuse `CallStage`/`CallControls` for the DM call surface (bounded panel above the message list); leaving ends the call for that participant only (US7 #3)
- [X] T055 [P] [US7] `convex-test` `tests/convex/dm-call.test.ts`: DM call join/leave, reactive visibility, non-participant rejected, single-active-call holds across DM ↔ voice-channel (FR-030, FR-032)

**Checkpoint**: All user stories independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Consolidation, resilience, and final gates across all stories.

- [X] T056 [P] Consolidate staleness cleanup into a single `convex/maintenance.ts` (`sweepAll`) wired to one `convex/crons.ts` interval (presence, typing — previously unswept, call participants, orphan signals); removed the old per-table `presence.sweepStale`/`calls.sweepStale` (Principle I)
- [X] T057 [P] Add loading states to `ChannelSidebar` (channel list, DM list) and `MemberList` via `Spinner`; empty/error states elsewhere were already in place from prior stories
- [X] T058 [P] `VideoTile`: clearer per-peer connection-failure message referencing the STUN-only/no-TURN limitation; debounce `disconnected` (transient) 3s before showing it, matching research.md §7a — only `failed` surfaces immediately
- [X] T059 [P] Accessibility pass: `Modal` Escape-to-close; server-menu `aria-haspopup`/`aria-expanded`/`role="menu"`/`role="menuitem"`; hover-only action buttons (channel rename/delete, member message/remove, **and message edit/delete — found via live browser E2E testing after the initial pass**) switched from `hidden` (unreachable by keyboard) to `opacity-0 focus:opacity-100 group-hover:opacity-100` (tabbable + visible on focus) with `aria-label`s; `Composer` textarea `aria-label`
- [X] T060 Re-ran all per-story backend verification scripts (`scripts/verify-*.mjs`, US1–US7) end-to-end against the live deployment after the Polish changes — all pass; quickstart.md's browser-only steps (visual layout, camera/mic prompts, two-tab WebRTC) still require manual verification (see completion report)
- [X] T061 Final gates: `npm run typecheck` (both `tsconfig.json` and `convex/tsconfig.json`) && `lint` && `test` (41/41) && `build` all green (Principles III, V, VI)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → no deps.
- **Foundational (P2)** → depends on Setup; **blocks all user stories**.
- **US1, US2, US3 (P1)** → depend on Foundational. US1 → US2 (presence shown in sidebar) → US3
  (messaging in the default channel). This trio is the MVP.
- **US4 (P2)** → depends on Foundational (+ US2 for servers). **Blocks US6.**
- **US5 (P2)** → depends on Foundational (+ US2 for shared-server check; reuses US3 chat UI).
- **US6 (P2)** → depends on **US4** (voice channels must exist) + Foundational.
- **US7 (P3)** → depends on **US5** and **US6**.
- **Polish** → after all targeted stories complete.

### Story completion order

`Setup → Foundational → US1 → US2 → US3` *(MVP)* `→ US4 → US5 → US6 → US7 → Polish`
(US4 must land before US6; US5 may run in parallel with US4 by a second developer.)

### Within each story

Convex functions (data layer) → hooks → components/pages → tests. Tests marked [P] run in
parallel once their target files exist.

---

## Parallel Opportunities

- **Setup**: T002, T003, T004, T007 in parallel after T001.
- **Foundational**: T009, T010, T012, T013, T014 in parallel after T008 (schema) / T011.
- **Per story**: the two Convex-function tasks + the test task are [P] (different files); e.g.
  US6 T043/T044 in parallel, then T050/T051/T052 in parallel.
- **Cross-story (with staff)**: after Foundational, US4 and US5 can proceed in parallel; US6
  waits on US4.

### Example — User Story 6 parallel batch

```bash
# Backend functions (different files):
Task: "convex/calls.ts join/leave/heartbeat/setMedia/roster/connectedByChannel/sweep"
Task: "convex/signals.ts send/inbox(ordered)/ack"
# After implementation, tests (different files):
Task: "tests/smoke/join-call.test.ts"
Task: "tests/unit/peermesh.test.ts"
Task: "tests/convex/calls.test.ts"
```

---

## Implementation Strategy

### MVP first (US1 + US2 + US3)

1. Complete Setup + Foundational.
2. US1 → validate auth + presence.
3. US2 → validate servers + membership.
4. US3 → validate real-time chat. **STOP & demo — this is a usable MVP** (Principle V).

### Incremental delivery

Add US4 → US5 → US6 → US7, validating each independently and keeping `main` green (build + run +
story acceptance + relevant smoke test) before starting the next (Principle V).

### Notes

- [P] = different files, no incomplete-task dependency.
- Every backend function starts with an authorization guard (Principle IV).
- Keep business logic in `convex/` and `src/lib` (testable seams); UI stays thin (Principle VI).
- Commit after each task or logical group; never merge a broken `main`.
