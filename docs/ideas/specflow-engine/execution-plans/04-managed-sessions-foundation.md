---
id: ideas.specflow-engine.plan-04
type: engineering
title: Temporary execution plan 04 — Managed Sessions Foundation
status: draft
scope: specflow
areas: [runtime, ai, security, testing]
tags: [execution-plan, temporary, sessions, turns, mock-provider]
read_when:
  - executing the temporary Engine migration proof of concept
  - reviewing implementation tasks, verification and dependency gates
summary: >
  Disposable implementation plan for canonical Runtime Session Turn Work persistence and a controllable mock provider, without worktree-native resume.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.acceptance
  - ideas.specflow-engine.test-plan
  - architecture.principles.enforceable-invariants
---

# Plan 04 — Managed Sessions Foundation

**Lifecycle: temporary implementation plan.** Independently useful Runtime capability with a **controlled fake/mock provider**, *not* proof that any real provider can resume or switch worktrees. Work can begin alongside Plan 03 once Plan 01's identity boundaries are sufficiently decided.

## Verifiable result

An authenticated user creates/opens a provider-backed **test** Session in a fixed, verified project checkout context; invokes a Turn; Runtime persists canonical `Session -> Turn -> Work -> ToolAction`; receives ordered events and optional interaction requests; restarts; then reads a truthful recovered Session view. All identity, attention/readiness and Turn concurrency rules come from Runtime, not UI heuristics.

Actual repository evidence: `packages/specflow-runtime/src/features/sessions/feature.ts` currently only registers Session authorization capabilities; `packages/specflow-contracts/src/sessions/` contains capabilities, not the full execution model. No real Session management API should be assumed already implemented. Reuse current [AI architecture](../../../architecture/ai/canonical-session-turn-work.md).

## Task sequence

| Task | Implement and prove | Depends on |
| --- | --- | --- |
| E4.T01 — Session contract reconnaissance | Inspect current `@nevo/specflow-contracts/sessions`, Runtime Sessions feature, existing UI session routes/mock data, accepted canonical Session/Turn/Work and provider boundary docs, and legacy `tools/dashboard/server/ai/sessions/**`. Identify migration semantics vs disposable infrastructure. | Plan 01 readiness |
| E4.T02 — Canonical identities | Define stable product `sessionId`, `turnId`, `workId`, `interactionId` and separate provider native `ProviderSessionRef=(provider, providerSessionId)`; preserve existing normative adapter meaning until the new owned-ID contract is deliberately adopted. Do **not** derive Session from Task, workspace path or providerSessionId alone. | T01 |
| E4.T03 — Durable Runtime state | Implement versioned Runtime-owned Session/Turn/Work repository under approved local state home. One non-terminal active Turn per Session, idempotent logical turn starts, terminal immutability, bounded recovery records and ordered work. Do not persist duplicate Engine workflow position. | T02 |
| E4.T04 — Provider-neutral test driver | Introduce a controllable local mock provider/adapter that emits deterministic commentary, work, tools, interaction requests, success/failure/cancel and simulated late events. It should support synthetic provider IDs without claiming real provider parity. | T02–T03 |
| E4.T05 — Turn coordinator | Implement Runtime-owned start/observe/interact/cancel/reconcile lifecycle; an interrupted live operation becomes a truthful interrupted/unavailable/recoverable state according to evidence. Normalize provider-specific data into canonical Work, not raw events in UI. | T03–T04 |
| E4.T06 — HTTP/stream contracts | Add authenticated and scoped feature-owned Session read/start/cancel/interact endpoints and streaming/replay where currently supported architecture permits. Place exact DTOs in `@nevo/specflow-contracts`, not shared UI fixtures or Engine. Separate ownership of Runtime read source from API presenter. | T03–T05 |
| E4.T07 — UI integration slice | Expose minimal real Session list/detail/active Turn state in existing UI feature boundaries, including loading, error, attention and recoverable statuses. Avoid broad UI redesign; do not render demo fixtures for production. | T06 |
| E4.T08 — Lifecycle/security tests | Run real Runtime HTTP and durable store with mock provider; overlapping start, idempotent retry, terminal-event immutability, interrupted interaction, restart, cancellation, ordering, authorization and unauthorized Session projection. | T02–T07 |

## Deliberately no Engine claim in this foundation

A standalone Session can exist without Task, workflow or Engine writer claim **only if the mock execution is enforced read-only / no real filesystem mutations**. Provider dispatch that could actually write code is blocked until Plan 05 integrates Engine admission. A conversational Turn is not secretly a workflow attempt.

Session associations with a Spec/Task are optional scoped product metadata and must be authorized, not used as implicit workflow progression. The Runtime Session service owns presentation-level semantic readiness; the UI cannot guess statuses from provider event strings.

## Exit gate

- Pass **S01** on real persistence and Runtime HTTP: durable `sessionId`, Turn/Work ordering and reload, truly read-only mock conversation.
- Demonstrate one-active-turn admission, idempotent duplicate Turn request, safe terminal immutability, correct interaction validity after restart/cancel and scoped Session read.
- Production wiring uses feature-owned source, not Storybook/demo fixtures; if provider is absent in production, report unsupported/unavailable honestly.
- Dependency/import review: Engine does not import Sessions, provider adapters, UI or Runtime.

This foundation **does not claim SI03–SI08**, which require Plan 05 and broader mock-provider execution tests.

## Exclusions with explicit future owner

No real Claude/Codex/Antigravity adapter, native provider resume, changing provider `cwd` across worktrees, Session migration after spec rebind, cross-worktree live Session moves, native history import, full transcript cloning or production provider credential manager. These become later adapter-specific plans after their actual capabilities can be verified.

## Sources and handoff

- [Managed Session integration concept](../managed-session-integration.md), [ownership](../ownership-and-state.md), [Runtime/Engine boundaries](../engine-cli-runtime-boundaries.md), [acceptance](../acceptance-criteria.md).
- [Canonical Session/Turn/Work](../../../architecture/ai/canonical-session-turn-work.md), [provider boundary](../../../architecture/ai/provider-boundary.md), [Runtime ownership](../../../architecture/runtime/ownership-and-lifecycle.md), [Runtime authorization](../../../architecture/runtime/auth/authorization.md).

**Ready for Plan 05:** stable product and provider-correlated identities, persisted Turn lifecycle, deterministic mock driver, authorized read model and no hidden mutation without Engine admission.
