---
id: ideas.specflow-engine.legacy-migration
type: engineering
title: Legacy Nevo migration map and instructions
status: draft
scope: specflow
areas: [docs, workflow, runtime, cli, testing]
tags: [legacy-nevo, migration, architecture, workflow]
read_when:
  - preparing deterministic workflow or AI migrations from the old nevo repository
  - reviewing whether a legacy module may be copied or needs redesign
summary: >
  Evidence-based map of old Nevo modules to Engine, CLI and Runtime owners, including
  known coupling to reject and checks required during future module-by-module migration.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.baseline-evidence
  - ideas.specflow-engine.boundaries
  - ideas.specflow-engine.ownership
  - ideas.specflow-engine.acceptance
  - ideas.specflow-runtime.ai-adapters
---

# Legacy Nevo migration map

## Scope and sequencing

Legacy `dczerwinskipl/nevo` includes both older workflow and newer deterministic execution. **Only migrate the deterministic workflow path**; do not reintroduce a selectable legacy mode. Architectural constraints must be established and demonstrated by the Specs creation slice before porting a large subsystem. Reinspect actual source/HEAD before every migration; this is a map, not an exhaustive copied-file inventory.

## Candidate module map

| Old path                                                                              | New owner                                                      | What to preserve                                                     | What to change                                                                                             |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `tools/specs.mjs`                                                                     | `@nevo/specflow` CLI composition + feature-owned adapters      | Human/agent command semantics and stable machine output              | No application logic in root Commander, no imports of Runtime private Session binding                      |
| `tools/specs/store.mjs`, `identity.mjs`, `validation.mjs`, `indexes.mjs`              | Engine Specs capability                                        | Stable spec identity, validation, manifests, deterministic indexes   | Explicit Project/Workspace context, no module-relative hardcoded ROOT                                      |
| `tools/specs/generate/**`, `query.mjs`, `context.mjs`                                 | Engine Specs/read and context operations                       | Deterministic specification query/context preparation                | No global current cwd, per-workspace cache/version                                                         |
| `tools/specs/workflow/definitions/**`, `contracts.mjs`, `registry.mjs`                | Engine Workflow                                                | Declarative definition and action/gate contracts                     | No Runtime/CLI import or hidden global provider registry                                                   |
| `tools/specs/workflow/start-operation.mjs`, `finish-operation.mjs`, `step-runner.mjs` | Engine Workflow                                                | Explicit start/finish, attempt/evidence identity, replay             | Use Engine journal/claim ports and per-workspace discovery                                                 |
| `tools/specs/workflow/readiness-policy.mjs`, `step-context.mjs`                       | Engine Workflow                                                | Nonmutating inspect, readiness, workflow-owned paths                 | Context constructed from project + workspace; no agent session required                                    |
| `tools/specs/workflow/workspace-writer.mjs`, `workspace-request.mjs`                  | Engine coordination                                            | Physical-worktree ownership, atomic compare-and-set, conflict guards | Distinguish short lock, external claim, Runtime-managed turn; review queue necessity rather than copy FIFO |
| `tools/specs/workflow/operation-record.mjs`, `cli-workspace-execution.mjs`            | Engine local persistence                                       | Durable recovery records                                             | Central project registry/journal partitioned by workspace; versioned schemas                               |
| `tools/specs/workflow/actions/commit-and-push.mjs`                                    | Engine Workflow action consuming Git capability                | Fail-closed Git facts, scoped commit checks                          | Avoid direct cwd assumptions and implicit finalize checkout; verify action idempotency                     |
| `tools/specs/approve/**`, `start/**`, `complete/**`, `verify/**`, `finalize/**`       | Review against deterministic Engine operations                 | Relevant validation/PR evidence and user actions                     | Do not port legacy lifecycle transitions as a second workflow mode                                         |
| `tools/lib/git.mjs`                                                                   | Engine Git adapter                                             | Safe root-aware Git invocations and useful diff/status parsing       | Narrow capability ports and error taxonomy; test worktree-specific behavior                                |
| `tools/dashboard/server/specs/routes.mjs`                                             | Runtime Specs HTTP adapter                                     | Existing route shapes where still relevant                           | No direct mutation orchestration, Git, lock or finish journaling in handler                                |
| `tools/dashboard/server/specs/data.mjs`, `service.mjs`                                | Engine query + Runtime read projections                        | Contextual read model/aggregations                                   | Separate canonical reads from Session overlays and transport DTO                                           |
| `tools/dashboard/server/specs/watcher.mjs`, `events.mjs`                              | Runtime observation/SSE                                        | Scoped filesystem invalidation                                       | Watch registered roots, handle missing/replaced worktree, no source authority                              |
| `tools/dashboard/server/ai/providers/**`                                              | Runtime providers                                              | Provider protocol adapters, capability/error evidence                | Session-safe workspace identity; no fixed global cwd if target worktree differs                            |
| `tools/dashboard/server/ai/sessions/**`                                               | Runtime Sessions + feature-bound bindings                      | Canonical Session/Turn/Work for managed calls                        | Do not require managed Session for external Engine operation                                               |
| `tools/dashboard/server/ai/orchestration/admission.mjs`                               | Split: Engine admission and Runtime provider/turn coordination | Safety of physical writer admission and turn settlement              | Remove requirement for Runtime-managed session to authorize offline workflow                               |
| `tools/dashboard/server/infrastructure/operation-runtime.mjs`                         | Runtime live operation/SSE projection                          | Progress streaming semantics                                         | Engine durable operation journal is independent authority                                                  |
| `tools/docs/**` and agent skill wrappers                                              | Repo tooling/agent adapters as applicable                      | Deterministic doc discovery and vendor-neutral command usage         | Do not conflate repository tooling with distributed product Engine                                         |

