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
| DC03 | Project-configured integrationTargetBranch (main/develop/other); initialize/migrate explicitly, pin config and refuse wrong primary checked-out branch; no automatic switch | Require per-close branch entry or silently assume main | Owner direction — revised |
| DC04 | Local verified already-integrated / fast-forward / automatic conflict-free merge; prepare divergent merge in isolated durable integration checkout; conflict returns requires-resolution | Blind merge in primary, automatic conflict choices, rebase/reset/force | Owner direction — revised; Git recovery design review required |
| DC05 | Source user edits and initial scaffold committed first; Engine makes narrowly scoped archive commit only for spec close | Automatically commit all dirty files; require the caller to commit a transient archive while journal is pending | Proposed |
| DC06 | Registry CAS rebind then guarded worktree removal then scoped retirement of obsolete registration | Remove directory first or permanently allow arbitrary registry mutation | Proposed |
| DC07 | Separate versioned lifecycle journal, one unsettled operation per spec; positive evidence replays | Add closing flags to CreateJournal or PID-based takeover | Proposed |
| DC08 | Exit gates/actions as a future typed domain boundary with explicit not-installed vs verified pass | Treat tasks/status as gate success; fake Workflow Engine today | Proposed |
| DC09 | CLI offline/local OS-account trust; HTTP distinct CloseWorktree/CloseSpecification permissions | Reuse Create/Manage by assumption or caller-selected workspace grant | Proposed |
| DC10 | Block if writer state is unknown; operator declaration of quiescence is advisory, not proven fencing | Declare clean git/PID/no Sessions to mean no external writer | Proposed |
| DC11 | Managed branch ref retained after worktree removal | Delete source branch automatically | Proposed |
| DC12 | Lifecycle gate independent of original Foundation A and Plans 03–05; temporary plans deleted before merge | Rewrite accepted E2.T01–T08 or make E3.T06 required | Proposed |
| DC13 | Deterministic workflow is intrinsic; remove redundant mode marker from new Spec manifests in E2.T09, preserve existing creation journal bytes/retries | Keep or replace an execution-algorithm selector in manifest | Owner approved |
| DC14 | Inspect ignored local data before managed worktree disposal; only pinned Engine marker may be safely removed, everything else blocks | Assume a clean git status means no user/ignored data | Required safety correction |
| DC15 | Linked Close Specification accepts integrateToTargetBranch (UI default true); false archives locally and retains canonical linked binding/worktree; later Close Worktree integrates archived Spec | Deleting unintegrated canonical archive or treating no-merge as close-worktree | Owner direction — revised |
| DC16 | New canonical manifest named specification.yaml; historical change.yaml readable and old journal bytes recoverable, fail on both filenames; no implicit migration | Call it change log or store local runtime state in state.yaml | Owner direction — proposed name pending final sign-off |
| DC17 | Conflict UX to offer Resolve manually / Ask agent, but Engine only emits typed suspended conflict evidence; separate resolution capability and agent integration deferred | Engine silently edits conflicts or leaves dirty primary | Owner direction — implementation boundary proposed |
| DC18 | Store integrationTargetBranch as Project Home operational policy in .nevo/config.yaml; release-train/stack policy deferred | Hard-code main or derive branch from invocation cwd | Owner direction — revised |

## Owner sign-off REQUIRED before implementing close operations

1. DC08 manual closure: approve an EXPLICIT administrative Foundation closure authorization for Specifications before spec-level workflow integration exists? It records exitEvaluation=not-configured and closureAuthorization=administrative, does not imply workflow completed, and must not bypass installed Specification exit gates. Recommendation: approve with dedicated close permission and explicit caller acknowledgement. Otherwise ordinary spec close must be postponed; worktree close can still ship.
2. DC03 resolved direction: configuration ALWAYS stores the project's integration target, e.g. main/develop. The remaining implementation decision is the exact config schema, init selection and safe migration of existing .nevo/config.yaml with no target.
3. DC04 resolved product direction: fast-forward and conflict-free merge are automatic; conflicts offer manual or agent resolution in future UX. Engineering review MUST settle crash-safe isolated merge candidate and exact verification before this is accepted for implementation.
4. DC10 external writers: is the documented cooperative, local-account trust limitation and explicit operator assertion acceptable for managed worktree removal (recommended for MVP)? If not, return cleanup-blocked until actual writer coordination is installed; do not pretend it is safe.
5. DC05 archive commit: approve an Engine-owned, scoped archive commit with operation marker (recommended)? If commit identity/signing/hooks are mandatory, define user-level Git configuration/preflight and recovery behavior.
6. Worktree ownership: enforce exactly one spec per managed linked worktree for automatic removal and reject shared/unmanaged (recommended). Archived-without-integration retains worktree and binding; later Close Worktree can integrate archived state.
7. DC15 default integrate=true on linked Close Specification and FALSE retains archived source, worktree and binding (owner direction). Confirm whether the UI should display this option by default on every linked close or under an advanced disclosure.
8. DC16 recommendation: use specification.yaml rather than spec.yaml or state.yaml. Confirm name before T09 implementation; migrate historical paths only explicitly.

Items 1, 4, 5, 6, and final DC16 filename sign-off still require owner choices. These are not questions that should be answered by the implementer implicitly. Once approved, capture selected decisions in the T10 contract test and task review.

## Review checks

- Does the transition graph prohibit CAS before actual destination content verification?
- Can the original source checkout be replaced without passing physical identity checks?
- Does an interruption after commit/merge/removal have an observable, non-repeatable recovery path?
- Can a caller without resource CloseSpecification authority choose an alternate workspace or falsify an administrative acknowledgement?
- Does no installed Specification evaluator remain distinguishable from passed gates, with no Specification workflow execution-mode field?
- Does Plan 02 genuinely run with the HTTP Runtime off and without E3.T06?
