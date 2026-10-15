---
id: architecture.runtime.ownership-and-lifecycle
type: architecture
title: Runtime ownership and lifecycle
status: current
read_when:
  - adding a long-lived Runtime capability or resource
  - introducing HTTP, realtime, MCP, provider-process, or persistence infrastructure
  - changing startup, shutdown, cancellation, or restart recovery
  - deciding whether a concern belongs to Runtime or a transport adapter
summary: >
  Nevo SpecFlow Runtime is the composition and lifecycle owner for long-lived local
  application resources. Transports are adapters, resources have one lifecycle owner,
  startup/shutdown are deterministic, and restart recovery reconciles durable state
  before accepting conflicting work.
related:
  - architecture.principles.enforceable-invariants
  - architecture.ai.canonical-session-turn-work
  - architecture.ai.provider-boundary
  - engineering.shared.async-and-lifecycle
  - engineering.shared.effects-and-io
  - architecture.principles.normative-language
---

# Runtime ownership and lifecycle

The **Nevo SpecFlow Runtime** is the long-lived local backend of the product. It is not
synonymous with an HTTP server.

A Runtime instance composes application capabilities and owns the lifetime of resources
that survive longer than one CLI operation.

## Responsibility boundary

Runtime may own resources such as:

- provider processes and provider/session registries;
- local persistence and execution records;
- filesystem/worktree watchers;
- HTTP or realtime servers;
- local MCP endpoints;
- background coordinators, timers, and queues;
- cancellation and shutdown coordination.

HTTP, realtime transports, MCP, CLI, and UI are **external boundaries/adapters**. They expose
or consume application operations; they do not become the source of truth for lifecycle or
workflow state.

## Composition root

There is one Runtime composition path for production behavior.

Entrypoints MAY differ — CLI start, development bootstrap, tests — but production
construction MUST NOT create subtly different dependency graphs or lifecycle semantics.

The composition root:

1. creates infrastructure dependencies;
2. constructs application capabilities/coordinators;
3. starts externally reachable adapters only when their dependencies are ready;
4. owns shutdown in reverse dependency order.

### Runtime feature modules

Product capabilities are composed as Runtime feature modules under
`packages/specflow-runtime/src/features/<feature-name>/`. Infrastructure such as server startup,
configuration loading, CLI adapters, and Runtime lifecycle remains outside that tree.

Each feature exposes its Runtime-facing surface from its own `index.ts`. Code outside a feature
uses that boundary instead of importing internal sub-slices. A feature may split recursively when
behavior is materially different; for example Specs Overview owns independent
`overview/current/` and `overview/archive/` read use cases while sharing an Overview-owned
repository port and visibility policy.

Feature modules may contribute:

- authorization resources/capabilities owned by that feature;
- route/application registration;
- replaceable dependencies exposed intentionally for composition or tests.

Product role policy is not feature-owned. The Runtime composition root maps the collected
capabilities into the configured product roles and passes that policy to Auth.

Cross-cutting Auth does not import Specs, Sessions, Settings, or another product feature to discover
their capabilities. The composition root creates the product features, collects their capability
catalogue, defines the product role policy, then supplies both to Auth. Capability-discovery
validation is built from the same injected resource catalogue.

Dependency direction is therefore:

```text
feature contracts / capability declarations
              ↓
        product features
              ↓
      Runtime composition
        ↙             ↘
      Auth       feature registration
```

A product feature may consume Auth's public request-authorization boundary. Auth MUST NOT depend
back on the feature implementation merely to learn which product capabilities exist.

Feature-local ports and adapters stay with the capability that owns them. Do not create root
technical buckets such as a generic `repositories/` folder when the port exists only for one
sub-capability.

### Canonical Specification discovery and read policy

Engine's verified Project Home registry selects the authoritative checkout. The manifest in that
checkout supplies canonical Specification metadata. Runtime only projects Engine reads and MUST
NOT fall back to demo data or an unbound primary duplicate if a bound workspace is unavailable.
For an authorized, scoped Overview, discovery skips manifest reads from explicitly bound linked
worktrees outside the authorized Spec set. Primary still must be validated as a whole because
unbound canonical Specs are discovered there and cannot be enumerated by registry bindings alone.
Thus primary manifest corruption is a project-level integrity failure (HTTP 503), even for
scoped reads. These are deliberately asymmetric behaviors, not permission to silently skip
corrupt manifests.

A read without a coordinated writer lock is not a transaction across files. It must use bytes
and metadata from the same opened file, verify the authority registry revision before returning
the projection, and fail explicitly if canonical selection changes during the read. On-demand
HTTP re-read observes later CLI updates; there is no promise of an atomic multi-Spec filesystem
snapshot or freshness beyond the final validation instant.

Task/Workflow projections remain separate from unvalidated manifest `tasks` entries. The typed
read contract follows the canonical workflow-state design in Plan 03; Runtime must not synthesize
progress, completion or execution state from unknown Task payloads.

## One lifecycle owner

Every process, server, timer, listener, stream, connection, registry entry, or other
long-lived resource has one explicit owner responsible for:

- creation;
- active lifetime;
- cancellation;
- terminal transition;
- cleanup after success, failure, partial startup, or shutdown.

Two subsystems MUST NOT independently own the same resource.

## Startup

Startup is deterministic and fail-closed.

A resource that other capabilities depend on becomes reachable only after its startup has
succeeded. Partial startup MUST either be completed or unwound; the Runtime MUST NOT advertise
readiness while required dependencies are unavailable.

## Shutdown

Shutdown is an application lifecycle operation, not a collection of unrelated process signal
callbacks.

The Runtime MUST:

- stop accepting conflicting new work;
- signal cancellation to owned long-running operations;
- allow bounded graceful completion where the operation contract permits it;
- persist or terminalize state that cannot safely remain active;
- release listeners, servers, processes, streams, and timers;
- produce diagnostics for resources that fail to stop cleanly.

## Restart recovery

Persistent state MAY describe work whose live process disappeared during a crash or restart. On
boot, Runtime MUST reconcile durable state with what can actually be resumed before admitting
conflicting new work.

Recovery MUST NOT fabricate a live resource merely because a persisted record says "active".

Each operation/session interaction MUST be classified by its real recovery semantics:

- resumable from durable/provider identity;
- reconstructable from durable state;
- interrupted because the original live operation no longer exists.

Recovery MUST settle contradictions before new work that would conflict with them is admitted.

## Runtime state versus repository state

Execution state that exists only to coordinate local processes/recovery belongs in local Runtime
storage, not in Git-tracked product/specification documents.

Repository state records durable product facts. Runtime storage records execution facts needed to
continue or reconcile local work.

## Trust boundary

Binding a local Runtime beyond loopback changes the trust boundary.

Authorization assumptions MUST be explicit and replaceable at the adapter boundary. "Reachable on
the network" MUST NOT silently mean "authenticated".
