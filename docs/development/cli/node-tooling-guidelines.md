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
summary: >
  Architecture for Node CLIs and developer tooling: thin external boundaries, cohesive
  capability modules, pure decision logic separated from I/O, lightweight DI, and a
  stable stdout/stderr/exit-code contract for agent automation.
related:
  - development.cli.testing-guidelines
  - development.local-setup
---

# Node tooling guidelines

Portable architecture guidance for Node CLIs and repository tooling.

> These are **responsibilities, not a mandatory directory tree**. Example module names
> are illustrative. Prefer the smallest structural boundary that solves a real problem
> in testability, reuse, or process lifecycle.

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

A CLI entrypoint defines commands and options, parses and shape-validates input, maps
it to an application operation, renders output, and maps failures to exit codes. It does
**not** contain workflow orchestration or domain logic. A large command file that also
embeds every operation's implementation is a smell.

When two boundaries (e.g. a CLI and a future HTTP route) need the same operation, call a
shared function — do not spawn the tool's own CLI as a subprocess to reuse internal
behavior. Subprocesses are for genuine external executables (`git`, `gh`).

## 3. Organize by cohesive capability

Name modules after what they do (`scan.mjs`, `search.mjs`, `index-file.mjs`), not after
architectural vocabulary (`service.mjs`, `manager.mjs`, `utils.mjs`, `helpers.mjs`). A
catch-all file becomes the default dumping ground. Do not create "one file per
function" without an ownership benefit either.

## 4. File size is an inspection trigger, not an extraction reason

No hard LOC limits. A large, cohesive deterministic parser or state machine can stay in
one module. Refactor when there is a concrete problem: multiple independent
capabilities mixed together, I/O tangled with complex decision logic, multiple
lifecycle owners, or the module is hard to unit-test because of unrelated side effects.

## 5. Pure logic vs external I/O

Keep deterministic decision logic separate from effects where practical:

```js
const decision = evaluateReleaseCut(input, state);
await git.createBranch(decision.branch);
```

Pure logic is fast to test without mocks and reusable across boundaries. Do not wrap
every trivial `fs` call in an adapter when there is no testing or ownership benefit —
aim for explicit effect boundaries, not abstraction for its own sake.

## 6. External adapters

Give git / filesystem / provider access narrow, application-facing APIs
(`git.status()`, `git.diff(base, head)`, `files.readJson(path)`). Prefer argument
arrays over command-string concatenation. Normalize adapter output near the boundary
while preserving diagnostics on failure.

## 7. Dependency injection without a container

Explicit, lightweight DI via function arguments or factory functions:

```js
export function createCutReleaseLine({ git, files, clock }) {
  return async (input) => {
    /* ... */
  };
}
```

Inject external effects and nondeterministic sources (clock, UUID, provider
implementations, lifecycle-managed resources). Do not inject pure helpers. Do not add a
DI container.

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

- [ ] Is the CLI/HTTP boundary thin?
- [ ] Are modules grouped by cohesive capability, not catch-all nouns?
- [ ] Is file size used only as an inspection trigger?
- [ ] Is deterministic logic separated from I/O where it helps?
- [ ] Is DI explicit and lightweight, with no container?
- [ ] Do long-lived paths avoid blocking the event loop?
- [ ] Are child processes spawned with streaming / timeout / `AbortSignal` where needed?
- [ ] Are stdout / stderr / exit codes treated as a stable contract?
