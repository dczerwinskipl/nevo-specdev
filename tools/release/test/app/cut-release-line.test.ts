import { beforeEach, describe, expect, it } from 'vitest';

import { executeReleaseCut } from '../../src/app/cut-release-line.js';
import { planReleaseCut, type CutPlan } from '../../src/domain/cut-plan.js';
import { versionFileText } from '../../src/domain/version.js';
import { InconsistentStateError } from '../../src/errors.js';
import {
  createFakeGit,
  createFakeGitHub,
  type FakeGit,
  type FakeGitHub,
} from '../support/fakes.js';

const BASE = 'base00000000000000000000000000000000000000';

let git: FakeGit;
let github: FakeGitHub;

beforeEach(() => {
  git = createFakeGit({ currentBranch: 'main' });
  git.state.commits.set('origin/main', BASE);
  git.state.files.set(
    `${BASE}:version.json`,
    versionFileText({ channel: 'alpha', version: '1.3.0' }),
  );
  github = createFakeGitHub();
});

const plan = (): Extract<CutPlan, { ok: true }> => {
  const p = planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '1.4.0' });
  if (!p.ok) throw new Error(p.errors.join('; '));
  return p;
};

describe('executeReleaseCut', () => {
  it('creates release/v1.3 + the bump branch and hands off the PR (no token)', async () => {
    const { events, performed } = await executeReleaseCut(plan(), {
      git,
      github,
      hasToken: false,
    });
    expect(performed).toBe(true);
    expect(git.pushedBranches.map((p) => p.branch)).toEqual([
      'release/v1.3',
      'chore/bump-main-to-1.4.0',
    ]);
    expect(git.state.files.get(`${git.pushedBranches[0]!.sha}:version.json`)).toContain('"beta"');
    expect(git.state.files.get(`${git.pushedBranches[1]!.sha}:version.json`)).toContain('"alpha"');
    expect(events.some((e) => e.message.includes('gh pr create'))).toBe(true);
  });

  it('opens + auto-merges the bump PR when a token is present', async () => {
    await executeReleaseCut(plan(), { git, github, hasToken: true });
    expect(github.createdPrs).toEqual([
      expect.objectContaining({ head: 'chore/bump-main-to-1.4.0', base: 'main' }),
    ]);
    expect(github.autoMerged).toHaveLength(1);
  });

  it('is a no-op when the branch exists and the bump PR is already open', async () => {
    git.state.remoteBranches.add('release/v1.3');
    github.state.openPrs.push({
      head: 'chore/bump-main-to-1.4.0',
      base: 'main',
      url: 'https://example.test/pull/9',
    });
    const { performed } = await executeReleaseCut(plan(), { git, github, hasToken: true });
    expect(performed).toBe(false);
    expect(git.pushedBranches).toEqual([]);
  });

  it('fails closed when origin/main is not alpha on the release version', async () => {
    git.state.files.set(
      `${BASE}:version.json`,
      versionFileText({ channel: 'alpha', version: '1.4.0' }),
    );
    await expect(executeReleaseCut(plan(), { git, github, hasToken: true })).rejects.toBeInstanceOf(
      InconsistentStateError,
    );
    expect(git.pushedBranches).toEqual([]);
  });

  it('fails closed when origin/main has no version.json', async () => {
    git.state.files.delete(`${BASE}:version.json`);
    await expect(executeReleaseCut(plan(), { git, github, hasToken: true })).rejects.toBeInstanceOf(
      InconsistentStateError,
    );
  });
});
