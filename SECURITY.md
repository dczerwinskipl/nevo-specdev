# Security policy

Nevo SpecDev is early-stage. There is no released product yet, but the repository
tooling and workflows are public and we take reports seriously.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab → **Report a vulnerability**.
2. Describe the issue, affected files/versions, impact, and reproduction steps.

This opens a private advisory visible only to you and the maintainers. If you cannot use
that form, contact the maintainer listed on their GitHub profile.

## What to expect

- Acknowledgement within about **5 working days**.
- An initial assessment (severity, affected surface) and a plan or a request for more
  detail.
- For a confirmed issue in a maintained release line, a fix follows the
  [hotfix flow](docs/development/releasing.md#hotfix-on-a-released-line): a patch on the
  `release/vX.Y` branch, a `vX.Y.z` tag, and a forward-port to `main`.
- Credit in the advisory and release notes unless you ask otherwise.

## Scope

In scope: this repository's tooling (`tools/`, `scripts/`), CI workflows, and the
documented conventions.

Out of scope: hypothetical issues in dependencies without a demonstrated impact here
(report those upstream, and Dependabot already tracks advisories), and anything
requiring a compromised maintainer account or self-hosted runner.

## Supported versions

No versions are released yet. Once release lines exist, the table of supported
`release/vX.Y` lines will be maintained here.
