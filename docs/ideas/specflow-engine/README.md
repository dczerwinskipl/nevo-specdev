---
id: ideas.specflow-engine
type: hub
title: Offline engine and workspace foundation
status: draft
scope: specflow
areas: [workflow, runtime, cli, configuration]
tags: [engine, worktree, offline, migration]
read_when:
  - evaluating the architecture before migrating legacy Nevo capabilities
  - planning optional Git worktrees for specifications
summary: >
  Non-authoritative design dossier for an offline-first SpecFlow Engine, CLI/Runtime boundaries,
  per-spec workspaces, filesystem coordination, Git integration, and migration verification.
related:
  - ideas.readme
  - architecture.workflow.deterministic-workflow
  - architecture.runtime.ownership-and-lifecycle
  - architecture.repository-structure
---

# Offline engine and workspace foundation

## Status and decision discipline

**Exploration only.** This directory is not an accepted ADR, an implementation specification, or a request to modify Runtime/CLI now. Candidate API shapes, packages, error codes, files, locks, and migration destinations are proposals. A later proof of concept must demonstrate the invariants before any normative rule is promoted.

**Baseline:** `main` of `dczerwinskipl/nevo-specflow` at `e0ffd59119abc833f814502db25db84542313e3a` (10 October 2026). **Preview, not baseline:** open PR [#45](https://github.com/dczerwinskipl/nevo-specflow/pull/45), HEAD `612d9c19348d83465fa8d6cfc71d5f9c4d58a4c8` when inspected, stacked on #39, incorporating already merged #44. Revalidate HEAD and merged state before implementation. A feature in #45 is **not** assumed merged or authoritative. See [inspection evidence](baseline-and-evidence.md).

## Design dossier

1. [Baseline and evidence](baseline-and-evidence.md): verified source boundaries, PR #45 versus main, disagreements with current architecture.
2. [Engine, CLI and Runtime boundaries](engine-cli-runtime-boundaries.md): shared use cases, process lifetime, packaging alternatives.
3. [Ownership and state](ownership-and-state.md): product facts, workflow evidence, live Sessions, local authority.
4. [Project and Workspace identity](project-and-workspace-context.md): discovery and identity across checkout roots.
5. [Specification creation vertical slice](specification-creation.md): title-only creation with optional new worktree, CLI and HTTP.
6. [Git capability](git-capability.md): enablement, port and adapter, branch/worktree guards.
7. [Worktree model and lifecycle](optional-worktrees.md): semantics, selection, retention and cleanup.
8. [Workspace registry and reads](workspace-registry-and-discovery.md): deduplication, missing roots, source of truth.
9. [Offline agents and CLI](offline-cli-and-external-agents.md): unsupervised external provider and skills, invisible Sessions.
10. [Locks, claims, admission](locking-and-admission.md): cross-process synchronization and long-lived ownership.
11. [Durable operations and recovery](durable-operations-and-recovery.md): idempotency, crash points, replay.
12. [Runtime API and UI integration](runtime-http-and-reads.md): one use case behind CLI and authenticated HTTP.
13. [Legacy migration](legacy-nevo-migration.md): inspect/port/adapt/reject instructions per subsystem.
14. [Test plan](test-plan.md): actual Git repositories, CLI + server, concurrency and failure injection.
15. [Acceptance criteria](acceptance-criteria.md): independent, measurable release gates.
16. [Open decisions and promotion](decisions-and-promotion.md): alternatives, assumptions, ADR freeze procedure.
17. [Project Home discovery](project-home-discovery.md): one local state/config owner from primary or linked checkout.
18. [Execution scopes and recovery](execution-scopes-and-recovery.md): read-only vs writing, claims, human-accessible reconcile.
19. [Managed Sessions integration](managed-session-integration.md): stable product Session ID, Turn handshake, provider uncertainty, batch/handover.
20. [Workspace binding lifecycle](workspace-binding-lifecycle.md): verified rebind after integration, move, cleanup, session history.
21. [Local actors and human gates](local-actor-and-human-gates.md): OS/HTTP trust, actor provenance and limits of human decision verification.

22. [Deferred multi-instance execution](multi-instance-execution.md): independently identified read-only reviewers of one deterministic step, retries, evidence and aggregation.
23. [Future multi-instance plan](multi-instance-plan/README.md): staged implementation tasks after the Engine/managed execution acceptance gates.

## Staged experiments and independent acceptance gates

Use the freshest `main` at implementation time; #45 is **preview only** and does not become the base by reference. Distinguish these three proof levels:

1. **Foundation A — Specs and Workspace:** resolve Project Home from primary/linked checkout, create Specification from title, optionally create a verified Git worktree, persist registry/journal, prove offline CLI/real HTTP parity, idempotent crash recovery and cross-process **create/registry serialization**. Do not fake a workflow step merely to exercise creation locks.
2. **Foundation B — Execution Coordinator + minimal real Workflow Kernel:** one representative deterministic step with actual admission, claims, inspect/reconcile/release and external CLI work without Runtime. No AI provider needed. This is a separate gate for workflow-migration readiness, not Foundation A's hidden prerequisite.
3. **Sessions integration gate — Runtime-managed execution:** build Session/Turn/Work and mock provider without workflow, then prove managed dispatch handshake, current workspace resolution, optional writer admission, crash/replay, batch/handover and scope authorization. Actual provider migration is later.

A and B establish Engine foundations; Sessions may be developed against the **documented handshake** without waiting for full workflow migration. See [test plan](test-plan.md), [acceptance criteria](acceptance-criteria.md), [managed integration](managed-session-integration.md) and [open decisions](decisions-and-promotion.md). **Do not** migrate all providers, the old queue system, full finalize or broad UI composition during Foundation A.

## Non-goals and constraints

- No forced Runtime dependency for specification/workflow CLI commands.
- No invented canonical Session for an external agent; observable workflow progress is distinct from live conversations.
- No parallel legacy/deterministic workflow product modes: only the deterministic model is a migration candidate.
- No generic DI framework or unnecessary npm package explosion.
- No implicit scanning and trusting of all Git worktrees.
- No automatic deletion of worktrees containing unproven or unintegrated work.
- No promotion of these drafts before executable evidence and explicit owner decision.

## Related existing work

Read the accepted [runtime ownership](../../architecture/runtime/ownership-and-lifecycle.md), [deterministic workflow](../../architecture/workflow/deterministic-workflow.md), [repository topology](../../architecture/decisions/0012-product-package-topology-and-dependency-direction.md), [local configuration](../../architecture/runtime/configuration.md), and [UI application architecture](../../product/specflow/ui/application-architecture.md). Provider-native resume remains covered by [AI adapter recovery](../specflow-runtime/ai-adapters/session-resume-and-recovery.md); this dossier does not replace it.
