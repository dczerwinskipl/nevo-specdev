---
id: ideas.specflow-engine.multi-instance
type: architecture
title: Deferred multi-instance deterministic workflow steps
status: draft
scope: specflow
areas: [workflow, runtime, ai, cli, security, testing]
tags: [multi-instance, review, deterministic, aggregation, recovery, read-only]
read_when:
  - evaluating several independent AI reviewers of one task and one workflow step
  - designing independent start, result submission, retry and final step settlement
  - distinguishing multi-instance execution from parallel tasks and task batches
summary: >
  Deferred exploration of multiple independently identified executions of one deterministic
  step, read-only review provenance, fault handling and deterministic aggregation without
  replacing the single canonical workflow attempt and transition.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.execution-scopes
  - ideas.specflow-engine.locking
  - ideas.specflow-engine.managed-session-integration
  - ideas.specflow-engine.worktrees
  - ideas.specflow-engine.decisions
  - architecture.workflow.deterministic-workflow
---

# Multi-instance execution of one deterministic step (deferred idea)

## Motivation and baseline evidence

Legacy Nevo has a real agent-facing `workflow step start` / `workflow step finish` protocol; an agent receives `StepContext.finishContract` and can submit `result`, `feedback` and artifact references. Its `standard-v1` review step currently makes one semantic decision, with `pass -> human-verification` and `fail -> implementation`; a successful `finish` advances the task exactly once. The legacy `workflow batch finish` operation is **one reviewer session evaluating multiple tasks**, not **several independent reviewers evaluating one task**. Review in the legacy standard workflow can modify source and commit/push; that is unsuitable for simultaneous same-workspace reviews.

Reference implementation: `dczerwinskipl/nevo` `tools/specs/workflow/cli.mjs`, `step-context.mjs`, `finish-operation.mjs`, `workspace-writer.mjs`, `.nevo-ai/workflows/standard-v1.yaml`, `.claude/skills/multi-task-review/SKILL.md`. Reinspect current code/provider capabilities before promotion. The Engine foundation in the stacked implementation PR provides Project Home, workspace registry and short control locks, **not** multi-instance scheduling or aggregation.

## Terminology: cardinality is not concurrency

| Term | Meaning |
| --- | --- |
| **Workflow step/attempt** | One `(spec, task, step, attempt)` controlling the canonical transition. |
| **Step instance / review slot** | One independently required evaluation of that step, with a stable Engine-assigned instance ID. |
| **Execution run** | A concrete attempt to fulfil one instance; retries have new run/invocation identities. |
| **Session / Turn** | Runtime-owned provider conversation/invocation; may be linked to a run but never identifies the step or instance. |
| **Required instances** | Number of valid independent contributions required by the frozen step execution plan. |
| **Concurrency limit** | Scheduler capacity, independent of the required instance count; sequential runs can still satisfy a multi-instance step. |
| **Task batch** | One execution covering multiple task attempts. Orthogonal to multiple reviewers for one task. |

Do not call the feature `parallel step`: multiple instances need not run concurrently, while unrelated tasks may execute in parallel without multi-instance steps. A name such as `multi-instance` or `fan-out/fan-in` is a candidate, not a frozen product term.

## Candidate invariants

1. **One canonical transition.** Several instances produce evidence; no individual instance may finish the shared workflow attempt or trigger continuation. Aggregate/finalize exactly once with durable idempotency and declared gates. The existing single-instance protocol remains compatible.
2. **Frozen participation.** Resolve the declared number of required independent instances, identity/role/provider constraints, execution definition revision, reviewed material and completion policy when the step attempt starts. No late scheduler configuration or Session history may silently change the quorum.
3. **Stable identity, independent retries.** A stable `instanceId` survives technical retries; every provider dispatch gets a distinct `runId`/`invocationId`. Accept an outcome only for an authorized current run, or an idempotent replay of its accepted result. Fence late callbacks and stale CLI submissions after supersession.
4. **Result != run status.** `pass`, `changes-required` and `inconclusive` are review semantics. Timeout, quota, provider crash, cancellation, unknown dispatch and incomplete report mean **no accepted review verdict**. Never turn transport failure into review `fail` or into positive approval.
5. **Independent results.** Keep immutable per-instance feedback/findings, reviewer provenance, timestamps and reviewed revision; aggregate without overwriting source evidence. Do not leak prior reviewers' judgments into independent reviewers' initial prompts by default.
6. **Read-only review.** The initial multi-instance capability is review/inspection only. No independent reviewer edits source, commits, pushes, generates tracked report files or mutates workflow manifests. Provider write capability must be technically restricted or execution conservatively rejected/serialized; a read-only prompt is not enforcement.
7. **Control-plane writes are permitted.** `start`, result submission and recovery may persist Engine-owned ignored state under short transactional coordination. This is distinct from a long-lived workspace **writer claim** for code mutation. External offline CLI and MCP adapters should call the same Engine rules; Runtime-only orchestration must not make offline workflow invalid.
8. **Same material, not merely same worktree.** All results in one aggregation refer to the same verified code/spec/definition snapshot. Git HEAD by itself is insufficient when uncommitted content matters; require a frozen content/delta fingerprint, immutable checkout, or other proven materialization. Active writers, rebind and cleanup must be coordinated during review. Same-OS-account agents are not OS security sandboxes.
9. **Explicit intervention.** Fewer valid outcomes than required is `incomplete`, not `pass`; after bounded retries the operator can retry/reassign, cancel or approve an auditable reduction/waiver if policy permits. A quorum waiver is **not** human acceptance of the code.
10. **No hidden fan-in through provider status.** Terminal Session/Turn is not a review result; only an authenticated/attributed and validated instance submission can count.

