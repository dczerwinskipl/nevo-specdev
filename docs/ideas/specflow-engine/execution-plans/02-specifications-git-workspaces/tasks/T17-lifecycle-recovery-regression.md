---
id: ideas.specflow-engine.plan-02.task-17
type: engineering
title: 'E2.T17 — Plan 02 lifecycle crash, platform and security gate'
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-task, temporary, lifecycle-closure]
read_when:
  - implementing or reviewing E2.T17
summary: >
  Temporary Plan 02 task: Plan 02 lifecycle crash, platform and security gate.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.test-plan
---

# E2.T17 — Plan 02 lifecycle crash, platform and security gate

**Temporary task, documentation only.** Branch feature/specflow-engine-foundation / existing PR #53. No product implementation exists merely because this plan is present. This file must be removed with the entire temporary execution-plans tree before PR merge.

## Executable prerequisites

- E2.T10–E2.T16 accepted individually
- Independent architecture review of all close operations

Run mode: **SOLO / final independent gate**. No parallel writes to shared Git refs, registry schemas, journal/state files, authentication capability lists or runtime composition. Re-check HEAD and approved decisions DC01–DC18 before editing code.

## Modules and ownership

Engine test lifecycle real Git fixtures, OS-process SIGKILL workers; Runtime HTTP authorization/refresh; CLI separate-process suites; .github/workflows/engine-filesystem.yml only if platform coverage needs extending; docs test-plan and closure decisions evidence.

## Required behavior / exact acceptance

1. Execute mandatory LC01–LC40 (see test-plan) on Windows and POSIX as appropriate, reporting per platform Git/Node/OS versions, commit SHA, crash checkpoint, PASS/FAIL/SKIP and actual evidence. Do not substitute mocked Git for real Git or forcible OS-process termination for simulated exceptions: use SIGKILL on POSIX and an equivalent demonstrably abrupt OS termination on Windows.
2. Include OS-process concurrency on different Spec IDs attempting simultaneous PRIMARY archive/index commits, two linked sources targeting one development ref, and new Create versus overlapping Close; hold/release durable resource claims across crash. SIGKILL during primary candidate fast-forward must check partial HEAD, index and physical worktree rather than relying on ancestry. Verify each journal stage crash/unknown process, repeat same operationId and competing IDs, source/destination drift, archive commit recovery, integrate-before-CAS, CAS-before-remove, removal-before-retirement, and no accidental primary branch switch.
3. Verify primary/linked worktree close chains, stable specId, single canonical manifest, correct runtime refresh, correct authorization, automatic exactly-once SCOPED Engine archive commit (and no arbitrary user-data commits), no unmanaged/shared deletion. Verify that public schemas and journals do NOT invent exit-gate pass, fake no-evaluator acknowledgement, registry or external-writer proof.
4. Original FA01–FA12 remain independently satisfied; LC gate is an ADDITIONAL Plan 02 lifecycle gate and must be green before calling lifecycle complete. Future W/S/MI tests remain deferred.

## Required evidence

- Positive: cross-process end-to-end and OS-specific proof of all completed close outcomes
- Negative/no unintended effects: fault injections and unauthorized operations do not produce false success/duplicate effects; no mandatory skipped tests
- Report LC test IDs, test files, OS/Node/Git version for real filesystem/process work, PASS/FAIL/SKIP, modified public contracts, and an independent code-quality/recovery review. Mock-only tests do not satisfy Git/process cases.
- Checkpoint for this task: Final independent acceptance report, not self-review, and owner sign-off; temporary docs remain until final PR cleanup.
- Preserve completed E2.T01–T08; avoid unrelated refactors. No Plan 03 or Session dependency.

## Sources

- [Plan 02](../README.md)
- [Close architecture](../../../specification-and-worktree-close-design.md)
- [Decisions needing approval](../../../specification-close-decisions.md)
- [Lifecycle test matrix](../../../test-plan.md)

- LC17 covers inter-spec/ref/index/Create-close conflicts, not just same-spec operation IDs; LC39 covers two source integrations racing for one primary target and SIGKILL during candidate publication. LC21 checks HEAD+index+physical tree concordance following a crash after Git publication initiation. Platform evidence required.
