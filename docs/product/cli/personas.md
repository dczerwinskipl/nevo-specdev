---
id: product.cli.personas
type: product
title: CLI personas
status: draft
read_when:
  - designing a nevo-spec command or its output
  - deciding whether a feature belongs in the CLI or the Dashboard
summary: >
  The three consumers of nevo-spec — the repository owner/maintainer, the AI coding
  agent, and CI — and what each needs from the command surface.
related:
  - product.cli.interaction-model
  - product.dashboard.personas
---

# CLI personas

`status: draft`. Three consumers, deliberately different needs.

## 1. Repository owner / maintainer (human, interactive)

Drives the workflow from a terminal: create and refine a spec, approve a task, check
status, cut a release line, open the dashboard. Wants concise, scannable output; clear
next-action guidance; and no irreversible action without an explicit confirmation.

## 2. AI coding agent (non-interactive)

Runs `nevo-spec` to discover the next task, load the declared context, start/verify a
task, and find documentation. Depends on a **stable output contract**: clean
machine-readable stdout (`--json`), diagnostics on stderr, meaningful exit codes, and
deterministic ordering. Never prompts; a command that would need input fails with a
clear message instead.

## 3. CI (non-interactive, automated)

Runs a narrow set of validation/verification commands (`nevo-spec ... --check`, docs
validation). Needs a fast, deterministic pass/fail and a non-zero exit on any problem.
Must never mutate protected state.

## Design implications

- Every command that produces data supports `--json`.
- Human-facing text is localizable ([localization](../shared/localization.md)); JSON
  field names are a stable contract and are **not** localized.
- Interactive confirmations exist only on the human path; the agent/CI paths reach the
  same operations through explicit flags, never a hidden prompt.