## Special caution: legacy finalize

Old `tools/specs/finalize/operation.mjs` explicitly checks out base branch, commits archive, merges PR and deletes branches. That sequence assumes a single mutable checkout and is not safe in a linked worktree. Future migration must separate: workflow verification, source integration into target ref, archive propagation, and optional cleanup of managed worktree. The created Specification's only archived copy cannot be left solely on a deleted worktree.

## Special caution: legacy CLI binding and session semantics

Old `tools/specs.mjs` and `tools/specs/agent-session.mjs` directly import `tools/dashboard/server/ai/sessions/binding-service.mjs`. Avoid reversing this import in SpecFlow. External agent CLI can progress workflow without any Runtime-managed provider state. Attaching an unmanaged external provider session is a separate opt-in feature; never implicitly fabricate Runtime Turns from CLI command events.

## Migration agent checklist

1. Read current `main` and accepted ADRs, then consult relevant docs under this **draft** ideas dossier as candidate guidance.
2. Inspect legacy deterministic implementation + tests and classify each part as domain operation, adapter, persistence, observer, or provider lifecycle; identify Runtime-only dependencies.
3. Identify all ambient `ROOT`, `process.cwd()`, mutable globals and cross-layer imports.
4. Locate the future Engine-owned use case and ports; expose the same operation to CLI and HTTP without duplicated transition logic.
5. Make per-workspace/physical-lock semantics explicit. For every mutation, add competing-process tests and failure/restart recovery.
6. Preserve provider-specific behavior only behind Runtime adapters; apply existing `docs/ideas/specflow-runtime/ai-adapters/` hardening guidance.
7. Include negative tests for no Runtime, stale claim, missing worktree, wrong actor and commit scope.
8. Do not import or publish `tools/*` internal code as product API.
9. Update normative docs/ADRs **after** the proof and explicit owner approval, not as a side effect of copying code.

## Interface constraints to enforce in CI

- Engine -> Runtime/CLI/Fastify/Commander/UI imports forbidden.
- Runtime/feature endpoint -> CLI handlers forbidden.
- UI -> Runtime private TS or Engine imports forbidden.
- Production UI fixture imports forbidden.
- Capability feature public entrypoints mediate cross-feature use.
- Only product composition root packages the final single npm artifact.

## Explicit deferred work

Full Task Planner, provider parity, batch protocol, PR merge and archived lifecycle, application-level batching/caching optimization, distributed/multi-host filesystem, multi-project selection and externally attached provider Sessions are follow-on tasks. Preserve their constraints here, but do not block the narrow creation proof with full feature delivery.

## Per-module disposition and sequencing gate

Before porting any module, label its disposition: **port** (semantics preserved), **refactor** (boundary/persistence changed), **replace** (new implementation), **delete** (unsupported legacy mode/queue), or **defer** (not part of current slice). Record owner, source revision, target capability and regression proof per row. The initial table is an **inspection routing map**, not an instruction to copy every file.

**Gates:** Foundation A proves Specs/Workspace/Git and offline CLI. Foundation B proves actual workflow start/finish/claim recovery against an external process. Sessions Foundation can implement Session/Turn persistence and mock provider with no workflow. Managed integration then proves Runtime ↔ Engine dispatch handshake and crash settlement; provider adapters and remaining deterministic workflow features migrate incrementally afterward. Do not make all Sessions wait for full workflow migration, but do not test managed coordination only with a fake Engine.

The legacy `ai/orchestration/admission.mjs` is split by authority: Engine owns physical-workspace claims/readiness; Runtime owns Session/Turn dispatch. Preserve staged invocation intent and unknown-outcome semantics; do not copy the giant AgentSessionService unchanged. One Session can execute an explicit Task batch sequentially, and handover requires an explicit new execution intent; neither automatically advances workflow or spawns an unrequested reviewer.

Legacy human-verification file records are **not** automatically strong human identity proof. Review local actor trust before porting `workflow verify-human --confirm`; see [human gates](local-actor-and-human-gates.md). Worktree cleanup requires verified binding [rebind](workspace-binding-lifecycle.md), not legacy `git checkout main`.
