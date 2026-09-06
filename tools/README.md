# `tools/`

Repository-internal tooling. **Never** published, and never the future
`@nevo/specdev` product CLI.

| Directory    | Purpose                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `tools/docs` | `nevo-docs` — deterministic docs discovery/index for humans and agents. |

Anything here exists because it has real value for developing this repository
(documentation indexing, repository administration helpers, and similar). It is
part of the pnpm workspace (`tools/*`) and participates in the Turborepo task
graph like any other package.
