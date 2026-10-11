---
id: ideas.specflow-engine.boundaries
type: architecture
title: Offline Engine CLI and Runtime boundaries
status: draft
scope: specflow
areas: [cli, runtime, workflow]
tags: [engine, adapter, architecture, offline]
read_when:
  - allocating responsibility between product CLI and Runtime
  - migrating workflow or creating a new mutation endpoint
summary: >
  Candidate independent application Engine invoked by CLI and Runtime without either adapter
  owning canonical workflow progression or long-running provider processes.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.baseline-evidence
  - architecture.workflow.deterministic-workflow
  - architecture.runtime.ownership-and-lifecycle
  - adr.0012-product-package-topology-and-dependency-direction
---

# Engine, CLI and Runtime boundaries

## Problem

The single-artifact SpecFlow package topology is sound, but it does not on its own guarantee that an external agent can use deterministic workflow commands when the HTTP Runtime is stopped. Legacy Nevo implements substantial workflow logic as library modules, yet adapters occasionally import each other and share mutable state implicitly.

## Candidate dependency rule

```text
External agent + skill -> CLI adapter -----+
                                          |
Browser UI -> Runtime HTTP adapter -------+--> Application Engine --> Git/filesystem/state ports
                                          |
Runtime-managed Session/Turn -----------> Engine commands when workflow mutations are required

Engine NEVER imports HTTP, Commander, Runtime Sessions, providers, browser/UI modules.
CLI NEVER calls HTTP to perform ordinary Specs/Workflow read/mutate operations.
Runtime NEVER shells out to CLI or imports CLI handlers for workflow mutations.
```

Do not confuse a Runtime-managed provider Turn with a workflow execution/attempt. They may correlate, but each has its own identity and lifecycle.

## Proposed source boundary

**Option A (recommended for PoC):** one new private source package `@nevo/specflow-engine`, with Specs, Project/Workspace, Git capability and eventually Workflow features. `@nevo/specflow` composes the public CLI and product startup; `@nevo/specflow-runtime` imports Engine exports and hosts HTTP/AI. Build tooling bundles one installable `nevo-specflow` artifact. This alters ADR 0012 dependency diagram only if accepted later.

**Option B:** put Engine in an independent submodule of `specflow-runtime` with a guaranteed server-free entrypoint. This reduces packages but makes it easier for workflow to accidentally import Runtime resources. Benchmark import boundaries and packaging before freezing Option A.

Do **not** create separate packages for each feature, a second deployed server, a generic DI container, or a universal repository abstraction before evidence requires one.

Possible Engine API (illustrative, not frozen):

```ts
interface Engine {
  specs: { create(input: CreateSpecInput): Promise<CreatedSpec>; list(): Promise<SpecSummary[]> };
  workspaces: { resolveSpec(specId: string): Promise<ResolvedWorkspace> };
  workflow?: {
    inspect(input: TaskRef): Promise<Readiness>;
    start(input: StartInput): Promise<StepContext>;
  };
}
```

Creation/configuration should inject explicit storage, Git and lock/clock/ID dependencies at composition boundaries. No hidden `process.cwd()` or environment lookup in domain/use cases; outer CLI startup resolves one project context.

## Execution classes

1. **Offline-safe**: discovery, specs creation/reads, gate inspection, deterministic workflow transitions, Git operations, local durable journal. Must work in a newly started CLI process with no HTTP listener.
2. **Runtime-managed**: provider process creation, canonical Session/Turn/Work, streaming, interaction response, cancellation, live SSE, Runtime auth and HTTP authorization. These operations require the owning Runtime.
3. **Observational**: Runtime can project locally durable Engine state for the browser; observers are not owners of the workflow state. A non-managed external agent is not retroactively represented as a managed Session.

A CLI command explicitly aimed at managing an existing Runtime-owned live Session may call the Runtime API. That exception must not become a general path for Specs/Workflow commands.

## Auth/trust boundary

HTTP adapters enforce request authorization and scoped capabilities before application calls. Offline CLI operates under an explicit local process/OS trust policy and Engine invariants; it must not impersonate an authenticated HTTP principal or treat a user-supplied `sessionId` as authoritative ownership. Actor attribution and future multi-user local CLI policies are open decisions.

## Read/write boundaries

Feature operations own their own validation, state transitions and persistence ports. The HTTP adapter owns status code mapping; CLI owns JSON/stdout/exit code mapping. Both consume the same machine-readable error kinds. Runtime may compose live watchers and cache invalidation, but cache state cannot become an alternative source of truth.

## Specific rejection tests

- With Runtime stopped, the same CLI create and future workflow commands still complete.
- Import graph forbids Engine -> Runtime/CLI/Fastify/Commander, Runtime -> CLI internals, and UI -> Engine.
- No mutation algorithm duplicated in endpoint and command adapters.
- One npm product install remains supported. Private source package count is not a public API.
- A file lock/admission conflict is reported consistently in HTTP and CLI; neither bypasses a shared gate.

## Explicit managed Sessions seam

The shared Engine is not a substitute for Runtime's canonical Session/Turn/Work lifecycle. Managed Turns derive their **effect scope** before dispatch, optionally acquire an Engine workspace writer claim, and persist an invocation intent so crashes between provider launch and native-session correlation cannot trigger blind replay. Terminal Turns do **not** automatically finish workflow steps. Read-only or ad-hoc Turns need no Task and no writer claim when their write restrictions are actually enforced. See [managed Sessions handshake](managed-session-integration.md) and [execution scopes](execution-scopes-and-recovery.md).

The Engine's mutation/admission API should receive a trusted execution context from its calling adapter; it must not accept unauthenticated `sessionId`/role claims as authority. Local CLI human sign-off has its own [trust boundary](local-actor-and-human-gates.md).
