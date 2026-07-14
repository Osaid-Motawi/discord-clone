# Implementation Plan: Real-Time Chat & Video Calling

**Branch**: `001-realtime-chat-video` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-realtime-chat-video/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A Discord-style web app for real-time text chat, direct messages, and up-to-4-person
voice/video calls. Members join servers via invite links, chat in text channels and DMs
with live updates, and start mesh WebRTC calls from voice channels or DMs. The frontend is
React 18 + TypeScript (Vite) styled entirely with Tailwind (dark, Discord-like shell:
server rail → channel sidebar → chat pane → member list). The backend is Convex: all data
in typed tables with per-access-pattern indexes, reactive reads via `useQuery`, writes via
mutations, and Convex Auth (password provider). Real-time behavior (messages, presence,
typing, call roster, WebRTC signaling) is delivered through Convex reactive subscriptions —
no separate socket server. Video/audio uses native `RTCPeerConnection` in a full-mesh
topology with Google public STUN (no TURN in v1).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) on React 18; Node 18+ for tooling

**Primary Dependencies**: React 18, Vite, React Router, Tailwind CSS, Convex, Convex Auth
(`@convex-dev/auth`, password provider), native WebRTC (`RTCPeerConnection`) — no UI
component library, no calling SDK (LiveKit/Twilio) per plan

**Storage**: Convex document database. Tables defined in `convex/schema.ts` with an index
for every access pattern: `users`, `servers`, `serverMembers`, `channels`, `messages`,
`directMessageThreads`, `directMessages`, `typingIndicators`, `presence`, `calls`,
`callParticipants`, `signals`

**Testing**: Vitest + React Testing Library for component/unit tests; `convex-test` for
Convex query/mutation logic; smoke tests for the two critical flows (send message, join
call) per Constitution Principle VI

**Target Platform**: Modern desktop browsers (Chromium, Firefox, Safari) with WebRTC and
`getUserMedia` support; web app only (no mobile app in v1)

**Project Type**: Web application — single repository (Vite app at root, Convex functions
in `convex/`)

**Performance Goals** (from spec Success Criteria): text message visible to others < 1s
(SC-002); presence change visible < 5s (SC-003); typing indicator appears < 1s (SC-004);
call mic/camera state reflected < 2s (SC-005); older-history batch loads < 1s (SC-006)

**Constraints**: Full-mesh WebRTC, max 4 participants per call (FR-025); STUN-only, no
TURN — strict-NAT networks may fail to connect (documented); message ≤ 2000 chars
(FR-016a); one active call per user (FR-032); `.env.local` for secrets, never committed;
every backend function must enforce auth + per-resource authorization (Constitution IV)

**Scale/Scope**: Student-scale — small servers, calls capped at 4 peers; 12 Convex tables;
7 prioritized user stories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Simplicity First | No deps beyond the plan; no speculative abstractions. Native WebRTC and hand-built Tailwind components (no UI kit, no calling SDK). | ✅ PASS |
| II | Real-Time Correctness | All UI-visible state read through Convex `useQuery` subscriptions. No polling for reads; no refresh-to-update. Presence/typing heartbeats are *write* cadences only — reads stay reactive. | ✅ PASS |
| III | Type Safety End-to-End | TS strict across app + `convex/`. DB access only through the typed `convex/schema.ts` + generated `api`. `any` forbidden except justified external boundaries (e.g., raw SDP/ICE blobs). | ✅ PASS |
| IV | Security Basics | Every Convex query/mutation resolves the authenticated user via Convex Auth and verifies membership/ownership/authorship for the resource before any read or write. No trusted client. | ✅ PASS |
| V | Incremental Delivery | Work is sequenced by the spec's P1→P3 user stories; app builds and runs after each story. Foundational Convex schema + auth land first. | ✅ PASS |
| VI | Testable Seams | Business logic lives in Convex functions and framework-free `src/lib` helpers, separated from React views; smoke tests cover send-message and join-call. | ✅ PASS |

