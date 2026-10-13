---
id: ideas.specflow-engine.multi-instance
type: architecture
title: Deferred multi-instance deterministic workflow steps
status: draft
scope: specflow
areas: [workflow, runtime, ai, cli, security, testing]
tags: [multi-instance, deterministic, aggregation, recovery, admission]
read_when:
  - configuring multiple independent executions of one user-defined workflow step
  - designing instance start, result submission, retry and deterministic final settlement
  - distinguishing step instances from task batches and scheduler concurrency
summary: >
  Deferred, step-agnostic exploration of multiple independently identified executions of
  one user-defined deterministic step with policy-driven effects, result collection,
  aggregation and a single canonical workflow transition.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.execution-scopes
  - ideas.specflow-engine.locking
  - ideas.specflow-engine.managed-session-integration
  - ideas.specflow-engine.worktrees
  - ideas.specflow-engine.decisions
  - architecture.workflow.deterministic-workflow
---

# Multi-instance execution of one user-defined step (deferred idea)

## Scope: workflow Engine does not know what "review" means

**The user defines the workflow steps, step instructions, result schema, gates, transitions and execution policy.** Review is one possible configured step, not a built-in step kind, verdict vocabulary or fixed Engine workflow. Engine coordinates instances and deterministic resolution of **declared** results; it must not infer reviewer semantics, invent P1/P2 thresholds or require a human approval for arbitrary step outcomes. A default legacy workflow may contain a step named `review`, but the name has no authority.

Legacy Nevo already exposes agent-facing `workflow step start` and `workflow step finish` via `StepContext.finishContract`. Its standard example uses `pass/fail` and can modify files and commit. Legacy `workflow batch finish` handles multiple **tasks** in one Session; it is not multiple executions of the **same** step. Preserve that distinction and the existing single-instance finish behavior. Sources for later migration: `dczerwinskipl/nevo` `tools/specs/workflow/{cli,step-context,finish-operation,workspace-writer}.mjs`, `.nevo-ai/workflows/standard-v1.yaml`. The current Engine Foundation does not implement multi-instance scheduling.

## Identity and cardinality are independent of concurrency

- **Workflow attempt** — One canonical (spec, task, step, attempt) and at most one transition
- **Instance** — One stable, Engine-allocated contribution slot for that attempt
- **Run / invocation** — One execution of a slot; retry or replacement gets a new run identity
- **Session / Turn** — Runtime/provider-owned conversation units; optional correlation, not workflow identity
- **Required instances** — Completion requirement frozen from the step definition/configuration
- **Max concurrency** — Scheduling limit; executing three slots sequentially is still multi-instance
- **Task batch** — Several different task attempts within a wider execution scope

Do not name this feature `parallel step`: parallel task execution and multiple contributors to one step solve different problems. Define defaults conservatively (one instance remains the backward-compatible behavior). Instance uniqueness does **not** guarantee semantic independence: two separate Sessions of the same model may produce correlated judgments.

## Candidate lifecycle and responsibility boundaries

1. Engine activates a user-defined workflow step once and pins its definition/instructions, output contract, effect scope, instance count, completion/resolution policies and required evidence to its attempt.
2. **After activation**, establish the common input baseline where the step requires comparable input. Activation itself can mutate workflow metadata; do not hash material before `step start` and silently compare it against material after activation.
3. Allocate stable `instanceId` values; authorize each concrete `runId`/invocation separately. `step start` for a second instance must not reactivate the step or be rejected merely because a first instance exists. Enforce side-effect admission independently.
4. The user-defined step instructions and output schema are passed to each permitted execution. The Engine validates and durably stores each contribution under its exact slot/run/attempt, without progressing the shared workflow.
5. Evaluate completion policy against **valid submitted results**, not terminal Turns. Once satisfied, evaluate the chosen deterministic result reducer against the frozen definition and accepted contributions.
6. If a declared result/transition can be determined and required gates/actions pass, finalize the step **once**, with a durable idempotent operation. A provider's completion is not the canonical step completion. Otherwise leave an explicit unresolved/incomplete state with appropriate configured or operator actions.

The distinction between `step start` and group input capture is important: a `change.yaml` write by activation should not make all subsequent instances appear to review different input. A stable step definition revision and an input snapshot revision are separate facts.

## Effects, worktrees and repeatability

**Multi-instance does not intrinsically mean read-only.** Effects belong to the user-defined step and verified executor capabilities: no source mutation, workspace writer, Git/ref changes or external side effects. The first **concurrent same-workspace** proof can be restricted to _technically enforced read-only_ executions; this is a staged support limitation, not a rule that every multi-instance step must be a review.

- True readers can coexist without a long-lived exclusive writer claim. CLI/MCP submission still performs Engine-owned control-plane writes using a short state lock/CAS.
- Independent writers need proven isolation or serialization. A declared "readOnly" prompt does not prevent a provider from modifying files; a worktree is not an OS sandbox, and per-spec worktrees are not per-instance sandboxes.
- External effects (network requests, APIs, tests generating files, Git refs) require declared admission and repeat/retry safety. Do not automatically retry an uncertain _effectful_ run.
- Comparable read-only analysis may require one immutable code/spec/input snapshot across instances. Git HEAD alone misses staged, unstaged and untracked changes. The policy may instead explicitly state that inputs are independent; do not impose an immutable review snapshot on all arbitrary user-defined steps.
- For shared-input steps, coordinate activation -> snapshot/baseline -> instance starts, and block or invalidate source changes, rebind and cleanup according to the adopted isolation policy. Existing external writers may remain physically unfenceable.

