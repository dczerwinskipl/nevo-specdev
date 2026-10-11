---
id: ideas.specflow-engine.plan-05
type: engineering
title: Temporary execution plan 05 — Managed Execution Integration
status: draft
scope: specflow
areas: [workflow, runtime, ai, security, testing]
tags: [execution-plan, temporary, managed-execution, handover, recovery]
read_when:
  - executing the temporary Engine migration proof of concept
  - reviewing implementation tasks, verification and dependency gates
summary: >
  Disposable implementation plan to integrate the real Engine coordinator and mock-provider Runtime Turns with crash-safe invocation and explicit workflow settlement.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.acceptance
  - ideas.specflow-engine.test-plan
  - architecture.principles.enforceable-invariants
---

# Plan 05 — Managed Execution Integration

**Lifecycle: temporary implementation plan.** Final integration slice of the first testable program. Requires Plan 03's **real** Engine admission/Workflow Kernel and Plan 04's **real** Runtime Session/Turn persistence and mock provider. The mock is a deliberate constraint, not a substitute for native-adapter certification.

## Demonstration boundary

In a **single verified, fixed execution checkout** (typically the primary workspace), an authenticated Session requests a writable Turn for a real Task step. Runtime resolves canonical target through Engine, checks workflow readiness, obtains an effect-scoped writer claim, durably records invocation intent and dispatches a controllable mock provider. After Turn termination, Engine reconciles/relinquishes the exact claim; **the Task remains unfinished until an explicit workflow `finish`**. Another conflicting writer cannot enter during an ambiguous dispatch. Handover and a small explicit batch preserve Task attempt ownership and never spawn the next Session automatically.

A path/workspace identity may be recorded for audit, but **do not launch/resume an actual provider in another worktree**, switch `cwd` for existing provider-native Sessions, or test session relocation via fake provider capability. Worktree-aware provider Session integration is a later adapter-gated plan.

## Task sequence

| Task | Implement and prove | Depends on |
| --- | --- | --- |
| E5.T01 — Cross-owner contract | Inspect Engine admission/claim/attempt APIs from Plan 03 and Runtime Turn/Session persistence from Plan 04. Define explicit intent/receipt shapes and resource ownership. `sessionId`, `turnId`, `invocationId`, `executionId`, `workspaceId`, `workflowAttemptRef`, and `ProviderSessionRef` stay distinct. | Plans 03 & 04 |
| E5.T02 — Preparation and authorization | Resolve canonical `specId` and actual target workspace under Engine, derive effect scope and requested Task attempts, authorize through Runtime (resource scope not client `workspaceId`), inspect workflow readiness and acquire writer claim only when effects require it. | T01 |
| E5.T03 — Atomic-enough intent protocol | Design two durable authorities: Engine owns claim/operations, Runtime owns Turn/provider invocation. Persist correlatable intent before provider side effects, with idempotency/revision compare-and-set so crash after claim but before Turn intent is discoverable. Do not invent a cross-store ACID transaction. | T02 |
| E5.T04 — Mock dispatch phases | Implement explicit `prepared` (proven not dispatched), `dispatching/unknown`, and `started` (correlated/evidenced) milestones. Inject failures **before spawn, after spawn before ID persisted, after correlation, during Work, and before settlement**. Unknown dispatch never automatically launches a replacement. | T03 |
| E5.T05 — Turn/claim settlement | Runtime terminalizes its Turn only with its evidence; Engine independently reconciles/relinquishes exact owned claim with fencing/correlation proofs. A terminal Turn or release **never** auto-finishes Task or activates next step. Cancellation with ambiguous tool effects may keep writer blocked. | T04 |
| E5.T06 — Explicit workflow interaction | Link one managed writable Turn to an actual Workflow attempt, then call explicit Engine `step finish` after passing declared gates; verify no hidden transition on Turn settlement. Also show a standalone truly read-only Turn with no workflow/claim. | T05 |
| E5.T07 — Bounded batch and handover | Support minimal **explicit** ordered set of Task attempts and new successor Session intent/context, preserving per-Task state and current claim. Never infer a Task from historical Session associations; no automatic reviewer spawning or claim transfer without settlement. | T05–T06 |
| E5.T08 — Restart and auth regressions | Cross-process and Runtime restart scenarios, duplicate request IDs, stale callbacks, uncertain provider outcome, wrong owner, per-Spec auth, unauthorized Session/Task reference redaction, manual recovery visibility. Test with real Git files where relevant and controlled mock provider. | T02–T07 |
| E5.T09 — Architecture audit + promotion backlog | Review imports, state ownership, diagnostics, error taxonomy, live API wiring and batch boundaries; record all deferred native provider/worktree concerns as future contracts. Propose ADR changes **only after** full A/B and relevant Session integration gates pass. | T08 |

## Hard invariants to review

1. `Execution Claim != Workflow Attempt != Runtime Turn != Provider Session`.
2. No unproven replay after the mock indicates “spawned but not correlated”; the same uncertainty rule must later be proven against each real provider.
3. Runtime cancel/terminal outcome is **not** proof that all external side effects are settled.
4. Handover is an explicit new managed execution request; does not inherit an active claim or advance workflow.
5. All code-changing managed execution uses a verified Engine admission; a read-only Turn can skip claim only with enforced non-writing capabilities.
6. External CLI agents remain unregistered as managed Runtime Sessions unless a later explicit feature does so.

## Integration acceptance — what is demonstrable now

Use real Engine + Runtime + controlled mock provider to prove **SI01–SI05, SI07 and SI08** and appropriate S01–S06/S08, R06 and H09 cases; in particular test S06 at every intent/spawn/correlation crash cut. Validate basic S04 sequential batch and S05 explicit handover without broad production orchestration.

**Deliberately deferred:** **SI06/S07** (provider-native resume or moved/rebound worktree during a managed Session), real adapter timeouts and side-effect fencing, cross-worktree provider execution, active-Session rebind cleanup (B03), full provider parity, nontrivial auto-batch routing and complete workflow catalogue. A mock passing S06 does not imply real provider replay safety.

Plan 02's optional **non-session** rebind/cleanup can use real Git evidence separately. Do not call this integration complete for provider/worktree behavior that was deliberately not tested.

## Verification demo

```text
1. Real Engine Task ready; Runtime Session created using mock.
2. Start writable Turn -> claim acquired + dispatch intent durable.
3. Concurrent offline CLI writer denied for same workspace.
4. Mock emits Work then completes -> Turn terminal; Task still active.
5. Explicit workflow finish -> deterministic Task progression.
6. Restart/kill at spawn-before-correlation -> unknown outcome, no duplicate Turn/tool effect.
7. Reconcile only with positive evidence; inspect returns actionable blocker otherwise.
8. Request next Session via explicit handover; batch Task identities stay distinct.
```

No live provider sessions are required to execute any of these steps.

## Sources and end-of-program cleanup

- [Managed handshake](../managed-session-integration.md), [execution scopes](../execution-scopes-and-recovery.md), [durable operations](../durable-operations-and-recovery.md), [local trust](../local-actor-and-human-gates.md), [test plan](../test-plan.md), [acceptance](../acceptance-criteria.md).
- [Canonical Session model](../../../architecture/ai/canonical-session-turn-work.md), [deterministic workflow](../../../architecture/workflow/deterministic-workflow.md).

When the verified implementation and owner architectural review are accepted, record lasting invariants/contracts in authoritative architecture, reference or ADR files, then **delete these five temporary execution plan documents and regenerate docs indexes**. Keep tests, evidence, and any accepted ADRs. Do not promote untested mock assumptions as provider-native guarantees.