**Result**: PASS — no violations. Complexity Tracking table intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-realtime-chat-video/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── README.md
│   ├── auth-presence.md
│   ├── servers-channels.md
│   ├── messaging.md
│   ├── direct-messages.md
│   └── calls-signaling.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (already passing)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
convex/                          # Convex backend (functions + schema)
├── schema.ts                    # All 12 tables + indexes (single source of truth)
├── auth.ts                      # Convex Auth setup (password provider)
├── auth.config.ts               # Auth config
├── http.ts                      # Auth HTTP routes (if required by Convex Auth)
├── users.ts                     # Profile: display name, avatar
├── presence.ts                  # Heartbeat + online/offline derivation + stale cleanup
├── servers.ts                   # Create/rename/delete, invites, membership, remove member
├── channels.ts                  # Create/rename/delete text & voice channels
├── messages.ts                  # Send/edit/delete, paginated history (newest-first)
├── typing.ts                    # Typing heartbeat + reactive indicator reads
├── directMessages.ts            # DM threads (find-or-create) + DM messages
├── calls.ts                     # Join/leave, mic/camera state, roster, single-active-call
├── signals.ts                   # WebRTC SDP/ICE exchange (write + subscribe)
├── model/                       # Shared server-side helpers (auth/authz guards)
│   ├── auth.ts                  # requireUser(), requireMember(), requireOwner(), etc.
│   └── validators.ts            # Shared arg validators (e.g., message length)
└── _generated/                  # Convex codegen (api, dataModel) — do not edit

src/                             # React 18 + Vite frontend
├── main.tsx                     # App bootstrap: ConvexAuthProvider + Router
├── App.tsx                      # Route tree + app shell
├── router.tsx                   # React Router route definitions
├── index.css                    # Tailwind directives + dark theme tokens
├── lib/                         # Framework-free, unit-testable business logic
│   ├── webrtc/                  # Mesh peer-connection manager (testable seam)
│   │   ├── PeerMesh.ts          # Manages RTCPeerConnections for up to 4 peers
│   │   └── signaling.ts         # Maps Convex signals ↔ RTCPeerConnection events
│   ├── presence.ts              # Heartbeat interval + online/offline thresholds
│   └── time.ts                  # Timestamp/relative-time formatting
├── hooks/                       # React hooks wrapping Convex + WebRTC
│   ├── useHeartbeat.ts          # Presence/typing heartbeat lifecycle
│   ├── useCall.ts               # Join/leave call, wire PeerMesh to signals table
│   └── useInfiniteMessages.ts   # Newest-first paginated message loading
├── components/                  # Presentational Tailwind components (no UI library)
│   ├── layout/                  # ServerRail, ChannelSidebar, MemberList, AppShell
│   ├── chat/                    # MessageList, MessageItem, Composer, TypingIndicator
│   ├── call/                    # CallStage, VideoTile, CallControls
│   └── common/                  # Avatar, Modal, Button, Spinner, EmptyState
└── pages/                       # Route-level screens
    ├── AuthPage.tsx             # Signup / login
    ├── ServerPage.tsx           # Server + channel + chat/call view
    ├── ChannelView.tsx          # Text channel or voice channel content
    └── DMPage.tsx               # Direct message conversation + DM call

tests/
├── unit/                        # lib/ logic (PeerMesh signaling, presence thresholds)
├── component/                   # React Testing Library component tests
├── convex/                      # convex-test query/mutation authorization tests
└── smoke/                       # Critical-flow smoke tests: send message, join call

.env.local                       # Convex deployment URL + secrets (gitignored, never committed)
vite.config.ts                   # Vite + Vitest config
tailwind.config.ts               # Tailwind theme (Discord-like dark palette)
tsconfig.json                    # TypeScript strict mode
```

**Structure Decision**: Single-repo web application. The Vite React app lives at the
repository root (`src/`) and the Convex backend in `convex/`, exactly as specified. This
keeps the project small (Principle I) and lets the frontend import the Convex generated
`api` and types directly for end-to-end type safety (Principle III). Business logic that
must be tested (WebRTC mesh management, presence math) is isolated in `src/lib`, and all
authorization logic is centralized in `convex/model/auth.ts` so every function reuses the
same guards (Principle VI, IV).

## Complexity Tracking

> No constitution violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _(none)_  | —          | —                                    |
