---
id: ideas.specflow-engine.workspace-registry
type: architecture
title: Workspace registry and Specification discovery
status: draft
scope: specflow
areas: [workflow, configuration, runtime]
tags: [registry, discovery, deduplication, workspace]
read_when:
  - listing Specs across primary and linked worktrees
  - designing source-of-truth and unavailable-worktree behavior
summary: >
  Local spec-to-workspace binding registry, authoritative manifest selection, duplicate handling,
  and safe cross-worktree discovery for CLI and Runtime reads.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.project-workspace
  - ideas.specflow-engine.worktrees
  - ideas.specflow-engine.recovery
  - ideas.specflow-engine.project-home
  - ideas.specflow-engine.workspace-binding-lifecycle
---

# Workspace registry and Specification discovery

## Separate location authority from content authority

The central local registry answers **where to read a given `specId`**. The specification manifest/documents in the selected Git checkout answer **what that spec contains**. The registry must not copy editable Specification state. A file path or branch label is metadata, not canonical identity.

Proposed machine-owned ignored file under project home: `.nevo/local/state/workspaces.json`; exact structure may evolve:

```json
{
  "version": 1,
  "projectId": "local-project-1",
  "workspaces": [
    {
      "workspaceId": "primary",
      "kind": "primary",
      "path": ".",
      "managed": false
    },
    {
      "workspaceId": "wt-01",
      "kind": "linked",
      "path": "../project-worktrees/feature-a",
      "branch": "spec/feature-a",
      "managed": true
    }
  ],
  "specBindings": [
    { "specId": "canonical-spec-uuid", "workspaceId": "wt-01" }
  ]
}
```

This is a **shape example** rather than an approved schema. In particular, decide whether primary workspace is explicitly stored and how local `projectId` is generated. Paths should be resolved relative to one [verified Project Home](project-home-discovery.md) and verified with Git before use; stale paths cannot be trusted as commands. The registry needs a monotonic binding revision/generation for compare-and-set rebinds.

## List algorithm

1. Read and validate registry atomically with a versioned schema.
2. Resolve the primary workspace and all **registered** linked workspaces. Do not trust/discover arbitrary Git worktrees as product sources.
3. For each workspace, validate accessibility and membership; list candidate active/archived manifests via its configured spec store/index.
4. Group records by canonical `specId`. If a valid explicit `specId -> workspaceId` binding exists, that binding wins for content, even if main retains the same manifest on a different branch.
5. For unbound specs, allow only a documented primary checkout default. Unbound copies in linked roots should be flagged/ignored according to explicit policy, never silently added as duplicate canonical specs.
6. Detect two incompatible bindings, mismatched IDs, slug/manifest collisions, and contradictory archive/current states; surface diagnostic conflicts.
7. Return one canonical row per spec with source/workspace availability. Revisions/indexes are workspace-scoped; Runtime Overview projects one list for the UI.

Do not choose whichever manifest is newest by timestamp, status or file modification time. Those are not provenance proofs.

## Missing workspace semantics

When bound root disappears, keep the binding and report a distinguishable `workspace_unavailable` state, with repair/removal options. A missing Project Home is a *different* error from a missing linked workspace. Do **not** fall back to a stale same-ID copy in the primary checkout. Do not auto-delete specs from Overview. A truly non-existent manifest in a verified workspace is different from a missing workspace; preserve that distinction.

Runtime may cache or subscribe to filesystem changes, but must refresh/regenerate snapshots when files change from an offline CLI or external editor. Polling/index revision can supplement watchers; watcher events are hints, not authority.

## Corruption and concurrency

- Versioned JSON registry with schema validation; on unknown version fail rather than silently resetting.
- Atomic temp-file write + rename with coordination lock; on Windows examine retry/replace semantics in integration tests.
- Multi-process creation must reserve path/slug/specId without TOCTOU race; filesystem/Git checks alone are not sufficient.
- Persist durable operation intent so register-after-create can be recovered.
- Local registry may be recreated from evidence only with explicit reconstruction and collision review; avoid pretending Git object store itself remembers workstation decisions.
- A portable clone on another machine can legitimately have its own registry and different worktree layout; its Git manifest identities remain the same.

## Rebinding after integration

The spec binding is not permanent. After changes are safely integrated into the destination branch and **actually present** in its checkout, an explicit durable [rebind operation](workspace-binding-lifecycle.md) can atomically change canonical `specId -> workspaceId` after verifying identity, integration evidence, active claims and Runtime Turn ownership. Reads thereafter follow the new binding. Cleanup is separate and may not delete a still-bound worktree. Do not infer rebind from PR merged status alone.

## Index and query performance

Keep existing Overview and Workspace read contracts as boundaries. Index updates should not rescan every document in every worktree on every request. Cache per-workspace summaries with revision/fingerprint and invalidate only affected sources. Sessions/Turn activity can refresh at a different rate from spec documents. Batch reads are an optimization option, not necessary for the foundation PoC.

## Acceptance probes

- Same spec present in primary and bound linked tree appears exactly once, with linked data.
- Bound linked checkout absent means unavailable, not fallback.
- Invalid/duplicate registry entry fails explicitly and preserves files.
- External CLI changes become visible to Runtime without calling the Runtime mutation API.
- Two local processes concurrently registering distinct workspaces do not lose updates.
