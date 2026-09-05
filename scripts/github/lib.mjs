// Thin wrapper around the `gh` CLI for the repository-administration scripts.
// Short-lived CLI use — synchronous execFile is fine here.

import { execFileSync } from 'node:child_process';

/**
 * Run `gh` with args, return stdout as a string. Throws with gh's stderr on failure.
 *
 * @param {string[]} args
 * @param {{ input?: string }} [opts]
 */
export function gh(args, opts = {}) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      input: opts.input,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (err) {
    const stderr = (err && err.stderr) || '';
    const stdout = (err && err.stdout) || '';
    throw new Error(`gh ${args.join(' ')} failed:\n${String(stderr || stdout).trim()}`, {
      cause: err,
    });
  }
}

/** `gh api` returning parsed JSON. `method` defaults to GET. */
export function ghApi(path, { method = 'GET', body } = {}) {
  const args = ['api', '-H', 'Accept: application/vnd.github+json', '--method', method, path];
  if (body !== undefined) args.push('--input', '-');
  const out = gh(args, { input: body === undefined ? undefined : JSON.stringify(body) });
  const trimmed = out.trim();
  return trimmed ? JSON.parse(trimmed) : undefined;
}

/** Abort unless `gh` is installed and authenticated. */
export function requireAuth() {
  try {
    gh(['auth', 'status']);
  } catch (err) {
    throw new Error(
      `GitHub CLI is not authenticated. Run \`gh auth login\` (needs repo-admin rights).\n${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err },
    );
  }
}

/** `owner/repo` for the checkout this script runs in. */
export function detectRepo() {
  return gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();
}

/**
 * Deep structural comparison of `actual` against `expected`, where `expected` is
 * a partial: every key in `expected` must be present and equal in `actual`, but
 * `actual` may have extra keys. Arrays must match element-for-element (recursing
 * with the same partial rule for objects).
 *
 * @returns {string[]} human-readable difference paths (empty ⇒ satisfied)
 */
export function diffPartial(expected, actual, path = '') {
  /** @type {string[]} */
  const diffs = [];
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      diffs.push(
        `${path || '(root)'}: expected array of ${expected.length}, got ${JSON.stringify(actual)}`,
      );
      return diffs;
    }
    expected.forEach((v, i) => diffs.push(...diffPartial(v, actual[i], `${path}[${i}]`)));
    return diffs;
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') {
      diffs.push(`${path || '(root)'}: expected object, got ${JSON.stringify(actual)}`);
      return diffs;
    }
    for (const [k, v] of Object.entries(expected)) {
      diffs.push(...diffPartial(v, actual[k], path ? `${path}.${k}` : k));
    }
    return diffs;
  }
  if (expected !== actual) {
    diffs.push(
      `${path || '(root)'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
  return diffs;
}
