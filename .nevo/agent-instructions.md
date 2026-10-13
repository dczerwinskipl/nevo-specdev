# Nevo SpecFlow agent bootstrap

Nevo agent profiles are defined under `.nevo/agents/definitions/`. Provider-specific skills under `.claude/skills/` and `.agents/skills/` are generated projections and are not sources of truth.

A profile declares which selection modes it supports. Selection policy belongs to the current invocation or execution context, not to the profile itself:

- `explicit` — a user, workflow, or orchestrator names the profile;
- `automatic` — the caller/provider may choose an eligible profile from the task context when automatic selection is enabled for that invocation.

Automatic selection is a routing decision made before a profile becomes active. Once a profile is active for an invocation, do not switch profiles merely because later task wording resembles another profile. Deterministic workflow steps may always bind a profile explicitly when the profile supports `explicit`.

When the selected profile declares `knowledge.required`, load those exact stable document IDs first. Generated provider projections include the corresponding `pnpm docs:get ...` command.

When repository rules may affect the work beyond that required baseline, identify the technologies and activities involved and query the documentation index with all relevant terms together, for example:

```bash
pnpm docs:find react git testing
```

`docs:find` is deterministic lexical OR search: every document matching at least one query term is returned unless an explicit `--limit` is supplied. Inspect the result metadata and load the documents that apply to the current work. Use exact stable IDs when a profile, workflow, or another document gives them explicitly:

```bash
pnpm docs:get engineering.repository.git-workflow engineering.shared.testing
```

`docs:get` fails closed for `deprecated` and `superseded` documents. Replace an inactive ID with its current authoritative successor before continuing.

Do not infer repository-specific rules when no matching documentation exists. Prefer the authoritative document over duplicated guidance in prompts or generated skills.

When the user requests an end-to-end screen design or delivery process, select `nevo-agents:screen-coordinator` for the coordinating invocation. The coordinator owns scope and handoffs; specialist profiles retain their own responsibilities. The profile does not itself provide agent spawning or automatic session switching.
