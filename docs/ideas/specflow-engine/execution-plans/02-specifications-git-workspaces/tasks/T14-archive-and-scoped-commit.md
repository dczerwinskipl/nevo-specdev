---
id: ideas.specflow-engine.plan-02.task-14
type: engineering
title: 'E2.T14 — Physical archive and narrowly scoped Git commit'
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-task, temporary, lifecycle-closure]
read_when:
  - implementing or reviewing E2.T14
summary: >
  Temporary Plan 02 task: Physical archive and narrowly scoped Git commit.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.test-plan
---

# E2.T14 — Physical archive and narrowly scoped Git commit

**Temporary task, documentation only.** Branch feature/specflow-engine-foundation / existing PR #53. No product implementation exists merely because this plan is present. This file must be removed with the entire temporary execution-plans tree before PR merge.

## Executable prerequisites

- E2.T10 accepted
- E2.T11 accepted

Run mode: **SOLO / independent filesystem and commit review**. No parallel writes to shared Git refs, registry schemas, journal/state files, authentication capability lists or runtime composition. Re-check HEAD and approved decisions DC01–DC18 before editing code.

## Modules and ownership

Engine: specs/lifecycle/archive-{plan,effects,verify}.ts and version-control/git/scoped-commit.ts; specifications repository/model only minimal validated archive write helpers. No workflow code or Runtime changes.

## Required behavior / exact acceptance

1. Read the canonical manifest's ACTUAL filename (new specification.yaml or historic change.yaml) and preserve that path throughout archival; do not implicitly rename historical content as part of close. Inspect required derived/spec/docs indexes before mutation. They are projections, not canonical authorities, but if index regeneration is required by current repo contract, classify EXACT generated paths as Engine-owned archive effects and include their regenerated verified bytes in the scoped commit/recovery inventory. Do not leave required indexes stale or grant an arbitrary add -A. For one verified active Specification preserve specId/slug and entire directory tree while moving specs/active/<slug> to specs/archive/<slug>, writing status=archived. Fail closed on existing target, symlinks, duplicates or moved/changed source.
2. Persist archive-initiated intent and exact inventory before mutation. Reconcile crash before/during/after move by checking actual file inventories and identity. No uncontrolled overwrite/rollback.
3. Archive commit is MANDATORY, AUTOMATIC and INTERNAL to the Engine Specification-close operation. The invoker MUST hold a durable exclusive reservation of the exact checkout/index/ref before move/stage/commit and until verified settlement; two different Specs in primary are conflicting writers, not independent. Create on the same checkout honors the same resource coordination. Neither agent/human nor CLI/HTTP independently stages, commits or renames archive content. Engine stages and commits ONLY planned archive paths (no action runner or action outputs exist today). First admission requires globally clean index/worktree; verify staged set after git add with literal pathspecs; no arbitrary add -A. Include operationId marker in commit but verify Git ancestry/tree rather than trusting message.
4. Commit-initiated is durable BEFORE invoking Git, with unknown outcome fencing and exactly-once verification on retry. `archive` and `commit` are ONE Engine-controlled business effect chain, not a manual checkpoint or an adapter responsibility. Refuse commit hook/index surprises rather than silently committing user files. A primary close needs no worktree or merge.

## Required evidence

- Positive: real primary archive commit preserves specId and all ancillary files; exactly one archived record, no other path committed
- Negative/no unintended effects: dirty/staged/untracked, target already exists, partial file move, failed Git commit, changed manifest or extra staged path is recovery/block, not user file loss
- Report LC test IDs, test files, OS/Node/Git version for real filesystem/process work, PASS/FAIL/SKIP, modified public contracts, and an independent code-quality/recovery review. Mock-only tests do not satisfy Git/process cases.
- Checkpoint for this task: Review archive/commit crash points separately from Git integration and workflow.
- Preserve completed E2.T01–T08; avoid unrelated refactors. No Plan 03 or Session dependency.

## Sources

- [Plan 02](../README.md)
- [Close architecture](../../../specification-and-worktree-close-design.md)
- [Decisions needing approval](../../../specification-close-decisions.md)
- [Lifecycle test matrix](../../../test-plan.md)
