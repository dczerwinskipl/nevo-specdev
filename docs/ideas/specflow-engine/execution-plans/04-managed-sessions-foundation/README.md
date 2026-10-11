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

Actual repository evidence: `packages/specflow-runtime/src/features/sessions/feature.ts` currently only registers Session authorization capabilities; `packages/specflow-contracts/src/sessions/` contains capabilities, not the full execution model. No real Session management API should be assumed already implemented. Reuse current [AI architecture](../../../../architecture/ai/canonical-session-turn-work.md).

## Execution order, task files and review checkpoints

Each task has its own Markdown file. **Batch** means sequential tasks in one agent session; **parallel** means independent workers writing disjoint owners; **solo** means separately executed and reviewed. The task-level dependency links are executable prerequisites, not only documentation. For cross-plan ordering see the [program runbook](../README.md).

### Recommended waves

1. T01 solo (discovery)
2. T02 solo (identity/DTO contract)
3. **T03 ∥ T04** parallel group `4-session-internals` (separate code ownership)
4. T05 solo (coordinator integration)
5. T06 → T07 sequential batch `4-runtime-surface`
6. T08 solo (acceptance)

### Tasks

| Task | Depends on | Run mode |
| --- | --- | --- |
| [E4.T01 — Session contract reconnaissance](tasks/T01-session-contract-reconnaissance.md) | E1.T07 | Solo |
| [E4.T02 — Canonical identities](tasks/T02-canonical-identities.md) | E4.T01 | Solo |
| [E4.T03 — Durable Runtime state](tasks/T03-durable-runtime-state.md) | E4.T02 | Parallel `4-session-internals` |
| [E4.T04 — Provider-neutral test driver](tasks/T04-provider-neutral-test-driver.md) | E4.T02 | Parallel `4-session-internals` |
| [E4.T05 — Turn coordinator](tasks/T05-turn-coordinator.md) | E4.T03, E4.T04 | Solo |
| [E4.T06 — HTTP/stream contracts](tasks/T06-http-stream-contracts.md) | E4.T05 | Sequential batch `4-runtime-surface` |
| [E4.T07 — UI integration slice](tasks/T07-ui-integration-slice.md) | E4.T06 | Sequential batch `4-runtime-surface` |
| [E4.T08 — Lifecycle/security tests](tasks/T08-lifecycle-security-tests.md) | E4.T02, E4.T03, E4.T04, E4.T05, E4.T06, E4.T07 | Solo |

**Batch policy:** never auto-batch a high-risk solo gate with dependent tasks; re-evaluate shared file ownership at dispatch. In particular, lock/claim, security, HTTP scopes, durability/recovery and dispatch uncertainty need an explicit review checkpoint. If a task uncovers an architecture conflict, stop dependent tasks but continue unaffected, disjoint work.

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

- [Managed Session integration concept](../../managed-session-integration.md), [ownership](../../ownership-and-state.md), [Runtime/Engine boundaries](../../engine-cli-runtime-boundaries.md), [acceptance](../../acceptance-criteria.md).
- [Canonical Session/Turn/Work](../../../../architecture/ai/canonical-session-turn-work.md), [provider boundary](../../../../architecture/ai/provider-boundary.md), [Runtime ownership](../../../../architecture/runtime/ownership-and-lifecycle.md), [Runtime authorization](../../../../architecture/runtime/auth/authorization.md).

**Ready for Plan 05:** stable product and provider-correlated identities, persisted Turn lifecycle, deterministic mock driver, authorized read model and no hidden mutation without Engine admission.
