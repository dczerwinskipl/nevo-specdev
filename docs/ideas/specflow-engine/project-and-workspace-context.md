---
id: ideas.specflow-engine.project-workspace
type: architecture
title: Project Workspace discovery and identity
status: draft
scope: specflow
areas: [configuration, workflow, runtime, cli]
tags: [project, workspace, identity, discovery, worktree]
read_when:
  - resolving spec roots from the project or a linked Git checkout
  - designing stable workspace identity independent of physical paths
summary: >
  Candidate Project versus Execution Workspace identity model and safe discovery of a home registry
  from any linked Git worktree, without confusing Git branch names or paths with canonical IDs.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.boundaries
  - ideas.specflow-engine.workspace-registry
  - ideas.specflow-engine.project-home
  - ideas.specflow-engine.workspace-binding-lifecycle
  - architecture.runtime.configuration
---

# Project and Workspace context

## Separate identities

- **Specification identity (`specId`)**: durable, committed domain identity; remains stable across branch/path changes.
- **Logical project**: one SpecFlow installation/configuration scope. The local coordination home may be different from the current Git checkout.
- **Workspace (`workspaceId`)**: locally stable handle for an execution root; path is a mutable attribute, not identity.
- **Git repository identity**: verified shared Git common directory/remote metadata; it is not a spec identifier. Do not use remote URL alone (forks, multiple clones, no remote).
- **Execution identity**: separate operation/claim ID for admission; not a Session ID.

A project can have one primary checkout and zero or more registered linked worktrees. Multiple independent clones of the same remote need not share local Runtime state.

Candidate representation:

```ts
type ProjectContext = {
  projectId: string;
  projectRoot: string; // known local coordination home
  stateRoot: string; // explicit ignored state location
};
type WorkspaceContext = {
  workspaceId: string;
  root: string; // verified absolute canonical filesystem root
  kind: 'primary' | 'linked';
  git?: { commonDir: string; branch?: string };
};
type SpecContext = { project: ProjectContext; workspace: WorkspaceContext; specId: string };
```

Avoid injecting this entire object into every small function. Resolve once at the invocation boundary; application operations consume relevant capabilities/ports.

## Discovery from any current directory

1. Resolve real absolute filesystem path and nearest Git checkout root where Git is in use. Distinguish primary checkout, linked checkout and bare repository.
2. Inspect Git's common-dir/worktree metadata via Git commands, not by concatenating `.git/` assumptions. Linked checkout `.git` is often a file.
3. Locate exactly one designated SpecFlow Project Home via the candidate explicit locator/validated Git worktree enumeration algorithm in [Project Home discovery](project-home-discovery.md). The marker format and state-home relocation procedure remain decisions; do not use branch names or current checkout as implicit authority.
4. Resolve the central local registry and `workspaceId`; ensure recorded roots still refer to the same Git repository, not a symlink/substitution to an unrelated location.
5. Fail clearly when zero or multiple candidate homes exist. Never silently treat an arbitrary linked checkout as a second independent project.

Git's `git rev-parse --show-toplevel` alone returns the _current checkout_, not the project's coordination home. This is a concrete limitation of `packages/specflow/src/project/layout.ts` on main.

## Open design: home discovery and moves

Git shared metadata is useful for membership proofs but does not by itself define who owns SpecFlow's local state. Avoid writing private product state into Git internals without an explicit portability/ownership decision. Document what happens when the designated home checkout moves, is deleted, or is no longer checked out at `main`. Foundation A must implement and test one deterministic discovery strategy, with explicit repair/ambiguity outcomes. Neither `git worktree list` alone nor the presence of `.nevo/config.yaml` proves which checkout owns ignored local state. See [Project Home discovery](project-home-discovery.md).

## Configuration and workflow-definition provenance

Two checkout roots may contain different Git-tracked `.nevo/config.yaml` or `.nevo/workflows/**` files. Treat them differently: **operational project policy** (including Runtime Auth, Git enablement, and local configuration/secrets) comes from the one designated [Project Home](project-home-discovery.md); **versioned workflow definitions** for an execution come from the verified bound execution workspace, subject to project policy. Do not merge configuration arbitrarily across branches or permit a linked checkout to override project authorization.

A real workflow attempt records the precise definition revision/content provenance resolved when it started. Later `inspect`, `resume` and `finish` may not silently adopt new workflow YAML because the home checkout HEAD moved or a linked branch changed. Missing/changed provenance blocks for explicit compatible migration/recovery, never a best-guess replacement. Initial proof: P06 in Foundation A for config ownership and W10 in Foundation B for definition pinning.

A local `projectId` / `workspaceId` identifies the **local** coordination environment, not necessarily a portable security scope; [local actor and authorization policy](local-actor-and-human-gates.md) separates persisted grants from runtime-resolved paths.

## Path safety and isolation

Resolve/canonicalize roots; verify parent boundaries, reserved destinations, symlinks, unexpected nested repositories, duplicate real paths and branch checkout constraints before creating or deleting. File API paths must be bounded to the resolved workspace and prohibit traversal via document IDs. A path's existence alone cannot authorize cleanup or serving its files.

## Cross-workspace resources

State authority and cache location are separate. Candidate: a central registry/journal under the project's ignored `.nevo/local/state/`, partitioned by `workspaceId`. Physical lock directories may be per-workspace; all participants need the same deterministic lock address, even when invoked from a linked checkout. Do not mix an Engine journal with Runtime-only provider transcripts merely because both are stored under `.nevo/local/state/`.

## Verification focus

- Resolve same `projectId` and registry from primary and managed linked worktrees.
- Distinguish another independent clone from a registered checkout.
- Reject relative/path collisions and escaped/symlinked destinations.
- Move or remove a worktree: report repairable state without selecting an unrelated checkout.
- Relocation policy must explicitly account for native-provider Session compatibility before reusing a managed session; [binding lifecycle](workspace-binding-lifecycle.md) owns rebind/move protocol.