**Verification gates are also effects.** `inspect` is non-mutating, but `verify` and finalize actions may run tests, write caches/reports, commit or push. The step definition must establish whether verification happens before instance admission, in isolated per-instance environments, or once during finalization. Never run write-producing gates concurrently inside supposedly read-only instances just because the agent's own tools are read-only; preserve existing Engine inspect/verify separation.

## Contribution result and agent-facing command boundary

Keep the single-instance CLI/skill behavior compatible. Two candidate multi-instance contracts remain open:

- **A — contextual `step finish`:** a valid instance-specific `finish` records a contribution and returns `contribution-recorded` (not a canonical step-completed signal); Engine finalizes only after policy resolution. Risk: same command changes meaning with cardinality.
- **B — explicit `instance submit`:** `step start` provides instructions/context and authorizes a run, a distinct CLI/MCP command records its result, and Engine retains the only `step finish` authority. This preserves unambiguous `finish` semantics and deserves preference pending owner approval; costs skill/API compatibility work.

Neither design trusts a user-supplied bare `instanceId` or Session ID as admission authority. Freeze and verify the instance-run association; retry has a new run ID but retains its required slot. Store submitted payload, optional artifacts, provenance, effective instruction/definition revision, input correlation, and technical execution status separately. An accepted result can be replay-read idempotently after a crash without an extra vote.

## Completion and typed, explicitly declared aggregation

Completion policy asks _how many valid contributions are needed_; result aggregation asks _how to derive the declared step output from them_. Both are part of the user-defined versioned policy. There is **no generic implicit reduction** of arbitrary booleans, enums, arrays or strings.

- **Boolean:** all / any with explicit predicate semantics. Without a declared policy: AND for every boolean is not meaningful.
- **Ordered enum:** Declared order and min/max/worst/best reducer. Without a declared policy: No inferred severity order.
- **Nominal enum:** Unanimity, declared priority, conflict or other explicit reducer. Without a declared policy: No arbitrary highest-severity guess.
- **Numeric:** min, max, sum, average with explicit units. Without a declared policy: No automatic aggregation.
- **List / findings:** Concatenate and optionally derive a deduplicated view. Without a declared policy: Do not discard original results.
- **Free text:** Preserve individually or user-defined deterministic formatter. Without a declared policy: Do not infer a structured verdict from prose.
- **Completion:** Exact N or approved quorum/waiver policy. Without a declared policy: Cannot treat missing data as a positive result.

Example **only**: a user-defined review step may choose `all-approved`, `any-blocking-finding`, or explicit triage if two passes conflict with one P1. Another user-defined step can legitimately choose `any`, `majority` or a different type-safe rule. Engine must validate the reducer, output schema and transition mapping; if no declared policy resolves the inputs, fail closed rather than choosing a branch. Every original contribution remains attributable even if a derived summary is computed.

## Independence of work and evidential quality

**Technical independence:** distinct admitted instance IDs, execution runs and result provenance. **Semantic independence:** the user-configurable execution strategy (models/providers, distinct prompts/roles, exposure to other contributions, randomness, shared history). Separate Sessions alone do not prove different reasoning.

Record _requested independence policy_ and _observed provenance_ where available. Do not claim diversity based solely on `N=3`. A policy may require distinct provider families, different agent profiles, no shared reviewer history or only unique runs; lacking provenance must be explicit, not silently represented as independent evidence. A strict requirement may block admission/finalization if it cannot be verified; other policies can permit repeated models. Keep initial prompts independent only where the step defines that rule.

## Failure, recovery and operator action

- **One of N agents times out** — Keep accepted other results; retry only that slot when effects are proven safe
- **Provider has quota/error** — Technical run failure, never an invented step result
- **Late result after slot retry** — Fence superseded run; preserve idempotent accepted replay
- **Crash after storing contribution** — Resume from its immutable record, no extra result/transition
- **Same-input snapshot changes** — Reject/invalidate stale contributions if that step requires snapshot consistency
- **Different effectful executions race** — Admit only with proven isolation or serialize; no hidden extra writer
- **Fewer valid results than policy requires** — Incomplete, with configured retry/reassignment or authorized exception
- **Operator waives missing result** — Record actor, reason and changed effective requirement; do not invent missing data
- **Two finalizers race** — One durable finalization and single workflow transition

Human authorization for a waiver is **not** necessarily a human approval step. Such a gate exists only when the user-defined workflow declares it.

## Decisions before promotion

1. Choose A vs B (preference B, **not** a frozen API) and preserve existing single-instance skill semantics.
2. Decide exact N vs quorum, provider diversity policy, execution strategy and `maxConcurrency` independently.
3. Determine typed output schemas and policy-reducer registry/validation; choose behavior for unresolved conflicts.
4. Define when input is frozen (post-activation), how snapshot rules and effect scopes are expressed, and how gates that generate files execute.
5. Determine technical retry/reassignment, unknown effectful dispatch recovery and whether authorized partial-completion waivers are allowed.
6. Define how a step's instructions and candidate contributions are kept independent or deliberately shared, with documented provenance limitations.
7. Keep Engine state, CLI/MCP submission and managed Session/Turn dispatch decoupled; do not require Runtime for offline contributions.

## Timing

This is a future optional capability, **not** a hidden requirement of current Foundation A/B or E1–E5 managed integration. E3/E4/E5 should merely avoid assuming `workflow attempt == provider Turn` or `agent work always requires an exclusive writer claim`. Start with Engine-owned offline per-instance result collection and deterministic aggregation; integrate managed scheduling after it is proven. The [future task plan](multi-instance-plan/README.md) stays outside disposable `execution-plans/`.
