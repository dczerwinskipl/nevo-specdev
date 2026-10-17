---
id: ideas.specflow-engine.worktrees
type: architecture
title: Optional per Specification Git worktrees
status: draft
scope: specflow
areas: [workflow, configuration, security]
tags: [worktree, git, lifecycle, isolation]
read_when:
  - designing one worktree per spec as optional execution isolation
  - deciding workspace creation reuse and cleanup
summary: >
  Optional worktree placement policy, isolation guarantees, lifecycle, guardrails, and
  safe cleanup rules without imposing new workflow types or automatic branch switching.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.git
  - ideas.specflow-engine.workspace-registry
  - ideas.specflow-engine.project-workspace
  - ideas.specflow-engine.locking
  - ideas.specflow-engine.workspace-binding-lifecycle
---

# Optional per-Specification worktree

## Product rule candidate

The Specification is the same kind of domain entity whether stored in the primary checkout or a linked Git worktree. Worktree placement is a **local execution/workspace binding**, not a new spec lifecycle mode, a field to commit into the manifest or a reason to duplicate workflow definitions.

A person can continue using one checkout for everything. Worktree is opt-in at create time and is available only with a functioning enabled Git capability. Engine/CLI operations receive the resolved root; agent tooling receives the same root as `cwd`.

## What isolation actually buys

Linked worktrees share Git object storage but keep checkout files and Git index separate. In normal cases two specs can make independent uncommitted edits, run tests and progress without competing for one physical workspace writer. It does **not** isolate package caches, databases, local services/ports, external APIs or a shared branch/reference namespace. Do not treat worktrees as general security sandboxes.

## One-spec managed worktree in MVP

For worktrees created by SpecFlow for a spec, propose one owner `specId` per managed worktree at first. This avoids ambiguous automatic cleanup. An explicitly attached existing worktree may already contain multiple specs: either defer that workflow to a future capability, or support shared occupancy with clear workspace-scoped locking. Never assume "one spec ID = one filesystem directory" universally.

The worktree registry is workstation-local; commits and PRs may be seen from another machine with no equivalent local checkout.

## Lifecycle proposal

```text
planned/reserved -> provisioning -> available -> active
                                  \-> recovery-required
available/active -> finalized/integrated -> eligible-for-cleanup -> removed
                               \-> retained (manual)
```

These are workspace-management states, **not** Specification workflow statuses and should not create additional duplicate canonical domain state if derivable. In first implementation, only necessary recovery/ownership facts need persistence.

### Create

Provision from a verified base ref under configured safe location, e.g. sibling `<project>-worktrees/<spec-slug>`. Directory and branch naming are suggestions, never unique identity. A `new-worktree` operation must not alter HEAD of the primary checkout.

### Normal use

Spec ID resolves to bound worktree, independent of the caller's `cwd`. Git checks and documents use that workspace, not the process's current directory. Each workspace has its own conflict coordination. Every durable operation is recoverable without a running server.

### Finalization boundary

Closing a linked Specification and integrating it are separately selected effects: default integrate=true means archive+commit+verified merge+CAS+eligible cleanup; integrate=false means archive+commit locally with archived canonical Specification still bound to linked checkout, worktree/branch retained. A later Close Worktree operation integrates an active OR already archived Spec, then safely rebinds/removes managed checkout. If merge conflicts after an Engine-owned archive commit, keep the linked archived source canonical; persist conflict evidence and safely retire or retain isolated scratch with explicit ownership. A proved conflict may settle as `archived-linked-awaiting-integration`, not as integrated success; future manual/agent resolution is a separate workflow. Local project config selects integration target branch rather than guessing main/develop. Close Worktree itself never discards committed source without integration.

Do **not** reuse legacy `git checkout main` in the spec's linked worktree: a branch is typically checked out in one worktree only, and main may already be checked out elsewhere. Split workflow completion, integration/merge confirmation and worktree cleanup. Before removing a worktree, verify committed spec/archive outcome is represented in the intended destination branch, not only in the worktree that will disappear. Then perform an explicit [canonical binding rebind](workspace-binding-lifecycle.md) **before** cleanup; a workflow completion or merged PR alone cannot redirect the registry.

### Cleanup conditions

- Worktree was created and registered as `managed`, or user explicitly approved removing an attached checkout under a separate guarded operation.
- No active or ambiguous Engine execution/claim/recovery record in that workspace.
- FUTURE CHECKPOINT ONLY: when managed Sessions/Turns and claims exist, require their actual owners to prove quiescence before disposal. No fictitious sessions/processes are consulted in Foundation.
- Clean Git status, no untracked meaningful files, no unpushed commits or unreconciled local branch changes.
- Integration/merge verified against intended destination (no inference from a completed Task).
- Recorded path/branch/common-dir match actual Git facts at deletion.
- Ordinary UX confirmation of destructive cleanup is not evidence that external writers stopped. No fake `confirmExternalWritersQuiescent` flag, no force or implicit branch deletion.

If removal fails, keep registry/journal for repair and return an explicit reason. Disappearing directory must not cause silent spec rebinding to main.

## Deferred multi-instance execution and worktrees

The one-spec managed worktree policy does **not** imply one Session, Turn or step instance per worktree. Several instances of one user-defined step may access the same verified checkout. Only technically enforced read-only executions can safely share it without a long-lived exclusive writer claim; their CLI/MCP contribution submissions still use short Engine state coordination. Writer or external-effect steps require suitable isolation, serialization and admission. Creating a worktree per instance is not a default requirement.

When a step requires comparable inputs, Git HEAD alone is insufficient: dirty/index/untracked content and external writers may change the material. Capture the requested baseline **after step activation**, then block or invalidate conflicting writes, rebind or cleanup. Other user-defined steps may have independent input policies. A registry claim cannot physically fence an external process with OS-level file access. This capability is outside Foundation A; see [multi-instance execution](multi-instance-execution.md).

## Move/delete outside SpecFlow

A manually moved worktree or deleted directory becomes unavailable/needs repair. Runtime must retain already authorized historical Session/Turn views; a new Turn resolves and checks the updated workspace before dispatch/native provider resume. Reattach only after matching Git membership and validated identity; do not guess based on basename or slug. `git worktree prune` and worktree removal metadata need careful handling. A worktree may continue to exist while its local product registry binding is invalid; report both independently.

## Alternatives rejected for MVP

- Mandatory worktree for every Specification.
- A separate Runtime per worktree.
- Scanning every checkout and treating duplicate spec manifests as distinct specs.
- Automatic forced removal immediately when a Task or workflow step finishes.
- Treating an external agent Session as required to own an Engine workspace.
- A special second category of Specs visible only in worktree UI.

## Unresolved and measurable

Decide branch naming defaults, safe filesystem root, import/reattach policy, lifecycle retention after merge, and multi-spec checkout semantics. Validate the model on Windows and POSIX, especially worktrees with spaces in paths and mixed casing. See [test plan](test-plan.md).

## Foundation A explicit close operations (draft extension, 2026-10-16)

The earlier exclusion of automatic cleanup on Task/workflow completion remains in force. A separately authorized, user-initiated **Close Worktree** may perform guarded removal only AFTER full local Git integration proof and registry rebind; it keeps the Specification active. **Close Specification** may archive in primary directly or archive in a linked source before integration and managed cleanup. An existing managed linked checkout can be closed even if worktree creation is disabled by current policy, subject to an explicit close capability. See [closure proposal](specification-and-worktree-close-design.md) and owner decisions. No native provider Session migration is asserted, and arbitrary writers cannot be physically fenced by a clean tree alone.
