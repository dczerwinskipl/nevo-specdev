---
id: ideas.specflow-engine.project-home
type: architecture
title: Discovering the Project Home from any Git worktree
status: draft
scope: specflow
areas: [configuration, cli, runtime, workflow]
tags: [project-home, worktree, discovery, identity]
read_when:
  - making CLI work from a linked checkout with Runtime stopped
  - selecting the canonical local state and configuration home
summary: >
  Testable candidate discovery protocol for the one local Project Home from the primary checkout
  and managed linked worktrees, including moves, ambiguity, offline startup, and repair.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.project-workspace
  - ideas.specflow-engine.workspace-registry
  - ideas.specflow-engine.recovery
  - architecture.runtime.configuration
---

# Project Home discovery

## Problem and invariant

`git rev-parse --show-toplevel` selects the **current checkout**; a linked worktree has its own working tree and usually a `.git` file. Git's `--git-common-dir` verifies common repository membership but is **not** itself a declaration of SpecFlow's state owner. A project can have many worktrees, while Specs registry, claims, journals and local configuration need one discoverable authority.

**Candidate invariant:** given any registered worktree of one local project, the same CLI command resolves to the same Project Home, `projectId`, coordination state root and config provenance, even if Runtime is stopped. An unrelated clone with the same remote must not be adopted.

## Candidate discovery protocol for Foundation A

This is a **proposed algorithm to implement and test**, not a promise that Git provides all required metadata automatically:

1. Inspect the caller's real `cwd`, find the Git checkout root using Git plumbing, and resolve the canonical Git common directory. Require a non-bare worktree for workspace operations.
2. Support an explicit `--project-root`/configured locator for repair and unambiguous scripted use; verify its config and Git common-dir match the invoking checkout before accepting it. An explicit override is not permission to attach arbitrary repositories.
3. Without an override, inspect the **known worktrees of that Git common-dir** (`git worktree list --porcelain` or equivalent). Check for a designated SpecFlow home marker/config with a persistent `projectId` and version; do not infer home from branch names, lexicographic paths or whatever checkout is first.
4. Accept **exactly one** validated home. Verify the project's coordination state and its recorded Git common-dir identity; load the registry under that home. Use registry membership and verified Git metadata to bind the caller to a `workspaceId`.
5. If zero/multiple homes are found, fail with a machine-readable `PROJECT_HOME_NOT_FOUND` / `PROJECT_HOME_AMBIGUOUS` diagnostic and remediation command proposal; do not silently initialize a new project or copy old state.
6. Revalidate the selected home at mutation admission and after long-running external work; a checked path can change or be replaced between reads.

A project marker should be rooted in already owned committed config plus **local** home designation/identity as appropriate; avoid inventing a second competing committed product ID. The exact data format, what survives a branch without current `.nevo/config.yaml`, and whether Git enumeration is efficient/portable enough are decisions to validate. Git worktree enumeration here is only **home discovery**, not automatic trust of every worktree as a product workspace.

## State/config ownership and fallback

Distinguish committed `.nevo/config.yaml` and workflow definitions (versioned policy) from ignored `.nevo/local/config.yaml` (operator-local secrets/settings) and `.nevo/local/state/` (Engine coordination and Runtime session stores). Do not read an untrusted linked branch's local config as a second authority, or silently fall back to default config when the home is unavailable.

It is permissible to start the experiment with the primary checkout as Project Home, **provided** this dependency and failure mode are explicit. A later external per-clone state directory is an alternative if moving/deleting the primary home proves too brittle. Do not quietly store canonical Engine state inside Git internals.

## Two configuration provenances: project policy versus workspace definitions

Project Home is the **operational configuration authority** for one local project instance: validated committed `.nevo/config.yaml` from the designated home checkout, ignored `.nevo/local/config.yaml` from that home, and the central local registry/journal. This includes Runtime authentication/authorization and enabled Git capabilities, under the existing project-versus-local ownership rules. The same local project must not change those permissions because a CLI command started from a different linked checkout whose committed config happens to differ. Changes to operational policy need explicit validation/reload or a designated-home migration, not implicit last-checkout-wins.

By contrast, committed workflow definitions (`.nevo/workflows/**`) and other **execution artifacts** should be selected from the *verified target execution workspace*, subject to the project-owned capability/policy boundary. A linked branch can legitimately contain a different workflow revision from the home checkout. **No Engine step may implicitly replace the definition of an active attempt with the definition at the Project Home's current HEAD**.

At attempt activation, resolve the intended workspace version and persist a stable provenance reference (workspace identity, definition ID and relative path, schema/version, content digest or Git blob identity, and any required immutable snapshot/retention evidence). Inspect/resume/finish must use or verify that pinned definition. If the original content is unavailable, modified or incompatible, report a structured recovery/migration blocker; adopting v2 is a separate explicit validated transition. A Git commit hash alone is not sufficient when an uncommitted definition is allowed; decide whether uncommitted definitions are rejected or snapshot immutably. Portability of this evidence across clones is also a decision, not an assumed feature.

The versioned definition may govern workflow behavior **but cannot alter Runtime user grants or elevate Engine actor permissions merely because it came from another checkout**. Keep operational policy provenance distinct from attempt definition provenance. Foundation A tests divergent project configs (P06); Foundation B tests pinned workflow revisions (W10).

## Moves, deletion and ambiguity

| Condition | Candidate behavior |
| --- | --- |
| Caller within primary worktree | Resolve same home and workspace as configured |
| Caller within registered linked worktree | Resolve home first, then bound workspace |
| Another linked worktree has `.nevo/config.yaml` in its branch | Do not assume this creates a second home |
| Primary checkout path moved with Git metadata intact | Validate/rebind home only with positive identity evidence |
| Primary checkout deleted while linked worktrees survive | Fail as home unavailable; offer explicit state-location repair/recovery, not empty registry initialization |
| Two candidate home markers | Fail ambiguous; require owner choice |
| Independent clone with same remote | New local scope; never share claims because remote URL matches |
| Missing/corrupt local state | Diagnose distinctly from an empty project; retain recovery evidence |
| Worktree outside configured parent | Membership verified through Git + registry, not path prefix alone |

## Security and portability

Treat realpath/symlink substitution, junctions on Windows, linked checkout `.git` files, spaces and Unicode, case-insensitive collisions, stale `git worktree` metadata, bare repos, and old Git versions as inputs to deliberate tests. Do not claim strong process isolation on shared local filesystem; operators with direct write access can bypass advisory state coordination.

## Required Foundation A evidence

- A fresh CLI process launched from each worktree chooses **identical** project/state home and resolves its own different workspace.
- Broken/multiple home and independent-clone cases fail deterministically, without creating a second local registry or dropping locks.
- `--project-root` is an explicit verified escape hatch, not an alternate project identity.
- A missing home does not cause Runtime or CLI to present a phantom empty Spec list.
- Divergent committed config in a linked branch does not implicitly replace home-owned Auth/Git operational policy (P06).
- Git metadata path resolution and local config provenance are inspected at every mutating boundary.

**Decision before implementation:** choose home marker/locator and state directory retention, or narrow Foundation A's supported topology explicitly. **Foundation A must fail safely when Project Home was moved or deleted; a successful automated home relocation/repair workflow is explicitly deferred** until a separately scoped lifecycle/repair gate. Do not promise working relocation from P02's detection-only test. See [decision register](decisions-and-promotion.md).
