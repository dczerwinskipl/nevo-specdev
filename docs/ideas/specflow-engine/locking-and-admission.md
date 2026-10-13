---
id: ideas.specflow-engine.locking
type: architecture
title: Cross-process locks claims and admission
status: draft
scope: specflow
areas: [workflow, runtime, cli, testing]
tags: [locking, admission, race-condition, claim]
read_when:
  - coordinating CLI and Runtime writes to the same workspace
  - designing external agent claim lifetime and stale recovery
summary: >
  Separate short atomic cross-process mutation locks from long-lived physical-workspace
  execution claims, with fail-closed admission and recovery independent of managed AI Sessions.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.ownership
  - ideas.specflow-engine.offline-agents
  - ideas.specflow-engine.recovery
  - architecture.workflow.deterministic-workflow
---

# Cross-process locking and admission

## Legacy foundation

Old Nevo's `tools/specs/workflow/workspace-writer.mjs` uses a physical-worktree scoped `workspace-control.lock` to serialize read/decide/mutate, plus a `workspace-writer.lock` claim. It explicitly has `cli-manual` and `agent` kinds and is not entirely Runtime-only. Reuse its demonstrated invariant, but review failure handling and portability rather than copying implementation byte for byte. Refer to legacy ADR-0009 for why workflow attempt != execution turn.

## Two different mechanisms

### A. Short transaction guard

Coordinates atomic business decisions across competing CLI/Runtime processes: reserving an ID/path, writing registry, changing step position or updating a claim. Use an OS/filesystem primitive with exclusive create or validated lock library. Prevent TOCTOU: re-read authoritative state **inside** the guarded critical section and write atomically (temp file, fsync policy and rename as applicable). Avoid holding this lock while waiting for an AI provider, running tests or performing slow Git operations.

File locks rely on filesystem guarantees; NFS/cloud sync and multi-host shared storage are **not** automatically supported. Test Windows and POSIX behavior; choose explicit recovery of orphaned short locks rather than removing files on arbitrary age alone.

### B. Durable execution claim

Represents which logical execution may write a **physical workspace** over a period longer than a CLI process. Identity could include `workspaceId`, `executionId`, `specId`, `scope`, `ownerKind`, creation/last-proven-activity and a protected ownership capability. Distinguish `active`, `released`, `unknown/recovery-required` where necessary. The claim is not itself the task's workflow position.

One physical workspace normally allows one conflicting writer; separate worktrees may run independently. Project-wide registry/Git-reference operations still require their own coordination despite separate worktree indexes.

## Admission algorithm candidate

1. Resolve workspace and scope from trusted Engine context, not a supplied path alone.
2. Under short lock, inspect current writer claim, task/step state, unresolved operations and Git baseline.
3. Reconcile only when positive evidence proves existing ownership settled, or flag human/explicit recovery.
4. Reserve one new claim or return a structured blocked result; record operation identity.
5. Release short lock; perform bounded work. Subsequent Engine mutations revalidate ownership.
6. At confirmed settlement, release exact owned claim under guarded compare-and-set. Do not advance Task on claim release.

For a remediable dirty worktree at pre-activation, permit the agreed remediation semantics without falsely activating a step; preserve legacy D1 reasoning. Do not globally block every attempt just because there are unrelated uncommitted changes unless the declared gate actually requires it.

## The hard part: external agent liveness

A `step start` CLI process exits while the agent keeps editing. Its PID is irrelevant to the claim's continued logical ownership. A lease heartbeat might be unavailable while an uninstrumented external agent is working, so a short TTL is dangerous. Candidate MVP choice: explicit owner release/finish plus an **unknown state requiring recovery when absence of liveness cannot be proven**. Time alone never establishes that writes are safe to preempt. Alternative heartbeats/supervised shell wrappers can be evaluated separately.

If owner capabilities are stored/returned, specify OS file permissions, no leakage into public JSON logs, secure comparison and rotation; don't treat a guessable `executionId` as proof.

## Lock ordering

Define consistent hierarchy (project registry reservation -> specific workspace control -> operation record) or design operations to avoid holding multiple locks at once. Explicitly forbid cycles. Git worktree create/remove is a multi-stage operation with an intent record, not a long critical section that blocks every other spec. Ensure retry/reconciliation does not acquire locks in reverse order.

## Failure matrix

| Condition                                                      | Required behavior                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| Two concurrent `specs create` requests choose same slug/branch | One wins, one explicit conflict; no overwrite              |
| Runtime write collides with external CLI claim                 | Fail/queue according to contract, never silently execute   |
| Two independent worktrees are claimed                          | Both can proceed unless shared project operation conflicts |
| CLI terminates after `step start`                              | Claim stays until proven settled or recovered              |
| Lock file corrupt/unreadable                                   | Fail closed with diagnostic; no destructive reset          |
| Process crashes while writing an operation                     | Recovery journal decides replay, no blind duplicate        |
| Claim expiry without proof of end                              | State becomes uncertain, not automatically free            |
| Two claim-release attempts race                                | CAS/owner check means only real owner wins                 |

## Deferred multi-instance effects and admission

Several instances of one **user-defined step** need independent run identity, but do not automatically imply either an exclusive writer claim or read-only access. Effects govern admission: enforced readers may share a verified workspace; writers require physical coordination or isolated workspaces; Git refs and external effects need separate checks. A writable provider does not become read-only through a prompt or flag.

Instance allocation, submission, finalization and operator intervention still mutate Engine control-plane records under short cross-process locks/CAS. If a step requires shared input, pin the baseline **after activation** and enforce a source-change/rebind/cleanup policy. Verification gates may generate files and cannot bypass the effect policy. This capability remains deferred; see [multi-instance execution](multi-instance-execution.md).

## Admission versus authorization

HTTP authorization answers **may this user request an operation**. Engine admission answers **is the requested mutation safe in the current state**. They must both run for HTTP requests. Offline CLI uses a separately defined local trust boundary then the same admission; do not conflate a role grant with owning the workspace.

## Test requirement

Use **separate OS processes**, not just Promise concurrency or an in-memory fake. Inject crash between lock and journal stages. Assert that no conflicting operation enters critical mutation region and that machine-readable blockers are stable across adapters.

## Recovery is an operation, not only a blocker

A long-lived claim must expose actionable `inspect`, `reconcile`, owner-verified `release`, and authorization-gated intervention. Inspect lists verified scope, operation, last observed evidence, and whether the original writer may still execute. Reconcile uses positive evidence of settlement, replayable stage checkpoints and compare-and-set under a short control lock. Only after provable settlement may ownership be released automatically; an ambiguous external writer remains blocked with explicit safe options. Merely expiring a TTL, losing the last CLI PID or observing no heartbeat does **not** revoke OS-level write capability. See [execution scopes](execution-scopes-and-recovery.md).

The admission target need not have a Task. Spec authoring and editing can hold a workspace claim, while enforced read-only provider work need not. A Git worktree add or rebind has separate repository-scoped coordination even when unrelated worktrees are independently writable. Foundation A tests registry/worktree create races; Foundation B tests the **actual** minimal workflow attempt and writer lease against independent CLI processes. Do not fake a workflow step just to make Foundation A pass.
