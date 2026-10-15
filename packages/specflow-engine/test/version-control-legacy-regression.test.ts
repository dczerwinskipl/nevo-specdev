import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addWorkspace,
  bootstrapProjectHome,
  openSpecFlowEngine,
  provisionLinkedWorkspaceIdentity,
  updateWorkspaceRegistry,
  workspaceRegistryPath,
} from '../src/index';
import { openVersionControl } from '../src/version-control';
import { createLocalGitClient } from '../src/version-control/git/client';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-git-Ż with spaces ')));
  roots.push(root);
  git(root, 'init', '-q');
  await mkdir(join(root, '.nevo'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\ngit:\n  enabled: true\n');
  git(root, 'add', '.gitignore', '.nevo/config.yaml');
  git(
    root,
    '-c',
    'user.name=SpecFlow Test',
    '-c',
    'user.email=specflow@example.invalid',
    'commit',
    '-qm',
    'initial',
  );
  const engine = await bootstrapProjectHome(root);
  return { root, engine, worktrees: openVersionControl(engine).worktrees };
}

function request(root: string) {
  const shortId = randomUUID().slice(0, 8);
  return {
    shortId,
    slug: 'feature-branch',
    baseRefOverride: 'HEAD',
    branchOverride: 'spec/feature-branch-' + shortId,
    targetPath: join(dirname(root), basename(root) + '-worktrees', 'feature-branch'),
  };
}

describe('VC06 legacy real-Git regression coverage through WorktreePort', () => {
  it('inspects a verified primary and plans a worktree without any side effects', async () => {
    const { root, engine, worktrees } = await fixture();
    expect(await worktrees.availability()).toEqual({ status: 'available' });
    const current = (await createLocalGitClient(root).listWorktrees()).find(
      (entry) => entry.root === root,
    );
    expect(current).toBeDefined();
    expect(current!.root).toBe(root);
    expect(current!.head).toBe(git(root, 'rev-parse', 'HEAD'));
    expect(current!.prunable).toBe(false);

    const registryPath = workspaceRegistryPath(engine.context);
    const registryBefore = await readFile(registryPath, 'utf8');
    const headBefore = git(root, 'rev-parse', 'HEAD');
    const worktreesBefore = git(root, 'worktree', 'list', '--porcelain');
    const planned = await worktrees.plan(request(root));

    expect(planned).toMatchObject({
      projectId: engine.context.project.projectId,
      gitInstanceId: engine.context.project.gitInstanceId,
      projectRoot: root,
      baseCommit: headBefore,
    });
    expect(planned.targetPath).toContain('feature-branch');
    expect(await readFile(registryPath, 'utf8')).toBe(registryBefore);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(headBefore);
    expect(git(root, 'worktree', 'list', '--porcelain')).toBe(worktreesBefore);
    await expect(readFile(planned.targetPath, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects disabled worktrees before branch, path or registry mutation', async () => {
    const { root, engine, worktrees } = await fixture();
    await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\ngit:\n  enabled: false\n');
    const before = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    const branchBefore = git(root, 'branch', '--list');
    const worktreesBefore = git(root, 'worktree', 'list', '--porcelain');

    expect(await worktrees.availability()).toEqual({ status: 'disabled' });
    await expect(worktrees.plan(request(root))).rejects.toMatchObject({
      code: 'GIT_DISABLED',
    });
    expect(git(root, 'branch', '--list')).toBe(branchBefore);
    expect(git(root, 'worktree', 'list', '--porcelain')).toBe(worktreesBefore);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(before);
  });

  it('fails closed on invalid policy and workstation-local Git overrides', async () => {
    const { root, worktrees } = await fixture();
    const projectPath = join(root, '.nevo/config.yaml');
    await writeFile(projectPath, 'runtime: {}\ngit:\n  enabled: yes\n');
    await expect(worktrees.availability()).rejects.toMatchObject({ code: 'GIT_POLICY_INVALID' });

    await writeFile(projectPath, 'runtime: {}\ngit:\n  enabled: true\n');
    await mkdir(join(root, '.nevo/local'), { recursive: true });
    await writeFile(join(root, '.nevo/local/config.yaml'), 'git:\n  enabled: false\n');
    await expect(worktrees.plan(request(root))).rejects.toMatchObject({
      code: 'GIT_POLICY_INVALID',
    });
  });

  it('uses home-owned policy rather than divergent linked worktree config', async () => {
    const { root, engine } = await fixture();
    const linked = await realpath(await mkdtemp(join(tmpdir(), 'specflow-git-linked-Ż ')));
    roots.push(linked);
    git(root, 'worktree', 'add', '-q', '-b', 'spec/linked-policy', linked);
    const registered = await provisionLinkedWorkspaceIdentity(
      engine.context,
      linked,
      randomUUID(),
      false,
    );
    await updateWorkspaceRegistry(engine.context, (registry) => addWorkspace(registry, registered));
    await writeFile(join(linked, '.nevo/config.yaml'), 'runtime: {}\ngit:\n  enabled: false\n');

    const linkedEngine = await openSpecFlowEngine({ cwd: linked });
    const linkedWorktrees = openVersionControl(linkedEngine).worktrees;
    expect(await linkedWorktrees.availability()).toEqual({ status: 'available' });
    const plan = await linkedWorktrees.plan({
      ...request(root),
      slug: 'linked-policy-proof',
      targetPath: join(dirname(root), basename(root) + '-worktrees', 'linked-policy-proof'),
    });
    expect(plan.projectRoot).toBe(root);
    expect(plan.baseCommit).toBe(git(root, 'rev-parse', 'HEAD'));
    expect((await createLocalGitClient(root).listWorktrees()).map((item) => item.root)).toContain(
      linked,
    );
  });

  it('rejects a checked-out branch and existing local ref before side effects', async () => {
    const { root, worktrees } = await fixture();
    const branch = 'spec/occupied';
    const linked = await realpath(await mkdtemp(join(tmpdir(), 'specflow-git-occupied-')));
    roots.push(linked);
    git(root, 'worktree', 'add', '-q', '-b', branch, linked);
    await expect(
      worktrees.plan({ ...request(root), branchOverride: branch }),
    ).rejects.toMatchObject({
      code: 'BRANCH_ALREADY_EXISTS',
    });

    git(root, 'branch', 'spec/already-exists');
    await expect(
      worktrees.plan({ ...request(root), branchOverride: 'spec/already-exists' }),
    ).rejects.toMatchObject({ code: 'BRANCH_ALREADY_EXISTS' });
  });

  it('rejects a child branch when its parent ref exists without side effects', async () => {
    const { root, engine, worktrees } = await fixture();
    git(root, 'branch', 'spec/example');
    const input = { ...request(root), branchOverride: 'spec/example/task' };
    const refsBefore = git(root, 'for-each-ref', '--format=%(refname)', 'refs/heads');
    const worktreesBefore = git(root, 'worktree', 'list', '--porcelain');
    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');

    await expect(worktrees.plan(input)).rejects.toMatchObject({
      code: 'BRANCH_ALREADY_EXISTS',
    });
    expect(git(root, 'for-each-ref', '--format=%(refname)', 'refs/heads')).toBe(refsBefore);
    expect(git(root, 'worktree', 'list', '--porcelain')).toBe(worktreesBefore);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
    await expect(readFile(input.targetPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });

    // A textual prefix without a '/' component boundary is not a Git ref collision.
    await expect(
      worktrees.plan({ ...input, branchOverride: 'spec/examples/task' }),
    ).resolves.toMatchObject({ branch: 'spec/examples/task' });
  });

  it('rejects a parent branch when a child ref exists, case-insensitively', async () => {
    const { root, engine, worktrees } = await fixture();
    git(root, 'branch', 'spec/Example/task');
    const input = { ...request(root), branchOverride: 'spec/example' };
    const refsBefore = git(root, 'for-each-ref', '--format=%(refname)', 'refs/heads');
    const worktreesBefore = git(root, 'worktree', 'list', '--porcelain');
    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');

    await expect(worktrees.plan(input)).rejects.toMatchObject({
      code: 'BRANCH_ALREADY_EXISTS',
    });
    expect(git(root, 'for-each-ref', '--format=%(refname)', 'refs/heads')).toBe(refsBefore);
    expect(git(root, 'worktree', 'list', '--porcelain')).toBe(worktreesBefore);
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
    await expect(readFile(input.targetPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects nonexistent refs and invalid names, including Git option injection', async () => {
    const { root, worktrees } = await fixture();
    await expect(
      worktrees.plan({ ...request(root), baseRefOverride: 'refs/heads/missing' }),
    ).rejects.toMatchObject({ code: 'BASE_REF_NOT_FOUND' });
    for (const branch of ['--help', 'spec/../escape', 'spec/unsafe.lock', 'spec/a..b']) {
      await expect(
        worktrees.plan({ ...request(root), branchOverride: branch }),
        branch,
      ).rejects.toMatchObject({ code: 'GIT_POLICY_INVALID' });
    }
  });

  it('rejects unsafe worktree destinations and symlinked parents', async () => {
    const { root, worktrees } = await fixture();
    const input = request(root);
    await expect(
      worktrees.plan({ ...input, targetPath: join(root, 'unsafe') }),
    ).rejects.toMatchObject({ code: 'WORKTREE_PATH_CONFLICT' });

    await mkdir(dirname(input.targetPath));
    await mkdir(input.targetPath);
    await expect(worktrees.plan(input)).rejects.toMatchObject({
      code: 'WORKTREE_PATH_CONFLICT',
    });

    await rm(dirname(input.targetPath), { recursive: true });
    const foreign = await realpath(await mkdtemp(join(tmpdir(), 'specflow-git-foreign-')));
    roots.push(foreign);
    await symlink(
      foreign,
      dirname(input.targetPath),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await expect(worktrees.plan(input)).rejects.toMatchObject({
      code: 'WORKTREE_PATH_CONFLICT',
    });
    await rm(dirname(input.targetPath));
  });

  it('rejects a base config recorded as a Git symlink even though Git calls it a blob', async () => {
    const { root, worktrees } = await fixture();
    const target = join(root, '.nevo/git-link-content');
    await writeFile(target, 'runtime: {}\n');
    const objectId = git(root, 'hash-object', '-w', target);
    git(root, 'update-index', '--add', '--cacheinfo', '120000,' + objectId + ',.nevo/config.yaml');
    git(
      root,
      '-c',
      'user.name=SpecFlow Test',
      '-c',
      'user.email=specflow@example.invalid',
      'commit',
      '-qm',
      'record invalid symlink config',
    );

    expect(git(root, 'ls-files', '-s', '.nevo/config.yaml')).toContain('120000');
    const before = git(root, 'worktree', 'list', '--porcelain');
    await expect(worktrees.plan(request(root))).rejects.toMatchObject({
      code: 'GIT_BASE_CONFIG_MISSING',
    });
    expect(git(root, 'worktree', 'list', '--porcelain')).toBe(before);
  });

  it('rejects replacing the physical Git repository after an Engine was opened', async () => {
    const { root, worktrees } = await fixture();
    await rm(join(root, '.git'), { recursive: true });
    git(root, 'init', '-q');
    await expect(worktrees.plan(request(root))).rejects.toMatchObject({
      code: 'PROJECT_HOME_MISMATCH',
    });
  });
});
