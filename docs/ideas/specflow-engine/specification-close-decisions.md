---
id: ideas.specflow-engine.specification-close-decisions
type: engineering
title: Proposed Specification and worktree closure decisions
status: draft
scope: specflow
areas: [workflow, security, cli, runtime, testing]
tags: [decision-record, architecture-review, temporary-design]
read_when:
  - approving Plan 02 lifecycle implementation
summary: >
  Decisions, rejected alternatives and product-owner questions for safe offline and HTTP closing.
related:
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.plan-02
---

# Closure design decision record (proposed, pending review)

| ID | Recommendation | Rejected or deferred alternative | Review status |
| --- | --- | --- | --- |
| DC01 | Separate worktree-close and specification-close intents, shared narrow Git/registry components | One generic close() with boolean flags; close-spec calling two user operations | Proposed |
| DC02 | Only an exclusive managed linked worktree may be automatically closed | Deleting unmanaged/shared worktrees on caller instruction | Proposed |
| DC03 | Local primary checkout with an explicitly pinned checked-out destination branch; never switch primary branch | Assume main or auto checkout main | Proposed |
| DC04 | Local fast-forward-only integration or proof source commit already ancestor; verify physical target Spec tree | Auto merge/rebase, PR state alone, squash equality guesses, reset/force | Proposed |
| DC05 | Source user edits and initial scaffold committed first; Engine makes narrowly scoped archive commit only for spec close | Automatically commit all dirty files; require the caller to commit a transient archive while journal is pending | Proposed |
| DC06 | Registry CAS rebind then guarded worktree removal then scoped retirement of obsolete registration | Remove directory first or permanently allow arbitrary registry mutation | Proposed |
| DC07 | Separate versioned lifecycle journal, one unsettled operation per spec; positive evidence replays | Add closing flags to CreateJournal or PID-based takeover | Proposed |
| DC08 | Exit gates/actions as a future typed domain boundary with explicit not-installed vs verified pass | Treat tasks/status as gate success; fake Workflow Engine today | Proposed |
| DC09 | CLI offline/local OS-account trust; HTTP distinct CloseWorktree/CloseSpecification permissions | Reuse Create/Manage by assumption or caller-selected workspace grant | Proposed |
| DC10 | Block if writer state is unknown; operator declaration of quiescence is advisory, not proven fencing | Declare clean git/PID/no Sessions to mean no external writer | Proposed |
| DC11 | Managed branch ref retained after worktree removal | Delete source branch automatically | Proposed |
| DC12 | Lifecycle gate independent of original Foundation A and Plans 03–05; temporary plans deleted before merge | Rewrite accepted E2.T01–T08 or make E3.T06 required | Proposed |
| DC13 | Deterministic workflow is intrinsic; remove redundant mode marker from new Spec manifests in E2.T09, preserve existing creation journal bytes/retries | Keep or replace an execution-algorithm selector in manifest | Required architecture correction |
| DC14 | Inspect ignored local data before managed worktree disposal; only pinned Engine marker may be safely removed, everything else blocks | Assume a clean git status means no user/ignored data | Required safety correction |

## Owner sign-off REQUIRED before implementing close operations

1. DC08 manual closure: approve an EXPLICIT administrative Foundation closure authorization for Specifications before spec-level workflow integration exists? It records exitEvaluation=not-configured and closureAuthorization=administrative, does not imply workflow completed, and must not bypass installed Specification exit gates. Recommendation: approve with dedicated close permission and explicit caller acknowledgement. Otherwise ordinary spec close must be postponed; worktree close can still ship.
2. DC03 destination: require the caller to explicitly name the checked-out primary destination branch (recommended) or accept an approved configured default? No silent assumption from a new-worktree baseRef=HEAD.
3. DC04 Git integration: accept fast-forward-only local integration and external/manual resolution of divergence (recommended) rather than introduce a recoverable merge-commit engine now?
4. DC10 external writers: is the documented cooperative, local-account trust limitation and explicit operator assertion acceptable for managed worktree removal (recommended for MVP)? If not, return cleanup-blocked until actual writer coordination is installed; do not pretend it is safe.
5. DC05 archive commit: approve an Engine-owned, scoped archive commit with operation marker (recommended)? If commit identity/signing/hooks are mandatory, define user-level Git configuration/preflight and recovery behavior.
6. Worktree ownership: enforce exactly one spec per managed linked worktree for closure and reject shared/unmanaged (recommended). Scope for explicit retained-worktree rebind could be added later without deleting user checkouts.

These are not questions that should be answered by the implementer implicitly. Once approved, capture selected decisions in the T10 contract test and task review.

## Review checks

- Does the transition graph prohibit CAS before actual destination content verification?
- Can the original source checkout be replaced without passing physical identity checks?
- Does an interruption after commit/merge/removal have an observable, non-repeatable recovery path?
- Can a caller without resource CloseSpecification authority choose an alternate workspace or falsify an administrative acknowledgement?
- Does no installed Specification evaluator remain distinguishable from passed gates, with no Specification workflow execution-mode field?
- Does Plan 02 genuinely run with the HTTP Runtime off and without E3.T06?
