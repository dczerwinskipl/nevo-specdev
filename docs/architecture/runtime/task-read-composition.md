---
id: architecture.runtime.task-read-composition
type: architecture
title: Task read composition and domain ownership
status: current
scope: specflow
areas: [runtime, workflow, server, security]
tags: [tasks, projections, engine, pagination, ownership]
read_when:
  - separating Task and Document reads from Specification Workspace
  - integrating Engine reads with Task HTTP projections
  - reviewing authority, coherence or pagination of Task detail
summary: >
  Feature-owned Task and Document application reads, Engine-owned
  execution facts, bounded authorized paging, and explicit production readiness.
related:
  - architecture.workflow.deterministic-workflow
  - architecture.runtime.ownership-and-lifecycle
  - architecture.runtime.authorization
  - engineering.shared.code-organization
  - product.specflow.ui.data-loading-and-integration
  - reference.api.task-reads
---

# Task read composition and domain ownership

## Decision and status

Tasks owns the application composition of Task reads. Engine owns offline specification and
workflow facts; Runtime Sessions owns managed conversations and live execution. Documents owns
document-content access. Specification Workspace consumes summaries and contributions from those
owners. A route containing `specId` does not transfer ownership to Specs.

The Runtime ownership/application refactor is implemented with explicit demo adapters and bounded
source ports. Production Engine reads remain unavailable until their owner supplies safe coherent
read contracts. Runtime does not implement or persist another workflow engine.

## Migration evidence baseline (before refactor)

- Inspected #60 HEAD `94ae91cb5b73f3180a330a88bf2b7cb842301ed0` and local working changes on top.
  `features/specs/workspace/repository.ts` owns workspace, document, task, resource and history reads.
  Task handlers perform authorization, collection slicing and revision rereads.
