---
id: product.shared.localization
type: product
title: Localization
status: current
read_when:
  - adding user-facing copy to the CLI or Dashboard
  - designing a message, label, or notification
  - planning the i18n runtime
summary: >
  Localization is a standing product requirement. The first release may be English-only,
  but all user-facing copy must be localizable and must not be scattered as hard-coded
  strings. The i18n library and locale-loading design are chosen when the UI/CLI reaches
  that concern.
related:
  - product.shared.terminology
  - product.cli.interaction-model
  - product.dashboard.interaction-model
---

# Localization

Localization / i18n is a **required product concern** for Nevo SpecDev, not a
post-launch nice-to-have — even though the first release can ship in English only.

## Requirements now

1. **Initial locale is English (`en`).** No other locales are required for the first
   release.
2. **All user-facing copy must be localizable.** Any string a user reads — CLI output,
   labels, table headers, error and validation messages, notifications, empty/warning
   states — must be authored so it can later be translated. This includes
   pluralization, number/date formatting, and interpolated values.
3. **Do not institutionalize scattered hard-coded strings.** User-facing copy must not
   be inlined ad hoc throughout components and command handlers. Route it through a
   single, replaceable seam (a message catalog / lookup) from the start, even if that
   seam initially just returns the English string.
4. **Diagnostic-only text is exempt.** Log lines, stack traces, and developer-facing
   debug output aimed at maintainers are not user-facing copy.

## Deferred to migration

- The concrete **i18n library** (e.g. an ICU MessageFormat implementation) and the
  **locale-loading architecture** (bundled vs. lazy, per-surface catalogs) are selected
  when the CLI/Dashboard code is migrated and this concern is actually exercised.
- **Do not add an i18n runtime dependency now** just to satisfy this document.

## CLI vs Dashboard

The CLI and Dashboard have different presentation constraints (line-oriented terminal
output vs. a rendered UI), so they may format differently. They **share product
terminology** — see [terminology](terminology.md) — and should share the underlying
message catalog keys where the same concept is shown on both.
