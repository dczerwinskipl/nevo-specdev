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
2. Support already-integrated proof and fast-forward as simple cases. For divergent history, prepare a conflict-free merge commit in an Engine-owned, identity-verified ISOLATED integration checkout based on pinned source/destination commits. Journal intent before Git, prove candidate parents/tree/commit and source content, THEN publish with a Git operation in the checked-out PRIMARY, e.g. `git merge --ff-only <pinned-candidate>`, NOT a bare `git update-ref` (which would desynchronize index/worktree). Persist `integration-publish-initiated` BEFORE launch, hold exact primary checkout/index and target-ref reservations, verify HEAD, index tree, clean physical worktree and intended Spec bytes AFTER completion. SIGKILL during checkout publication is an unknown effect until full reconciliation; Git ancestry alone never marks success. Never run branch checkout, reset, force, clean or remote fetch in PRIMARY; do not hold project control lock across Git subprocess. Review Git hooks/signatures and commit identity. A conflict must NOT dirty primary.
3. A KNOWN conflict after verified archive commit yields a deliberate `archived-linked-awaiting-integration` SETTLED outcome: pinned base/source/target and conflict paths, primary unchanged, canonical archived source/binding retained. Once isolated scratch is safely reconciled/retired and reservations released with evidence, a subsequent distinct CloseWorktree can attempt/prove later integration without silently changing the original immutable request. An uncertain process or unverified scratch must NOT be settled. On conflict return typed requires-resolution with pinned conflicts/base/source/target, preserve isolated worktree and journal with safe inspection; only an independently authorized future manual/agent resolution integration may supply a verified candidate, never self-invoke an agent in Engine. After Git returns or a process is interrupted, inspect HEAD/ancestry/tree and verify the target checkout contains exact required Specification tree/status plus intended committed branch changes. Failure/uncertainty is not success. Do not repeat merge if proof already exists.
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

## Required self-review corrections before T11 ACCEPT

- **P1 ownership of scratch merge:** Define a *specific* durable mechanism for isolated merge scratch creation, physical identity, scoped file inventory, crash observation, known-conflict state and NONDESTRUCTIVE cleanup or owned retention. Ordinary no-force cleanup may fail when merge conflicts leave staged/unmerged files; never silently force-delete or orphan a worktree. Candidate commit parents, tree and operation SHA must be verifiable without trusting only commit message. In an unknown Git outcome do not rerun subprocess blindly.
- **P1 post-archive conflict:** Source archive commit is ALREADY durable when linked integration is attempted. On a known conflict, preserve linked canonical archived Spec and its binding; return a truthful retained/needs-resolution result or a rigorously documented resumable state that does not strand the Spec. Define explicit later CloseWorktree route once manual/agent conflict reconciliation has been externally proven, without silently repinning immutable integration inputs. This is a current recovery design requirement, NOT implementation of future agent UX.
- **Security:** Integration covers the WHOLE branch, including code and `.nevo/config.yaml`, not only `specs/**`. Provide exact source-vs-target commit/path diff preview to T16 and refuse protected project/auth policy changes absent separate project-level authority. Authorization occurs BEFORE side effects; Git integration port itself never trusts request-scoped Spec permission.
- **Gate:** Independent real-Git review MUST approve clean divergent merge and conflicting merge, scratch lifecycle and crash checkpoints before T11 ACCEPT. Fast-forward-only green tests are not sufficient.

- **Final T11 checkpoint:** prove actual Git target publication updates HEAD/index/files, races for same primary target resource and SIGKILL between steps. Do not ACCEPT only on an isolated candidate commit and ancestry proof.
