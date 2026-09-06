import { beforeEach, describe, expect, it } from 'vitest';

import { executeRelease } from '../../src/app/create-release.js';
import { versionFileText, type VersionFile } from '../../src/domain/version.js';
import { InconsistentStateError, UsageError } from '../../src/errors.js';
import {
  createFakeGit,
  createFakeGitHub,
  greenChecks,
  type FakeGit,
  type FakeGitHub,
} from '../support/fakes.js';

const HEAD = 'head0000000000000000000000000000000000aa';
const BASE = 'base0000000000000000000000000000000000bb';
const RELEASE_BRANCH = 'release/v1.3';
const ADVANCE_BRANCH = 'chore/advance-release-v1.3-to-1.3.1';

let git: FakeGit;
let github: FakeGitHub;

/** Standard: on release/v1.3, local HEAD == origin/release/v1.3, CI green. */
function onReleaseBranch(vf: VersionFile): void {
  git = createFakeGit({ currentBranch: RELEASE_BRANCH, headSha: HEAD });
  git.state.commits.set(BASE, {
    sha: BASE,
    parents: [],
    files: { 'version.json': versionFileText({ channel: 'stable', version: '1.3.0' }) },
  });
  git.state.commits.set(HEAD, {
    sha: HEAD,
    parents: [BASE],
    files: { 'version.json': versionFileText(vf) },
  });
  git.state.refs.set(`origin/${RELEASE_BRANCH}`, HEAD);
  github = createFakeGitHub();
}

const deps = (hasToken = false) => ({ git, github, hasToken });

const run = (channel: string, mutate: boolean, hasToken = false) =>
  executeRelease({ channel }, deps(hasToken), { mutate });

const msgs = (r: { events: { message: string }[] }): string =>
  r.events.map((e) => e.message).join('\n');

describe('executeRelease — validate-only parity + §2 local/remote HEAD', () => {
  beforeEach(() => onReleaseBranch({ channel: 'beta', version: '1.3.0' }));

  it('a wrong channel is a UsageError in both modes', async () => {
    await expect(run('ga', false)).rejects.toBeInstanceOf(UsageError);
    await expect(run('ga', true)).rejects.toBeInstanceOf(UsageError);
  });

  it('CI not green on HEAD is refused in validate-only AND execute', async () => {
    github.state.checkRuns = [
      { name: 'quality', status: 'completed', conclusion: 'success', id: 1 },
      { name: 'test', status: 'completed', conclusion: 'failure', id: 2 },
      { name: 'build', status: 'completed', conclusion: 'success', id: 3 },
    ];
    await expect(run('beta', false)).rejects.toBeInstanceOf(InconsistentStateError);
    await expect(run('beta', true)).rejects.toBeInstanceOf(InconsistentStateError);
    expect(git.createdTags).toEqual([]);
  });

  it('a stale local HEAD (behind/diverged from origin) is refused before any mutation', async () => {
    git.state.refs.set(`origin/${RELEASE_BRANCH}`, BASE); // remote moved past local HEAD
    await expect(run('beta', false)).rejects.toThrow(/is not origin\/release\/v1\.3/);
    await expect(run('beta', true)).rejects.toThrow(/is not origin\/release\/v1\.3/);
    expect(git.createdTags).toEqual([]);
  });

  it('an unresolvable origin/<branch> fails closed', async () => {
    git.state.refs.delete(`origin/${RELEASE_BRANCH}`);
    await expect(run('beta', true)).rejects.toThrow(/Cannot resolve origin\/release\/v1\.3/);
  });

  it('validate-only performs the tag/Release inspection and makes zero mutations', async () => {
    const r = await run('beta', false);
    expect(msgs(r)).toMatch(/Would create annotated tag v1\.3\.0-beta\.1/);
    expect(msgs(r)).toMatch(/Would create the GitHub Release for v1\.3\.0-beta\.1/);
    expect(git.createdTags).toEqual([]);
    expect(git.pushedBranches).toEqual([]);
    expect(github.createdReleases).toEqual([]);
  });

  it('execute performs the same steps for real', async () => {
    await run('beta', true);
    expect(git.createdTags).toEqual([{ tag: 'v1.3.0-beta.1', sha: HEAD }]);
    expect(github.createdReleases).toEqual(['v1.3.0-beta.1']);
  });
});

describe('executeRelease — Phase A recovery + fail-closed GitHub reads', () => {
  beforeEach(() => onReleaseBranch({ channel: 'beta', version: '1.3.0' }));

  it('orphan beta.1 on HEAD, Release missing -> completes beta.1 (execute), described in dry-run', async () => {
    git.state.tags.set('v1.3.0-beta.1', HEAD);
    const dry = await run('beta', false);
    expect(msgs(dry)).toMatch(/creating the missing GitHub Release/);
    expect(msgs(dry)).toMatch(/Would create the GitHub Release for v1\.3\.0-beta\.1/);
    expect(github.createdReleases).toEqual([]);

    onReleaseBranch({ channel: 'beta', version: '1.3.0' });
    git.state.tags.set('v1.3.0-beta.1', HEAD);
    await run('beta', true);
    expect(git.createdTags).toEqual([]);
    expect(github.createdReleases).toEqual(['v1.3.0-beta.1']);
  });

  it('an orphan prerelease tag sitting on a different commit is not reused -> next number', async () => {
    git.state.tags.set('v1.3.0-beta.1', 'elsewhere00000000000000000000000000000000');
    await run('beta', true);
    // beta.1 is elsewhere and has no Release -> do not reuse it, cut beta.2.
    expect(git.createdTags).toEqual([{ tag: 'v1.3.0-beta.2', sha: HEAD }]);
  });

  it('an ambiguous GitHub Release read (auth/network) fails closed, never "absent"', async () => {
    github.state.failReleaseView = new Error('HTTP 401: bad credentials');
    await expect(run('beta', false)).rejects.toThrow(
      /Could not determine the GitHub Release state/,
    );
    await expect(run('beta', true)).rejects.toThrow(/Could not determine the GitHub Release state/);
  });

  it('an unreadable check-run response fails closed', async () => {
    github.state.failCheckRuns = new Error('could not parse check-run data');
    await expect(run('beta', true)).rejects.toThrow(/could not parse check-run data/);
  });
});

