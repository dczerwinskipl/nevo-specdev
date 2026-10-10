---
id: ideas.specflow-engine.local-actors
type: architecture
title: Offline CLI actors and human approval authority
status: draft
scope: specflow
areas: [cli, workflow, runtime, security]
tags: [authentication, authorization, human-gates, local-trust]
read_when:
  - allowing external agents to invoke local workflow commands
  - designing human review approvals and authoritative evidence outside Runtime
summary: >
  Candidate distinction between local filesystem execution, workflow owner admission and
  authorized human decisions, preventing an agent action from impersonating a human approval.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.ownership
  - ideas.specflow-engine.execution-scopes
  - ideas.specflow-engine.offline-agents
  - architecture.workflow.deterministic-workflow
---

# Local actor and human verification gates

## Three questions, three authorities

1. **Authentication/authorization:** who is permitted to request this action? HTTP Runtime validates its configured user/capability policy. Offline CLI must specify an explicit local trust model.
2. **Workspace admission:** can this execution safely mutate the physical resource right now? Engine inspects claims/journal and admits or blocks, irrespective of role.
3. **Human decision evidence:** has a suitably authorized human confirmed *this exact* gate for *this exact* spec/task/step/attempt? Engine evaluates typed durable evidence; agent narration is never approval.

An execution owner token is **not** an identity, a human role, or proof of a human review. A valid workspace claim can authorize the claimed mutation protocol without granting the right to approve itself.

## Threat model: cooperative processes versus adversarial local access

If a malicious agent and CLI share the same unrestricted OS account and can write all the same files, neither a lock file nor an opaque token offers robust adversarial isolation. Describe these mechanisms as guardrails for **cooperating actors**, not security sandboxes. A secure human-only approval requires a separate trusted channel/credential/policy with an enforcement boundary that the agent cannot forge or modify.

Possible stronger models, to evaluate rather than silently claim:
- approve via authenticated Runtime HTTP using human identity and capability, with durable signed/verified receipt;
- approve via a local operator CLI only when an independently authenticated human identity/confirmation is established and cannot be used by the agent's own filesystem authority;
- restrict agents via OS-level user separation or sandboxed credentials; if not available, explicitly document that local human sign-off is not cryptographically trustworthy.

Do not treat `--confirm`, `--role owner`, environment variables, terminal TTY checks, a persisted `confirmedBy` string, or arbitrary agent-supplied `sessionId` as strong proof of human authorization.

## Evidence lifecycle and portability

Human sign-off should carry canonical `specId`, scoped Task/Spec target, step, attempt, exact gate, decision, actor provenance/trust level, issue/revocation information and audit timestamp/revision. Engine must prevent evidence from one attempt/gate satisfying another. Decide carefully which evidence is committed, ignored-local, portable across clone/worktree and verifiable from historical source state.

Current workflow architecture expressly distinguishes human gates from agent narration and scopes evidence by attempt. Legacy `human-verification-store.mjs` is a useful *warning*: its `confirm({role})` path stores a role/confirmation but does not itself establish cryptographic operator identity. Do not copy that into a strong authorization contract.

A review outcome may be stored as a committed domain fact **only when** backed by valid, verifiable provenance. Otherwise mark a local, lower-trust indication and do not claim remote/multi-machine enforcement.

## HTTP scope resolution

For existing spec/task/session: resolve canonical Spec -> Workspace ownership through Engine then enforce authoritative HTTP capability/scope, not the caller-provided workspace ID. For creation before spec/workspace IDs exist: authorize project-level create + Git resource creation as appropriate; perform Engine admission separately. For viewing Session history, guard the Session itself and any referenced Spec/Task data against accidental disclosure in aggregated responses.

## Recommended future commands

Engine owns `inspect human gate` (read-only evidence/readiness) and `recordHumanDecision` with trusted actor context; CLI/HTTP provide suitable authorization and interaction. An external agent may request human review but cannot submit approval solely by claiming to be a human actor. Reconciliation cannot convert successful automated tests into a human decision.

## Tests / adoption blockers

- Agent holding a valid workspace claim cannot approve its own human review solely via that claim.
- False `role=owner`, `confirmedBy` or guessed owner ID is rejected under the chosen secure policy.
- Evidence from another Task, step, gate or attempt is not accepted.
- No Runtime: offline workflow can inspect gates and leave them awaiting human without fabricating acceptance.
- An offline authenticated human flow works **only if** a supported trust mechanism is explicitly chosen and proven; otherwise approval requires the trusted Runtime channel or the weaker local trust limitations must be documented.
- HTTP denies scoped user even when target `workspaceId` supplied by client is accessible.
- Changing worktree/binding does not allow replaying unrelated or unauthorized human evidence.

**Owner decision required:** strong vs cooperative local trust model, human-only channel, storage portability and revocation policy. These are security/product choices; do not let a PoC's easiest CLI handler settle them implicitly.
