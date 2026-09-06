import { beforeEach, describe, expect, it } from 'vitest';

import { executeReleaseCut } from '../../src/app/cut-release-line.js';
import { versionFileText, type VersionFile } from '../../src/domain/version.js';
import { InconsistentStateError, UsageError } from '../../src/errors.js';
import {
  createFakeGit,
  createFakeGitHub,
  type FakeGit,
  type FakeGitHub,
} from '../support/fakes.js';

const RELEASE_BRANCH = 'release/v1.3';
const BUMP_BRANCH = 'chore/bump-main-to-1.4.0';
const INPUT = { releaseVersion: '1.3.0', nextDevelopmentVersion: '1.4.0' };

let git: FakeGit;
let github: FakeGitHub;
let mainSha: string;

/** origin/main is a single commit with `version.json` = mainVf. */
function withMain(mainVf: VersionFile): void {
  git = createFakeGit({ currentBranch: 'main' });
  mainSha = git.addCommit({ files: { 'version.json': versionFileText(mainVf) } });
  git.state.refs.set('origin/main', mainSha);
  github = createFakeGitHub();
}

const deps = (hasToken = false) => ({ git, github, hasToken });
const run = (mutate: boolean, hasToken = false) =>
  executeReleaseCut(INPUT, deps(hasToken), { mutate });
const msgs = (r: { events: { message: string }[] }): string =>
  r.events.map((e) => e.message).join('\n');

/** Add a correctly-cut release branch (single commit on origin/main -> beta 1.3.0). */
function seedCorrectReleaseBranch(): string {
  const sha = git.addCommit({
    parents: [mainSha],
    files: { 'version.json': versionFileText({ channel: 'beta', version: '1.3.0' }) },
  });
  git.state.refs.set(`origin/${RELEASE_BRANCH}`, sha);
  git.state.remoteBranches.add(RELEASE_BRANCH);
  return sha;
}
function seedCorrectBumpBranch(): string {
  const sha = git.addCommit({
    parents: [mainSha],
    files: { 'version.json': versionFileText({ channel: 'alpha', version: '1.4.0' }) },
  });
  git.state.refs.set(`origin/${BUMP_BRANCH}`, sha);
  git.state.remoteBranches.add(BUMP_BRANCH);
  return sha;
}

describe('executeReleaseCut — validate-only parity', () => {
  beforeEach(() => withMain({ channel: 'alpha', version: '1.3.0' }));

  it('bad inputs are a UsageError in both modes', async () => {
    const bad = executeReleaseCut(
      { releaseVersion: '1.3.0', nextDevelopmentVersion: '1.9.9' },
      deps(),
      { mutate: false },
    );
    await expect(bad).rejects.toBeInstanceOf(UsageError);
  });

  it('validate-only checks origin/main + its version.json and mutates nothing', async () => {
    const r = await run(false);
    expect(msgs(r)).toMatch(/origin\/main at .* is alpha 1\.3\.0/);
    expect(msgs(r)).toMatch(/Would create release\/v1\.3/);
    expect(msgs(r)).toMatch(/Would push chore\/bump-main-to-1\.4\.0/);
    expect(git.pushedBranches).toEqual([]);
    expect(github.createdPrs).toEqual([]);
  });

  it('origin/main not alpha on the release version -> refused in BOTH modes', async () => {
    withMain({ channel: 'alpha', version: '1.4.0' });
    await expect(run(false)).rejects.toBeInstanceOf(InconsistentStateError);
    await expect(run(true)).rejects.toBeInstanceOf(InconsistentStateError);
    expect(git.pushedBranches).toEqual([]);
  });

  it('origin/main has no version.json -> refused in both modes', async () => {
    git.state.commits.set(mainSha, { sha: mainSha, parents: [], files: {} });
    await expect(run(false)).rejects.toThrow(/has no version\.json/);
    await expect(run(true)).rejects.toThrow(/has no version\.json/);
  });

  it('execute without a token pushes both branches and prints the gh command', async () => {
    const r = await run(true, false);
    expect(git.pushedBranches.map((p) => p.branch)).toEqual([RELEASE_BRANCH, BUMP_BRANCH]);
    expect(msgs(r)).toMatch(/gh pr create --base main/);
    expect(github.createdPrs).toEqual([]);
  });

  it('execute with a token opens + auto-merges the bump PR', async () => {
    await run(true, true);
    expect(github.createdPrs).toEqual([
      expect.objectContaining({ head: BUMP_BRANCH, base: 'main' }),
    ]);
    expect(github.autoMerged).toHaveLength(1);
  });
});

