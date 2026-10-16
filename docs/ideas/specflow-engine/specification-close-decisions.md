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
| DC05 | Engine automatically commits exactly its own archive effects as a durable INTERNAL Specification-close stage; user/agent/adapter never commit those effects | Arbitrary user edits auto-commit or caller-managed archive commit | Owner approved |
| DC06 | Registry CAS rebind then guarded worktree removal then scoped retirement of obsolete registration | Remove directory first or permanently allow arbitrary registry mutation | Proposed |
| DC07 | Separate versioned lifecycle journal, one unsettled operation per spec; positive evidence replays | Add closing flags to CreateJournal or PID-based takeover | Proposed |
| DC08 | Explicit TODO checkpoint in Engine Specs lifecycle before archive, future workflow slice owns real gates/actions; NO gate evaluator, registry, mock, status/acknowledgement or admin bypass today | Synthetic gate dispositions and invented WorkflowGateway/no-op adapter | Owner approved |
| DC09 | CLI offline/local OS-account trust; HTTP distinct CloseWorktree/CloseSpecification permissions | Reuse Create/Manage by assumption or caller-selected workspace grant | Proposed |
| DC10 | Only ACTUAL installed Engine journal/lock/Git/fs evidence checked now; no fake writer/process lookup or operator quiescence flag; future TODO before disposal for Workspace Execution coordinator; document cooperative OS-writer limitation | Pretend absent coordinator proves no writers | Owner-approved scope; documented limitation |
| DC11 | Managed branch ref retained after worktree removal | Delete source branch automatically | Proposed |
| DC12 | Lifecycle gate independent of original Foundation A and Plans 03–05; temporary plans deleted before merge | Rewrite accepted E2.T01–T08 or make E3.T06 required | Proposed |
| DC13 | Deterministic workflow is intrinsic; remove redundant mode marker from new Spec manifests in E2.T09, preserve existing creation journal bytes/retries | Keep or replace an execution-algorithm selector in manifest | Owner approved |
| DC14 | Inspect ignored local data before managed worktree disposal; only pinned Engine marker may be safely removed, everything else blocks | Assume a clean git status means no user/ignored data | Required safety correction |
| DC15 | Linked Close Specification accepts integrateToTargetBranch (UI default true); false archives locally and retains canonical linked binding/worktree; later Close Worktree integrates archived Spec | Deleting unintegrated canonical archive or treating no-merge as close-worktree | Owner direction — revised |
| DC16 | New canonical manifest specification.yaml; historical change.yaml readable and old journal bytes recoverable, fail on both filenames; no implicit migration | Treat manifest as change log or local process state | Owner approved |
| DC17 | Conflict UX to offer Resolve manually / Ask agent, but Engine only emits typed suspended conflict evidence; separate resolution capability and agent integration deferred | Engine silently edits conflicts or leaves dirty primary | Owner direction — implementation boundary proposed |
| DC18 | Store integrationTargetBranch as Project Home operational policy in .nevo/config.yaml; release-train/stack policy deferred | Hard-code main or derive branch from invocation cwd | Owner direction — revised |

## Owner-confirmed direction and remaining engineering reviews

- **Owner approved:** DC05 Engine-scoped automatic archive commit; DC08 explicitly located future gate/action seam ONLY, no fake gate/acknowledgement; DC10 check existing real protections and no invented writer status/acknowledgement; DC13 deterministic-only; DC16 `specification.yaml`; project-configured integration target and optional linked archive integration.
- **Placement:** `specs/lifecycle/close-specification.ts` orchestrates and marks TODO before archive effects for future workflow-owned exit gates/actions. `specs/lifecycle/disposal.ts` marks TODO immediately before physical worktree disposal for future Workspace Execution/Session coordinator. Add actual typed ports/adapters ONLY with real counterpart implementation. Today real Git VersionControl capability, Specs archive, Project/registry CAS and durable lifecycle journal are implemented as appropriate.
- **Supported scope:** real git/fs/index/ignore, Engine journals/locks, instance ID and registry checks continue; arbitrary OS writers are NOT physically fenced. No fabricated assertion of safe quiescence.
- **Still requires technical review:** config migration + default branch validation; crash-safe isolated clean-merge commit ownership/hook/signing; scoped archive commit verification and worktree one-spec eligibility. Shared/unmanaged automatic removal deferred.
## Review checks

- Does the transition graph prohibit CAS before actual destination content verification?
- Can the original source checkout be replaced without passing physical identity checks?
- Does an interruption after commit/merge/removal have an observable, non-repeatable recovery path?
- Can a caller without resource CloseSpecification authority choose another workspace or bypass the Engine-owned archive commit?
- Are fake gate/active-writer statuses absent from journal, request/response and code, with future integration boundaries still clear?
- Does Plan 02 genuinely run with the HTTP Runtime off and without E3.T06?
