#!/usr/bin/env node
// Create a Git tag + GitHub Release for the current release branch, in one of
// three channels: beta | rc | stable. No npm publishing.
//
//   node scripts/release/release.mjs --channel beta [--execute]
//
// Inputs may also come from the environment (RELEASE_CHANNEL, EXECUTE).
//
// Run only on a `release/vX.Y` branch. The tag is created at that branch's HEAD;
// stable/RC tags never come from `main`.

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  isReleaseTagVersion,
  lineOfBranch,
  nextPrereleaseTag,
  readVersionFile,
  versionInLine,
} from './version.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Decide which tag to create. Pure — no git, no network.
 *
 * @param {object} o
 * @param {string} o.branch          current branch, e.g. `release/v1.3`
 * @param {'beta'|'rc'|'stable'} o.channel   requested release channel
 * @param {{channel:string,version:string}} o.versionFile   version.json on the branch
 * @param {string[]} o.existingTags  every tag name in the repo
 * @returns {{ errors: string[], tag?: string, prerelease?: boolean, version?: string }}
 */
export function planRelease({ branch, channel, versionFile, existingTags }) {
  /** @type {string[]} */ const errors = [];

  const line = lineOfBranch(branch);
  if (!line) {
    errors.push(`Releases must be cut from a release/vX.Y branch, not '${branch}'.`);
    return { errors };
  }
  if (!['beta', 'rc', 'stable'].includes(channel)) {
    errors.push(`--channel must be one of beta, rc, stable (got ${JSON.stringify(channel)}).`);
    return { errors };
  }
  if (!versionInLine(versionFile.version, line)) {
    errors.push(
      `version.json version ${versionFile.version} does not belong to line ${line} (branch ${branch}).`,
    );
  }
  if (versionFile.channel !== channel) {
    errors.push(
      `Branch is in channel '${versionFile.channel}', not '${channel}'. Promote the branch ` +
        `first — merge a PR that sets version.json to this channel ` +
        `(see docs/development/releasing.md).`,
    );
  }
  if (errors.length) return { errors };

  const version = versionFile.version;
  const tags = (existingTags ?? []).map((t) => String(t).trim());

  if (channel === 'stable') {
    const tag = `v${version}`;
    if (tags.includes(tag)) errors.push(`Tag ${tag} already exists.`);
    return errors.length ? { errors } : { errors, tag, prerelease: false, version };
  }

  const tag = nextPrereleaseTag({ version, channel, existingTags: tags });
  if (!isReleaseTagVersion(tag.replace(/^v/, ''))) {
    errors.push(`Computed tag ${tag} is not a valid release tag.`);
  }
  if (tags.includes(tag)) errors.push(`Tag ${tag} already exists (unexpected).`);
  return errors.length ? { errors } : { errors, tag, prerelease: true, version };
}

// ── side effects ────────────────────────────────────────────────────────────

function git(args) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function gh(args) {
  return execFileSync('gh', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  const { values } = parseArgs({
    options: {
      channel: { type: 'string' },
      execute: { type: 'boolean', default: false },
    },
  });
  const channel = values.channel ?? process.env.RELEASE_CHANNEL ?? '';
  const execute = values.execute || process.env.EXECUTE === 'true';

  const out = (m) => process.stdout.write(`${m}\n`);
  const die = (m) => {
    process.stderr.write(`${m}\n`);
    process.exit(1);
  };

  git(['fetch', 'origin', '--tags', '--prune']);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const versionFile = readVersionFile();
  const existingTags = git(['tag', '--list']).split('\n').filter(Boolean);

  const plan = planRelease({ branch, channel, versionFile, existingTags });
  if (plan.errors.length) die(`Cannot release:\n  - ${plan.errors.join('\n  - ')}`);

  out('Plan');
  out(`  branch     : ${branch}`);
  out(`  channel    : ${channel}`);
  out(`  tag        : ${plan.tag}${plan.prerelease ? '  (prerelease)' : ''}`);

  if (!execute) {
    out('\n--execute not set: validated only, no tag created.');
    process.exit(0);
  }

  const headSha = git(['rev-parse', 'HEAD']);
  git(['tag', '-a', plan.tag, '-m', plan.tag, headSha]);
  git(['push', 'origin', `refs/tags/${plan.tag}`]);
  out(`\nTagged ${plan.tag} at ${headSha.slice(0, 7)}`);

  const args = [
    'release',
    'create',
    plan.tag,
    '--verify-tag',
    '--title',
    plan.tag,
    '--generate-notes',
  ];
  if (plan.prerelease) args.push('--prerelease');
  const url = gh(args);
  out(`Published GitHub Release: ${url}`);
  out('(No npm package is published — that is out of scope.)');
}
