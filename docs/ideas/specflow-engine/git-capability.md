---
id: ideas.specflow-engine.git
type: architecture
title: Optional Git capability and adapter
status: draft
scope: specflow
areas: [workflow, configuration, security]
tags: [git, worktree, branch, capability]
read_when:
  - enabling optional Git integration for Specs/workspaces
  - designing safe branch and linked worktree creation
summary: >
  Candidate capability-owned Git port with explicit enablement, verified checkout membership,
  guarded branch/worktree operations and no Git shell logic in Specification use cases.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.project-workspace
  - ideas.specflow-engine.spec-creation
  - ideas.specflow-engine.worktrees
  - engineering.repository.git-workflow
---

# Git capability boundary

## Git presence is not capability enablement

Current SpecFlow `resolveProjectLayout` on main requires `git rev-parse --show-toplevel` to initialize/start. That makes a Git-backed project a current bootstrap prerequisite, **not** evidence that every Git automation action must be enabled. In the experiment, keep Git-backed init if needed, but add an explicit feature availability decision for worktree actions. Supporting projects without Git at all is a separate product decision.

Feature enablement must be feature-owned (a proposed top-level project policy, not `runtime.server`), with truthful capability discovery across CLI and Runtime. A request for `new-worktree` when disabled must fail before creating or mutating anything. Reads and ordinary spec creation can remain available where their storage contract supports them.

## Port and adapter

Git semantics belong to a reusable Git capability, not Specs HTTP, the UI, a generic workflow shell, or a provider adapter:

```ts
interface GitCapability {
  inspectCheckout(root: string): Promise<GitCheckoutFacts>;
  listWorktrees(project: ProjectRef): Promise<readonly GitWorktreeFacts[]>;
  validateNewWorktree(input: NewWorktreePlan): Promise<GitPlan>;
  createWorktree(plan: GitPlan, operationId: string): Promise<GitWorktreeFacts>;
  inspectChanges(root: string): Promise<GitChanges>;
  removeManagedWorktree(input: RemovalPlan): Promise<RemovalResult>;
}
```

Application operations use a narrow interface. Platform adapter invokes `git` via safe argument arrays and explicit `cwd`, with bounded output, abort/timeout/error taxonomy. Never concatenate untrusted branch/path input into a shell command. Avoid exporting a universal `git(args)` API to every feature.

## Before creating a worktree

- Verify Git binary and exact Git repository/common-dir identity.
- Ensure base ref exists and resolves to a commit; choose a documented branch/ref policy.
- Ensure branch is not already checked out in another worktree (normal Git constraint).
- Validate target absolute path, expected parent, directory collision, symlink and nesting restrictions.
- Check project-config existence in the target commit, or define explicitly how scaffold/config is bootstrapped.
- Make branch names deterministic enough to understand, not based solely on mutable display title.
- Avoid branch checkout, reset or clean in the primary worktree.
- Serialize conflicting branch/path reservations across independent processes.

## Error taxonomy proposal

Use machine-readable kinds: `GIT_DISABLED`, `GIT_UNAVAILABLE`, `NOT_GIT_REPOSITORY`, `WORKTREE_PATH_CONFLICT`, `BRANCH_ALREADY_CHECKED_OUT`, `BASE_REF_NOT_FOUND`, `GIT_OPERATION_FAILED`, `WORKTREE_MEMBERSHIP_MISMATCH`. Names are candidates; never present them as already implemented contracts.

Error context should preserve safe diagnostic detail and support remediation. Do not silently enable capability, create a fallback branch, or force checkout when requested state is invalid.

## Git changes versus workflow evidence

A branch HEAD, worktree dirty state, base diff and PR/MR refs are separate observations. Do not assume a clean worktree proves a task is verified or that a PR is merged. Workflow evidence must be associated with attempts/scopes. Git capability reports source-control facts; Engine workflow evaluates gates.

## Cleanup policy

Removal uses a managed-worktree record **plus** validation of current Git membership, path, branch, local changes, outstanding operations and merge/integration proof. Ref deletion and physical worktree removal are separate choices. Never use forced removal by default. User-owned/imported worktrees should not be deleted automatically.

## Open choices

- Whether Git feature config is enabled by default in a Git-backed project.
- Whether externally supplied branches/worktrees may be attached in MVP.
- How remote provider (GitHub/GitLab/none) is kept distinct from local Git.
- Whether a worktree is allowed to live outside a configured parent directory.
- How a project whose Git main checkout is missing recovers registry lookup.
- Whether automatic source-control commits are part of spec creation (proposed: do not require for first PoC).

## Tests

Use real local Git repos and worktrees. Test space-containing paths, branch checkout conflicts, race on same branch, invalid base, missing executable, disabled capability, symlink escape, branch names with special characters, and stop/retry after process interruption.

## Shared Git versus workspace coordination

Git worktrees have distinct working files and indexes, but share references and object storage. A workspace-specific claim does not serialize cross-worktree branch creation, deletion or `rebind`. Reserve branch/path under project/Git-repository coordination, journal multi-stage operations, and validate actual target checkout membership; do not hold a global lock while awaiting provider work.

After merge/finalize, changing the authoritative spec's checkout is a separate [binding lifecycle](workspace-binding-lifecycle.md) operation: prove content is present in destination and use compare-and-set before optional cleanup. The feature's capability switch and HTTP project-level permission are separate: presence of `git` executable or a Git-backed init does not authorize worktree creation.
