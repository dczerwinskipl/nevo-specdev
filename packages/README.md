# `packages/`

Shared and publishable Nevo SpecDev libraries live here.

Nothing is here yet. This directory is reserved by the pnpm workspace
(`packages/*`) so the structure is stable before the product migration.

The intended **published** scope for product packages is `@nevo/*` (e.g. the future
`@nevo/specdev`). Repository-internal tooling stays **unscoped and private**
(`nevo-repo-docs` and similar under `tools/`) so it can never be confused with a
publishable package. Shared internal libraries — spec model, core utilities — arrive
here as real code is migrated, one reviewable pull request at a time.

No placeholder packages are created here to make the monorepo "look populated".
