---
id: ideas.specflow-engine.plan-02.task-13
type: engineering
title: 'E2.T13 — Close Worktree application operation'
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-task, temporary, lifecycle-closure]
read_when:
  - implementing or reviewing E2.T13
summary: >
  Temporary Plan 02 task: Close Worktree application operation.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.test-plan
---

# E2.T13 — Close Worktree application operation

**Temporary task, documentation only.** Branch feature/specflow-engine-foundation / existing PR #53. No product implementation exists merely because this plan is present. This file must be removed with the entire temporary execution-plans tree before PR merge.

## Executable prerequisites

- E2.T10 accepted
- E2.T11 accepted
- E2.T12 accepted

Run mode: **SOLO / end-to-end review**. No parallel writes to shared Git refs, registry schemas, journal/state files, authentication capability lists or runtime composition. Re-check HEAD and approved decisions DC01–DC18 before editing code.

## Modules and ownership

Engine: specs/lifecycle/close-worktree.ts, read-only preview and completion/inspection orchestration. Reuse version-control and registry lifecycle capabilities. No changes to specification status or archive files.

## Required behavior / exact acceptance

1. One worktree-close operation owns reservation -> integration proof -> verified rebind -> guarded disposal -> result. Eligibility restricted to exclusive managed linked binding and source location active OR archive (archived linked Spec retained after close without integration); worktree closing never evaluates exit gates, alters status or archives.
2. Same specId remains canonical once, status/location preserved as either active or archive, destination checkout physically contains intended files. Plain same-ID repeat returns prior evidence-backed result; competing ID is conflict.
3. No caller-supplied external-writer acknowledgement or fabricated claim enumeration. Block on ACTUAL unresolved Engine journals/locks, ambiguous Git effect, unsafe local files or identity; document that arbitrary external OS writers are not fenced by Foundation. On removal failure report verified integration/rebound with cleanup pending, not terminal success. Future writer admission hooks belong to the shared disposal slice, not this use case.
4. Standalone Git operations remain internal; no Task/Attempt or Runtime dependencies.

## Required evidence

- Positive: create linked spec, commit its work, close worktree and resolve same active spec from primary; ALSO close spec locally with integrateToTargetBranch=false, then later close worktree to integrate existing archive and retain original specId
- Negative/no unintended effects: call on primary/unmanaged/shared linked checkout, divergent branch and SIGKILL after merge/CAS cannot cause duplicate merge, false archive or deletion
- Report LC test IDs, test files, OS/Node/Git version for real filesystem/process work, PASS/FAIL/SKIP, modified public contracts, and an independent code-quality/recovery review. Mock-only tests do not satisfy Git/process cases.
- Checkpoint for this task: Review separate domain semantics and rebind-after-integration evidence.
- Preserve completed E2.T01–T08; avoid unrelated refactors. No Plan 03 or Session dependency.

## Sources

- [Plan 02](../README.md)
- [Close architecture](../../../specification-and-worktree-close-design.md)
- [Decisions needing approval](../../../specification-close-decisions.md)
- [Lifecycle test matrix](../../../test-plan.md)
