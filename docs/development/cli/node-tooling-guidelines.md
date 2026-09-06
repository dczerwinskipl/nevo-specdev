---
id: development.cli.node-tooling-guidelines
type: development
title: Node tooling guidelines
status: current
read_when:
  - creating or restructuring a Node CLI command
  - changing Node-based developer tooling
  - running git, filesystem, or child-process operations from Node
  - deciding how a tool should print output and set exit codes
  - designing the nevo-spec product CLI
summary: >
  Architecture for Node CLIs and developer tooling: Commander for multi-command CLIs, a
  thin executable, command-local options, use cases separate from handlers, explicit
  filesystem/git/gh I/O ports, TypeScript-first, and a stable stdout/stderr/exit-code
  contract for agent automation.
related:
  - development.cli.testing-guidelines
  - development.local-setup
---

# Node tooling guidelines

Portable architecture guidance for Node CLIs and repository tooling. The three packages
under `tools/` are the reference implementations; the future `nevo-spec` product CLI is
expected to follow the same shape.

> These are **responsibilities, not a mandatory directory tree**. Prefer the smallest
> structural boundary that solves a real problem in testability, reuse, or process
> lifecycle — but do not re-litigate the settled choices in §0.

## 0. Settled choices

- **Commander** for any multi-command CLI. Use it directly and lightly — no custom
  router, no `parseArgs` + `switch (command)` for a subcommand tree, no wrapper
  framework over Commander. `node:util` `parseArgs` is acceptable only for a genuinely
  single-purpose one- or two-flag script.
- **TypeScript**, strict, `tsc` emitting to `dist/`; the `bin` points at the built
  artifact. Tests are typechecked too.
- **One executable, subcommands** (`nevo-release version`, `nevo-release create`, …) —
  not several `bin` entries.
- **Command-local options.** Each command declares only the arguments and options it
  uses, in its own file, so `--help` is coherent. No global option bag shared by
  unrelated commands.
- A **layered** `src/` — `domain/` (pure), `ports.ts` (the interfaces the use cases
  depend on), `infra/` (real adapters over fs / `git` / `gh`), `app/` (use cases,
  return typed results), `cli/` (thin Commander wiring), `bin.ts` (the boundary). Names
  may be compressed; the responsibility split is the point.

## 1. Conceptual flow

```text
external boundary (CLI args / HTTP / event)
        ↓
application use case / orchestration
        ↓
pure policy / transformation / state logic
        ↓
explicit external dependencies (fs / git / child process / network)
```

Do not force commands through `Command → Handler → Service → Manager → Repository`
forwarding chains. Introduce a boundary only when it owns an observable responsibility.

## 2. External boundaries are thin

`bin.ts` does four things: construct dependencies, build the Commander program,
`parseAsync(argv)`, and map a thrown error to an exit code. It contains no scanning,
planning, git/gh orchestration, or business validation. Run Commander with
`.exitOverride()` so `--help` and parse errors are catchable, not `process.exit`.

A **command handler** maps `CLI args → application use case → typed result → presenter
output`. The use case (`createAdr(...)`, `executeRelease(...)`) is a plain function,
directly testable without `process.argv` or Commander — a handler that itself does
`readdir` + render + validate + write + rollback is a smell.

When two boundaries (e.g. a CLI and a future HTTP route) need the same operation, call a
shared function — do not spawn the tool's own CLI as a subprocess to reuse internal
behavior. Subprocesses are for genuine external executables (`git`, `gh`).

## 3. Organize by cohesive capability

Within a layer, name modules after what they do (`search.ts`, `index-file.ts`,
`create-release.ts`), not after architectural vocabulary (`service.ts`, `manager.ts`,
`utils.ts`, `helpers.ts`). A catch-all file becomes the default dumping ground. Do not
create "one file per function" without an ownership benefit either.

## 4. File size is an inspection trigger, not an extraction reason

No hard LOC limits. A large, cohesive deterministic parser or state machine can stay in
one module. Refactor when there is a concrete problem: multiple independent
capabilities mixed together, I/O tangled with complex decision logic, multiple
lifecycle owners, or the module is hard to unit-test because of unrelated side effects.

## 5. Pure logic vs external I/O

Keep deterministic decision logic separate from effects where practical:

```ts
const plan = planReleaseCut({ releaseVersion, nextDevelopmentVersion });
if (!plan.ok) throw new UsageError(plan.errors.join('\n'));
await executeReleaseCut(plan, { git, github, hasToken });
```

Pure logic is fast to test without mocks and reusable across boundaries. Wrap the
tool's whole filesystem / git / gh surface behind **one port each** (`DocRepository`,
`GitClient`, `GitHubClient`) — not one interface per `fs` call — so the use cases can be
driven by an in-memory fake and a temp-dir test can still cover the real adapter.

## 6. External adapters

Give git / filesystem / provider access narrow, application-facing APIs
(`git.status()`, `git.diff(base, head)`, `files.readJson(path)`). Prefer argument
arrays over command-string concatenation. Normalize adapter output near the boundary
while preserving diagnostics on failure.

## 7. Dependency injection without a container

Explicit, lightweight DI via function arguments or a small context object:

```ts
export async function executeRelease(
  plan: ValidReleasePlan,
  deps: { git: GitClient; github: GitHubClient; hasToken: boolean },
): Promise<{ events: ActionEvent[] }> {
  /* ... */
}
```

Inject external effects and nondeterministic sources (git, gh, filesystem, clock).
`bin.ts` constructs the real adapters once and passes them down. Do not inject pure
helpers. Do not add a DI container.

## 8. Async policy

Short-lived CLI commands may use synchronous, bounded operations (`readFileSync`, small
checks) when that is materially simpler and no streaming/concurrency/cancellation is
needed. Long-lived server code must never block the event loop: use async child-process
and I/O APIs, stream progress, propagate `AbortSignal`, and clean up child processes,
timers and listeners on completion or disconnect.

## 9. Child processes

`execFile` (async) for a known executable with bounded output; `spawn` for
long-running, streamed, or cancellable work. Avoid shell execution unless pipelines or
expansion are genuinely required. Handle startup errors, avoid double-completion
between `error` and `close`, and preserve exit-code/signal diagnostics.

## 10. Output is an external contract

Especially when AI agents run the command:

- **stdout** — primary results: a clean human summary, or stable machine-readable
  JSON/YAML. Keep it free of diagnostic chatter.
- **stderr** — warnings, progress, diagnostics, error detail.
- **exit code** — `0` success, non-zero failure. Prefer `process.exitCode = 1` over
  `process.exit()` so pending writes flush.

Deep application modules must not write to `console.*`, call `process.exit()`, set
`process.exitCode`, or build HTTP responses — they return results or throw structured
errors, and the boundary maps them. Use `code: "SOMETHING"` on errors when callers need
to distinguish categories.

## Review checklist

- [ ] Multi-command CLI on Commander, one executable with subcommands, options declared per command?
- [ ] Is `bin.ts` just deps + program + parse + error→exit?
- [ ] Do handlers call a use case rather than embed the implementation?
- [ ] Is the fs / git / gh surface behind one port each, with an in-memory fake in tests?
- [ ] Is deterministic logic separated from I/O where it helps?
- [ ] Is DI explicit and lightweight, with no container?
- [ ] TypeScript strict, tests typechecked, no broad `any`?
- [ ] Are stdout / stderr / exit codes treated as a stable contract; `--json` clean on stdout?
