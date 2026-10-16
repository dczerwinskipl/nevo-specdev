---
id: ideas.specflow-engine.execution-plans
type: hub
title: Temporary SpecFlow Engine implementation runbook
status: draft
scope: specflow
areas: [workflow, runtime, cli, testing]
tags: [execution-plan, temporary, batching, implementation]
read_when:
  - planning staged implementation and safe agent batching
  - reviewing SpecFlow Engine implementation across all five plans
summary: >
  Temporary cross-plan order, batch/parallel dispatch rules and removal gate for the Engine implementation branch.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.plan-01
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.plan-03
  - ideas.specflow-engine.plan-04
  - ideas.specflow-engine.plan-05
  - ideas.specflow-engine.acceptance
---

# Temporary execution plans — implementation runbook

**These documents are disposable, the implementation branch is not.** Use all five folders on `feature/specflow-engine-foundation` to develop and review actual code. Do not merge these 49 temporary plan/task/runbook Markdown files as permanent docs. Before final merge remove **this entire `execution-plans/` tree** and regenerate `docs/index.generated.{json,md}`; retain code, tests and accepted durable ADR/reference contracts.

**Design source:** [Engine Ideas](../README.md), [acceptance criteria](../acceptance-criteria.md), [test matrix](../test-plan.md), [PR #50](https://github.com/dczerwinskipl/nevo-specflow/pull/50). Ideas are draft; current normative documentation wins. Always inspect freshest base/merged features before implementation.

## Five plan boundaries

| Plan | Entry point                                                                   | Mandatory completion                                                       | Relative order                                             |
| ---- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 01   | [Engine / Project Foundation](01-engine-project-foundation/README.md)         | Verified Project Home, Engine import boundary and cross-process state      | First                                                      |
| 02   | [Specifications / Git Workspaces](02-specifications-git-workspaces/README.md) | Foundation A: FA01–FA12 including H03                                      | After 01                                                   |
| 03   | [Offline Workflow / Execution](03-offline-workflow-execution/README.md)       | Foundation B: FB01–FB09                                                    | After mandatory 02                                         |
| 04   | [Managed Sessions Foundation](04-managed-sessions-foundation/README.md)       | Durable Session/Turn/Work with genuinely read-only mock                    | Can run alongside 02/03 after Plan 01 identities stabilize |
| 05   | [Managed Execution Integration](05-managed-execution-integration/README.md)   | Real Engine coordinator + Runtime mock-provider dispatch/crash integration | Only after 03 and 04 pass                                  |

The original Plan 02 E2.T09 optional binding/cleanup placeholder is superseded, and its E3.T06 dependency is removed for ordinary close. A NEW, separately gated Plan 02 lifecycle extension E2.T10–T17 provides Close Worktree and Close Specification without Task/Attempt or Sessions. It does NOT change the already accepted FA01–FA12 gate or make Plan 03–05 prerequisites. No worktree Session/native resume work is part of these tasks.

**Deferred beyond these five plans:** [Multi-instance execution](../multi-instance-execution.md) and its [future task plan](../multi-instance-plan/README.md) are not an E1–E5 acceptance gate. Preserve the distinction between a workflow attempt, one provider Turn and a physical writer claim; do not implement multi-instance dispatch or aggregation in E5.T07. This follow-up plan lives **outside** this disposable tree and must not be removed during E1–E5 cleanup.

## Dispatch semantics

- **Solo / review gate:** run task separately; verify its output and contract before starting dependent task. This is the default for Project Home, authorization, workflow definition changes, durable operations, recovery, Engine↔Runtime handshake and crash-sensitive settlement.
- **Sequential batch:** multiple named dependent tasks in one agent context, in explicit order with one checkpoint per task. This means **not parallel**. Suggested groups: Plan 01 `E1.T04 → E1.T05`; Plan 02 `E2.T06 → E2.T07`; Plan 03 `E3.T03 → E3.T04` and `E3.T08 → E3.T09`; Plan 04 `E4.T06 → E4.T07`.
- **Parallel:** only where dependencies and implementation ownership permit independent writers. Inside Plan 04, `E4.T03 ∥ E4.T04` after `E4.T02` settles identity/ports. Distinct workspaces are not enough when tasks edit the same project-level Auth, package exports, Git refs, state schema or Runtime composition.
- **Parallel across plans:** after Plan 01 interface/identity acceptance, Plans 02 and 04 may progress concurrently **if** Engine/Runtime shared contracts are fixed and changes remain in separate feature-owned modules. Plan 04 and Plan 03 can likewise overlap. Plan 05 cannot start until Plans 03 and 04 are integrated and verified.
- **Unexpected conflict:** if dispatch finds both candidates touching common contracts/files/Git refs, downgrade to sequential or solo; pause only dependent/conflicting tasks. Parallelism is a permission to assess, **never** a guarantee from document metadata.

## Review checkpoints

1. Plan 01: Project Home, local identity, config authority, package graph and process-safe local registry.
2. Plan 02: original real create/reads and H03 Foundation A gate, PLUS distinct, later owner-approved T10–T17 lifecycle close gate (LC01–LC28) with Windows/POSIX evidence. No future workflow or Session dependency.
3. Plan 03: real offline workflow and attempt identity, claims/abandoned execution recovery, human trust; Foundation B gate.
4. Plan 04: canonical Session/Turn/Work and mock provider contract; actual Runtime HTTP and persistence.
5. Plan 05: durable dispatch uncertainty, explicit workflow finish, limited batch/handover and authorization; do not infer real provider behavior.

At each checkpoint an architecture review compares **implemented code** with current normative docs and the linked candidate ideas; update later plan tasks if actual contracts change. Required test skips are not PASS.

## Out of scope until real provider adapters exist

No native provider execution/resume in a different worktree, `cwd` switching of an active provider Session, native Session rebind/history migration, adapter-specific unknown-outcome fencing, or claims of Claude/Codex/Antigravity parity. A controlled mock can prove coordinator transitions **only**.

## Cleanup before merge

- All implemented tasks and required stage gates have verified results; list explicitly deferred task(s).
- Promote evidence-backed persistent architecture/contract decisions to accepted homes after owner review, not by silently elevating Ideas.
- Delete **all** files under `docs/ideas/specflow-engine/execution-plans/` in this implementation branch; regenerate docs index with `pnpm docs:check --write`; run `pnpm docs:check` and CI.
- PR must contain only surviving implementation/tests/permanent documentation in its final diff; never merge these plans as the formal SpecFlow specification format.


## Plan 02 closure extension review boundary

Run E2.T10–T17 only after owner approval of manual no-workflow policy, destination/ref and external-writer trust limitations in [closure decisions](../specification-close-decisions.md). T09 is historical and not runnable. T10, T11, T12, T13, T15, T16, T17 are solo reviews; T14 is solo but may be developed in parallel with T12/T13 after T11 if modules AND Git refs are independent. Default to sequential if uncertain. The original FA01–FA12 must stay passing; the new LC gate cannot be declared green without real Git/OS-process evidence on Windows and POSIX. At end of PR #53 implementation all temporary execution plans, including new tasks, are removed exactly as stated above.
