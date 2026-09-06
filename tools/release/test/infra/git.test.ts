// Integration test for the one non-trivial infra method: building a commit with
// a single file replaced, via git plumbing, without touching the working tree.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createGitClient } from '../../src/infra/git.js';

let repo: string;
const git = (args: string[]): string =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'nevo-git-'));
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.test']);
  git(['config', 'user.name', 'Test']);
  writeFileSync(join(repo, 'version.json'), '{"channel":"alpha","version":"1.3.0"}\n');
  writeFileSync(join(repo, 'other.txt'), 'keep me\n');
  git(['add', '.']);
  git(['commit', '-qm', 'base']);
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('createGitClient.commitSingleFileOnto', () => {
  it('replaces one file, preserves the rest, keeps the parent, and leaves the working tree alone', async () => {
    const client = createGitClient(repo);
    const baseSha = git(['rev-parse', 'HEAD']);

    const sha = await client.commitSingleFileOnto({
      baseRef: baseSha,
      path: 'version.json',
      content: '{"channel":"beta","version":"1.3.0"}\n',
      message: 'chore(release): start 1.3.0 stabilization (beta)',
    });

    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(git(['show', `${sha}:version.json`])).toContain('"beta"');
    expect(git(['show', `${sha}:other.txt`])).toBe('keep me');
    expect(git(['rev-parse', `${sha}^`])).toBe(baseSha);
    expect(git(['log', '-1', '--format=%s', sha])).toContain('start 1.3.0 stabilization');

    // HEAD and the working tree are untouched.
    expect(git(['rev-parse', 'HEAD'])).toBe(baseSha);
    expect(git(['status', '--porcelain'])).toBe('');
  });

  it('showFileAtRef returns null for a missing ref, resolveCommit too', async () => {
    const client = createGitClient(repo);
    expect(await client.showFileAtRef('HEAD', 'nope.json')).toBeNull();
    expect(await client.resolveCommit('refs/heads/does-not-exist')).toBeNull();
    expect(await client.resolveCommit('HEAD')).toMatch(/^[0-9a-f]{40}$/);
  });

  it('commitParents and changedFiles read history without mutating anything', async () => {
    const client = createGitClient(repo);
    const baseSha = git(['rev-parse', 'HEAD']);

    const child = await client.commitSingleFileOnto({
      baseRef: baseSha,
      path: 'version.json',
      content: '{"channel":"beta","version":"1.3.0"}\n',
      message: 'advance',
    });

    expect(await client.commitParents(child)).toEqual([baseSha]);
    expect(await client.commitParents('refs/heads/nope')).toBeNull();
    expect(await client.changedFiles(baseSha, child)).toEqual(['version.json']);
    expect(await client.changedFiles(baseSha, baseSha)).toEqual([]);

    // a two-file commit is detected as changing both
    const two = await client.commitSingleFileOnto({
      baseRef: child,
      path: 'extra.txt',
      content: 'hi\n',
      message: 'extra',
    });
    expect((await client.changedFiles(child, two)).sort()).toEqual(['extra.txt']);
    expect(git(['status', '--porcelain'])).toBe('');
  });
});
