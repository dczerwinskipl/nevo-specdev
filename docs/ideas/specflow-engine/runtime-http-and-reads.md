---
id: ideas.specflow-engine.runtime-http
type: architecture
title: Runtime HTTP and read model integration
status: draft
scope: specflow
areas: [runtime, server, ui, workflow]
tags: [http, api, read-model, synchronization]
read_when:
  - exposing offline Engine operations through the real Runtime API
  - integrating creation with Specs Overview and Workspace reads
summary: >
  Thin authorized HTTP adapters over the same Engine use cases as offline CLI, with real
  read repositories, correct source availability and cache invalidation across processes.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.boundaries
  - ideas.specflow-engine.spec-creation
  - ideas.specflow-engine.workspace-registry
  - product.specflow.ui.application-architecture
---

# Runtime HTTP and read integration

## Preserve existing design direction

On `main`, `packages/specflow-runtime/src/features/specs` provides a feature-scoped Runtime entry point and Overview read model. In **unmerged PR #45 preview** the same feature has a `SpecificationWorkspaceRepository`, endpoints for workspace/document/task reads, and a separate explicit demo backend. These are useful future integration seams, not permission to make HTTP own specification mutations.

Do not replace typed feature APIs with browser fixture imports. Do not create a second HTTP transport/QueryClient for the new feature. The current UI architecture already specifies application-scoped HTTP transport and typed feature APIs.

## Proposed HTTP flow

```text
HTTP authentication -> scoped authorization -> validate DTO
    -> Specs Engine use case
    -> canonical result / domain error
    -> HTTP response mapping + cache/event notification
```

Endpoint `POST /api/specs` is a **proposal**. Check existing registered routes and API naming at implementation time. `Specs.create` owns manifest, Git worktree and registry semantics; request handler must not call `git` directly, write YAML, acquire locks or invent operation recovery.

Read repositories adapt Engine queries into the existing Overview/Workspace read models; Runtime-specific Session/Attention overlays may be composed afterward under their own capability boundaries. A Specification read must still function when no managed Session exists.

## Read consistency

Two levels:

- **Durable source**: selected checkout manifest, Git facts, registry and Engine journal; changes may be made by CLI with Runtime stopped.
- **Runtime snapshot/projection**: cached and transport-facing, derived from sources; watchers and SSE deliver invalidation hints, not canonical state.

Do not assume all data changes at the same rate: docs/manifests infrequently, local status/Git more often, provider Sessions most frequently. Keep per-source query invalidation and revisions. Avoid rereading all documents across hundreds of worktrees for every Overview request.

With multiple registered worktrees, every read resolves authoritative source by binding. A missing registered checkout is a transparent unavailable/repair state; no fallback to primary stale manifest. Preserve 401/403/404/503 distinctions and existing authorization/redaction of related Session references.

## CLI parity

Same create use case from CLI with Runtime off and HTTP with Runtime on. Compare durable results, not just response DTO equality. Different presentation error formats are allowed but each carries same semantic code. Do not use an HTTP call from CLI for normal Engine operations.

## Demo isolation

Runtime demo mode uses explicit demo repositories from existing feature composition. A demo request must not provision real worktrees or mutate project files. Production composition must use real Engine-backed repositories. If real data source is not yet installed/available, report unavailable; do not silently substitute demo.

## Optional UI scope

If the UI create action is included in this vertical slice, integrate it with the real Specs feature API. Title is the only required human field; optional worktree choice is capability-gated. Do not move creation to a separate fake frontend mutation. Rich agent initialization and sessions are later follow-ups.

## Verification and observability

- CLI-created spec appears over real HTTP after starting Runtime.
- Changes made by CLI while server is running appear after bounded invalidation or explicit refresh, without server restart.
- HTTP-created spec is discoverable by CLI with server stopped.
- Read of bound missing worktree returns explicit availability state; never stale main content.
- Unauthorized HTTP creation is rejected before any filesystem/Git side effect.
- Demo mode cannot mutate production project state.
- A multi-worktree change stream does not leak another user's unauthorized Session references.

## Canonical resource scope and pre-creation authorization

An HTTP client-supplied `workspaceId` or route `specId` is a selector, never a grant. Resolve authoritative Spec -> Workspace binding through Engine, then authorize with the canonical resource scope before returning protected data or performing a mutation. Avoid leaking details about unauthorized resources during resolve/errors. For **new** Specification/worktree creation there is no `workspaceId` yet: authorize at the established project-level scope plus any Git-worktree-create capability, then reserve/bind the new resource. A managed Session read additionally applies Session ownership/scope and redacts unauthorized Task associations. See [binding lifecycle](workspace-binding-lifecycle.md) and [local actors](local-actor-and-human-gates.md).

A later managed Turn must resolve the **current** workspace root immediately before provider dispatch/resume. Do not use a provider instance with a constructor-time global `cwd`. Missing/moved worktree blocks new writes but leaves authorized Session history readable; see [managed Sessions](managed-session-integration.md).
