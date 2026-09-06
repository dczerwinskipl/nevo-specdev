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
pnpm docs:check                       # validate frontmatter + verify the index is current
pnpm docs:check --write               # regenerate docs/index.generated.{md,json}
```

`--type`, `--status`, `--limit` and `--json` are accepted where they make sense.
`pnpm docs:check` is what CI runs; it exits non-zero on **any** authored file missing
frontmatter, invalid frontmatter, an unresolved `related` id, or a stale index. The
generated index carries no timestamp, so `--write` run twice with no source change
leaves the working tree clean.

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
