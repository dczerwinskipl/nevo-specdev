---
id: reference.api.specification-workspace
type: reference
title: Specification Workspace HTTP API
status: current
read_when:
  - implementing or consuming the Specification Workspace API
  - validating Workspace authentication and feature availability
summary: >
  Typed Specification Workspace, document and Task read endpoints with explicit
  Runtime data source, authorization and independent detail loading.
related:
  - reference.api.specs-overview
  - architecture.runtime.authorization
  - product.specflow.ui.data-loading-and-integration
---

# Specification Workspace HTTP API

The Runtime owns the authoritative read boundary. Production UI invokes a typed
`SpecificationApi` over its application-scoped `HttpClient`. There is no browser
fixture switch or silent mock fallback.

## Endpoints

| Method | Path                                       | Response                                    |
| ------ | ------------------------------------------ | ------------------------------------------- |
| GET    | `/api/specs/:specId/workspace`             | `SpecificationWorkspaceResponse`            |
| GET    | `/api/specs/:specId/documents/:documentId` | `SpecificationDocumentResponse`             |
| GET    | `/api/specs/:specId/tasks/:taskId`         | `SpecificationTaskResponse`                 |
| GET    | `/api/runtime/info`                        | `RuntimeInfoResponse` containing `dataMode` |

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

The internal `SpecificationWorkspaceRepository` returns a Runtime-owned read model,
not a transport response. The endpoint converts it to the TypeBox HTTP contract,
applies scoped authorization, and validates detail identifiers against route parameters.
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

## Generic Task snapshot and lazy pages

Task detail optionally includes `snapshot` (`TaskSnapshotSchema`). Its sections are
independently available, unavailable or forbidden. Work describes a configurable
deterministic flow: definition and revision, active attempt or next step/checkpoint,
terminal outcome, declared transitions, blockers and previous feedback. Human steps
and independent human gates share one pending requirements projection. No Session,
review or report is required by this model. `work.data.definition.steps` contains every
configured step (executor, purpose, expected work and hints) and its declared transitions,
including explicit step or terminal targets. The UI renders this graph independently of
runtime position and attempt history; a branch or return is never inferred from array order.

Requirement evidence uses the same typed reference inspection as related resources. It is
pushed onto the current Secondary stack, so Back returns focus to its requirement opener.
The inspection binds to the snapshot revision and must not silently select another evidence
item after refresh. Available documents use the Documents owner with their exact revision;
reference types without an inspection reader show a noninteractive reader-unavailable state.
Reference availability alone MUST NOT enable an inspection action. The current generic Task
inspector supports only available document references, including requirement evidence and history.

Resources carry stable IDs, attempt provenance and resolved link availability.
The authorized first three recommendations and visible total are returned in detail;
the preview shows two before disclosure. Remaining resources and canonical attempt
history are loaded from:

- `GET /api/specs/:specId/tasks/:taskId/resources`
- `GET /api/specs/:specId/tasks/:taskId/history`

Both require `spec.view` and query `token`, optional opaque `cursor`, and optional
`limit` (1–50). Pages return `token`, `items`, `nextCursor` and `coverage`.
An expired/mismatched snapshot returns `409 { "error": "task_snapshot_expired" }`;
the UI refreshes Task detail before retrying against its new token. Session resource
references are authorized at their concrete Session scope before count/ranking/page
selection. The document reference includes the exact revision; the Documents reader
owns Markdown and authorization, and a revision mismatch is explicitly unavailable.

The same scoped reference policy applies to requirement evidence, dependencies and recovery,
not only resource lists and history. Denied references and their descriptive metadata are omitted;
a denied recovery source is forbidden. Non-Session references outside the selected Specification
are excluded by this increment's bounded read policy.

`recommended` contains at most the first three authorized resources. `visibleTotal` counts the
complete authorized collection, never just the recommendations of an incomplete read.
`page: null` means there are no remaining resources: `visibleTotal` equals `recommended.length`.
When further resources exist, a page reference and a complete resource reader are required.
An adapter without a complete reader may provide only a confirmed complete inline collection;
inconsistent counts, missing paging or an incomplete source yield an unavailable resource section.
The UI must not offer a page request without both its token and client reader.

This increment supplies additive transport schemas, guarded routes and explicit demo
data. It does not provide a project workflow reader, policy-bound production paging,
workflow mutation/confirmation forms, or a flow editor. A project adapter must provide
coherent revisions, policy-aware tokens, resource ranking and authoritative attempt/
gate/session membership before these capabilities can be enabled for project data.
An omitted snapshot or absent page reader stays unavailable without fixture fallback.
