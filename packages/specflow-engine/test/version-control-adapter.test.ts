import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { bootstrapProjectHome } from '../src';
import { openVersionControl } from '../src/version-control';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function project() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'vc-worktree-Ż space ')));
  roots.push(root);
  git(root, 'init', '-q');
  await mkdir(join(root, '.nevo'));
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  await writeFile(
    join(root, '.nevo/config.yaml'),
    'runtime: {}\ngit:\n  enabled: true\n  worktrees:\n    branchPattern: "feature/{slug}-{shortId}"\n    baseRef: "develop"\n',
  );
  git(root, 'add', '.gitignore', '.nevo/config.yaml');
  git(
    root,
    '-c', 'user.name=Nevo Test',
    '-c', 'user.email=nevo@example.invalid',
    'commit', '-qm', 'initial',
  );
  git(root, 'branch', 'develop');
  const engine = await bootstrapProjectHome(root);
  return { root, engine, worktrees: openVersionControl(engine).worktrees };
}

describe('internal Git worktree adapter (VC02)', () => {
  it('honors project-owned naming, base commit and read-only planning', async () => {
    const { root, worktrees } = await project();
    const before = git(root, 'worktree', 'list', '--porcelain');
    const plan = await worktrees.plan({ slug: 'alpha', shortId: randomUUID().slice(0, 8) });
    expect(plan.branch).toMatch(/^feature\/alpha-[0-9a-f]{8}$/u);
    expect(plan.baseCommit).toBe(git(root, 'rev-parse', 'develop'));
    expect(await worktrees.inspectEffect(plan)).toBe('absent');
    expect(git(root, 'worktree', 'list', '--porcelain')).toBe(before);
  });

  it('distinguishes read inspection from disabled new mutation', async () => {
    const { root, worktrees } = await project();
    const plan = await worktrees.plan({ slug: 'beta', shortId: 'abcdef12' });
    await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\ngit:\n  enabled: false\n');
    expect(await worktrees.availability()).toEqual({ status: 'disabled' });
    expect(await worktrees.inspectEffect(plan)).toBe('absent');
    await worktrees.validateReservedPlan(plan);
    await expect(worktrees.create(plan)).rejects.toMatchObject({ code: 'GIT_DISABLED' });
    expect(await worktrees.inspectEffect(plan)).toBe('absent');
  });

  it('checks preflight collisions and never changes primary HEAD', async () => {
    const { root, worktrees } = await project();
    const before = git(root, 'rev-parse', 'HEAD');
    const plan = await worktrees.plan({ slug: 'gamma', shortId: 'abcdef01' });
    // The adapter is invoked directly by this trusted integration test. Production
    // orchestration must persist git-initiated journal evidence before calling create().
    await worktrees.create(plan);
    expect(await worktrees.inspectEffect(plan)).toBe('present');
    expect(git(root, 'rev-parse', 'HEAD')).toBe(before);
    await expect(worktrees.plan({
      slug: 'gamma', shortId: 'abcdef01',
    })).rejects.toMatchObject({ code: 'BRANCH_ALREADY_EXISTS' });
    await writeFile(join(plan.targetPath, 'readme.txt'), 'legitimate changes\n');
    expect(await readFile(join(plan.targetPath, 'readme.txt'), 'utf8')).toBe('legitimate changes\n');
    await worktrees.inspectCreated(plan);
  });
});