describe('executeRelease — Phase B (stable advance) structural validation §3', () => {
  const NEXT: VersionFile = { channel: 'beta', version: '1.3.1' };

  beforeEach(() => onReleaseBranch({ channel: 'stable', version: '1.3.0' }));

  const seedAdvance = (files: Record<string, string>, parent = HEAD): string => {
    const sha = git.addCommit({ parents: [parent], files });
    git.state.refs.set(`origin/${ADVANCE_BRANCH}`, sha);
    git.state.remoteBranches.add(ADVANCE_BRANCH);
    return sha;
  };
  const releaseFiles = () => git.state.commits.get(HEAD)!.files;

  it('fresh stable: dry-run describes tag+release+advance and mutates nothing', async () => {
    const r = await run('stable', false, true);
    expect(msgs(r)).toMatch(/Would create annotated tag v1\.3\.0/);
    expect(msgs(r)).toMatch(/Would create chore\/advance-release-v1\.3-to-1\.3\.1/);
    expect(msgs(r)).toMatch(/Would open the branch-advance PR/);
    expect(git.createdTags).toEqual([]);
    expect(git.pushedBranches).toEqual([]);
    expect(github.createdPrs).toEqual([]);
  });

  it('the stable tag already exists at a different commit -> fails closed', async () => {
    git.state.tags.set('v1.3.0', 'elsewhere00000000000000000000000000000000');
    await expect(run('stable', false, true)).rejects.toThrow(/different commit/);
    await expect(run('stable', true, true)).rejects.toThrow(/different commit/);
    expect(git.pushedBranches).toEqual([]);
  });

  it('fresh stable with token: tags, releases, pushes the advance branch and opens the PR', async () => {
    await run('stable', true, true);
    expect(git.createdTags).toEqual([{ tag: 'v1.3.0', sha: HEAD }]);
    expect(github.createdReleases).toEqual(['v1.3.0']);
    expect(git.pushedBranches.map((p) => p.branch)).toEqual([ADVANCE_BRANCH]);
    expect(github.createdPrs).toEqual([
      expect.objectContaining({ head: ADVANCE_BRANCH, base: RELEASE_BRANCH }),
    ]);
  });

  it('§9: phase A already complete -> phase B still runs', async () => {
    git.state.tags.set('v1.3.0', HEAD);
    github.state.releases.add('v1.3.0');
    await run('stable', true, true);
    expect(github.createdReleases).toEqual([]); // A really was a noop
    expect(git.pushedBranches.map((p) => p.branch)).toEqual([ADVANCE_BRANCH]);
  });

  it('valid existing advance branch -> reuse it, open the PR only', async () => {
    seedAdvance({ ...releaseFiles(), 'version.json': versionFileText(NEXT) });
    await run('stable', true, true);
    expect(git.pushedBranches).toEqual([]);
    expect(github.createdPrs).toHaveLength(1);
  });

  it('advance branch: correct version.json but an unrelated file also changed -> reject', async () => {
    seedAdvance({ ...releaseFiles(), 'version.json': versionFileText(NEXT), 'unrelated.txt': 'x' });
    await expect(run('stable', true, true)).rejects.toThrow(/not only version\.json/);
    expect(git.pushedBranches).toEqual([]);
  });

  it('advance branch: derives from the wrong base (not current release HEAD) -> reject', async () => {
    seedAdvance({ ...releaseFiles(), 'version.json': versionFileText(NEXT) }, BASE);
    await expect(run('stable', true, true)).rejects.toThrow(/not a single commit on top of/);
  });

  it('advance branch: wrong version.json -> reject', async () => {
    seedAdvance({
      ...releaseFiles(),
      'version.json': versionFileText({ channel: 'rc', version: '9.9.9' }),
    });
    await expect(run('stable', true, true)).rejects.toThrow(/its version\.json is/);
  });

  it('advance PR already open -> phase B no-op', async () => {
    github.state.openPrs.push({
      head: ADVANCE_BRANCH,
      base: RELEASE_BRANCH,
      url: 'https://example.test/pull/7',
    });
    const r = await run('stable', true, true);
    expect(git.pushedBranches).toEqual([]);
    expect(github.createdPrs).toEqual([]);
    expect(msgs(r)).toMatch(/already open/);
  });

  it('sanity: the green-check fixture is what drives the pass', () => {
    expect(github.state.checkRuns).toEqual(greenChecks());
  });
});
