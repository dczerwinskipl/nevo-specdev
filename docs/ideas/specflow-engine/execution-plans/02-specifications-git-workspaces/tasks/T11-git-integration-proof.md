---
id: ideas.specflow-engine.plan-02.task-11
type: engineering
title: 'E2.T11 — Git integration and destination proof'
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-task, temporary, lifecycle-closure]
read_when:
  - implementing or reviewing E2.T11
summary: >
  Temporary Plan 02 task: Git integration and destination proof.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.test-plan
---

# E2.T11 — Git integration and destination proof

**Temporary task, documentation only.** Branch feature/specflow-engine-foundation / existing PR #53. No product implementation exists merely because this plan is present. This file must be removed with the entire temporary execution-plans tree before PR merge.

## Executable prerequisites

- E2.T10 accepted

Run mode: **SOLO / independent Git review**. No parallel writes to shared Git refs, registry schemas, journal/state files, authentication capability lists or runtime composition. Re-check HEAD and approved decisions DC01–DC18 before editing code.

## Modules and ownership

Engine-internal version-control/git/integration.ts and typed ports in version-control/{git,worktrees}; low-level implementation via git/process and git/mutation; specs/lifecycle only calls a narrow typed integration interface.

## Required behavior / exact acceptance

1. Implement/read a validated Project Home integrationTargetBranch; report clean Git status including staged/untracked and sequencer state for BOTH verified checkouts, pinned pre-mutation HEADs, archive-commit integrationSourceCommit (when applicable), branch/ref, common-dir, source ancestry, proposed fast-forward and already-integrated proof. Do not infer integration from a PR or branch name.
2. Support already-integrated proof and fast-forward as simple cases. For divergent history, prepare a conflict-free merge commit in an Engine-owned, identity-verified ISOLATED integration checkout based on pinned source/destination commits. Journal intent before Git, prove candidate parents/tree/commit and source content, THEN fast-forward primary on its already-checked-out CONFIGURED target branch to verified candidate. Never run branch checkout, reset, force, clean or remote fetch in PRIMARY; do not hold project control lock across Git subprocess. Review Git hooks/signatures and commit identity. A conflict must NOT dirty primary.
3. On conflict return typed requires-resolution with pinned conflicts/base/source/target, preserve isolated worktree and journal with safe inspection; only an independently authorized future manual/agent resolution integration may supply a verified candidate, never self-invoke an agent in Engine. After Git returns or a process is interrupted, inspect HEAD/ancestry/tree and verify the target checkout contains exact required Specification tree/status plus intended committed branch changes. Failure/uncertainty is not success. Do not repeat merge if proof already exists.
4. Explicitly block unsafe/uncertain divergence, wrong checked-out configured destination branch, changed HEAD, source not committed, unexpected merge/sequencer state, replaced workspace or incompatible git policy. Clean divergence with verified merge is eligible; CONFLICT requires resolution but is not a successful close. A manually integrated source commit may be accepted only by actual ancestry and physical content.

## Required evidence

- Positive: real two-worktree repo fast-forward, conflict-free divergent merge and already-ancestor destination with exact persisted result, primary remains on original branch
- Negative/no unintended effects: diverged source, changed HEAD mid-admission, dirty primary, source change in another Spec and source SHA not in destination refuse rebind and report no false success
- Report LC test IDs, test files, OS/Node/Git version for real filesystem/process work, PASS/FAIL/SKIP, modified public contracts, and an independent code-quality/recovery review. Mock-only tests do not satisfy Git/process cases.
- Checkpoint for this task: Independent real-Git review including Windows/POSIX argument/path handling.
- Preserve completed E2.T01–T08; avoid unrelated refactors. No Plan 03 or Session dependency.

## Sources

- [Plan 02](../README.md)
- [Close architecture](../../../specification-and-worktree-close-design.md)
- [Decisions needing approval](../../../specification-close-decisions.md)
- [Lifecycle test matrix](../../../test-plan.md)
