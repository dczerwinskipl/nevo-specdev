---
id: product.cli.interaction-model
type: product
title: CLI interaction model
status: draft
read_when:
  - adding or changing a nevo-spec command
  - designing command output or exit codes
  - deciding how the CLI confirms a risky action
summary: >
  Command shape (nevo-spec <noun> <verb>), the stdout/stderr/exit-code contract shared
  with agents and CI, deterministic output, and how confirmations gate irreversible
  actions on the human path only.
related:
  - product.cli.personas
  - development.cli.node-tooling-guidelines
  - product.shared.localization
---

# CLI interaction model

`status: draft`. Product-level rules; implementation rules are in the
[Node tooling guidelines](../../development/cli/node-tooling-guidelines.md).

## Command shape

```text
nevo-spec <area> <action> [target] [--flags]

nevo-spec init
nevo-spec status
nevo-spec dashboard
nevo-spec task next
nevo-spec task start <change> <task>
```

Short, guessable, `<noun> <verb>` where there is more than one verb. The full command
set is defined with the implementation; this is only the shape it must follow. Whether
repository documentation discovery (today's `nevo-docs`) becomes part of the product CLI
is a separate decision, not implied here.

## Output contract

| Stream / code  | Carries                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| **stdout**     | The result only. A clean human summary by default; stable JSON with `--json`.                          |
| **stderr**     | Progress, warnings, diagnostics, error detail.                                                         |
| **exit 0**     | Success.                                                                                               |
| **exit non-0** | Failure — including "nothing to do" only when the caller asked for an action that cannot be performed. |

Machine-readable stdout stays free of decorative chatter. JSON field names are a
stable contract and are not localized; human text is localizable.

## Determinism

Same inputs and repository state ⇒ same output, including ordering. No dependence on
locale, wall-clock time (beyond explicitly-requested timestamps), or ambient env.

## Confirmations and safety

- Irreversible or outward-facing actions (finalize/merge, cut a release line, delete)
  require an explicit confirmation on the **interactive human path**.
- Agents and CI reach the same operations through explicit flags — never through a
  suppressed prompt. A command that would otherwise need interactive input, run
  non-interactively without the flag, **fails with a clear message**.
- The CLI never writes directly to a protected branch; it opens a PR.

## Next-action guidance

Status-style commands answer with **one** computed next action from a fixed table, not
a prose paragraph the reader has to interpret.
