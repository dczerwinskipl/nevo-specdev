---
id: ideas.specflow-engine.plan-02.task-12
type: engineering
title: 'E2.T12 — CAS rebind and managed workspace disposal'
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-task, temporary, lifecycle-closure]
read_when:
  - implementing or reviewing E2.T12
summary: >
  Temporary Plan 02 task: CAS rebind and managed workspace disposal.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.test-plan
---

# E2.T12 — CAS rebind and managed workspace disposal

**Temporary task, documentation only.** Branch feature/specflow-engine-foundation / existing PR #53. No product implementation exists merely because this plan is present. This file must be removed with the entire temporary execution-plans tree before PR merge.

## Executable prerequisites

- E2.T10 accepted
- E2.T11 accepted

Run mode: **SOLO / independent data-loss review**. No parallel writes to shared Git refs, registry schemas, journal/state files, authentication capability lists or runtime composition. Re-check HEAD and approved decisions DC01–DC12 before editing code.

## Modules and ownership

project/registry-store.ts, workspace-registry.ts and validation/types ONLY for scoped lifecycle transitions; version-control/worktrees/close-{port,git-adapter}.ts for non-forced removal. specs/lifecycle/rebinding.ts and disposal.ts orchestrate, not generic Git.

## Required behavior / exact acceptance

1. Narrow, auditable CAS transition from one verified explicit linked Spec binding to primary, advancing binding generation. Require journal verified destination proof and expected source binding; never loosen generic registration append-only guard.
2. Revalidate source/destination identity, no other explicit binding to source, no unsettled writer/operation evidence and source clean. Inherited manifests are permitted only when untouched and not source-owned.
3. CAS rebind precedes any worktree removal; from that instant ordinary reads resolve primary. Keep old registration until cleanup completes. Removal under journal initiated stage uses non-force Git worktree removal, safe location/instance checks, and reports retained or uncertain state without fabricating completion.
4. Remove obsolete linked registration under another narrow CAS only after confirmed Git effect and zero references. Leave branch ref intact. If cleanup fails retain journal and safe primary binding. Do not erase ownership evidence preemptively.

## Required evidence

- Positive: real CAS rebind after verified content; primary read remains available after safe source removal
- Negative/no unintended effects: stale generation, unrelated registered spec, unmanaged/shared/substituted path, dirty source, refused non-force deletion leave source untouched and never revert verified primary binding
- Report LC test IDs, test files, OS/Node/Git version for real filesystem/process work, PASS/FAIL/SKIP, modified public contracts, and an independent code-quality/recovery review. Mock-only tests do not satisfy Git/process cases.
- Checkpoint for this task: Review both order and crash window after CAS but before remove, plus removal before registry retirement.
- Preserve completed E2.T01–T08; avoid unrelated refactors. No Plan 03 or Session dependency.

## Sources

- [Plan 02](../README.md)
- [Close architecture](../../../specification-and-worktree-close-design.md)
- [Decisions needing approval](../../../specification-close-decisions.md)
- [Lifecycle test matrix](../../../test-plan.md)
