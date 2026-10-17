import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BASE_REF,
  DEFAULT_BRANCH_PATTERN,
  normalizeBaseRef,
  parseGitWorktreePolicy,
  resolveWorktreeBranch,
  validateBaseRef,
  validateBranchName,
  validateBranchPattern,
} from '../src/version-control/worktrees/policy';

describe('Version Control worktree policy (VC01)', () => {
  it('keeps the legacy defaults without worktrees configuration', () => {
    expect(parseGitWorktreePolicy({ git: { enabled: true } })).toEqual({
      enabled: true,
      branchPattern: DEFAULT_BRANCH_PATTERN,
      baseRef: DEFAULT_BASE_REF,
    });
    expect(parseGitWorktreePolicy({})).toEqual({
      enabled: false,
      branchPattern: DEFAULT_BRANCH_PATTERN,
      baseRef: DEFAULT_BASE_REF,
    });
  });

  it('parses the configured integration branch independently from new-worktree enablement', () => {
    expect(
      parseGitWorktreePolicy({
        git: { enabled: false, integrationTargetBranch: 'develop' },
      }),
    ).toMatchObject({ enabled: false, integrationTargetBranch: 'develop' });
    expect(
      parseGitWorktreePolicy({
        git: { enabled: true, integrationTargetBranch: 'main' },
      }),
    ).toMatchObject({ enabled: true, integrationTargetBranch: 'main' });
    expect(parseGitWorktreePolicy({ git: { enabled: true } }).integrationTargetBranch).toBeUndefined();
    for (const target of ['HEAD', 'a..b', '-bad', 'origin/main..x', '', 17]) {
      expect(() => parseGitWorktreePolicy({ git: { enabled: true, integrationTargetBranch: target } }))
        .toThrow();
    }
  });

  it('supports only explicit naming variables, conventional prefixes and default base refs', () => {
    const policy = parseGitWorktreePolicy({
      git: {
        enabled: true,
        worktrees: { branchPattern: 'feature/{slug}-{shortId}', baseRef: 'develop' },
      },
    });
    expect(resolveWorktreeBranch(policy, 'my-spec', '12345678')).toBe('feature/my-spec-12345678');
    expect(resolveWorktreeBranch(policy, 'my-spec', '12345678', 'topic/custom')).toBe(
      'topic/custom',
    );
    expect(normalizeBaseRef(policy.baseRef)).toBe('refs/heads/develop');
    expect(normalizeBaseRef('HEAD')).toBe('HEAD');
    expect(normalizeBaseRef('refs/tags/v1.0')).toBe('refs/tags/v1.0');
    expect(normalizeBaseRef('0123456789abcdef0123456789abcdef01234567')).toBe(
      '0123456789abcdef0123456789abcdef01234567',
    );
  });

  it.each([
    '{slug}',
    'feature/{slug}-{unknown}',
    'feature/{shortId}-{shortId}',
    'feature/{slug-{shortId}',
    'feature/{shortId}}',
    'feature/{slug}/{shortId}/',
    '../{shortId}',
    'feature//{shortId}',
    'feature/.hidden-{shortId}',
  ])('rejects unsafe branch template %s', (pattern) => {
    expect(() => validateBranchPattern(pattern)).toThrow();
  });

  it.each([
    '-danger',
    'spec/bad..ref',
    'spec/foo.lock',
    'spec/.hidden',
    'spec/with space',
    'spec/@{HEAD}',
    'spec/café',
    'spec/a//b',
  ])('rejects unsafe branch name %s', (branch) => {
    expect(() => validateBranchName(branch)).toThrow();
  });

  it.each(['-bad', 'origin/main', 'HEAD^{commit}', 'refs/remotes/origin/main', 'bad..ref'])(
    'rejects unsupported base ref %s',
    (ref) => {
      expect(() => validateBaseRef(ref)).toThrow();
    },
  );

  it('fails closed on unknown keys, local overrides and invalid types', () => {
    for (const project of [
      { git: { enabled: 'yes' } },
      { git: { enabled: true, provider: 'git' } },
      { git: { enabled: true, worktrees: { enabled: true } } },
      { git: { enabled: true, worktrees: { branchPattern: 17 } } },
      { git: { enabled: true, worktrees: { baseRef: '-bad' } } },
    ]) {
      expect(() => parseGitWorktreePolicy(project)).toThrow();
    }
    expect(() => parseGitWorktreePolicy({ git: { enabled: true } }, { git: {} })).toThrow();
  });
});
