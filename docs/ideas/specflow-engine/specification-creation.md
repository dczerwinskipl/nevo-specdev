---
id: ideas.specflow-engine.spec-creation
type: product
title: Specification creation vertical slice
status: draft
scope: specflow
areas: [workflow, cli, server, ui]
tags: [specifications, create, vertical-slice, worktree]
read_when:
  - implementing the initial cross-layer proof of concept
  - defining creation inputs and CLI HTTP parity
summary: >
  Narrow end-to-end create-Spec experiment with title-only UX, explicit target workspace,
  optional Git worktree provisioning, durable operation intent, and consistent CLI/HTTP results.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.project-workspace
  - ideas.specflow-engine.git
  - ideas.specflow-engine.worktrees
  - ideas.specflow-engine.recovery
  - ideas.specflow-engine.acceptance
  - ideas.specflow-engine.project-home
  - ideas.specflow-engine.execution-scopes
---

# Specification creation vertical slice

## Scope

Build a real `create Specification` operation accessible in-process from CLI and from authenticated Runtime HTTP. **Only title is required in human-facing UI**, consistent with `docs/ideas/specflow-ui/information-and-navigation-inventory.md`. Slug and canonical `specId` are generated deterministically where appropriate, with collision checking. Description/goal optional, agent/session launch **not** part of this PoC.

A user may create inside an existing/current checkout or select an optional new Git worktree. The worktree choice is available only when Git capability is enabled and operational. A successful operation returns the canonical `specId`, manifest location, workspace identity and usable navigation reference, not just a success message.

## Candidate application input

```ts
type WorkspaceTarget =
  | { kind: 'existing'; workspaceId: string }
  | { kind: 'new-worktree'; baseRef: string; branch?: string; location?: string };

type CreateSpecInput = {
  title: string;
  description?: string;
  target: WorkspaceTarget;
  operationId?: string; // idempotency identity supplied/resolved at trusted boundary
};

type CreatedSpec = {
  specId: string;
  slug: string;
  workspaceId: string;
  repositoryRelativeManifestPath: string;
};
```

These are **sketches**, not approved API/public DTO shapes. The CLI's default target may be its current registered checkout; UI may default to project's primary workspace. Resolve defaults **before** calling the use case. Do not let internal `process.cwd()` choose implicitly.

## Expected sequence

1. Resolve authoritative [Project Home](project-home-discovery.md) and current Project/Workspace context; check Git capability if `new-worktree` requested.
2. Authorize at adapter boundary (HTTP), validate title/slug and resolve target branch/location policy.
3. Under project registry coordination, reserve unique spec ID/slug/worktree path/branch; record a durable creation intent.
4. If new worktree requested, create using a verified base ref; **do not checkout/switch the primary worktree**.
5. Write minimal valid specification scaffold in the selected workspace and update any canonical indexes needed by the existing contract.
6. Persist registration `specId -> workspaceId` without producing an untracked competing source of truth for manifest content.
7. Mark operation terminal and return canonical result; propagate invalidation/notification to Runtime observers if present.

## Partial failure/retry table

| Failure point                                    | Candidate behavior                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| Git disabled                                     | Reject before reserving/provisioning or writing                     |
| Invalid title or collision                       | Structured validation/conflict, no side effects                     |
| Branch already checked out                       | Explicit conflict, do not forcibly steal it                         |
| Worktree creation failed                         | Record failure; release reservation; do not mutate primary branch   |
| Worktree exists but manifest write failed        | Resume same intent; don't create second worktree                    |
| Manifest exists but registry write failed        | Recover and link only after verifying matching specId and operation |
| Successful create retried with same operation ID | Same result; not a duplicate spec                                   |
| Target root replaced with unrelated path         | Refuse mutation and flag recovery                                   |
| Crash after all writes before response           | Re-read committed state and return same result                      |

For failures requiring manual recovery, keep durable evidence; never automatically remove an unproven worktree or discard edits.

## CLI and HTTP

Illustrative CLI:

```sh
nevo-specflow specs create --title "Authorization redesign"
nevo-specflow specs create --title "Authorization redesign" --worktree
nevo-specflow specs list --json
```

HTTP: propose a real `POST /api/specs` with declared request/response types and authorization, layered over the same Engine operation. Preserve existing `GET /api/specs/overview` and `GET /api/specs/:specId/workspace` semantics when wiring production repositories. Do not return fixture data or claim unsupported sections are available.

## First-run scaffold baseline and dirty state

The new canonical manifest is specification.yaml, not a change log; it is versioned durable Specification metadata and status, not host-local journals, locks, or execution process state. Unreleased change.yaml and Create v1 artifacts are not supported or silently converted; reject them explicitly and require manual recreation or one-off operator handling if data exist. The new manifest may be uncommitted immediately after creation. Nevo SpecFlow uses deterministic workflow execution by architecture; new Specification scaffolds MUST NOT persist a redundant workflow.mode execution-algorithm selector. These contract corrections are E2.T09 and MUST preserve byte-exact replay of previously persisted Create v1/v2 journals rather than invalidating stored scaffold fingerprints. A subsequent Spec Writer must not get stuck merely because creation produced its own known files. Foundation A must record provenance/fingerprint for scaffold side effects; a later action-specific admission can accept that known baseline **only when evidence proves it**, without globally bypassing unrelated dirty changes or mandatory clean Git gates. Avoid automatically committing as a workaround until owner chooses an explicit commit policy. Stage B must test Create → authoring writer admission and the difference between Engine-owned scaffold dirt and unknown external edits.

For the PoC, lock/resource serialization covers _creation_, not a fake `workflow step start`; see [two-stage acceptance](acceptance-criteria.md) and [execution scopes](execution-scopes-and-recovery.md).

## Prerequisite choices

Specify default spec directory/manifest shape, whether initial scaffold is staged/committed automatically, where base ref comes from and whether the 'Git integration enabled' switch can be off inside a Git-backed SpecFlow project. Avoid conflating a Git repo required by current `init` with an enabled feature. The experiment may keep 'non-Git project' out of scope while proving Git-disabled capability behavior.

## Out of scope

No full agent turn, AI spec drafting, Task Planner, spec approval, PR open/merge, automatic worktree deletion, full finalization, broad UI redesign or editable general-purpose file explorer.

## Demonstration script

1. Start with a temporary Git repo and initialized project.
2. Create spec A in the primary checkout via CLI with Runtime absent.
3. Create spec B in a fresh worktree via CLI, with Runtime absent.
4. Start real Runtime, read A and B through actual HTTP endpoints and verify different roots.
5. Create spec C through HTTP, stop Runtime, read C from independent CLI.
6. Retry a creation operation, then inject a crash after Git creation and demonstrate reconciliation.

Definition of success is in [acceptance criteria](acceptance-criteria.md).