## Submission boundary: two candidates, decision still open

**A. Contextual `step start` / `step finish`.** Keep the legacy skill entry points. Engine associates each admitted call with a **trusted** `instanceId` and current `runId`; `finish` of an instance stores immutable evidence and responds `contribution-recorded`, not `step-completed`. A separate Engine-owned finalization performs the only workflow transition. Single-instance calls retain existing semantics. Pros: skill continuity; cons: same verb has context-dependent behavior, and the consumer must not interpret every successful finish as step completion.

**B. Explicit instance submission.** Keep `step start` for activation/context but use a distinct CLI/MCP command (e.g. `workflow instance submit`) for each independent result; `workflow step finish` remains strictly the single step finalization. Pros: unambiguous APIs and safer tools; cons: new agent skill protocol and compatibility adapter needed. Neither option may grant authority from an arbitrary user-supplied instance ID or Session ID.

For either choice, separate **instance result persistence** from **aggregate finalization**, and make both recovery-safe under a short state lock/CAS. The agent must know whether its own contribution was recorded, whether more instances remain, and whether the step transitioned; do not assume one successful CLI exit means all three.

## Aggregation: typed semantics, not an untyped merge function

Propose two independent policies: (1) **completion** decides whether enough valid contributions exist; (2) **resolution** maps their typed outcomes to one configured step transition, or `needs-triage`/`incomplete` requiring explicit resolution. Do not silently promote `incomplete` to existing `pass/fail` transitions. Freeze policy version with the attempt.

| Payload | Candidate reduction | Pitfall |
| --- | --- | --- |
| Boolean predicate | `all` or `any`, selected by predicate semantics | `approved` and `hasBlockingFinding` require opposite operators. |
| Ordered severity | Explicit severity ordering / highest blocking severity | Unknown severity or inconclusive review is not the lowest severity. |
| Nominal enum | Exact-match/unanimity, declared conflict handling | `pass/fail/blocked` is not automatically an ordered severity scale. |
| Findings / feedback | Preserve all attributed findings; optionally deduplicate in a derived view | Duplicate clustering must not erase original findings or provenance. |
| Free text / Markdown | Retain separately; render a combined report only from sources | Cannot safely determine a semantic verdict by concatenating strings. |

For safety-oriented code review, **majority voting is not the default**: two `pass` results must not outvote a plausible P1. A candidate first policy is `all-required-results` followed by `any-blocking-finding -> changes-required/triage`, otherwise `pass`. Contradictory findings, unknown severity, stale snapshot or unresolved evidence require triage rather than an invented deterministic verdict. Define what a validated `pass` report means when it contains findings.

## Failure and recovery matrix (deferred)

| Event | Expected behavior |
| --- | --- |
| Three required, one provider fails before submission | Preserve other accepted results; independently retry **that instance** up to configured bound. |
| One run crashes after storing contribution, before acknowledging it | Same run idempotently re-reads accepted submission; no duplicate count. |
| Timeout with uncertain provider liveness or effects | Fence old run/late callbacks; do not blindly redispatch if unproven side effects are possible. |
| Two starts race for the same instance | One admitted run or idempotent replay, no double allocation or extra votes. |
| Three results refer to different HEAD/dirty baselines | Refuse aggregation; diagnose invalid/stale material, do not report partial success. |
| Workspace rebind, cleanup or writer attempts during review | Check active/frozen snapshot constraints; block or invalidate safely, preserve evidence. |
| All retries exhausted with fewer than required results | `incomplete` plus operator retry/reassign/waiver/cancel choices; no implicit success. |
| Waiver permits one result instead of three | Durable actor and reason with original policy, missing instances and remaining evidence; separate later human sign-off. |
| Aggregation/finalization crashes after some durable effects | Resume same operation by identity; no second transition, report commit or continuation. |

## Promotion questions for owner

1. Should the agent-facing `finish` submit a contribution in multi-instance context (A), or should there be a new instance-result command (B)? What is the exact successful-but-not-step-complete response?
2. Is a required `N` always `N` distinct completed contributions, or may a definition declare a minimum/maximum and optional reviewers? What is the default (`1` suggested)?
3. Which providers/models count as independent, and how are repeated models/reassignments represented without inventing diversity?
4. What enforces immutable review input: fixed worktree writer barrier, isolated read-only snapshot, or another approach? What about active external writers and dirty baselines?
5. What structured result schema is supported first, and which findings/severities are blocking? What happens when two valid reviewers disagree?
6. Which failures permit safe automatic retry, how many attempts/timeouts, and what operator authority is required for waiver/partial coverage?
7. Where do contribution records live so external CLI works without Runtime and commits only happen at aggregate finalize, if configured?

## Scope and sequencing

**Not part of Foundation A/B, Sessions Foundation or current E1–E5 implementation acceptance.** Reserve only compatibility seams in E3/E4/E5 (one workflow attempt is not the same as one Turn; read-only turns do not occupy writer claims; current single-instance `finish` remains idempotent). Do not widen E5.T07's limited Task-batch/handover into multi-review orchestration.

After E3/E4/E5 are demonstrated, use the [separate future plan](multi-instance-plan/README.md) and [deferred scenarios](test-plan.md). Its folder intentionally sits outside disposable `execution-plans/` and survives deletion of E1–E5 temporary implementation tasks. No behavior here is an accepted architecture contract.
