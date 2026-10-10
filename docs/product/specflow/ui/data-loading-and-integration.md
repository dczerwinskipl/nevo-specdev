---
id: product.specflow.ui.data-loading-and-integration
type: architecture
title: SpecFlow UI data, loading and integration contract
status: current
read_when:
  - designing a data-driven SpecFlow UI surface
  - deciding which facts belong in one read model or load independently
  - defining loading, refresh, invalidation or failure behavior
  - checking whether an existing API/read model can support a UI contract
  - implementing a new SpecFlow UI query, mutation or integration
summary: >
  Product-level rules for turning UX information needs into coherent read-model boundaries,
  integration readiness, loading/refresh behavior, and independently loadable detail without
  prescribing endpoint URLs from UX.
related:
  - adr.0007-documentation-architecture-and-taxonomy
  - docs.reference-readme
  - product.specflow.ui.application-architecture
  - product.specflow.ui.interaction-model
  - design-system.implementation.react.component-guidelines
  - design-system.implementation.storybook.guidelines
---

# SpecFlow UI data, loading and integration contract

## Purpose

A data-driven UI contract must describe not only what is visible, but also which authoritative facts
must be available together for the user to interpret the surface correctly.

The core rule is:

> Data that the user must interpret together should be delivered and refreshed as one coherent
> read-model boundary. Data that is independently expensive, independently stale, or only needed
> after explicit inspection should remain independently loadable.

Do not mirror backend entities or existing endpoint boundaries when they produce incoherent UI state.
Do not solve consistency by fetching an entire domain graph up front.

Implementation follows the routing, transport and server-state architecture defined by
`product.specflow.ui.application-architecture`.

## UX data requirements

For each material screen region, state, and action, establish when relevant:

- which authoritative facts the user needs;
- which facts must be mutually consistent on first render;
- which facts may be lightweight references until detail is opened;
- which details are intentionally lazy or pageable;
- which facts are local UI state rather than server state;
- which action availability/readiness facts must come from the application/backend rather than be
  inferred by the frontend.

The UX contract describes the required information and coherence boundary. It does not invent a
transport shape merely to make the screen appear implementable.

## Integration readiness

For every required remote data group, classify the current integration state:

- **available** — an existing authoritative API/read model already supplies the required semantics
  and granularity;
- **integration needed** — the authoritative capability exists, but the UI still needs its typed
  application/query integration;
- **API/read-model needed** — the required semantics or coherent projection do not yet exist and a
  backend/application contract must be added or changed;
- **unknown** — repository evidence is insufficient; resolve before claiming the production slice is
  implementable.

When an exact API/read-model/command/event contract exists, the screen/product contract records its
stable reference/document ID for traceability. Exact endpoint paths, schemas, protocol fields, and
example payloads stay in their authoritative reference/code-owned home in accordance with ADR 0007.

Do not invent transport contracts for missing capabilities. Describe the required facts, coherence,
freshness, and operation semantics; leave concrete API design to the owning backend/application work.

A UX contract can be decision-complete while production still needs backend/application integration.

UX owns the required facts, coherence, freshness, loading, refresh, and user-visible semantics. It
also owns making the missing integration visible and giving the owner enough evidence to choose scope.

When capability is missing or unknown, first classify the likely backend gap as:

- **exposure/integration gap** — authoritative semantics already exist and only bounded exposure or
  projection/integration work appears necessary;
- **capability/design gap** — required semantics/ownership/read model/command/event behavior does not
  yet exist and needs broader backend design;
- **unknown** — more repository discovery is required before the scope choice is meaningful.

The owner decides whether backend planning is included in the current specification/work scope or
split into separate planning. Backend planning should run in the active conversation/on-demand
instruction when kept inline so the owner can answer material scope/product questions.

For an MVP production surface, every required remote data group must eventually point to an
authoritative UI-consumable API/read-model/command/event contract. Representative exact payload
examples belong with that reference contract or its contract tests/fixtures. The screen/product
contract names the user-visible scenarios those examples must cover rather than copying payloads.

If planning is split, the resulting stable contract reference must be incorporated before the affected
production integration is considered complete.

Task assignment, agent selection, and scheduling remain orchestration concerns.

## Coherent projections and independent detail

Prefer one coherent screen/steering projection when several facts must be interpreted together, for
example:

- identity plus user-visible workflow state;
- action availability plus the reason an action is unavailable;
- attention signals plus the object/action they point to;
- current execution plus the Tasks or scope it owns.

Keep independently loadable when appropriate:

- full document bodies;
- old Session/history pages;
- file bodies and diffs;
- raw tool/provider output;
- large reports or handovers;
- other detail reached only after explicit inspection.

A screen projection may carry lightweight references and summary metadata for independently loaded
resources.

## Workspace aggregation versus independent freshness

A Specification Workspace may initially load one coherent, lightweight steering snapshot.
Its Task readiness/actions, human Attention and current execution pointers must agree with
one another. This does **not** make every feature's detail data part of the same freshness
or rendering lifecycle:

