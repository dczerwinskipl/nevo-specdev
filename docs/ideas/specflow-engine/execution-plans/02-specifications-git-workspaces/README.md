---
id: ideas.specflow-engine.plan-02
type: engineering
title: Temporary execution plan 02 — Specifications and Git Workspaces
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-plan, temporary, specifications, git, worktree]
read_when:
  - executing the temporary Engine migration proof of concept
  - reviewing implementation tasks, verification and dependency gates
summary: >
  Disposable implementation plan for Specs create/read, optional local Git worktrees, durable retries, and real CLI Runtime parity.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.acceptance
  - ideas.specflow-engine.test-plan
  - architecture.principles.enforceable-invariants
---

# Plan 02 — Specifications and Git Workspaces

**Lifecycle: temporary implementation plan**, not an approved ADR or a formal product spec. Implements **Foundation A** on Plan 01 without implicitly starting workflow, creating a Session or auto-committing source files.

## Goal and demonstrable user scenario

```text
Runtime stopped -> CLI create spec A in current checkout
Runtime stopped -> CLI create spec B in optional new Git worktree
Runtime running -> authenticated HTTP lists/reads A and B
Runtime running -> separate CLI modifies B -> HTTP refresh reads new canonical data
Runtime stopped -> CLI reads spec C created earlier via HTTP
```

A Spec is one canonical `specId`, with local binding to one verified workspace; duplicates across branches are not two Specs. Git enablement is independent of the existence of the Git repository. A bound missing worktree is unavailable, never silently replaced by stale main content.

## Execution order, task files and review checkpoints

Each task has its own Markdown file. **Batch** means sequential tasks in one agent session; **parallel** means independent workers writing disjoint owners; **solo** means separately executed and reviewed. The task-level dependency links are executable prerequisites, not only documentation. For cross-plan ordering see the [program runbook](../README.md).

### Recommended waves

1. T01 solo (manifest model)
2. T02 solo (Git boundary)
3. T03 solo (binding)
4. T04 solo (journal)
5. T05 solo (CLI/HTTP create)
6. T06 → T07 sequential batch `2-read-freshness`
7. T08 solo (Foundation A gate)
8. T09 is a superseded placeholder: no longer executable and no Plan 03 prerequisite.
9. T10 SOLO: typed close lifecycle, preflight, intent/journal. Review before effects.
10. T11 SOLO: conservative Git integration/proof. Independent Git review.
11. T12 SOLO: scoped registry CAS and guarded managed worktree disposal. Independent data-loss review.
12. T13 SOLO: Close Worktree use case.
13. T14 SOLO: archive directory and Engine-scoped commit. After T11, MAY run parallel with T12/T13 only with strictly disjoint files/refs; default sequential.
14. T15 SOLO: Close Specification, explicit manual Foundation mode and future exit seam. Requires owner decision.
15. T16 SOLO: CLI/HTTP parity and authorization.
16. T17 SOLO: actual cross-process crash, Windows/POSIX and authorization gate for lifecycle.

### Tasks

| Task                                                                                                                         | Depends on                     | Run mode                            |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------- |
| [E2.T01 — Specs model and repository](tasks/T01-specs-model-and-repository.md)                                               | E1.T07                         | Solo                                |
| [E2.T02 — Git capability](tasks/T02-git-capability.md)                                                                       | E2.T01                         | Solo                                |
| [E2.T03 — Binding and discovery](tasks/T03-binding-and-discovery.md)                                                         | E2.T01, E2.T02                 | Solo                                |
| [E2.T04 — Durable create](tasks/T04-durable-create.md)                                                                       | E2.T02, E2.T03                 | Solo                                |
| [E2.T05 — CLI and HTTP create](tasks/T05-cli-and-http-create.md)                                                             | E2.T04                         | Solo                                |
| [E2.T06 — Runtime read integration](tasks/T06-runtime-read-integration.md)                                                   | E2.T03, E2.T05                 | Sequential batch `2-read-freshness` |
| [E2.T07 — Live refresh](tasks/T07-live-refresh.md)                                                                           | E2.T06                         | Sequential batch `2-read-freshness` |
| [E2.T08 — Safety and regression](tasks/T08-safety-and-regression.md)                                                         | E2.T04, E2.T05, E2.T06, E2.T07 | Solo                                |
| [E2.T09 — superseded placeholder](tasks/T09-rebind-and-cleanup-sub-slice-optional-later-gate.md) | None; replaced by T10–T17 | Not executable |
| [E2.T10 — Closure contract, preview, journal](tasks/T10-closure-contract-preflight-journal.md) | E2.T08; owner decisions | Solo |
| [E2.T11 — Git integration and proof](tasks/T11-git-integration-proof.md) | E2.T10 | Solo |
| [E2.T12 — Registry rebind and disposal](tasks/T12-registry-rebind-disposal.md) | E2.T10–T11 | Solo |
| [E2.T13 — Close Worktree](tasks/T13-close-worktree-use-case.md) | E2.T10–T12 | Solo |
| [E2.T14 — Archive and scoped commit](tasks/T14-archive-and-scoped-commit.md) | E2.T10–T11 | Solo; conditional disjoint parallel |
| [E2.T15 — Close Specification](tasks/T15-close-specification-use-case.md) | E2.T10, T12–T14; owner decision | Solo |
| [E2.T16 — CLI/HTTP close adapters](tasks/T16-close-cli-http-adapters.md) | E2.T13, T15 | Solo |
| [E2.T17 — Lifecycle regression gate](tasks/T17-lifecycle-recovery-regression.md) | E2.T10–T16 | Solo; independent review |

