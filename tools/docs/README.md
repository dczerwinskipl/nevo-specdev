# `nevo-repo-docs` (`nevo-docs`)

Repository-internal documentation discovery. Private, never published, not the
`nevo-spec` product CLI (ADR 0005).

It reads the structured frontmatter on every `docs/**/*.md` file and answers
"which document should I read for this task?" deterministically — no product
knowledge is baked into the code.

## Commands

Run from the repository root:

```bash
pnpm docs:list                        # every indexed document (all statuses)
pnpm docs:find "git workflow"         # rank documents by a query (--status to filter)
pnpm docs:context "react tailwind"    # files to load for a task; deprecated/superseded excluded
pnpm docs:adr new "Use X for Y"       # create the next-numbered ADR as a draft
pnpm docs:check                       # validate the whole corpus + verify the index
pnpm docs:check --write               # also regenerate docs/index.generated.{md,json}
```

`context` feeds an AI agent, so it never recommends a `deprecated` or `superseded`
document — once one is excluded its replacement ranks first naturally. `list` and
`find` still show every status for historical lookup.

`adr new` writes the file at `status: draft` with `TODO:` placeholders and
regenerates the index. Fill the sections in, then set `status: current` when the
decision is adopted — `docs:check` rejects a `current` ADR that still has a TODO
placeholder summary. Titles are serialized through the YAML library, so `:`
/ `#` / quotes / accents in a title cannot corrupt the frontmatter; the slug is
still ASCII-only and deterministic.

Each command owns its own options (`nevo-docs find --help`, `nevo-docs adr new --help`):
`find` takes `--type` / `--status` / `--limit` / `--json`; `context` takes `--limit` /
`--json`; `adr new` takes `--dry-run` / `--json`; `check` takes `--write`.

`list` / `find` / `context` / `adr` load a **fully validated corpus** — if the docs are
inconsistent they fail loudly rather than serve partial context. `pnpm docs:check` is
what CI runs; it exits non-zero on any authored file missing frontmatter, invalid
frontmatter, an unresolved `related` id, an ADR whose filename and `id` disagree or
whose date is not ISO, a `current` ADR still carrying a generated `TODO` placeholder
**anywhere** (summary or body), or a stale index. The generated index carries no
timestamp, so `--write` twice with no source change leaves the tree clean.

## Architecture

TypeScript, `tsc` → `dist/`; the `nevo-docs` executable is `dist/bin.js`. Same layered
split as the other `tools/*` packages:

```
src/
  domain/     frontmatter contract · ADR authoring/validation · search · index build  (all pure)
  app/        load-corpus · find-documents · get-context · validate-documentation · create-adr
  infra/      doc-repository — the filesystem boundary (scan docs/, read/write index, write/remove ADR)
  cli/        thin Commander wiring; commands own their own options
  bin.ts      executable boundary — build deps, run the program, map errors to exit codes
```

The use cases run against a `DocRepository` port: `create-adr` (plan → validate in
memory → write → re-validate → roll the file back on failure → regenerate the index) is
driven by an in-memory repository in tests; a temp-dir test covers the real adapter.

## Frontmatter contract

```yaml
---
id: development.git-workflow # <area>.<slug>, unique across docs/
type: development # hub | development | product | architecture | adr
title: Git workflow
status: current # current | draft | deprecated | superseded
read_when: # non-empty for development/product/architecture
  - creating a branch
  - preparing a pull request
summary: >
  One or two sentences describing what the document covers.
related: # optional; each id must resolve
  - development.commit-conventions
---
```

An authored `docs/**/*.md` file with **no** frontmatter block is a `docs:check`
failure — it must not silently disappear from discovery. Only two things are exempt:
`docs/templates/**` (copy-me starters) and `*.generated.*` (owned by the generator).
