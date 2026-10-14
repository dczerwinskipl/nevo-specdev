---
id: ideas.specflow-engine.workspace-binding-lifecycle
type: architecture
title: Canonical Specification workspace binding lifecycle
status: draft
scope: specflow
areas: [workflow, runtime, configuration, security]
tags: [workspace-binding, worktree, rebind, integration]
read_when:
  - moving canonical Spec ownership after branch integration
  - relocating or deleting worktrees used by Specs and managed Sessions
summary: >
  Transactional Spec-to-workspace binding changes and safe post-merge rebind, move, unavailable,
  session-compatibility and cleanup behavior without branch-guessing or stale fallback.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.workspace-registry
  - ideas.specflow-engine.project-home
  - ideas.specflow-engine.worktrees
  - ideas.specflow-engine.managed-session-integration
  - ideas.specflow-engine.recovery
---

# Workspace binding lifecycle

## Binding is authority for location, not content

The workstation-local registry owns `specId -> workspaceId` placement and optionally a binding generation/revision. Git-tracked manifest files own canonical spec content. A checkout branch named after the spec is _not_ an authoritative binding. Never choose an alternate checkout based on recency when a bound worktree is unavailable.

## Distinct operations

| Operation          | Preconditions and effect                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `register`         | Provision verified workspace; attach one specId under atomic registry revision                                                              |
| `resolve`          | Validate current Git membership, registry generation and spec manifest identity; return verified workspace                                  |
| `rebind`           | Explicitly change authoritative source from `workspaceA` to `workspaceB` after verifying same spec and intended committed content           |
| `relocate`         | Update physical root for **same** workspace identity after verifying Git metadata/path; may invalidate provider native resume compatibility |
| `mark-unavailable` | Keep binding and identity; return repairable source-unavailable state                                                                       |
| `cleanup`          | Separate authorized operation, only after integration and safe rebind, never implicit on Task/Turn completion                               |

These are proposed use cases; exact names and public availability are not frozen.

## Rebind after integration into main

1. Inspect binding revision, target branch/common Git repository and manifest identity at source; verify intended integration into destination commit/ref. A completed Task, merged PR number alone or branch name are **not** sufficient proof.
2. Ensure target checkout **actually contains** the intended spec content and canonical `specId` and the correct archived/current state. If target currently has stale or different content, report conflict.
3. Check outstanding local journal operations, workspace writer claims, uncommitted/unpushed changes and Runtime-managed active Turn bindings. Block or explicitly coordinate/fence them; rebind is not silent while someone writes.
4. Persist intent for `rebind(specId, fromWorkspaceId, toWorkspaceId, expectedBindingRevision, targetRevisionProof)`. Mutate registry with compare-and-set under project coordination; update generation and durable evidence.
5. Reads thereafter select destination only. Invalidate Runtime/UI projection per affected spec. Do not delete source automatically.
6. A retry resumes same operation by evidence; if destination differs from intent, report recovery conflict, not last-write-wins.
7. Perform **separate** cleanup assessment; only managed worktrees and branches may be candidates, and only after confirmation.

A destination primary checkout may still be on a different commit than a remote merged branch. Verify actual materialization, not merely PR merge state. The transition may require human choice if source/target versions differ.

## Session and provider implications

- A canonical Session retains historical `workspaceId` correlation; moving/rebinding a Spec does not retroactively change old Turn execution provenance.
- For a **new Turn**, Runtime resolves the current binding and verified root. If its previous provider-native session was created in another workspace, apply explicit resume-compatibility policy; when uncertain, refuse automatic native resume or start a fresh provider-native context only after confirming replay safety.
- A missing workspace **does not erase or hide authorized historical Session content**. It blocks new workspace-dependent execution, but read-only Session history can remain accessible through scoped authorization.
- A Session with active Turn cannot silently switch its active workspace; reconcile/cancel that Turn first. This must be tested for path relocations and `specId` rebinds.

## Source unavailable and repair

No registry entry where one was required, missing checkout, missing manifest in verified checkout, substituted path, divergent `specId` and unavailable Project Home are distinct errors with different remediation. An explicit repair operation can restore a validated path/binding with evidence and operator authorization; it must not silently turn an absent worktree into a fresh empty source.

## Cleanup ordering

```text
workflow complete (domain) -> integration proven (Git)
 -> destination files verified -> binding rebind committed
 -> active/unknown work checked -> cleanup eligibility verified
 -> optional confirmed worktree cleanup -> optional guarded branch cleanup
```

These are not one automatic "finish" side effect. Deleting a worktree that remains canonical would create a self-inflicted unavailable spec.

## Deferred multi-instance lifecycle implications

A group of instances for one user-defined step may depend on a configured input baseline or hold effect-specific resource ownership even without an exclusive writer claim. Rebind, relocation and cleanup must account for active instances, source reservations, writer claims and managed Turns. Preserve per-instance history and reject stale results when declared input consistency is violated. Do not impose frozen source inputs on steps that explicitly allow independent input; see [multi-instance execution](multi-instance-execution.md).

## Authorization scope after binding

HTTP receives selectors and resolves the authoritative spec/workspace through Engine before authorizing a resource-specific read/mutation. Never trust caller-provided `workspaceId` to widen authorization or allow an alternate path. For `create new-worktree` (before workspaceId exists), use project-level capability plus Git/worktree-specific permission if policy requires it; then bind the created resource to resolved project scope. Where a resource may not be disclosed to unauthorized users, resolve only minimal trusted scope before returning any details.

## Verification

- After branch integration and validated rebind, spec resolves once from destination and survives safe source removal.
- Rebind to stale/divergent target is rejected; stale binding generation cannot overwrite a concurrent move.
- A managed active Turn prevents uncoordinated rebind; Turn history remains readable after relocation.
- Missing worktree shows unavailable, not stale source or fabricated 404.
- Different actor cannot rebind by supplying an authorized specId with an unauthorized destination.
