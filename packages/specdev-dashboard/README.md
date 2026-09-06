# `@nevo/specdev-dashboard`

The Nevo SpecDev **dashboard capability** package.

- **Scope.** One export — `runDashboard()` — returning a plain typed
  `DashboardResult`. It is framework-independent: no Commander, no argv, no
  stdout, no exit codes, no HTTP server. The public CLI
  ([`@nevo/specdev`](../specdev/README.md)) owns all of that; this package owns
  the capability.
- **Bootstrap only.** `runDashboard()` currently returns a deterministic marker
  (`Nevo SpecDev dashboard command is available.`). The real dashboard
  runtime / React / Vite / assets are **not** migrated yet. A later change swaps
  the body without touching the signature or the CLI boundary.
- **Distribution.** `private: true`. It is **never published or installed on its
  own** — `@nevo/specdev`'s packaging step bundles the built `dist/` into the
  product tarball (see [`docs/development/product-packaging.md`](../../docs/development/product-packaging.md)),
  so a consumer installs exactly one artifact. The source dependency stays a real
  `workspace:*` edge; only the distribution is single-artifact.

```
src/index.ts   runDashboard(): DashboardResult   (pure)
```
