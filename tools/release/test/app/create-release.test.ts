import { beforeEach, describe, expect, it } from 'vitest';

import { executeRelease } from '../../src/app/create-release.js';
import { planRelease, type ReleasePlan } from '../../src/domain/release-plan.js';
import { versionFileText } from '../../src/domain/version.js';
import { InconsistentStateError } from '../../src/errors.js';
import {
  createFakeGit,
  createFakeGitHub,
  greenChecks,
  type FakeGit,
  type FakeGitHub,
} from '../support/fakes.js';

const HEAD = 'head000000000000000000000000000000000000';
const ADVANCE_BRANCH = 'chore/advance-release-v1.3-to-1.3.1';

let git: FakeGit;
let github: FakeGitHub;

beforeEach(() => {
  git = createFakeGit({ currentBranch: 'release/v1.3', headSha: HEAD });
  git.state.commits.set('origin/release/v1.3', 'base00000000000000000000000000000000000000');
  git.state.files.set(
    'base00000000000000000000000000000000000000:version.json',
    versionFileText({ channel: 'stable', version: '1.3.0' }),
  );
  github = createFakeGitHub();
});

const valid = (plan: ReleasePlan): Extract<ReleasePlan, { ok: true }> => {
  if (!plan.ok) throw new Error(plan.errors.join('; '));
  return plan;
};

const betaPlan = (existingTags: string[] = []) =>
  valid(
    planRelease({
      branch: 'release/v1.3',
      channel: 'beta',
      versionFile: { channel: 'beta', version: '1.3.0' },
      existingTags,
    }),
  );

const stablePlan = () =>
  valid(
    planRelease({
      branch: 'release/v1.3',
      channel: 'stable',
      versionFile: { channel: 'stable', version: '1.3.0' },
      existingTags: [],
    }),
  );

describe('executeRelease — phase A (tag + Release)', () => {
  it('tag absent + Release absent -> creates both', async () => {
    await executeRelease(betaPlan(), { git, github, hasToken: false });
    expect(git.createdTags).toEqual([{ tag: 'v1.3.0-beta.1', sha: HEAD }]);
    expect(github.createdReleases).toEqual(['v1.3.0-beta.1']);
  });

  it('orphan beta.1 on HEAD (tag present, Release missing) -> completes beta.1, not beta.2', async () => {
    git.state.tags.set('v1.3.0-beta.1', HEAD);
    await executeRelease(betaPlan(['v1.3.0-beta.1']), { git, github, hasToken: false });
    expect(git.createdTags).toEqual([]); // no new tag
    expect(github.createdReleases).toEqual(['v1.3.0-beta.1']);
  });

  it('planned tag + its Release both complete on HEAD -> no mutation', async () => {
    git.state.tags.set('v1.3.0-beta.1', HEAD);
    github.state.releases.add('v1.3.0-beta.1');
    await executeRelease(betaPlan(), { git, github, hasToken: false });
    expect(git.createdTags).toEqual([]);
    expect(github.createdReleases).toEqual([]);
  });

  it('beta.1 complete on HEAD -> advances to beta.2 (§3)', async () => {
    git.state.tags.set('v1.3.0-beta.1', HEAD);
    github.state.releases.add('v1.3.0-beta.1');
    await executeRelease(betaPlan(['v1.3.0-beta.1']), { git, github, hasToken: false });
    expect(git.createdTags).toEqual([{ tag: 'v1.3.0-beta.2', sha: HEAD }]);
  });

  it('the candidate tag already exists at a different commit -> fails closed', async () => {
    git.state.tags.set('v1.3.0-beta.2', 'somewhere-else-0000000000000000000000000');
    await expect(
      executeRelease(betaPlan(['v1.3.0-beta.1']), { git, github, hasToken: false }),
    ).rejects.toBeInstanceOf(InconsistentStateError);
  });

  it('CI not green on HEAD -> refuses to tag', async () => {
    github.state.checkRuns = [
      { name: 'quality', status: 'completed', conclusion: 'success', id: 1 },
      { name: 'test', status: 'completed', conclusion: 'failure', id: 2 },
      { name: 'build', status: 'completed', conclusion: 'success', id: 3 },
    ];
    await expect(
      executeRelease(betaPlan(), { git, github, hasToken: false }),
    ).rejects.toBeInstanceOf(InconsistentStateError);
    expect(git.createdTags).toEqual([]);
  });
});

describe('executeRelease — phase B runs even when phase A is a no-op (§9)', () => {
  beforeEach(() => {
    // stable tag + Release already complete on HEAD -> phase A is a noop.
    git.state.tags.set('v1.3.0', HEAD);
    github.state.releases.add('v1.3.0');
  });

  it('advance branch missing -> still creates the branch + hands off the PR (no token)', async () => {
    const { events } = await executeRelease(stablePlan(), { git, github, hasToken: false });
    expect(github.createdReleases).toEqual([]); // phase A really was a noop
    expect(git.pushedBranches.map((p) => p.branch)).toEqual([ADVANCE_BRANCH]);
    expect(events.some((e) => e.level === 'warn' && e.message.includes('gh pr create'))).toBe(true);
  });

  it('advance branch missing + token -> opens the advance PR', async () => {
    await executeRelease(stablePlan(), { git, github, hasToken: true });
    expect(github.createdPrs).toEqual([
      expect.objectContaining({ head: ADVANCE_BRANCH, base: 'release/v1.3' }),
    ]);
  });

  it('advance branch already exists and is valid -> reuse it, create the PR only', async () => {
    git.state.remoteBranches.add(ADVANCE_BRANCH);
    git.state.files.set(
      `origin/${ADVANCE_BRANCH}:version.json`,
      versionFileText({ channel: 'beta', version: '1.3.1' }),
    );
    await executeRelease(stablePlan(), { git, github, hasToken: true });
    expect(git.pushedBranches).toEqual([]); // nothing pushed
    expect(github.createdPrs).toHaveLength(1);
  });

  it('advance branch exists but is inconsistent -> fails closed, never force-pushes', async () => {
    git.state.remoteBranches.add(ADVANCE_BRANCH);
    git.state.files.set(
      `origin/${ADVANCE_BRANCH}:version.json`,
      versionFileText({ channel: 'rc', version: '9.9.9' }),
    );
    await expect(
      executeRelease(stablePlan(), { git, github, hasToken: true }),
    ).rejects.toBeInstanceOf(InconsistentStateError);
    expect(git.pushedBranches).toEqual([]);
  });

  it('advance PR already open -> phase B is a no-op', async () => {
    github.state.openPrs.push({
      head: ADVANCE_BRANCH,
      base: 'release/v1.3',
      url: 'https://example.test/pull/7',
    });
    const { events } = await executeRelease(stablePlan(), { git, github, hasToken: true });
    expect(git.pushedBranches).toEqual([]);
    expect(github.createdPrs).toEqual([]);
    expect(events.some((e) => e.message.includes('already open'))).toBe(true);
  });
});

describe('executeRelease — a fresh stable release does A then B in one run', () => {
  it('tags, releases, and hands off the advance', async () => {
    const { events } = await executeRelease(stablePlan(), { git, github, hasToken: true });
    expect(git.createdTags).toEqual([{ tag: 'v1.3.0', sha: HEAD }]);
    expect(github.createdReleases).toEqual(['v1.3.0']);
    expect(github.createdPrs).toHaveLength(1);
    expect(events.length).toBeGreaterThan(0);
    expect(github.state.checkRuns).toEqual(greenChecks());
  });
});
