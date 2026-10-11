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

## Task sequence

| Task | Implement and prove | Depends on |
| --- | --- | --- |
| E2.T01 — Specs model and repository | Inspect latest current Specs and legacy `tools/specs/store.mjs`, `identity.mjs`, `validation.mjs`, `indexes.mjs`. Choose committed manifest/scaffold structure compatible with current UI read semantics. Keep stable `specId`, validated slug and no second source of canonical status. | Plan 01 |
| E2.T02 — Git capability | Add feature-owned Git enablement, checkout/worktree inspection, safe arg-array commands and validated branch/base-ref/path planning. Reject disabled capability, wrong repository, branch checked out elsewhere and symlink/path collisions before side effects. | E2.T01 |
| E2.T03 — Binding and discovery | Resolve `specId -> workspaceId -> verified root` from local registry. Deduplicate same-id manifests, detect contradictory bindings, preserve missing-worktree state and distinguish missing manifest. Do not scan arbitrary worktrees as trusted sources. | E2.T01–T02 |
| E2.T04 — Durable create | Design `operationId` + immutable input fingerprint; reserve slug/ID/branch/path under Plan 01 short lock; persist intent before Git/manifest/registry side effects, then journal evidence of each stage and replay safely. Crash recovery must not duplicate worktree, branch or Spec. | E2.T02–T03 |
| E2.T05 — CLI and HTTP create | Add capability-owned CLI `specs create/list/resolve` and authenticated `POST /api/specs` (exact URL to confirm against latest routes). Both call one Engine use case. Resolve target defaults at boundary, and require only human title; return canonical resource/workspace identity. | E2.T04 |
| E2.T06 — Runtime read integration | Implement **production** Engine-backed Overview/Workspace/Document/Task read repositories in `packages/specflow-runtime/src/features/specs/`, preserving existing DTOs, feature-scoped authorization, unavailable vs missing and current demo repositories **only** for explicit demo/test. No frontend fixtures in production. | E2.T03–T05 |
| E2.T07 — Live refresh | Warm Runtime read cache, modify Spec using another CLI process while server stays up, then verify supported HTTP refresh/re-read sees new source without restart. No SSE requirement; no indefinite stale cache. | E2.T06 |
| E2.T08 — Safety and regression | Test concurrent same-slug and distinct registrations (separate processes), repeat `operationId`, failures after Git add/manifest/registry/response, Git disabled, dirty creation scaffold provenance, no primary HEAD switch and actual Windows/POSIX Git. | E2.T04–T07 |
| E2.T09 — Rebind and cleanup sub-slice (optional later gate) | After content is materially present in destination ref/checkout, explicitly `rebind(specId)` with compare-and-set, then assess separate user-confirmed **managed-only** worktree cleanup. Reject stale destination, dirty/unpushed source, active/unknown Engine writer. Do not require this sub-slice to pass Foundation A; finish before claiming end-to-end finalization support. | E2.T03–T08, Plan 03 for writer claims |

## Material choices to record

- Default spec manifest/slug location and indexes: select from current repo + verified legacy compatibility, not a new schema invented by this plan.
- New scaffold may be dirty: record its Engine-owned fingerprint. Do not globally bypass clean Git gates or auto-commit without an explicit decision.
- Auth for a new worktree occurs at canonical project-level capability before `workspaceId` exists; a client-supplied workspace ID is not an authorization grant.
- Read model may preserve optional/unavailable sections; missing source must never be disguised as a demo success.
- Do not accidentally treat docs index generation as universal task verification: generated artifacts are produced by their declared owning action; verification checks deterministic invariants for the task actually run.

## Foundation A exit gate (mandatory)

Prove **FA01–FA12** with the concrete mapping in [test plan](../test-plan.md): C01–C12, L01/L02/L07, R01–R05, H01–H06/H08/H10, P01–P06 and SC00. In particular **H03 is mandatory**: CLI change while Runtime remains running is visible after supported refresh. Test result contains Git/Node/OS versions, process/crash checkpoints, unexpected side-effect assertions, and no skipped required tests.

Independent review must verify: CLI and Runtime do not duplicate mutation logic; no fixture fallback; actual Git instead of mock-only integration; no path guessed from `cwd`; no destructive rollback; no unauthorized HTTP leak; feature-owned read boundaries.

## Explicit exclusions

No workflow start/finish, provider process, Session, full task planning, PR automation, implicit finalize, automatic removal or native-provider execution inside worktrees. Rebinding ordinary **Specs content** is testable with Git; **re-binding a live managed provider Session** is not part of this work.

## Sources and handoff

- [Spec creation](../specification-creation.md), [Git capability](../git-capability.md), [worktrees](../optional-worktrees.md), [registry](../workspace-registry-and-discovery.md), [durable recovery](../durable-operations-and-recovery.md), [Runtime reads](../runtime-http-and-reads.md), [binding lifecycle](../workspace-binding-lifecycle.md).
- [Acceptance](../acceptance-criteria.md), [test plan](../test-plan.md), [legacy mapping](../legacy-nevo-migration.md).

**Ready for Plan 03:** Specs/Workspaces are canonically resolved and locally durable, with independent CLI + HTTP consumption. This does not certify workflow execution or managed Sessions.
