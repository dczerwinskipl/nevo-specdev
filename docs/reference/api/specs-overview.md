---
id: reference.api.specs-overview
type: reference
title: Specs Overview HTTP API
status: current
read_when:
  - connecting the Specs Overview UI to Runtime
  - verifying Specs collection authorization and response contracts
summary: >
  Typed Current/Archive Specs Overview read endpoint with feature-owned classification,
  real session authentication, and per-item spec.view filtering.
related:
  - architecture.runtime.authorization
  - product.specflow.ui.application-architecture
---

# Specs Overview HTTP API

`GET /api/specs/overview?collection=current|archive` reads one Specs Overview collection.
Omitted `collection` defaults to `current`. Unsupported values and additional query fields
return `400`.

The response schema is owned by `@nevo/specflow-contracts/specs/overview`.

## Current

Current is the operational read model:

```ts
{
  revision: string;
  collection: 'current';
  sections: ('requires-attention' | 'active' | 'ready' | 'draft')[];
  items: CurrentSpecOverviewItem[];
}
```

Each item has one backend-owned `classification`:

```ts
{ section: 'requires-attention', reason?, count? }
{ section: 'active' }
{ section: 'ready' }
{ section: 'draft' }
```

The section list is ordered, and `classification` is the single authoritative top-level
classification for each Current item.

Current classification precedence is:

```text
requires-attention > active > ready > draft
```

- **Requires attention**: an authoritative human-attention signal exists. A known semantic reason
  such as input, decision, review, blocked, or approval is included when available; the reason is
  not required for the signal to remain human-blocking.
- **Active**: no higher-priority attention exists and at least one current execution exists.
- **Ready**: no attention or execution exists and the Spec is ready for work.
- **Draft**: the Spec is still being prepared.

Signals and current executions remain available as bounded evidence. Consumers do not reclassify a
Spec from raw signals.

Project configuration may choose and order Current sections:

```yaml
specs:
  overview:
    current:
      sections:
        - requires-attention
        - active
        - ready
        - draft
```

Omitted configuration uses the order above. Duplicate or unknown section ids are rejected.

## Archive

Archive is a separate historical read model:

```ts
{
  revision: string;
  collection: 'archive';
  items: ArchivedSpecOverviewItem[];
}
```

Archive has no Current sections, classification, signals, or current executions. Historical items
may expose authoritative `completedAt` and `archivedAt` timestamps. Consumers must not invent
Current state for archived Specs.

## Repository boundary

The `SpecsOverviewRepository` port is defined in
`features/specs/overview/repository/read-repository.ts`. It does not return HTTP DTOs. Its
`repository/model.ts` records are internal read facts and evidence used by Overview operations.
For Current, facts such as `readyForWork`, attention signals, and current executions are mapped
through `classifyCurrentSpec()`; the repository does not persist or return the final
`classification`.

Current and Archive are read independently:

```ts
readCurrent();
readArchive();
```

The Overview use cases then apply authorization, Current classification where applicable, and
mapping to the public transport contract. The fixed example catalogue is an explicit Runtime demonstration repository,
available when the Runtime starts with `--demo`. Normal project mode never
falls back silently to sample data. The response schema does not expose a
`sample` property; the separate `GET /api/runtime/info` reports
`dataMode: 'project' | 'demo'` for environment-level presentation.

## Access

When authentication is required, a request without a valid browser session returns `401`:

```json
{ "error": "authentication_required" }
```

An authenticated subject with no `spec.view` capability in any assigned scope receives `403`:

```json
{ "error": "forbidden" }
```

A subject that possesses `spec.view` in at least one scope may enter the collection. Rows are then
filtered independently using the server-owned target scope:

```ts
{
  specId: item.id;
}
```

Therefore a scoped subject may legitimately receive `200` with an empty `items` list when none of
the Specs visible to that subject belong to the requested Current/Archive collection.

The client does not provide authorization scope. Runtime derives the per-row scope from the
authoritative Spec identifier.

Trusted-local mode keeps the same authorization semantics. If access control is disabled, registered
capabilities are available. If a local subject is configured, its assignments are evaluated normally.

Successful and authorization-denied responses use `Cache-Control: no-store`.

## UI handling

The UI treats `current` and `archive` as distinct projections while sharing one collection
switcher and one HTTP source.

Current renders the ordered `sections`; Archive renders a flat historical list. Search filters the
selected projection without changing backend classification or archive lifecycle facts.

A `401` re-enters the existing authentication flow, `403` maps to the standalone access-denied
surface, and network/server failures remain retryable Runtime-unavailable states.
