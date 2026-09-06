# `nevo-repo-release`

Repository-internal release + version tooling. Private, never published, and never a
`nevo-spec` product surface (ADR 0005). The full flow is in
[`docs/development/releasing.md`](../../docs/development/releasing.md).

`version.json` at the repository root is `{ channel, version }` for whichever branch it
is on. SemVer parsing/compare is the `semver` package; only the channel/branch rules
are custom.

## Commands

TypeScript, `tsc` → `dist/`; the `nevo-release` executable is `dist/bin.js`. One
program, four subcommands, each owning its own options (`nevo-release <cmd> --help`):

```bash
nevo-release version [--with-sha]
    # CI build version from version.json + $GITHUB_* (run number 0 locally):
    # alpha/beta/rc -> <version>-<channel>.<run>; stable -> <version>; a tag ref -> its own version.

nevo-release check-transition [--json]
    # CI + local gate. A version.json change must be a legal transition (unchanged /
    # main-line bump / line cut / promotion) for the branch it lands on. The rules are
    # judged against the TARGET branch (PR base / pushed branch), never the head branch:
    # GITHUB_BASE_REF for a PR, the pushed branch (HEAD~1 base) for a push, or — locally —
    # inferred from the working-tree version.json channel (alpha -> main; a release
    # channel -> its origin/release/vX.Y). There is no BASE_REF override.

nevo-release cut-line --release-version X.Y.Z --next-development-version X.Y.Z [--execute]
    # Cut release/vX.Y off the current origin/main. ONE operation, explicit mutation
    # boundary: without --execute it runs EVERY read-only check (origin/main + its
    # version.json at the fetched base; an existing release/bump branch's *contents*;
    # PR state) and reports "would this succeed now?" — creating nothing. A dry run
    # that passes means the real run proceeds.
    #   - a prior run is recognised only by CONTENT: an existing release/vX.Y must be a
    #     single commit on an alpha <releaseVersion> base changing only version.json to
    #     beta <releaseVersion>; the bump branch (if present) the mirror on the same
    #     base. A merged bump PR (main already on the next alpha) = fully complete.
    #     Inconsistent contents -> fail closed, never overwritten / force-pushed.
    #   - with --execute: create both branches by git plumbing (no working-tree change),
    #     then open the main-bump PR (RELEASE_TOKEN present) or print the exact
    #     `gh pr create` command. Env fallbacks: RELEASE_VERSION, NEXT_DEVELOPMENT_VERSION.

nevo-release create --channel beta|rc|stable [--execute]
    # Run on a release/vX.Y branch. ONE operation, explicit mutation boundary: without
    # --execute it runs every read-only check and reports what would happen, changing
    # nothing. Checks (both modes):
    #   - after fetch, the local release-branch HEAD must equal origin/<branch> — a
    #     behind / diverged / unresolvable checkout is refused (§ stale checkout);
    #   - the branch HEAD must have PASSED quality + test + build on GitHub (newest run
    #     per check); an unreadable check-run response is refused;
    #   - Phase A — tag + GitHub Release: orphaned last prerelease tag on HEAD is
    #     completed, not skipped to N+1; a tag at a different commit is refused; if the
    #     Release state cannot be DETERMINED (auth/network/ambiguous) it fails closed,
    #     never assuming "absent".
    #   - Phase B (stable) — advance the branch, reached even when Phase A was a no-op.
    #     An existing advance branch is reused only when read-only Git inspection proves
    #     it is a single commit on the current origin/release/vX.Y HEAD changing only
    #     version.json to the expected next state. Extra file / wrong base / wrong
    #     content -> fail closed, never force-pushed, never turned into a PR.
    # Env fallbacks: RELEASE_CHANNEL, EXECUTE, RELEASE_TOKEN_PRESENT.
```

Root scripts `pnpm version:print` / `pnpm version:check-transition` call the built
`dist/bin.js`; the release / cut-release-line workflows build the package first.

## Architecture

```
src/
  domain/     version model · transitions · release/cut planning + decisions  (all pure)
  ports.ts    GitClient / GitHubClient interfaces
  infra/      git.ts (plumbing-based GitClient) · github.ts (gh CLI) · git-sync.ts (fast reads for the gate)
  app/        check-transition · build-version · cut-release-line · create-release  (use cases)
  cli/        thin Commander wiring; commands own their own options
  bin.ts      executable boundary
```

Application code never touches `child_process`, `process`, or stdio. `GitClient`
exposes only read-only history inspection (`commitParents`, `changedFiles`,
`showFileAtRef`, `resolveCommit`) plus the mutation methods, so the structural
recovery checks run without any plumbing writes. Errors: `UsageError` (exit 2) /
`InconsistentStateError` (exit 1), rendered only at the CLI boundary; `--json` errors
are structured. `GitHubClient` reads fail closed — an ambiguous `gh` failure never
reads as "resource absent".

## Tests

`vitest run` (affected-aware via `turbo run test`): domain units, application-level
orchestration against in-memory `GitClient` / `GitHubClient` fakes (the full
create-release and cut-release-line scenario matrices), and a subprocess CLI smoke
suite.
