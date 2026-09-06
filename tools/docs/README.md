# `nevo-repo-docs` (`nevo-docs`)

Repository-internal documentation discovery. Not published, not the `nevo-spec`
product CLI.

It reads the structured frontmatter on every `docs/**/*.md` file and answers
"which document should I read for this task?" deterministically — no product
knowledge is baked into the code.

## Commands

Run from the repository root:

```bash
pnpm docs:list                        # every indexed document
pnpm docs:find "git workflow"         # rank documents by a query
pnpm docs:context "react tailwind"    # print the files to load for a task
pnpm docs:adr new "Use X for Y"       # create the next-numbered ADR from the template
pnpm docs:check                       # validate the whole corpus + verify the index
pnpm docs:check --write               # also regenerate docs/index.generated.{md,json}
```

`--type`, `--status`, `--limit`, `--json` and (for `adr new`) `--dry-run` are accepted
where they make sense.

`list` / `find` / `context` / `adr` load a **fully validated corpus** — if the docs are
inconsistent they fail loudly rather than serve partial context. `pnpm docs:check` is
what CI runs; it exits non-zero on any authored file missing frontmatter, invalid
frontmatter, an unresolved `related` id, an ADR whose filename and `id` disagree or
whose date is not ISO, or a stale index. The generated index carries no timestamp, so
`--write` twice with no source change leaves the tree clean.

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
