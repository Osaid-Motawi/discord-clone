<!--
Sync Impact Report
==================
Version change: (template, unversioned) → 1.0.0
Bump rationale: Initial ratification of the project constitution from the template.
  MAJOR baseline (1.0.0) established for the first concrete set of principles.

Modified principles: N/A (initial adoption)
Added principles:
  - I. Simplicity First
  - II. Real-Time Correctness
  - III. Type Safety End-to-End
  - IV. Security Basics
  - V. Incremental Delivery
  - VI. Testable Seams
Added sections:
  - Additional Constraints (technology & scope guardrails)
  - Development Workflow (quality gates)
  - Governance
Removed sections: None

Templates requiring updates:
  - .specify/templates/plan-template.md ✅ compatible (Constitution Check gate present)
  - .specify/templates/spec-template.md ✅ compatible (prioritized, independently testable stories)
  - .specify/templates/tasks-template.md ✅ compatible (per-story phases, incremental delivery)

Follow-up TODOs: None
-->

# Discord Clone Constitution

## Core Principles

### I. Simplicity First

Prefer the smallest solution that satisfies the spec. Teams MUST NOT introduce
speculative abstractions, configuration, or generalization for use cases that are not
in the current spec. No library, framework, or service may be added unless it is named
in the approved plan; adding a dependency requires amending the plan first.

**Rationale**: This is a student-built project with finite time. Every abstraction and
dependency is a maintenance and comprehension cost. YAGNI keeps the codebase small
enough for the team to fully understand and finish.

### II. Real-Time Correctness

The UI MUST reflect server state through reactive subscriptions that push updates to the
client. Manual polling loops, timers used to refresh data, and "reload the page to see
changes" flows are prohibited for any collaborative or live data (messages, presence,
call state). When the server state changes, connected clients MUST observe the change
without a user-initiated refresh.

**Rationale**: A chat and video app is defined by immediacy. Polling is wasteful and
races; refresh-to-update breaks the core experience. Reactive subscriptions make
correctness the default rather than something reconciled after the fact.

### III. Type Safety End-to-End

TypeScript strict mode MUST be enabled across the entire codebase (frontend, backend,
and shared code). Use of `any` to bypass the type system is prohibited except at
genuinely untyped external boundaries, and each such use MUST be justified in a comment.
All database access MUST go through typed schema definitions; raw untyped queries are not
permitted.

**Rationale**: End-to-end types catch whole classes of bugs at compile time, document the
contracts between layers, and make refactoring safe. A typed data layer prevents the most
common source of runtime errors in data-driven apps.

### IV. Security Basics

Every backend function that touches a resource MUST validate that the caller is
authenticated and is authorized for that specific resource before performing any read or
write. There are no trusted clients; authorization checks MUST run on the server, never
only in the UI. A function that cannot establish authorization MUST reject the request.

**Rationale**: Client-side checks are cosmetic and trivially bypassed. Enforcing
authentication and per-resource authorization on the server is the minimum bar for not
leaking or corrupting other users' data.

### V. Incremental Delivery

The application MUST build and run after each user story is completed. The main branch
MUST always be in a working, runnable state; broken code MUST NOT be merged to main. Work
is delivered as independently testable, demonstrable increments (see the spec and tasks
templates), each of which leaves the app functional.

**Rationale**: A continuously working main branch means the project is always
demonstrable and always shippable at its current scope. It prevents the end-of-project
integration collapse that kills student projects.

### VI. Testable Seams

Business logic MUST be separated from UI so that it can be exercised without rendering a
component. Critical flows — at minimum sending a message and joining a call — MUST each
have at least a smoke test that verifies the flow end to end. New business logic SHOULD be
placed behind a testable seam rather than embedded in view code.

**Rationale**: Logic entangled with UI cannot be tested cheaply and rots. Separating seams
makes the important flows verifiable and guards them against regression as the app grows.

## Additional Constraints

- **Technology scope**: The stack is fixed by the approved plan. Any change to languages,
  frameworks, databases, or third-party services requires a plan amendment (and, if it
  alters a principle, a constitution amendment) before implementation.
- **Data access**: All persistence goes through the typed schema layer defined in the
  plan. No direct, untyped, or ad-hoc database access from feature code.
- **Server authority**: Authentication and authorization are server-side concerns.
  Clients MAY hide UI affordances for convenience, but MUST NOT be relied on for access
  control.

## Development Workflow

- **Constitution gate**: Every plan MUST pass the Constitution Check before design work
  proceeds. Violations MUST be recorded in the plan's Complexity Tracking table with a
  justification and the rejected simpler alternative, or the design MUST be changed.
- **Definition of done per story**: A user story is complete only when the app builds and
  runs, its acceptance scenarios pass, and any required smoke tests (Principle VI) pass.
- **Main branch health**: Changes that leave the app unable to build or run MUST NOT be
  merged. Fixing a broken main takes priority over new work.
- **Review**: Code review MUST verify compliance with these principles, especially
  authorization on backend functions, reactive (non-polling) data flow, and strict typing.

## Governance

This constitution supersedes other development practices for this project. When a
practice and a principle conflict, the principle wins.

**Amendments**: Amendments MUST be proposed as a change to this file with a rationale, be
approved by the team, and update dependent artifacts (plan, spec, and tasks templates) in
the same change so they stay in sync.

**Versioning**: This constitution is versioned with semantic versioning:
- **MAJOR**: Backward-incompatible governance or principle removals or redefinitions.
- **MINOR**: A new principle or section is added, or guidance is materially expanded.
- **PATCH**: Clarifications, wording, or non-semantic refinements.

**Compliance**: All plans and reviews MUST verify compliance with this constitution.
Complexity or deviations MUST be justified in the plan's Complexity Tracking table; if it
cannot be justified, the simpler compliant approach MUST be taken.

**Version**: 1.0.0 | **Ratified**: 2026-07-14 | **Last Amended**: 2026-07-14
