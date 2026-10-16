---
id: ideas.specflow-engine.specification-close-self-review
type: engineering
title: Self-review of Specification and Worktree closure design
status: draft
scope: specflow
areas: [workflow, security, git, testing]
tags: [architecture-review, self-review, lifecycle, temporary-design]
read_when:
  - independently reviewing E2.T09–T17
  - checking corrected design weaknesses before code implementation
summary: >
  Explicit internal review findings and correction evidence against the 2026-10-16 planning design.
related:
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.specification-close-decisions
  - ideas.specflow-engine.plan-02
---

# Self-review: Plan 02 Specification & Worktree closure

**Scope:** architectural/doc/task design only. The reviewer is the original design author: NOT an independent review and NOT verified runtime implementation. Examined git HEAD 123830e, current Engine scaffold/create/journal/registry/version-control code, old Nevo deterministic Task workflow and draft Plan 02 docs on 2026-10-16. The corrected task plan still requires a separate architecture approval before execution.

## Findings and changes

| ID | Severity | Finding | Corrective action | Follow-up |
| --- | --- | --- | --- | --- |
| SR01 | P1 | Redundant workflow execution-mode field in new Spec manifest. The sole SpecFlow workflow architecture is deterministic. Its presence implied an artificial choice. | E2.T09 now removes the marker from new scaffold; docs define no alternative algorithm. | Test LC34 |
| SR02 | P1 | Naively modifying createSpecificationScaffold breaks unfinished persisted Create v1/v2 journals: create-scaffold.ts reconstructs scaffold and compares its hashes with immutable record.files. | E2.T09 explicitly preserves byte-exact old-template replay and requires positive/negative SIGKILL/restart evidence. No automatic rewrite of existing Specs. | LC30 |
| SR03 | P1 | Linked Spec close creates an archive commit, so original pinned source HEAD is not the commit that must be integrated. Earlier proposal did not make this change-of-HEAD explicit. | Persist preArchiveSourceHead and independently evidenced integrationSourceCommit, keep both in journal; integrate exact new SHA. | LC32 |
| SR04 | P1 | Ordinary git status does not inventory ignored per-checkout files; managed worktrees have an ignored .nevo/local/state/workspace-identity.json and might have user state/config/artifacts. Removing checkout without inspecting ignored files risks silent loss. | Before disposal inventory ignored state, whitelist only original verified Engine marker, block other ignored local data. No force removal. | LC29 |
| SR05 | P2 | An interrupted archive may leave exact Engine-owned staged files. Blindly re-running global-clean preflight makes supported journal recovery impossible. | First admission requires clean tree; recovery validates only pinned journal-owned file inventory/staged changes, all unexpected changes block. | LC33 |
| SR06 | P2 | Windows has no POSIX SIGKILL semantics identical to Unix, although process-level crash proof is still required. | Require forcible OS process termination with actual confirmed process exit and stage proof on Windows, SIGKILL on POSIX. | T17 LC19–LC23 and LC33 |
| SR07 | P2 | Earlier design/test prose said LC01–LC24 although 28 cases were published. | Correct to LC01–LC34 across design, plan, gate and task files. | Static consistency check |
| SR08 | P2 | Generated Spec/docs indexes might become stale after an archive even if they are not canonical read authority. | T14 explicitly requires inspecting actual index contract and journaled path-scoped regeneration when required, not global add -A. | T14 independent review |
| SR09 | P2 | T09 optional cleanup carried a Plan 03 writer-claim dependency inconsistent with Foundation-only closure; after moving closure to T10–T17 the placeholder was misleading. | Replace T09 with narrow manifest contract/recovery task; no dependency on E3.T06. | Review plan graph |
| SR10 | Decision | No installed spec-level exit evaluator is NOT evidence of passed gates. An administrative archive is a separate explicit product authorization, not a workflow algorithm mode. | Keep explicit administrative acknowledgement and journal disposition not-configured, require owner approval, future installed/unknown gate results block. | Owner DC08 |
| SR11 | Decision | Clean Git/index and even an operator's assertion cannot physically prevent a non-cooperating external writer. | Document cooperative offline trust limitation and block known unsettled work. Future claims/Sessions strengthen admission. | Owner DC10 |

## Source-of-truth and consistency checks

- The scoped Engine implementation currently writes a redundant mode marker at packages/specflow-engine/src/specs/model.ts, and its test at packages/specflow-engine/test/specifications.test.ts checks for it. E2.T09 is responsible for updating both **later**, with Create journal compatibility preserved. No code implementation in this document.
- create-scaffold.ts.expectedScaffold regenerates full scaffold and compares hashes to record.files, proving SR02 is a real migration/replay consideration, not a speculative warning.
- Linked workspace physical identity marker is written to ignored .nevo/local/state/workspace-identity.json by workspace-identity.ts, proving the ignored-data disposal problem is relevant to this repository.
- Registry store currently prohibits rebind and registration removal; T12 must introduce narrowly fenced lifecycle CAS without altering arbitrary create transitions.
- Future Specification exit evaluation must never derive completion from tasks: unknown[] nor introduce a selectable execution mode. Task workflows in legacy Nevo are reference material only.
- The generated closure design must be checked against docs/architecture/workflow/deterministic-workflow.md before architectural promotion. No claim that the new spec-level workflow evaluator exists today.

## Residual risks / explicit non-goals

1. Automatic branch merge commits, rebase, squash-equivalence, PR/remote push and branch deletion remain deferred; MVP integration is local fast-forward or strict already-integrated evidence.
2. A managed worktree with unexpected ignored files or another canonical binding cannot be automatically removed. Source integration/rebind and later cleanup recovery are distinct observed states, never fake success.
3. Current Foundation cannot physically fence a hostile/same-OS-account process; this remains an owner security decision before enabling removal. A PID, TTL, clean tree or arbitrary caller claim is insufficient.
4. Future workflow exit actions may be non-idempotent. Their installed implementation MUST durably pin action intent/inputs and reconcile before replay. The seam is reserved, no action engine built now.
5. No implementation tests have yet been executed for these NEW close tasks; LC01–LC34 are acceptance requirements, not PASS claims. No independent agent reviewed this design.

## Recommended next check

Independent architecture reviewer should focus first on SR02–SR05, DC05/DC08/DC10, then audit E2.T09, E2.T10, E2.T11, E2.T12 and E2.T14 contracts before permitting E2.T13/T15 functionality. Recheck HEAD, code paths, documentation references and tests, and stop if a material contract mismatch is found.
