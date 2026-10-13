---
id: reference.api.task-reads
type: reference
title: Task and document read API
status: current
scope: specflow
areas: [server, runtime, workflow, security]
tags: [tasks, documents, pagination, compatibility]
read_when:
  - implementing the Task read ownership refactor
  - migrating Task schemas out of Specification Workspace
  - implementing scoped Task page tokens and continuation
summary: >
  Compatible Task and Document HTTP ownership, application outcomes, page lease
  semantics and migration constraints; production Engine adapters remain dependent.
related:
  - architecture.runtime.task-read-composition
  - reference.api.specification-workspace
  - reference.api.authorization
---

# Task and document read API

## Status and compatibility

Runtime Tasks and Documents own these implemented application/HTTP boundaries. Source ports and
explicit demo adapters are available; production Engine and content adapters remain dependent.
Schemas live under `packages/specflow-contracts/src/tasks/` and `documents/`, with compatibility
re-exports from `specs/workspace`. This API is independent of the fixture-only revised workspace UI.

The compatibility migration retains these paths and JSON shapes:

| HTTP operation                                   | New Runtime owner                                    | Application operation                      |
| ------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------ |
| `GET /api/specs/:specId/workspace`               | Specs                                                | Read lightweight Specification composition |
| `GET /api/specs/:specId/tasks/:taskId`           | Tasks                                                | Read Task detail                           |
| `GET /api/specs/:specId/tasks/:taskId/history`   | Tasks, consuming Engine history                      | Read authorized history page               |
| `GET /api/specs/:specId/tasks/:taskId/resources` | Tasks, composing resource relations/content metadata | Read authorized resource page              |
| `GET /api/specs/:specId/documents/:documentId`   | Documents                                            | Read document content                      |

Each path is registered exactly once. Workspace loading is not a prerequisite to Task detail or
document access. The route prefix supplies identity/context, not domain ownership.

## Shared contract ownership

Source locations/public exports:

- `specflow-contracts/tasks`: Task detail, task-relative targets, resources and history HTTP types.
- `specflow-contracts/documents`: document identity, content response and read params/errors.
- `specflow-contracts/specs/workspace`: lightweight Specification projection and imports/re-exports
  only where needed for existing consumers.

Move schema definitions; do not create divergent copies. Retain old export names/import paths as
compatibility re-exports during the internal migration. The current `TaskSnapshot` shape is a
Runtime transport projection, not an Engine application type or an authoritative stored snapshot.
Its embedded flow descriptors do not become Engine schemas by moving files.

Do not invent a new Task JSON version just to rename `SpecificationTaskResponse`. A future wire
change requires a separate explicit migration of producers, clients and example/contract tests.
This reference owns Task/document endpoint descriptions; the Workspace reference links here.

## Detail success and availability

The existing detail JSON remains:

```ts
type Detail = {
  task: ExistingTaskSummary;
  purpose?: string;
  acceptanceCriteria: string[];
  workflow?: string;
  snapshot?: ExistingTaskSnapshot;
};
```

`Existing*` denotes the existing code schema, not a new duplicate TypeScript definition. A missing
snapshot continues to mean no execution projection. An available section with an empty array is
a confirmed empty source; `unavailable`/`forbidden` is not an empty source.

Detail composition must not read full history, full document bodies or transcripts. It can obtain
bounded recommendation metadata, exact visible count when supported, and owner-issued page
handles. If any prerequisite for a truthful resources page/count is absent, resources remains
unavailable. Definition identity and Task metadata may remain usable if execution is unavailable.

No GET in this contract starts work, compiles activating agent context, verifies a gate, records
sign-off, creates a session or changes recovery state.

## Page wire format

Retain `token`, optional opaque `cursor`, and `limit` in query. `limit` is a decimal string 1–50;
omission uses the bounded default advertised by detail. Unknown query fields or invalid syntax
return 400 through schema validation. Existing identifier constraints remain unchanged.

Success retains:

```ts
{ token: string; items: ExistingItem[]; nextCursor: string | null;
  coverage: 'complete' | 'partial' }
```

`coverage: complete` means that the owner can enumerate the intended authorized collection;
it does not mean that the current page contains its entirety. `partial` describes known incomplete
historical/source coverage, not normal pagination. A non-null continuation can follow an underfilled
or empty page when a bounded visibility scan has not reached the end. Clients continue by cursor,
not by assuming `items.length < limit` means completion.

## Token and cursor semantics

The Runtime Tasks application layer owns opaque page leases. A page token is an unguessable random
identifier for a short-lived, bounded in-memory record, not a serialized Task or a bearer grant.
Lease records bind:

- runtime instance/data mode and resolved project identity;
- `specId`, `taskId`, verified workspace/binding identity when applicable;
- authenticated subject and server-derived visibility/policy context;
- collection kind (`history` or `resources`);
- the owner source read handles/versions required by this collection;
- source order and starting continuation;
- an expiry deadline.

