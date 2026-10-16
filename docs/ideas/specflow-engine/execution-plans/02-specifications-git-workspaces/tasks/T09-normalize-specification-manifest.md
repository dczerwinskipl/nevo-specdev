---
id: ideas.specflow-engine.plan-02.task-09
type: engineering
title: 'E2.T09 — Normalize Specification manifest contract'
status: draft
scope: specflow
areas: [workflow, cli, testing]
tags: [execution-task, temporary, specification-contract, compatibility]
read_when:
  - implementing or reviewing E2.T09
summary: >
  Remove the redundant execution-mode marker and rename new canonical manifest to specification.yaml, without breaking existing manifests or Durable Create recovery.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.specification-creation
  - ideas.specflow-engine.specification-worktree-closure
---

# E2.T09 — Normalize Specification manifest contract

**Temporary executable task**, branch feature/specflow-engine-foundation / existing PR #53. No production implementation in this planning commit. This is a narrowly scoped follow-up after E2.T01–E2.T08; do not reopen or reimplement accepted foundation tasks.

## Prerequisites and run mode

- E2.T08 accepted baseline.
- SOLO: independently review the Durable Create compatibility/negative tests BEFORE executing T10. No parallel change to Create journal versioning, scaffold generator or public manifest parser.

## Product contract

Nevo SpecFlow has one deterministic workflow architecture. A Specification does not select an execution algorithm, so new manifest scaffolds MUST NOT persist workflow.mode or invent another workflow execution mode. The canonical version-controlled Specification manifest is named specification.yaml (not change.yaml or state.yaml): it contains the spec's durable definition/metadata/lifecycle status, NOT host-local sessions, mutable process locks or execution journals. Do not confuse workflow definition/step/action identifiers with a mode selector. Specification closing may record explicit administrative authorization and exit-evaluation evidence, but that is NOT a workflow execution mode.

## Owned files

- packages/specflow-engine/src/specs/model.ts: new scaffold emits specification.yaml WITHOUT mode marker; audit overview.md generated metadata for outdated change-domain terms (avoid unrelated taxonomy migration).
- packages/specflow-engine/src/specs/repository.ts, canonical-source.ts and discovery/read projections: recognize exact allowed filename variants without guessing, rejecting an ambiguous directory with both manifest names.
- packages/specflow-engine/src/specs/create-scaffold.ts, specs/create/journal-{model,codec}.ts and specs/create/reservation.ts only as narrowly required to maintain v1/v2 creation intent recovery and stable fingerprint semantics.
- packages/specflow-engine/test/specifications.test.ts, create-journal-v2.test.ts, durable-create.test.ts and create-crash-recovery.test.ts for positive/negative persistence, retry, portability.
- Documentation: specification-creation.md, accepted workflow contracts only if inaccurate; never add a selectable mode or pretend one is implemented. No Runtime/CLI new feature required.

## Implementation and compatibility requirements

1. New artifacts use specs/{active|archive}/{slug}/specification.yaml; remove workflow.mode and its selector semantics in the scaffold for NEW operations; no replacement discriminator, toggle or default. Existing parser/read projections must not depend on this redundant field. Deterministic workflow execution remains the sole architecture direction.
2. **P1 recovery compatibility**: unfinished persisted Create v1/v2 journal entries were fingerprinted against bytes GENERATED WITH the marker, under the historical filename change.yaml. The present create-scaffold.ts reconstructs a scaffold and compares all hashes to immutable record.files. A naive generator-only edit makes old intent unrecoverable. Preserve exact old-byte replay for such existing journals while new reservations use marker-free output, with an explicit, validated scaffold format discriminator for new records OR another equally strict proven compatibility mechanism. Do not silently re-hash, overwrite, migrate or mutate existing journal identity. Avoid adding a speculative schema version unless necessary.
3. Completed earlier creation operations and existing manifests with historical change.yaml and the mode marker must remain readable and idempotently resolvable. The repository reader recognizes EXACTLY one of specification.yaml (new) or change.yaml (historical), never an active-first or filename-preference fallback that masks duplicates. If both exist, or symlinks, invalid identity or collision is detected, fail closed; do not silently rename, copy or delete committed user files. Never rewrite user-authored/committed manifests as a side-effect of create retry or closing. Any eventual physical cleanup of the marker in old manifests must be a separate explicit migration, not an implicit move to archive.
4. Audit code and documentation references to literal change.yaml (including CLI, Runtime read canonical documents, git diff path filters, test fixtures, generated index paths and overview metadata); update only those owned by the canonical manifest contract, retaining explicit historical-read path support. Update scaffold unit assertions to verify parsed YAML has NO workflow execution-mode property; don't conflate this with the required task/definition schema. Ensure cross-process SIGKILL/restart recovery of an old interrupted create and new field-free create, including SHA-256 provenance and identical operationId retry. Exercise v1 and v2 persisted journals, including manifest-writing/manifest-written recovery checkpoints.
5. Ensure new archive/move in T14 preserves a historical manifest filename if that is what source actually contains; explicit migration/normalization is a different operation and cannot be hidden in archive or close. Add a negative test that mismatched or tampered scaffold hashes are rejected rather than "made compatible" by replacing evidence; support Windows/POSIX where actual file/process cases are involved.

## Acceptance / verification

- New specification.yaml: stable specId, location, status and tasks; no workflow.mode key. Existing change.yaml manifest reads unchanged; no implicit rewrite or rename.
- Old CREATE journals: exact byte/fingerprint proof, safe operator-confirmed interrupted-operation recovery; no overwritten user file, duplicated spec/worktree or second change of operationId.
- Updated tests explicitly distinguish new scaffold shape/file path from historical journal renderer; reject both filenames together and wrong-case/redirected manifests on Windows and POSIX; verify failed/mismatched evidence stays blocked.
- Report modified modules, test IDs, OS/Node/Git versions, PASS/FAIL/SKIP, CI outcomes and independent checkpoint review.
- Gate IDs: LC30, LC34 and LC35–LC36 (test-plan.md). This task is a hard prerequisite for T10.
- No implementation of Specification workflow, Task/Attempt, Sessions or new execution mode.

## References

- [Plan 02](../README.md)
- [Closure design](../../../specification-and-worktree-close-design.md)
- [Spec creation](../../../specification-creation.md)
- [Test plan](../../../test-plan.md)

All temporary execution plans, including this task, must be removed before PR #53 merge per the program runbook.
