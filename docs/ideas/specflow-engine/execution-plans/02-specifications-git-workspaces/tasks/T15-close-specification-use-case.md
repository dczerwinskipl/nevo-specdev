---
id: ideas.specflow-engine.plan-02.task-15
type: engineering
title: 'E2.T15 — Specification closure and future workflow seam'
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-task, temporary, lifecycle-closure]
read_when:
  - implementing or reviewing E2.T15
summary: >
  Temporary Plan 02 task: Specification closure and future workflow seam.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.test-plan
---

# E2.T15 — Specification closure and future workflow seam

**Temporary task, documentation only.** Branch feature/specflow-engine-foundation / existing PR #53. No product implementation exists merely because this plan is present. This file must be removed with the entire temporary execution-plans tree before PR merge.

## Executable prerequisites

- E2.T10 accepted
- E2.T12 accepted
- E2.T13 accepted
- E2.T14 accepted
- Owner-approved DC05/DC08/DC10: real archive effects plus explicit future TODO seams, NO fake workflow/writer infrastructure

Run mode: **SOLO / independent domain review**. No parallel writes to shared Git refs, registry schemas, journal/state files, authentication capability lists or runtime composition. Re-check HEAD and approved decisions DC01–DC18 before editing code.

## Modules and ownership

Engine: specs/lifecycle/close-specification.ts owns real lifecycle orchestration using archive, narrow Git and registry capabilities. Do NOT create lifecycle/specification-exit-policy.ts, WorkflowGateway, registry, fake service, injected optional callback or new workflow-facing type when no evaluator exists. Leave one explicit TODO in the application orchestrator before the first archive side effect; future Specification-workflow slice will own the real gate/action component.

## Required behavior / exact acceptance

1. One specification-close intent contains ONLY current real inputs/effects: validated authorization, immutable integrateToTargetBranch input (linked default true), canonical source, archive, automatic scoped Engine commit, and optional verified Git integration/rebind/disposal. If true, linked close includes integration/rebind/disposal; if false, after archive commit complete with canonical archive still in linked checkout and linked binding unchanged (worktree/branch retained). Do NOT claim archive exists in primary. Primary directly archives and commits only. Linked source archives/commits BEFORE verified primary integration. Never call the public worktree-close operation as a suboperation.
2. Currently there are NO Specification exit gates, exit actions or active process coordination contracts. Ordinary authorized close proceeds after REAL current preflight; NO admin override, gate pass/not-configured result, placeholder journal step or `acknowledgeAbsentSpecificationExitChecks`. In `close-specification.ts`, after verified preflight and BEFORE the first archive mutation, mark `// TODO(specification-exit): connect real Specification exit gates/actions owned by future workflow slice here.` This preserves placement without designing an imaginary evaluator today. Deterministic workflow is the only intended future execution model, not a selectable mode.
3. When the real workflow capability arrives, define the minimal typed port at THAT time, owned by the actual workflow feature, and integrate it at this seam. Ensure unknown/blocked real gate outcome stops before archival, and future exit actions use durable idempotent/reconcilable effects. Do NOT define speculative evaluator functions, no-op adapters, registries or a pretend action-settled phase now. Automated archive commit is always an Engine operation today.
4. Validate already-closed repeat by verified canonical archive and matching journal/identity; a conflicting close with new ID must not create another commit. Do not inspect tasks: unknown[] or infer from status.

## Required evidence

- Positive: primary and linked-integrated archive through same Engine use case with original specId and exactly one archive in verified primary; linked archive-only retains one canonical archive bound to linked worktree, later close-worktree integrates it without reevaluating gates
- Negative/no unintended effects: absence of synthetic gate/writer fields, fake approvals and fabricated outcomes; real unauthorized caller, already archived contradictory journal, crash after source archive or automated archive commit never pass as completed
- Report LC test IDs, test files, OS/Node/Git version for real filesystem/process work, PASS/FAIL/SKIP, modified public contracts, and an independent code-quality/recovery review. Mock-only tests do not satisfy Git/process cases.
- Checkpoint for this task: Independent review of real Engine orchestration, correct placement of TWO future seams across close/disposal, and automatic archive commit without speculative abstractions.
- Preserve completed E2.T01–T08; avoid unrelated refactors. No Plan 03 or Session dependency.

## Sources

- [Plan 02](../README.md)
- [Close architecture](../../../specification-and-worktree-close-design.md)
- [Decisions needing approval](../../../specification-close-decisions.md)
- [Lifecycle test matrix](../../../test-plan.md)

## Required self-review corrections before T15 ACCEPT

- For linked integrateToTargetBranch=true, archive+automatic commit precedes merge. A known conflict is NOT failure of the already committed archive: source remains canonical as archived in linked workspace, primary is untouched, removal/rebind are skipped. An actionable retained/needs-resolution outcome must be evidence-backed and allow later CloseWorktree; a permanently active journal owner without recovery is not acceptable. Do not silently change immutable integrateToTargetBranch into false.
- Do not fabricate workflow exit checks, active process inspection, administrative bypass or injected no-op gateways. Keep only explicit TODO integration checkpoints owned by future real feature slices.