- Live Session Turn/Work updates are consumed by Session-owned snapshot/cursor/SSE
  processing. Ordinary streaming deltas must not refetch the whole Workspace.
- Changes that affect human steering (for example a Session requiring interaction or a
  Task transition) update or invalidate the **coherent steering projection**, not an
  arbitrary mixture of independently inferred UI facts.
- Document bodies, Task evidence/detail and Git file diffs have independently scoped
  cache keys and refresh policies. A Workspace header Refresh does not reload them.
- One HTTP Workspace response may be observed through narrow Query `select` projections
  where useful. This can isolate cache subscriptions but **does not** reduce the cost
  of a refetched endpoint. A parent subscribed to the complete snapshot still
  rerenders its own subtree unless composition boundaries are actually split.
- Independent endpoints are introduced only when measured read cost, change frequency
  or security/coherence boundaries justify them. Never duplicate server-derived
  readiness rules on the frontend to manufacture independent projections.

A future SSE integration must invalidate the smallest coherent projection it can
identify, recover missed updates on reconnect (revision/cursor or reconciliation),
and remain bound to the authenticated identity. High-frequency Session streams and
resource-change notifications need not share the same state/store semantics.

## Batch loading

Use a bounded batch read when the client intentionally needs several homogeneous resources at once and
those resources share scope/auth while remaining independently cacheable.

Do not issue an uncontrolled N-request fan-out for a known homogeneous set when a bounded batch
capability is the appropriate integration contract.

Do not batch unrelated resources merely because one route happens to display them together. Coherent
projection design and transport batching are separate decisions.

If the UX requires a batch capability that does not exist, record it as integration/API work rather
than emulating a domain batch with arbitrary parallel requests.

## Freshness and change model

For each remote data group, identify what can make it stale:

- explicit user/domain action;
- workflow/operation completion;
- repository/file change;
- Session/live event;
- configuration/plugin change;
- external provider state;
- time/focus when no event source exists.

The contract should state the user-relevant freshness expectation: effectively static for the visit,
refresh-on-action, event-driven/live, focus-refetched, or explicitly/manual refreshable.

Exact cache durations and framework tuning values are implementation details unless product behavior
depends on them.

## Refresh ownership

A Refresh action has one understandable scope.

Facts that form one coherent projection and change together should normally share one Refresh action,
one refresh state, and one user-visible refresh/error treatment.

Independently loadable detail may have its own local refresh only when its freshness can differ and
refreshing it independently is useful to the user.

Do not expose several refresh controls for data that is semantically one state. Do not make one global
Refresh invalidate unrelated heavy resources.

If live/event-driven updates make manual refresh unnecessary, omit the button. If missing events or
external state can leave important information stale, expose or document the appropriate recovery
refresh.

## Loading feedback

Loading feedback follows the ownership of the data being loaded.

### Initial load

When no usable content exists yet and the expected layout is predictable, prefer restrained skeletons
that preserve the stable geometry and scan structure of the surface.

Use a spinner/progress indicator for bounded indeterminate work where a skeleton would not represent
meaningful content structure, such as a small local operation or compact control state.

Do not stack several independent loading indicators for facts that belong to one coherent projection.
One coherent load should read as one loading state.

### Refresh with usable data

When previously valid data remains safe to show, keep it visible during refresh and add lightweight
refreshing feedback. Do not replace an already understood screen with initial-load skeletons merely
because the same query is refetching.

If refresh fails while retained data is still usable, preserve the data and communicate that the
refresh failed or the view may be stale.

### Independent detail

Lazy detail owns its own loading/error feedback when it can load or fail independently from the parent
projection. Its failure must not erase usable parent state.

## Mutations and pending state

A user action should expose pending state at the action or coherent operation scope that owns it.

Do not convert an entire screen to loading when only one independent mutation is pending unless the
operation makes the whole surface unusable or semantically indeterminate.

After a mutation, update or invalidate the smallest authoritative data boundary that can be stale.
Long-running operations should normally settle through their authoritative operation/event lifecycle
before a final targeted refresh.

## Screen-contract checklist

For a data-driven implementation-ready screen, document when relevant:

1. required authoritative facts;
2. coherence/read-model groups;
3. initial versus lazy/paged detail;
4. source/integration readiness for each group;
5. what makes each group stale and the expected freshness model;
6. Refresh scope or the reason manual Refresh is unnecessary;
7. initial loading treatment;
8. refresh/pending treatment with existing data;
9. independent failure boundaries;
10. missing API/read-model or batch capabilities and the owner's inline-vs-separate planning choice;
11. stable references to the authoritative exact contracts for every MVP remote data group once
    available;
12. representative user-visible scenarios that exact contract examples or implementation fixtures
    must cover.

This checklist defines UX needs and integration readiness. It does not make the screen/product
contract the owner of endpoint schemas, payload catalogues, backend implementation task decomposition,
agent assignment, or scheduling.
