import { beforeEach, describe, expect, it } from 'vitest';

import { promoteRelease } from '../../src/app/promote.js';
import { versionFileText, type VersionFile } from '../../src/domain/version.js';
import { UsageError } from '../../src/errors.js';
import {
  createFakeGit,
  createFakeGitHub,
  type FakeGit,
  type FakeGitHub,
} from '../support/fakes.js';

const HEAD = 'head0000000000000000000000000000000000aa';
const BRANCH = 'release/v0.1';
const promoteBranch = (target: string): string => `chore/promote-0.1.0-to-${target}`;

let git: FakeGit;
let github: FakeGitHub;

/** On release/v0.1 with `version.json` = vf, local HEAD == origin/<branch>, CI green. */
function onReleaseBranch(vf: VersionFile): void {
  git = createFakeGit({ currentBranch: BRANCH, headSha: HEAD });
  git.state.commits.set(HEAD, {
    sha: HEAD,
    parents: [],
    files: { 'version.json': versionFileText(vf) },
  });
  git.state.refs.set(`origin/${BRANCH}`, HEAD);
  github = createFakeGitHub();
}

const deps = (hasToken = false) => ({ git, github, hasToken });
const run = (target: string, mutate: boolean, hasToken = false) =>
  promoteRelease({ target }, deps(hasToken), { mutate });
const msgs = (r: { events: { message: string }[] }): string =>
  r.events.map((e) => e.message).join('\n');

/** Seed a promotion branch: one commit on origin/<BRANCH> HEAD changing only version.json. */
function seedPromotionBranch(target: string, vf: VersionFile, parent = HEAD): string {
  const sha = git.addCommit({ parents: [parent], files: { 'version.json': versionFileText(vf) } });
  git.state.refs.set(`origin/${promoteBranch(target)}`, sha);
  git.state.remoteBranches.add(promoteBranch(target));
  return sha;
}

describe('promoteRelease — legal transitions', () => {
  it('beta -> rc: validate-only succeeds with zero mutation', async () => {
    onReleaseBranch({ channel: 'beta', version: '0.1.0' });
    const r = await run('rc', false, true);
    expect(msgs(r)).toMatch(/promote: \{ beta, 0\.1\.0 \} -> \{ rc, 0\.1\.0 \}/);
    expect(msgs(r)).toMatch(/Would create chore\/promote-0\.1\.0-to-rc/);
    expect(msgs(r)).toMatch(/Would open the PR/);
    expect(git.pushedBranches).toEqual([]);
    expect(github.createdPrs).toEqual([]);
  });

  it('beta -> rc: execute with token creates branch + PR + auto-merge', async () => {
    onReleaseBranch({ channel: 'beta', version: '0.1.0' });
    const r = await run('rc', true, true);
    expect(git.pushedBranches.map((p) => p.branch)).toEqual([promoteBranch('rc')]);
    expect(git.state.commits.get(git.pushedBranches[0]!.sha)?.files['version.json']).toContain(
      '"rc"',
    );
    expect(github.createdPrs).toEqual([
      expect.objectContaining({ head: promoteBranch('rc'), base: BRANCH }),
    ]);
    expect(github.autoMerged).toHaveLength(1);
    expect(msgs(r)).toMatch(/Auto-merge requested/);
  });

  it('rc -> stable: succeeds', async () => {
    onReleaseBranch({ channel: 'rc', version: '0.1.0' });
    await run('stable', true, true);
    expect(git.pushedBranches.map((p) => p.branch)).toEqual([promoteBranch('stable')]);
    expect(git.state.commits.get(git.pushedBranches[0]!.sha)?.files['version.json']).toContain(
      '"stable"',
    );
  });

  it('beta -> stable: rejected (skips rc)', async () => {
    onReleaseBranch({ channel: 'beta', version: '0.1.0' });
    await expect(run('stable', false, true)).rejects.toBeInstanceOf(UsageError);
    await expect(run('stable', true, true)).rejects.toThrow(/requires the branch to be 'rc' first/);
  });

  it('already in the target channel -> already promoted, no mutation', async () => {
    onReleaseBranch({ channel: 'rc', version: '0.1.0' });
    const r = await run('rc', true, true);
    expect(r.alreadyPromoted).toBe(true);
    expect(git.pushedBranches).toEqual([]);
    expect(msgs(r)).toMatch(/already promoted/);
  });

  it('branch already stable -> promotion to rc is refused with an explanation', async () => {
    onReleaseBranch({ channel: 'stable', version: '0.1.0' });
    await expect(run('rc', true, true)).rejects.toThrow(/already stable; run Release stable/);
  });
});

