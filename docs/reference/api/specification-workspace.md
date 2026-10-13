---
id: reference.api.specification-workspace
type: reference
title: Specification Workspace HTTP API
status: current
read_when:
  - implementing or consuming the Specification Workspace API
  - validating Workspace authentication and feature availability
summary: >
  Typed Specification Workspace composition with explicit
  Runtime data source, authorization and independent detail loading.
related:
  - reference.api.task-reads
  - reference.api.specs-overview
  - architecture.runtime.authorization
  - product.specflow.ui.data-loading-and-integration
---

# Specification Workspace HTTP API

The Runtime owns the authoritative read boundary. Production UI invokes a typed
`SpecificationApi` over its application-scoped `HttpClient`. There is no browser
fixture switch or silent mock fallback.

## Endpoints

| Method | Path                           | Response                                    |
| ------ | ------------------------------ | ------------------------------------------- |
| GET    | `/api/specs/:specId/workspace` | `SpecificationWorkspaceResponse`            |
| GET    | `/api/runtime/info`            | `RuntimeInfoResponse` containing `dataMode` |

The schemas and generated types live in `@nevo/specflow-contracts/specs/workspace`
and `@nevo/specflow-contracts/runtime`. The initial Workspace response is a
bounded, coherent read projection. Markdown bodies and full Task details have
their own read operations. The DTO is independent of React and `@nevo/ui`.

Workspace section states are `available`, `unavailable` (with
`not_implemented` or `source_unavailable` reason) and `forbidden`.
An `available` empty list means the authoritative read succeeded and was
empty; it must not stand in for a missing integration. Backend-supplied Task
groups and document manifest ordering are authoritative.

## Data source

Normal `nevo-specflow start` uses project mode. A missing project-side
read repository returns `503 { "error": "specification_source_unavailable" }`
rather than demonstration data. The explicit `nevo-specflow start --demo`
selects Runtime-owned demonstration repositories over the same endpoints.
Demo Overview and Workspace derive from one consistent sample catalogue.

This increment does **not** implement a real project Specification storage
adapter, mutations, multi-project routing, or multi-worktree execution.
Availability and action states describe only what actually exists.

## Authorization and errors

All Specification reads require `spec.view` at the selected `specId`
scope. All Session-owned data, including summaries, attention, activity and generic events
with a Session provenance ID, are filtered according to `session.view` at the
concrete Session scope. The backend issues a `recommendedSessionId`; the UI must
not guess the preferred Session from array order. When the Session section is
unavailable, Session references in other sections still undergo authorization. HTTP `401` and `403` follow
existing Runtime authorization conventions; unknown valid Specification
identities return `404 { "error": "specification_not_found" }`. Missing
Task/document resources use their own stable 404 codes. Invalid parameters
return 400. Both successful read responses and domain error responses use
`Cache-Control: no-store`.

Frontend code distinguishes a missing Specification from an unregistered
Fastify endpoint by the stable error body, not by HTTP status alone. TanStack
Query handles cancellation, caching and targeted lazy-detail reads.

## Domain projection and UI freshness

The internal Specification source supplies its own identity and lightweight facts. The application
composer joins public Task, Document and Session contributions and applies visibility. Specs owns
no Task detail, history, resources or document-body repository methods or routes. The HTTP endpoint
only maps the application result; root composition selects project or explicit demo dependencies.
The actual project reader is still a separate future increment.

Task lifecycle is a semantic code. The UI does not persist translated status labels in
its Query cache; translation happens during rendering. Full Task uses the current
Task-detail response as authority for its title. When work is available, its deterministic
flow snapshot owns the main status; legacy lifecycle is a fallback only without that source. Workspace Refresh
invalidates only the exact Workspace snapshot; Task, document and lazy-page queries
own their freshness and Retry lifecycles. `GET /api/specs/:specId/workspace` never contains
full document Markdown.

A backend reader must attach Session provenance to any generic activity event
carrying Session-owned information so authorization can filter it. A generic
activity item without a Session provenance cannot carry protected Session content.

## Task and document reads

[Task and document read API](task-reads.md) owns the independent detail, bounded paging,
opaque leases and exact document revision contracts. Runtime Tasks and Documents retain the
existing URL paths. `specs/workspace` re-exports the owner schemas for compatibility; it does
not own their source definitions or application operations.
