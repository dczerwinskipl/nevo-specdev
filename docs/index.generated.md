<!-- GENERATED FILE — do not edit. Run: pnpm docs:check --write -->

# Documentation index

Regenerate with `pnpm docs:check --write`. Human-authored navigation lives in [`docs/README.md`](README.md).

## Hub

| ID | Title | Status | Summary |
|---|---|---|---|
| `docs.architecture-decisions-readme` | [Architecture Decision Records](architecture/decisions/README.md) | current | Index of ADRs. Each ADR captures one durable, cross-cutting decision, its context, and its consequences. |
| `docs.architecture-readme` | [Architecture documentation](architecture/README.md) | current | Durable technical boundaries and decision records. Not a place for implementation instructions — those belong in development/. |
| `docs.development-cli-readme` | [CLI & Node tooling documentation](development/cli/README.md) | current | Engineering guidance for Node-based command-line tools and developer tooling in this repository — architecture and testing. |
| `docs.development-readme` | [Development documentation](development/README.md) | current | Entry point for engineering work in this repository — process, Node tooling, testing, and UI implementation conventions. |
| `docs.development-ui-react-readme` | [React documentation](development/ui/react/README.md) | current | React implementation conventions — component composition, module organization, hooks, and state ownership. |
| `docs.development-ui-readme` | [UI engineering documentation](development/ui/README.md) | current | Cross-UI engineering guidance, then technology-specific conventions for React, Tailwind, and Storybook. Implementation only — product UX contracts live under product/dashboard/. |
| `docs.development-ui-storybook-readme` | [Storybook documentation](development/ui/storybook/README.md) | current | Storybook conventions — story hierarchy and naming, fixtures, interaction tests, and the agent visual-verification workflow. |
| `docs.development-ui-tailwind-readme` | [Tailwind documentation](development/ui/tailwind/README.md) | current | Tailwind CSS conventions — class composition pipeline, component variants, token usage, and the `@apply` policy. |
| `docs.product-cli-readme` | [CLI product documentation](product/cli/README.md) | current | The nevo-spec command-line product — who uses it and how it should behave. Node CLI implementation guidance is under development/cli/. |
| `docs.product-dashboard-readme` | [Dashboard product documentation](product/dashboard/README.md) | current | The Nevo SpecDev dashboard — who uses it, how navigation and surfaces behave, and how AI sessions are presented. React/Tailwind implementation guidance is under development/ui/. |
| `docs.product-readme` | [Product documentation](product/README.md) | current | What Nevo SpecDev is meant to do — product overview, shared terminology and localization, and the CLI and Dashboard interaction models. |
| `docs.product-shared-readme` | [Shared product concerns](product/shared/README.md) | current | Product concerns common to every surface — terminology and localization. The CLI and Dashboard must stay consistent with these. |
| `docs.readme` | [Nevo SpecDev documentation](README.md) | current | Top-level, human-authored map of the documentation, split by audience: development (how we build), product (what we build), architecture (durable decisions). |

## Architecture

| ID | Title | Status | Summary |
|---|---|---|---|
| `architecture.repository-structure` | [Repository structure](architecture/repository-structure.md) | current | Monorepo layout (apps/packages/tools), the Turborepo task graph, the CI affected-package model and what invalidates everything, the SemVer / release-line model, and the pre-1.0 policy. |

## Adr

| ID | Title | Status | Summary |
|---|---|---|---|
| `adr.0001-record-architecture-decisions` | [Record architecture decisions](architecture/decisions/0001-record-architecture-decisions.md) | current | Durable, cross-cutting decisions are recorded as lightweight numbered Markdown ADRs under docs/architecture/decisions/. |
| `adr.0002-toolchain-selection` | [Toolchain selection](architecture/decisions/0002-toolchain-selection.md) | current | The monorepo foundation is pnpm 10 + Turborepo + TypeScript + ESLint flat config (type-aware for TS) + Prettier + Vitest on Node Active LTS. Two versions are held back on purpose — pnpm (for GitHub Dependency Graph compatibility) and TypeScript (for the lint ecosystem) — each with an explicit upgrade condition. |
| `adr.0003-branch-and-release-model` | [Branch and release model](architecture/decisions/0003-branch-and-release-model.md) | current | main carries the next development version; short-lived feature/ and fix/ branches merge into it by squash-only PR; each maintained minor line has one long-lived release/vX.Y branch. The next-version choice (minor vs major) is always an explicit input. |
| `adr.0004-mit-license` | [MIT license](architecture/decisions/0004-mit-license.md) | current | The repository is licensed MIT — permissive, minimal obligations, sufficient for a public developer-tooling project. Provenance of any code migrated in from elsewhere is a separate per-migration review. |
| `adr.0005-repository-tooling-is-separate-from-the-product-api` | [Repository tooling is separate from the product API](architecture/decisions/0005-repository-tooling-is-separate-from-the-product-api.md) | current | Repository-internal developer tooling lives under `tools/*` as private, unscoped packages and never becomes a Nevo SpecDev product surface by default. Product capabilities are designed as `@nevo/*` packages and `nevo-spec` commands in their own right. |

## Development