- Inspected Engine [#53](https://github.com/dczerwinskipl/nevo-specflow/pull/53) at
  `1404966cca4daf230afc29def0188ae5d3c1e3b4`. Its
  [public exports](https://github.com/dczerwinskipl/nevo-specflow/blob/1404966cca4daf230afc29def0188ae5d3c1e3b4/packages/specflow-engine/src/index.ts)
  implement Project Home, workspace registry/identity and coordination. They do not expose Task
  workflow/history reads. Plan E3.T09 is future Runtime read projection work.
- Sessions in #60 registers capability declarations only. A complete managed Session reader is not
  implemented there. The Engine plan also explicitly identifies that gap.
- Legacy Nevo is migration evidence, not a dependency to import into Runtime. In particular its
  `compileStepContext` may activate a step. It cannot serve an innocuous GET/disclosure.

## Authority and composition

| Fact                                                                                      | Authoritative owner                                           | Runtime consumption                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Project identity, spec/workspace binding and checkout admission                           | Engine Project/Workspace                                      | Resolve and verify target context before content access             |
| Specification and Task definitions, dependency declarations, versioned Markdown           | Engine Specs/Tasks and repository documents                   | Tasks adapts task facts; Documents exposes bodies                   |
| Workflow definition and pinned revision, position, attempts, declared transitions         | Engine Workflow                                               | Tasks composes a read view; no independent transition algorithm     |
| Gate inspection, human-step/gate requirements, accepted decisions, readiness and recovery | Engine application operations                                 | Consume safe inspection; recording/verification remains a command   |
| Completed transitions, feedback and artifact associations                                 | Engine execution/history                                      | Read the recorded attempt; do not fill gaps from current work       |
| Managed Session/Turn/Work, status, question, role and live scope                          | Runtime Sessions                                              | Authorized summaries and real navigation targets                    |
| Document content at a revision                                                            | Documents application access to the appropriate content owner | Exact-version body; no Task-owned content store                     |
| Image/archive/report content                                                              | Its actual content owner                                      | Typed reference; unavailable until a reader exists                  |
| Task detail HTTP view and its bounded page leases                                         | Runtime Tasks                                                 | Disposable presentation/cache state, never canonical workflow state |
| Specification Workspace HTTP view                                                         | Runtime Specs composition                                     | Lightweight owner contributions, not foreign canonical records      |

Engine's Specs/Tasks source ownership and Runtime's Tasks presentation ownership are different
boundaries. Moving HTTP composition to Runtime Tasks does not move repository truth out of Engine.
No new `TaskService` is permitted to absorb workflow progression, Session persistence, document
storage and all collection access under a renamed central interface.

## Required module boundaries

Use cohesive slices, not mandatory forwarding layers:

```text
specflow-runtime/src/features/
  specs/workspace/       workspace composition + lightweight contribution ports
  tasks/
    detail/             read-task-detail use case, mapper, source ports, HTTP adapter
    history/            read-task-history-page use case and paged source port
    resources/          read-task-resource-page use case and authorized selection
    reads/              shared identity/read-context and bounded page leases
    demo/               explicit Task demo adapters
    feature.ts          registration/composition
    index.ts            public Runtime boundary
  documents/
    content/            versioned body use case, content port, HTTP adapter
    demo/               explicit document demo adapter
    feature.ts
    index.ts
  sessions/             managed Session authority; public read boundary when implemented
```

These paths describe responsibility, not a requirement to create empty modules. A common concern
stays shared only when two real operations consume it. Runtime Tasks does not contain an Engine
implementation. When Engine reads land, an adapter consumes only its declared package exports.
Engine does not import Runtime, Fastify, UI, HTTP DTOs, authorization roles or managed Sessions.

Runtime's composition root constructs feature dependencies once, supplies demo adapters only in
explicit demo mode, registers routes and injects the common feature capability catalogue into Auth.
`RuntimeAppDependencies` gains separate Task and Document dependencies; `SpecsFeatureDependencies`
does not remain their transit container. Runtime data mode becomes composition-owned rather than
being inferred solely from `dependencies.specs.mode`.

The remaining `readWorkspace` is an application composition operation, not a storage repository
that receives ownership of all feature records. A Specs source port reads Specification-owned
identity/metadata/structure. Task summaries/attention, Session summaries/attention and document
metadata enter through their owners' public contribution boundaries. Those contributions reuse
the same projection/visibility policy as their detail features; Specs must not implement a second
workflow-status algorithm. Keep the existing aggregate HTTP envelope, not the old all-domain
repository dependency. If contributions needed for coherent steering have incompatible execution
versions, the composer retries a bounded read or reports the affected projection unavailable.

## Application operations and ports

The concrete application operations are:

1. `readTaskDetail`: validate identity, authorize Task scope, obtain definition and execution
   facts, join permitted lightweight references and construct the transport view.
2. `readTaskHistoryPage`: validate the scoped page lease, read one authorized source page,
   attach permitted material summaries and return continuation.
3. `readTaskResourcePage`: continue the same authorized ordered collection used for inline
   recommendations; it does not reload and subtract a whole collection.
4. `readDocumentContent`: authorize the document in its real scope and read the requested revision.

Names are implementation guidance. Observable responsibilities and boundary constraints are the
design. HTTP validates syntax, derives trusted request context, invokes one use case and maps its
typed outcome. It does not load a Task twice, scan history or implement visibility/ranking rules.

Ports return source facts, source availability and source revision/read handles. They do not return
`TaskSnapshot` or another already-authorized HTTP response. The projection mapper owns that DTO.
Avoid a port with one method per screen section: separate definition/execution reads, history
paging, resource relation paging and content access by their actual lifecycle.

A history/resource page request carries resolved Task identity, an owner-issued read handle,
opaque continuation and bounded limit. Its result contains a bounded set of visible records,
next continuation and truthful coverage. The owning adapter implements selection near the source.
A test adapter may use small arrays; the port must not require production to return all records.

### Source authorization without coupling Engine to HTTP

Runtime application policy derives visibility from the trusted subject. Sources must support
bounded authorized selection, using adapter-local permitted-ID joins/predicates or an appropriate
source query. Do not pass Fastify requests, role names or UI state into Engine.

If a source can only return candidate pages, application scanning has an explicit bounded work
budget and continuation. Underfilled/empty pages can have a next cursor; they do not prove the end
of the collection. No unbounded scan to fill a page or compute a count. An exact authorized count
requires an owner/query that can supply one. The existing wire contract's exact `visibleTotal` is
therefore an explicit readiness condition; otherwise the resources section is unavailable, rather
than publishing the size of the unfiltered collection.

## Coherence and versioning

Separate these concepts:

- Task definition/document revision;
- workflow definition revision pinned to an attempt;
- Engine execution/history version;
- resource relation version;
- independently changing Session summary version;
- document body version;
- Runtime policy/visibility context and temporary page lease identity.

The HTTP `snapshot.revision` is an opaque identity for one coherent projection, not the version of
every domain and not a mutation precondition accepted by Engine. Session streaming must not change
the workflow attempt or invalidate unchanged history pages. A new unrelated document body must not
invalidate execution history.

Within one execution view, position, pending requirements, blockers, transition choices and latest
handoff come from one authoritative Engine read basis. Their Task/definition versions must match
the basis Engine inspected. A pinned old definition remains old; the mapper cannot substitute the
latest YAML because it is easier to load.

There is no claimed global transaction over Engine, Sessions and every content owner. Independently
read details keep their own versions. Task composition either has validated matching execution
facts or marks affected sections unavailable; it must not splice one attempt's position with
another's requirements. Retrying two reads and observing equal opaque strings is not a universal
proof of consistency. A real adapter must document the owner's atomic/immutable read guarantee
or version-validation protocol, including protection against undetected replacement.

No safe coherent read capability means no production execution projection. No long writer lock,
step activation, gate verification, reconciliation mutation or Session creation is allowed in GET.
An inspection can report recovery required; a separate explicit operation performs recovery.

## Policy and content boundaries

Retain existing `spec.view` at `{ specId }` for Task/document reads during this migration. New
feature modules do not automatically create new permission resources. Session data additionally
requires `session.view` in its actual owning scope. Resolve membership before authorizing a
reference; a URL's `specId` or a reference string is not proof of membership.

Do not weaken the working authorization fixes on top of #60. Apply one reference-visibility policy
to inline resources, page results, history materials, requirement evidence, dependencies and
recovery. Counts and recommendations are computed after visibility. Denied titles, IDs, paths and
provenance do not leak through alternative sections.

Optional denied references may be omitted. Required decision material that cannot be read must
make the containing decision inspection non-actionable/unavailable, without exposing protected
details. Do not reinterpret hidden required evidence as an empty, satisfied requirement. Real
command authorization and gate evaluation remain authoritative even after a successful read.

Document/item access is rechecked at the content owner. An issued link/lease is not an access
grant. Unknown readers remain unavailable; an existing reference does not imply an existing
Markdown/image/download reader. Historical content that cannot be retrieved at its recorded
revision is unavailable, never replaced with today's body.

## Presentation needs without UI-shaped authority

The accepted Task UX requires title/description, workflow status, current/next step, instruction,
session associations, latest handoff, history and typed materials. These are projection consumers,
not persisted screen sections. The accepted mock's implementation/review/human step names and
pass/fail labels are sample workflow configuration, not a universal Engine state machine.

Task context, workflow instruction, input reference and output artifact are distinct. A complete
context reader must expose the actual inputs safely; the legacy activating compiler is not that
reader. Do not label `purpose` plus hints as complete agent context. Full-context integration stays
explicitly dependent until Engine owns a side-effect-free contract.

Start and finish/decision commands are not introduced by this read refactor. Future command
adapters call Engine's trusted operations, using execution identity and command preconditions;
they cannot execute a branch just because a stale read response lists it. Ending a Turn does not
finish a Task, and finishing one step does not implicitly start its successor.

## Independent delivery and readiness

**Implemented:** Runtime feature ownership; application use cases; port and
HTTP adapter separation; owner-specific contract exports; demo adapters; compatible page leases;
unchanged truthful project-unavailable behavior; focused boundary tests.

**Dependent on Engine's existing program:** public Task/definition/context/execution/history read
contracts, immutable/versioned read guarantees and verified workspace binding. Coordinate with
E3.T02–T09 in #53 rather than creating a competing Engine API from this document.

**Dependent on content/Sessions owners:** real versioned readers and authorized association/status
queries. Engine cannot fabricate Runtime Sessions for an offline external agent. Absence of a
managed Session is a valid case, not a reason to hide real workflow progress.

No new microservice, deployment boundary, event bus, universal resource repository or new durable
Task projection store is needed for the immediate refactor.

## Acceptance at architecture boundaries

- Specs has no Task detail/history/resource or document body repository methods/routes.
- Tasks composes facts but owns no workflow mutation or managed Session/content persistence.
- Cross-feature imports use public feature boundaries; Engine dependencies use package exports.
- HTTP tests prove application outcomes, not handler-owned slicing or authorization algorithms.
- Source paging tests prove bounded reads, coherent continuation and no authorization leakage.
- Project mode without a reader never constructs demo adapters or reports known-empty execution.
- Production-read acceptance requires actual Engine reads, including an externally progressed Task
  with no managed Session and a missing bound workspace that never falls back to primary checkout.

Exact transport migration and lease behavior: [Task reads](../../reference/api/task-reads.md).