**Batch policy:** never auto-batch a high-risk solo gate with dependent tasks; re-evaluate shared file ownership at dispatch. In particular, lock/claim, security, HTTP scopes, durability/recovery and dispatch uncertainty need an explicit review checkpoint. If a task uncovers an architecture conflict, stop dependent tasks but continue unaffected, disjoint work.

## Material choices to record

- Default spec manifest/slug location and indexes: select from current repo + verified legacy compatibility, not a new schema invented by this plan.
- New scaffold may be dirty: record its Engine-owned fingerprint. Do not globally bypass clean Git gates or auto-commit without an explicit decision.
- Auth for a new worktree occurs at canonical project-level capability before `workspaceId` exists; a client-supplied workspace ID is not an authorization grant.
- Read model may preserve optional/unavailable sections; missing source must never be disguised as a demo success.
- Do not accidentally treat docs index generation as universal task verification: generated artifacts are produced by their declared owning action; verification checks deterministic invariants for the task actually run.

## Foundation A exit gate (mandatory)

Prove **FA01–FA12** with the concrete mapping in [test plan](../../test-plan.md): C01–C12, L01/L02/L07, R01–R05, H01–H06/H08/H10, P01–P06 and SC00. In particular **H03 is mandatory**: CLI change while Runtime remains running is visible after supported refresh. Test result contains Git/Node/OS versions, process/crash checkpoints, unexpected side-effect assertions, and no skipped required tests.

Independent review must verify: CLI and Runtime do not duplicate mutation logic; no fixture fallback; actual Git instead of mock-only integration; no path guessed from `cwd`; no destructive rollback; no unauthorized HTTP leak; feature-owned read boundaries.

## Explicit exclusions

No workflow start/finish, provider process, Session, full task planning, PR automation, implicit finalize, automatic removal or native-provider execution inside worktrees. Rebinding ordinary **Specs content** is testable with Git; **re-binding a live managed provider Session** is not part of this work.

## Sources and handoff

- [Spec creation](../../specification-creation.md), [Git capability](../../git-capability.md), [worktrees](../../optional-worktrees.md), [registry](../../workspace-registry-and-discovery.md), [durable recovery](../../durable-operations-and-recovery.md), [Runtime reads](../../runtime-http-and-reads.md), [binding lifecycle](../../workspace-binding-lifecycle.md).
- [Acceptance](../../acceptance-criteria.md), [test plan](../../test-plan.md), [legacy mapping](../../legacy-nevo-migration.md).

**Ready for Plan 03:** Specs/Workspaces are canonically resolved and locally durable, with independent CLI + HTTP consumption. This does not certify workflow execution or managed Sessions.


## Additional Plan 02 lifecycle extension gate (separate from accepted FA01–FA12)

A passing original Foundation A does not establish closure. This additional gate covers the two distinct domain operations with real Git and SIGKILL evidence, CLI offline and authorized HTTP parity; see [design](../../specification-and-worktree-close-design.md), [pending decisions](../../specification-close-decisions.md) and LC01–LC28 in [test plan](../../test-plan.md). Owner must approve DC03, DC04, DC05, DC08, DC10 before implementing. Critical Git/OS-process LC cases must pass on **Windows AND POSIX**. No LC case is satisfied by mocks alone. Preserve accepted E2.T01–T08 unchanged.

Dependencies: T10 -> T11 -> T12 -> T13; T11 -> T14; (T12, T13, T14) -> T15 -> T16 -> T17. T14 may be dispatched independently of T12/T13 only if interface and file/ref ownership are actually disjoint. T09 and its old E3.T06 dependency are superseded, NOT prerequisites for ordinary closure. Plan 03 claims and Plan 04 managed Sessions later strengthen writer admission, not the basic closure path. Do not delete temporary plans now; the program runbook still requires deleting the entire execution-plans tree and regenerating indexes **before merge**.
