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
    # Cut release/vX.Y off the current origin/main. Without --execute: validate only.
    # With it: validate origin/main's own version.json at the fetched base commit
    # (must be alpha on the release version), then create release/vX.Y and the
    # chore/bump-main-to-<next> branch by git plumbing (no working-tree changes), and
    # either open the main-bump PR (RELEASE_TOKEN present) or print the exact
    # `gh pr create` command. Env fallbacks: RELEASE_VERSION, NEXT_DEVELOPMENT_VERSION.

nevo-release create --channel beta|rc|stable [--execute]
    # Run on a release/vX.Y branch. Two independent idempotent phases:
    #   A. ensure the tag + its GitHub Release exist — the branch HEAD must have PASSED
    #      quality + test + build on GitHub (newest run per check); an orphaned last
    #      prerelease tag on HEAD is completed rather than skipped to N+1; a tag at a
    #      different commit is refused.
    #   B. for a stable release, ensure the branch advances to the next patch's beta —
    #      reached even when phase A was a no-op. PR already open -> nothing; branch
    #      missing -> create + hand off PR; valid branch, no PR -> reuse + create PR;
    #      inconsistent branch -> fail closed, never force-push.
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

Application code never touches `child_process`, `process`, or stdio. Errors:
`UsageError` (exit 2) / `InconsistentStateError` (exit 1), rendered only at the CLI
boundary; `--json` errors are structured.

## Tests

`vitest run` (affected-aware via `turbo run test`): domain units, application-level
orchestration against in-memory `GitClient` / `GitHubClient` fakes (the full
create-release and cut-release-line scenario matrices), and a subprocess CLI smoke
suite.
