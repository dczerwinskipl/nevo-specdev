// Deterministic version derivation from version.json + CI environment.
// Pure logic is exported for tests; the CLI at the bottom wires in env + argv.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const SEMVER_CORE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** @param {string} v @returns {boolean} true for a bare `X.Y.Z` core version */
export function isSemverCore(v) {
  return typeof v === 'string' && SEMVER_CORE.test(v);
}

/** `1.4.7` -> `{ major: 1, minor: 4, patch: 7 }` */
export function parseSemverCore(v) {
  const m = SEMVER_CORE.exec(v);
  if (!m) throw new Error(`Not a plain SemVer version: ${JSON.stringify(v)}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Minor-line branch name for a version: `1.4.7` -> `release/v1.4` */
export function releaseBranchFor(version) {
  const { major, minor } = parseSemverCore(version);
  return `release/v${major}.${minor}`;
}

/** @typedef {{ development: { line: string, channel: string }, releaseLines: Array<{branch:string,version:string,status?:string}> }} VersionMeta */

/** @returns {VersionMeta} */
export function readVersionMeta(root = REPO_ROOT) {
  const meta = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'));
  if (!meta.development || !isSemverCore(meta.development.line)) {
    throw new Error("version.json: 'development.line' must be a plain SemVer version");
  }
  if (!meta.development.channel) {
    throw new Error("version.json: 'development.channel' is required (e.g. 'alpha')");
  }
  if (!Array.isArray(meta.releaseLines)) {
    throw new Error("version.json: 'releaseLines' must be an array");
  }
  return meta;
}

/**
 * Derive the full version string.
 *
 * - `main` (and anything not on a release branch): `<line>-<channel>.<build>`,
 *   optionally `+<sha>` when a short commit id is supplied.
 * - `release/vX.Y`: the exact `version` recorded for that line in version.json —
 *   release builds are not prerelease-stamped.
 *
 * @param {object} opts
 * @param {VersionMeta} opts.meta
 * @param {string} [opts.ref]   git ref, e.g. `refs/heads/main` or `refs/heads/release/v1.3`
 * @param {number|string} [opts.build]  deterministic build number (GitHub run number)
 * @param {string} [opts.sha]   short commit id for build metadata (optional)
 * @returns {string}
 */
export function deriveVersion({ meta, ref = '', build = 0, sha = '' } = {}) {
  const branch = ref.replace(/^refs\/heads\//, '');

  if (branch.startsWith('release/v')) {
    const line = meta.releaseLines.find((l) => l.branch === branch);
    if (!line) throw new Error(`No entry in version.json#releaseLines for '${branch}'`);
    if (!isSemverCore(line.version)) {
      throw new Error(`version.json#releaseLines '${branch}': 'version' must be plain SemVer`);
    }
    return line.version;
  }

  const buildNum = Number(build);
  if (!Number.isInteger(buildNum) || buildNum < 0) {
    throw new Error(`build must be a non-negative integer, got ${JSON.stringify(build)}`);
  }
  const base = `${meta.development.line}-${meta.development.channel}.${buildNum}`;
  return sha ? `${base}+${sha}` : base;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function isMain() {
  return fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  try {
    const meta = readVersionMeta();
    const ref = process.env.GITHUB_REF ?? '';
    const build = process.env.GITHUB_RUN_NUMBER ?? '0';
    const rawSha = process.env.GITHUB_SHA ?? '';
    const sha = process.argv.includes('--with-sha') && rawSha ? rawSha.slice(0, 7) : '';
    process.stdout.write(`${deriveVersion({ meta, ref, build, sha })}\n`);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}
