# Quickstart & Validation Guide: Real-Time Chat & Video Calling

**Feature**: 001-realtime-chat-video | **Date**: 2026-07-14

How to run the app locally and validate that each user story works end-to-end. Details of data
shapes and function signatures live in [data-model.md](./data-model.md) and
[contracts/](./contracts/); this guide is the run/validation checklist.

## Prerequisites

- Node 18+ and npm
- A Convex account (free tier) for `npx convex dev`
- A modern desktop browser with camera/mic (Chrome/Edge/Firefox) for call validation
- Two browser profiles (or one normal + one incognito) to act as two users

## Setup

```bash
# From the repository root
npm install

# Start Convex (first run provisions a dev deployment and writes CONVEX_URL)
npx convex dev

# In a second terminal, start the Vite dev server
npm run dev
```

Environment:

- `.env.local` holds `VITE_CONVEX_URL` (from `npx convex dev`) and any auth secrets. It is
  gitignored and **never committed**.
- Convex Auth (password provider) requires its keys set via `npx convex env set` per the Convex
  Auth setup; see `convex/auth.ts`.

Open the app (default `http://localhost:5173`) in two separate browser profiles for multi-user
checks.

## Validation scenarios (by user story)

Each scenario maps to acceptance scenarios in [spec.md](./spec.md). "User A" and "User B" are
two browser profiles.

### US1 — Accounts, identity & presence (P1)
1. Sign up as User A (display name + avatar), then User B in the other profile.
2. Log in both. In a shared server (create one first, US2), confirm the member sidebar shows the
   other as **online**.
3. Close User B's tab; within ~5s User A sees User B go **offline** (SC-003) without refreshing.
4. Log out User A and attempt to open a server URL directly → redirected to login (FR-004).

### US2 — Servers & membership (P1)
1. As User A, create a server → it opens with a default **#general** text channel (US4 #1).
2. Generate an invite link; open it as User B → User B joins and appears in the sidebar.
3. As A (owner), rename the server → B sees the new name live (no refresh).
4. As A, remove B → B immediately loses access to the server. Re-add via invite; B's earlier
   messages are still shown (US2 #8, FR-010a).
5. As B (non-owner), confirm rename/remove controls are absent and blocked.

### US3 — Real-time text messaging (P1) ⭐ smoke-tested
1. A and B both open **#general**. A sends a message → appears for B within ~1s (SC-002), showing
   A's name, avatar, timestamp, content.
2. A edits the message → B sees the update marked **(edited)**. A deletes it → disappears for B.
3. B tries to edit A's message → not possible (FR-018).
4. Post 40+ messages; scroll up → older history loads in batches within ~1s (SC-006).
5. A starts typing → B sees a typing indicator within ~1s; it clears shortly after A stops.
6. Paste a >2000-char message → sending is blocked with a limit message (US3 #8).

### US4 — Channel management (P2)
1. As owner, create a text channel and a voice channel → both appear live for all members.
2. Rename each → live update. Delete the text channel → it and its messages vanish for everyone.
3. Non-owner cannot create/rename/delete channels.

### US5 — Direct messages (P2)
1. A opens a DM with B (they share a server) → 1-on-1 conversation for both.
2. Exchange messages in real time; edit/delete behave as in channels.
3. A opens a DM with B again → the **same** thread reopens (no duplicate) (US5 #5).
4. A user sharing no server is not offerable for DM (US5 #4).

### US6 — Voice & video calls (P2) ⭐ smoke-tested
1. A joins a voice channel → a call starts with A. The channel list shows A connected (FR-029).
2. B joins the same voice channel → both see each other's video tiles and connected state.
3. Toggle mic/camera on each → the other sees muted/video changes within ~2s (SC-005).
4. Confirm the speaking indicator highlights whoever is talking.
5. B leaves → A sees B drop from the call and channel list.
6. With a call active, have A join a *different* voice channel → A is removed from the first call
   automatically (single active call, US6 #8).
7. (If available) A 4th participant beyond the cap is prevented from joining (FR-025).
8. Kill B's tab mid-call → A sees B treated as left within the staleness window (US6 #7).

### US7 — 1-on-1 video from a DM (P3)
1. In an open A↔B DM, A starts a video call → B can join.
2. Toggle mic/camera → reflected to the other. Either leaves → call ends for them.

> **Network note**: With STUN-only (no TURN), peers on strict/symmetric NATs may fail to
> connect. Validate calls on a permissive network; the app surfaces a connection-failure message
> otherwise (documented v1 limitation).

## Automated checks

```bash
npm run typecheck     # tsc --noEmit (strict) — Principle III
npm run lint          # eslint
npm test              # Vitest: unit + component + convex-test + smoke
npm run build         # production build must succeed (Principle V)
```

Smoke tests (Principle VI) that must pass:
- **send message**: `messages.send` → a second subscribed client sees the message.
- **join call**: `calls.join` → roster includes the participant and signaling inbox is wired.

Definition of done per story (Constitution Principle V): the app builds and runs, the story's
acceptance scenarios above pass, and the relevant smoke tests are green before moving on.