| ID | Title | Status | Summary |
|---|---|---|---|
| `development.ci` | [Continuous integration](development/ci.md) | current | What the CI workflows run, how affected-package execution is scoped on PRs, which checks are required to merge, and what invalidates the whole graph. |
| `development.cli.node-tooling-guidelines` | [Node tooling guidelines](development/cli/node-tooling-guidelines.md) | current | Architecture for Node CLIs and developer tooling: thin external boundaries, cohesive capability modules, pure decision logic separated from I/O, lightweight DI, and a stable stdout/stderr/exit-code contract for agent automation. |
| `development.cli.testing-guidelines` | [Testing guidelines](development/cli/testing-guidelines.md) | current | Test stack (Vitest, with node:test acceptable for zero-dep tools), what to test at which boundary, determinism rules, and how tests fit the Turborepo task graph. |
| `development.commit-conventions` | [Commit conventions](development/commit-conventions.md) | current | Conventional Commits is the PR-title format (the squash commit message). Branch-local checkpoint commits are exempt. |
| `development.dependencies-and-security` | [Dependencies and security](development/dependencies-and-security.md) | current | How dependency updates arrive (Dependabot, grouped, weekly), how versions are pinned, the vulnerability-report path, the repository security features that are enabled, and when CodeQL should be added. |
| `development.git-workflow` | [Git workflow](development/git-workflow.md) | current | Branch model (main, feature/, fix/, release/v*), protected-branch rules, squash-merge policy, and how maintained release lines and hotfixes work. |
| `development.local-setup` | [Local setup](development/local-setup.md) | current | Prerequisites (Node, Corepack/pnpm), the standard root commands, and how Turborepo owns the task graph. |
| `development.pull-requests` | [Pull requests](development/pull-requests.md) | current | PR template, the merge gate on protected branches, and review expectations for a currently single-maintainer repository. |
| `development.releasing` | [Releasing and version lines](development/releasing.md) | current | The version model (version.json = channel + version), CI-derived build versions, the legal-transition gate, the cut-release-line and release workflows, the beta -> rc -> stable channel flow with an automatic post-stable advance, intentional prerelease tag sequences, and the pre-1.0 policy. |
| `development.ui.react.component-guidelines` | [React component guidelines](development/ui/react/component-guidelines.md) | draft | Small focused components, composition over configuration, split by responsibility not ceremony, feature-local vertical ownership, hooks by behavior, and where state lives. |
| `development.ui.storybook.guidelines` | [Storybook guidelines](development/ui/storybook/guidelines.md) | draft | Story hierarchy and naming (Foundations / Shared UI / Features / Screens), strict co-location, typed fixture factories, args-first state, play-function interaction tests, and the mandatory verification workflow. |
| `development.ui.tailwind.styling-guidelines` | [Tailwind styling guidelines](development/ui/tailwind/styling-guidelines.md) | draft | Class-composition pipeline: static local layout inline, reusable variants via cva, domain state resolved to a semantic tone before classes, explicit conditional composition, and a narrow @apply policy. |
| `development.ui.ui-ux-guidelines` | [UI/UX engineering guidelines](development/ui/ui-ux-guidelines.md) | draft | Portable engineering rules for building UI: validate the composed screen, semantic typography/color/spacing tokens, information hierarchy, progressive disclosure, and mandatory visual self-review. Product-specific UX (AI sessions, dashboard screens) is under product/dashboard/. |

## Product

| ID | Title | Status | Summary |
|---|---|---|---|
| `product.cli.interaction-model` | [CLI interaction model](product/cli/interaction-model.md) | draft | Command shape (nevo-spec <noun> <verb>), the stdout/stderr/exit-code contract shared with agents and CI, deterministic output, and how confirmations gate irreversible actions on the human path only. |
| `product.cli.personas` | [CLI personas](product/cli/personas.md) | draft | The three consumers of nevo-spec — the repository owner/maintainer, the AI coding agent, and CI — and what each needs from the command surface. |
| `product.dashboard.ai-session-ux` | [AI session UX](product/dashboard/ai-session-ux.md) | draft | How an AI session is presented: canonical semantics first, immediate turn feedback, "thinking" needs evidence, "waiting" is not "needs attention", and the four Work information levels. |
| `product.dashboard.interaction-model` | [Dashboard interaction model](product/dashboard/interaction-model.md) | draft | Responsive shell (wide with contextual inspector / narrow), the product navigation hierarchy, context-preserving drill-down, and when to use a tooltip vs. inspector vs. sheet vs. full page. |
| `product.dashboard.personas` | [Dashboard personas](product/dashboard/personas.md) | draft | Who uses the dashboard — the owner monitoring and steering work, and the reviewer checking a change — and what each needs from it. The dashboard observes and steers; it does not replace the CLI/PR workflow. |
| `product.product-overview` | [Product overview](product/product-overview.md) | draft | Nevo SpecDev is a human-led, spec-anchored workflow for AI-assisted software engineering, delivered as a CLI (nevo-spec), a dashboard, and a shared library. |
| `product.shared.localization` | [Localization](product/shared/localization.md) | current | Localization is a standing product requirement. The first release may be English-only, but all user-facing copy must be localizable and must not be scattered as hard-coded strings. The i18n library and locale-loading design are chosen when the UI/CLI reaches that concern. |
| `product.shared.terminology` | [Terminology](product/shared/terminology.md) | draft | Canonical product nouns for Nevo SpecDev — specification, change, task, review, session, work — with their meaning. Both surfaces use these terms; the message catalog keys follow them. |