Do not log raw tokens/cursors. Store only bounded metadata/source handles, not complete collections.
Defaults are five minutes and 1,000 lease records plus 1,000 cursor records per Runtime Tasks instance.
Trusted composition may configure TTL/capacity; expired/evicted leases and restart invalidate tokens with 409. Capacity limits fail honestly rather than allowing unbounded process memory. Numeric defaults
are operational tuning; tests use injected clock/limits/randomness.

Policy context is derived from the authenticated subject and immutable authorization instance on every
request. A replaced policy instance invalidates leases; current target checks still apply. It cannot be supplied by
the client. Token possession does not bypass current `spec.view` or target-specific reference
checks. If the implementation cannot verify that the old visibility basis still matches current
policy, invalidate the lease rather than reuse it. No lease is persisted as workflow authority.

Continuation is also opaque and bound to the same lease. A bounded server cursor record contains
the owner's continuation and expected read basis. Replaying a retained cursor reads the same
source interval, subject to fresh authorization. Unknown/mismatched/expired cursors return 409;
the implementation never interprets the cursor as a client-controlled integer offset.

Cursor handles are bound to the requested page size as well as the lease/source position. Reusing
a cursor with another explicit limit returns 409 rather than producing an overlapping partition.
Omitting limit on continuation uses that cursor's recorded limit, not a newly chosen default.
The first request records its chosen/default limit. Cursor retention is bounded by the same lease
deadline/capacity; an evicted continuation fails explicitly and never falls back to offset zero.

History uses the source's stable total order (completed transition order with a unique tie-breaker),
not a sort by nullable display timestamps. New history/execution that invalidates the owner's read
basis causes 409 unless the owner supplies a genuine retained immutable read. Do not silently move
the cursor into today's history or delete duplicates after an inconsistent fetch.

### Recommendation continuation

The resources source exposes one stable authorized order. Detail selects the first at most three
records for the existing `recommended` field and records the continuation immediately after those
actual records. The first resources page starts at that continuation. There is no handler
`slice(3)`, no reread of all resources, and no global rule that resources always begin at offset 3.

`visibleTotal` is the exact authorized collection count at that read basis. `page: null` means no
remainder and `visibleTotal === recommended.length`. Any remainder requires a page lease. Preview
can show two of the three recommendations; revealing the third is UI-local and does not change
the collection/page contract. Permission-filtered records cannot affect recommendations or count.

## Authorization and typed application outcomes

HTTP authentication and the existing capability vocabulary are retained. Task/document scope uses
`spec.view` at `{ specId }`; Session references additionally use real Session-owner scope and
`session.view`. Do not introduce `task.execute` or a Document capability just because modules move.
Independent document permissions, if required later, are a separate policy change.

Application functions return typed outcomes, never Fastify replies:

| Application outcome                                                            | HTTP result during compatibility migration                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Authentication missing/expired                                                 | Existing 401 response                                                                 |
| Caller lacks the required capability                                           | Existing 403 response                                                                 |
| Task/document absent in a verified, readable source                            | Existing 404 with `specification_task_not_found` / `specification_document_not_found` |
| Reader missing, source unavailable, unsafe/mismatched read basis               | Existing 503 with `specification_source_unavailable`                                  |
| Page lease/cursor invalid, expired, wrong scope, or owner read no longer valid | `409 { "error": "task_snapshot_expired" }`                                            |
| Valid permitted read                                                           | Existing 200 DTO                                                                      |

Authorize the enclosing resource before looking up page tokens or foreign target details. Readers
return enough typed identity evidence to reject cross-task/spec/binding substitution. Missing
bound checkout is source unavailable, not a reason to read another checkout. Denied reference
metadata is omitted before response serialization and before any exact count/ranking.

All detail/page/body responses remain `Cache-Control: no-store`. UI caches remain scoped to
authenticated identity and their resource-specific keys; server tokens are not UI permissions.

## Versioned document read

Documents owns the current response `{ id, title, content, revision }`. Retain the existing
unversioned read for callers explicitly requesting latest. Add optional `revision` query for an
exact body, with the same 1–1000 character opaque string bounds as page token syntax. An omitted
revision means latest; a supplied revision means exactly that revision, never fallback to latest.

For a supplied revision: authorized document absent -> existing 404; known document but requested
version unavailable -> 409 `{ "error": "document_revision_unavailable" }`; reader unavailable ->
existing 503; denied -> existing 403. A successful response's revision equals the requested value.
The new error/schema is Documents-owned and additive. No comparison of a latest body after it has
already been exposed can substitute for an exact-version application operation.

Task/current and historical document targets carry the recorded revision. Update the Document UI
client/query key to send and cache by that revision. Historical bodies cannot silently follow a
changed Markdown file. Image/archive/report readers are not invented by this migration.

## Production admission evidence

Before enabling each project reader, demonstrate its real owner guarantees: correct project/spec/
workspace binding; safe non-mutating read; pinned definition/attempt identity; stable page order and
continuation; current authorization; supported exact counts; versioned body access where advertised.

Demo can implement the same application ports with explicit in-memory source versions and test
collections. Its successful requests prove transport composition only. They do not certify Engine
atomic reads, an external-agent managed Session, production policy-bound paging or filesystem
recovery. No project reader means unavailable without demo fallback.
