---
id: development.dogfooding
type: development
title: Dogfooding the product build
status: current
read_when:
  - installing a local build of nevo-spec to use it elsewhere
  - checking that a packaging change did not break the installed CLI
summary: >
  `pnpm dogfood:install` builds the real distributable, packs it, installs THAT tarball
  globally with pnpm, and smokes the installed `nevo-spec`. It deliberately uses a
  tarball — not a workspace link — so it catches packaging problems a linked install
  would hide.
related:
  - development.product-packaging
  - adr.0006-product-ships-as-a-single-bundled-artifact
---

# Dogfooding the product build

```bash
pnpm dogfood:install
```

This is a **repository developer workflow**, not the future public
`nevo-spec install` / `nevo-spec update` (those are not designed yet — see
[repository-structure](../architecture/repository-structure.md)). It:

1. builds the packaging tool if needed, then runs
   [`pnpm product:pack`](product-packaging.md) (self-bootstrapping — no prior
   `pnpm build` / `pnpm check` required);
2. `pnpm add -g <the packed tarball>` — on the **repository-pinned pnpm** (every child
   `pnpm` runs from the repo root, so Corepack never downloads "latest");
3. puts pnpm's global bin dir on `PATH` and runs the **real installed `nevo-spec`
   executable shim** (the `.cmd` shim on Windows, the shell shim on Unix — not
   `node dist/bin.js`): `nevo-spec --version` (must equal the packed version),
   `nevo-spec --help` (must list `dashboard`), `nevo-spec dashboard` (must print the
   dashboard-capability marker);
4. fails with a diagnostic and a non-zero exit if pack or any smoke step fails.

## Why a tarball and not `pnpm link`

`pnpm link` / a `file:../nevo-specdev` dependency resolve through the workspace, so they
**hide** the exact failures a real install hits:

- a missing or wrong `files` allowlist (a needed file not shipped);
- a broken `bin` path, or `bin` pointing at `src`;
- a runtime dependency only present because of workspace hoisting;
- a `workspace:*` / `file:` dependency that cannot resolve off a registry;
- an `import` of a workspace-only module that was never bundled;
- invalid or drifted package metadata (version, `type`, `engines`).

Installing the packed `.tgz` is the only way to exercise the real distribution boundary,
so that is what `dogfood:install` does.

## After installing

`nevo-spec` is on `PATH` via pnpm's global bin dir (`pnpm bin -g`). From any other
directory:

```bash
nevo-spec --help
nevo-spec --version
nevo-spec dashboard      # bootstrap marker only — does not start the real dashboard yet
```

Remove it with `pnpm remove -g @nevo/specdev`.