describe('executeReleaseCut — recovery validated by CONTENT, not names §4', () => {
  beforeEach(() => withMain({ channel: 'alpha', version: '1.3.0' }));

  it('correct release branch + open bump PR -> already done, zero mutation', async () => {
    seedCorrectReleaseBranch();
    seedCorrectBumpBranch();
    github.state.openPrs.push({
      head: BUMP_BRANCH,
      base: 'main',
      url: 'https://example.test/pull/9',
    });
    const r = await run(true, true);
    expect(r.alreadyDone).toBe(true);
    expect(git.pushedBranches).toEqual([]);
    expect(msgs(r)).toMatch(/already cut correctly/);
  });

  it('correct release branch, bump PR merged (main already on 1.4.0) -> already done', async () => {
    seedCorrectReleaseBranch(); // parent stays the historical origin/main { alpha, 1.3.0 }
    const advancedMain = git.addCommit({
      parents: [mainSha],
      files: { 'version.json': versionFileText({ channel: 'alpha', version: '1.4.0' }) },
    });
    git.state.refs.set('origin/main', advancedMain);
    const r = await run(true, true);
    expect(r.alreadyDone).toBe(true);
    expect(msgs(r)).toMatch(/the line is fully cut/);
    expect(git.pushedBranches).toEqual([]);
  });

  it('correct release branch, no bump PR, main still old -> InconsistentStateError with guidance', async () => {
    seedCorrectReleaseBranch();
    await expect(run(true, true)).rejects.toThrow(/no open main-bump PR was found/);
  });

  it('release branch present but with an unrelated file change -> fail closed', async () => {
    const sha = git.addCommit({
      parents: [mainSha],
      files: {
        'version.json': versionFileText({ channel: 'beta', version: '1.3.0' }),
        'extra.txt': 'oops',
      },
    });
    git.state.refs.set(`origin/${RELEASE_BRANCH}`, sha);
    git.state.remoteBranches.add(RELEASE_BRANCH);
    await expect(run(true, true)).rejects.toThrow(/not only version\.json/);
    expect(git.pushedBranches).toEqual([]);
  });

  it('release branch present but based on an unexpected main commit -> fail closed', async () => {
    const wrongBase = git.addCommit({
      files: { 'version.json': versionFileText({ channel: 'alpha', version: '9.9.9' }) },
    });
    const sha = git.addCommit({
      parents: [wrongBase],
      files: { 'version.json': versionFileText({ channel: 'beta', version: '1.3.0' }) },
    });
    git.state.refs.set(`origin/${RELEASE_BRANCH}`, sha);
    git.state.remoteBranches.add(RELEASE_BRANCH);
    await expect(run(true, true)).rejects.toThrow(/its base version\.json is/);
  });

  it('names match but the bump branch content is wrong -> fail closed', async () => {
    seedCorrectReleaseBranch();
    const badBump = git.addCommit({
      parents: [mainSha],
      files: { 'version.json': versionFileText({ channel: 'alpha', version: '2.0.0' }) },
    });
    git.state.refs.set(`origin/${BUMP_BRANCH}`, badBump);
    git.state.remoteBranches.add(BUMP_BRANCH);
    github.state.openPrs.push({
      head: BUMP_BRANCH,
      base: 'main',
      url: 'https://example.test/pull/9',
    });
    await expect(run(true, true)).rejects.toThrow(/refusing to treat this cut as complete/);
  });

  it('open bump PR but no release branch -> fail closed', async () => {
    seedCorrectBumpBranch();
    github.state.openPrs.push({
      head: BUMP_BRANCH,
      base: 'main',
      url: 'https://example.test/pull/9',
    });
    await expect(run(true, true)).rejects.toThrow(/does not\./);
  });

  it('a pr-list query failure fails closed (not "no PR")', async () => {
    github.state.failPrList = new Error('HTTP 502');
    await expect(run(false)).rejects.toThrow(/HTTP 502/);
  });
});
