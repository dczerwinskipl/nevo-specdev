# Security policy

Nevo SpecDev is maintained by a single person on a best-effort basis.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab → **Report a vulnerability**.
2. Describe the issue, affected files/versions, impact, and reproduction steps.

This opens a private advisory visible only to you and the maintainer. If you cannot use
that form, contact the maintainer via their GitHub profile.

## What to expect

This is a spare-time open-source project, so there is **no guaranteed response time**.
Reports are looked at as soon as is practical. In general:

- an acknowledgement once the report has been read;
- an assessment of severity and affected surface, or a request for more detail;
- for a confirmed issue in a maintained release line, a fix via the
  [hotfix flow](docs/development/releasing.md#hotfix-on-a-released-line) — a patch on
  the `release/vX.Y` branch, a `vX.Y.z` tag, and a forward-port to `main`;
- credit in the advisory and release notes unless you prefer otherwise.

If an issue is serious and unanswered, opening a minimal private advisory that just says
"please look at the earlier report" is fine.

## Scope

In scope: this repository's tooling (`tools/`, `scripts/`), CI workflows, and the
documented conventions.

Out of scope: issues in dependencies with no demonstrated impact here (report those
upstream — Dependabot already tracks advisories), and anything requiring a compromised
maintainer account or self-hosted runner.

## Supported versions

No versions are released yet. Once release lines exist, the supported `release/vX.Y`
lines will be listed here.