describe('promoteRelease — guards', () => {
  it('wrong branch -> UsageError', async () => {
    onReleaseBranch({ channel: 'beta', version: '0.1.0' });
    git.state.currentBranch = 'feature/x';
    await expect(run('rc', false)).rejects.toBeInstanceOf(UsageError);
  });

  it('stale local release HEAD vs origin -> rejected', async () => {
    onReleaseBranch({ channel: 'beta', version: '0.1.0' });
    git.state.refs.set(`origin/${BRANCH}`, 'moved00000000000000000000000000000000000a');
    await expect(run('rc', false, true)).rejects.toThrow(/behind or diverged/);
    await expect(run('rc', true, true)).rejects.toThrow(/behind or diverged/);
  });

  it('invalid --target -> UsageError', async () => {
    onReleaseBranch({ channel: 'beta', version: '0.1.0' });
    await expect(run('ga', false)).rejects.toBeInstanceOf(UsageError);
  });

  it('origin/<branch> has no version.json -> fail closed', async () => {
    onReleaseBranch({ channel: 'beta', version: '0.1.0' });
    git.state.commits.set(HEAD, { sha: HEAD, parents: [], files: {} });
    await expect(run('rc', false, true)).rejects.toThrow(/has no version\.json/);
  });
});

describe('promoteRelease — recovery / idempotency', () => {
  beforeEach(() => onReleaseBranch({ channel: 'beta', version: '0.1.0' }));

  it('existing valid promotion branch, no PR -> reuse + create PR only', async () => {
    seedPromotionBranch('rc', { channel: 'rc', version: '0.1.0' });
    await run('rc', true, true);
    expect(git.pushedBranches).toEqual([]);
    expect(github.createdPrs).toHaveLength(1);
  });

  it('existing valid promotion branch + open PR -> noop', async () => {
    seedPromotionBranch('rc', { channel: 'rc', version: '0.1.0' });
    github.state.openPrs.push({ head: promoteBranch('rc'), base: BRANCH, url: 'u' });
    const r = await run('rc', true, true);
    expect(git.pushedBranches).toEqual([]);
    expect(github.createdPrs).toEqual([]);
    expect(msgs(r)).toMatch(/verified and its PR is open/);
  });

  it('malformed promotion branch (unrelated file) -> fail closed', async () => {
    seedPromotionBranch('rc', { channel: 'rc', version: '0.1.0' });
    const bad = git.addCommit({
      parents: [HEAD],
      files: { 'version.json': versionFileText({ channel: 'rc', version: '0.1.0' }), 'z.txt': '1' },
    });
    git.state.refs.set(`origin/${promoteBranch('rc')}`, bad);
    await expect(run('rc', true, true)).rejects.toThrow(/not only version\.json/);
  });

  it('PR exists but branch missing -> fail closed', async () => {
    github.state.openPrs.push({ head: promoteBranch('rc'), base: BRANCH, url: 'u' });
    await expect(run('rc', true, true)).rejects.toThrow(/does not exist on origin/);
  });

  it('promotion PR merged (origin/<branch> already rc) -> already promoted', async () => {
    onReleaseBranch({ channel: 'rc', version: '0.1.0' });
    const r = await run('rc', true, true);
    expect(r.alreadyPromoted).toBe(true);
  });

  it('GitHub PR-list failure -> fail closed', async () => {
    github.state.failPrList = new Error('HTTP 502');
    await expect(run('rc', false, true)).rejects.toThrow(/HTTP 502/);
  });
});

describe('promoteRelease — token handoff + auto-merge failure', () => {
  beforeEach(() => onReleaseBranch({ channel: 'beta', version: '0.1.0' }));

  it('no CI_GITHUB_RELEASE_TOKEN -> branch pushed, exact PR command handed off', async () => {
    const r = await run('rc', true, false);
    expect(git.pushedBranches.map((p) => p.branch)).toEqual([promoteBranch('rc')]);
    expect(github.createdPrs).toEqual([]);
    expect(msgs(r)).toMatch(/CI_GITHUB_RELEASE_TOKEN/);
    expect(msgs(r)).toMatch(
      /gh pr create --base release\/v0\.1 --head chore\/promote-0\.1\.0-to-rc/,
    );
  });

  it('auto-merge unavailable (expected) -> stated accurately, PR still opened', async () => {
    github.state.autoMerge = 'unavailable';
    const r = await run('rc', true, true);
    expect(github.createdPrs).toHaveLength(1);
    expect(msgs(r)).toMatch(/Auto-merge not requested .*normal merge after CI/);
  });

  it('auto-merge unexpected error -> surfaced', async () => {
    github.state.autoMerge = new Error('HTTP 403: forbidden');
    await expect(run('rc', true, true)).rejects.toThrow(/HTTP 403/);
  });
});
