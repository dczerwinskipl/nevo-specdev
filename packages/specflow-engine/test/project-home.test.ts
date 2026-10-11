import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PROJECT_HOME_MARKER_RELATIVE_PATH,
  ProjectHomeError,
  resolveProjectHome,
} from '../src/index';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function tempRoot(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'nevo-home-Ż project '));
  const root = await realpath(directory);
  temporaryRoots.push(root);
  return root;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

async function repository(): Promise<string> {
  const root = await tempRoot();
  git(root, 'init', '-q');
  await mkdir(join(root, '.nevo'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  await writeFile(join(root, '.nevo/config.yaml'), 'runtime:\n  server: {}\n');
  git(root, 'add', '.gitignore', '.nevo/config.yaml');
  git(
    root,
    '-c',
    'user.name=SpecFlow Test',
    '-c',
    'user.email=specflow@example.invalid',
    'commit',
    '-qm',
    'bootstrap',
  );
  return root;
}

async function linkedWorktree(root: string): Promise<string> {
  const linked = await tempRoot();
  git(root, 'worktree', 'add', '--detach', linked);
  return linked;
}

async function designateHome(root: string, commonDir?: string): Promise<string> {
  const projectId = randomUUID();
  const stateDir = join(root, '.nevo/local/state');
  await mkdir(stateDir, { recursive: true });
  const gitCommonDir =
    commonDir ?? (await realpath(resolve(root, git(root, 'rev-parse', '--git-common-dir'))));
  await writeFile(
    join(root, PROJECT_HOME_MARKER_RELATIVE_PATH),
    JSON.stringify(
      {
        version: 1,
        projectId,
        homeRoot: root,
        gitCommonDir,
      },
      null,
      2,
    ),
  );
  return projectId;
}

async function expectHomeError(
  action: Promise<unknown>,
  code: ProjectHomeError['code'],
): Promise<void> {
  try {
    await action;
    expect.fail('Project Home discovery should have failed');
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectHomeError);
    expect((error as ProjectHomeError).code).toBe(code);
  }
}

describe('Project Home discovery (real Git worktrees, read-only)', () => {
  it('resolves identical project authority and distinct active checkout roots', async () => {
    const primary = await repository();
    const linked = await linkedWorktree(primary);
    const projectId = await designateHome(primary);
    const nested = join(linked, 'folder with spaces');
    await mkdir(nested);

    // Different tracked checkout config must not become operational policy.
    await writeFile(join(linked, '.nevo/config.yaml'), 'runtime:\n  server:\n    port: 9999\n');

    const fromPrimary = await resolveProjectHome({ cwd: primary });
    const fromLinked = await resolveProjectHome({ cwd: nested });

    expect(fromPrimary.project.projectId).toBe(projectId);
    expect(fromLinked.project).toEqual(fromPrimary.project);
    expect(fromPrimary.project.homeRoot).toBe(primary);
    expect(fromPrimary.project.stateRoot).toBe(join(primary, '.nevo/local/state'));
    expect(fromLinked.project.projectConfigPath).toBe(join(primary, '.nevo/config.yaml'));
    expect(fromLinked.project.localConfigPath).toBe(join(primary, '.nevo/local/config.yaml'));
    expect(fromPrimary.workspace.root).toBe(primary);
    expect(fromLinked.workspace.root).toBe(linked);
    expect(fromLinked.workspace.gitCommonDir).toBe(fromPrimary.workspace.gitCommonDir);
    expect(await readFile(fromLinked.project.projectConfigPath, 'utf8')).not.toContain('9999');
  });

  it('fails without designation instead of creating a default local registry', async () => {
    const primary = await repository();
    const linked = await linkedWorktree(primary);
    const before = await readdir(join(primary, '.nevo'));
    await expectHomeError(resolveProjectHome({ cwd: linked }), 'PROJECT_HOME_NOT_FOUND');
    expect(await readdir(join(primary, '.nevo'))).toEqual(before);
    await expectHomeError(resolveProjectHome({ cwd: primary }), 'PROJECT_HOME_NOT_FOUND');
  });

  it('rejects two designated homes, but permits an explicit verified selection', async () => {
    const primary = await repository();
    const linked = await linkedWorktree(primary);
    const firstProjectId = await designateHome(primary);
    await designateHome(linked);

    await expectHomeError(resolveProjectHome({ cwd: linked }), 'PROJECT_HOME_AMBIGUOUS');

    const chosen = await resolveProjectHome({ cwd: linked, projectRoot: primary });
    expect(chosen.project.projectId).toBe(firstProjectId);
    expect(chosen.project.homeRoot).toBe(primary);
    expect(chosen.workspace.root).toBe(linked);
  });

  it('rejects absolute foreign and relative explicit home overrides', async () => {
    const primary = await repository();
    const linked = await linkedWorktree(primary);
    const foreign = await repository();
    await designateHome(primary);
    await designateHome(foreign);

    await expectHomeError(
      resolveProjectHome({ cwd: linked, projectRoot: foreign }),
      'PROJECT_HOME_MISMATCH',
    );
    await expectHomeError(
      resolveProjectHome({ cwd: linked, projectRoot: '.' }),
      'PROJECT_HOME_INVALID',
    );
  });

  it('does not adopt an independent local clone even with an identical remote URL', async () => {
    const primary = await repository();
    await designateHome(primary);
    const clone = await tempRoot();
    git(primary, 'remote', 'add', 'origin', 'https://example.invalid/our-team/repo.git');
    git(primary, 'clone', '-q', primary, clone);
    git(clone, 'remote', 'set-url', 'origin', 'https://example.invalid/our-team/repo.git');
    await expectHomeError(resolveProjectHome({ cwd: clone }), 'PROJECT_HOME_NOT_FOUND');
    await expectHomeError(
      resolveProjectHome({ cwd: clone, projectRoot: primary }),
      'PROJECT_HOME_MISMATCH',
    );
  });

  it('rejects corrupt, substituted and unignored home markers', async () => {
    const primary = await repository();
    await designateHome(primary);
    const path = join(primary, PROJECT_HOME_MARKER_RELATIVE_PATH);
    const original = await readFile(path, 'utf8');

    await writeFile(path, '{"version":99}');
    await expectHomeError(resolveProjectHome({ cwd: primary }), 'PROJECT_HOME_INVALID');

    const altered = JSON.parse(original) as { gitCommonDir: string };
    altered.gitCommonDir = await tempRoot();
    await writeFile(path, JSON.stringify(altered));
    await expectHomeError(resolveProjectHome({ cwd: primary }), 'PROJECT_HOME_MISMATCH');

    await writeFile(path, original);
    await writeFile(join(primary, '.gitignore'), '');
    await expectHomeError(resolveProjectHome({ cwd: primary }), 'PROJECT_HOME_INVALID');
  });

  it('rejects a removed home marker without creating replacement state', async () => {
    const primary = await repository();
    const linked = await linkedWorktree(primary);
    await designateHome(primary);
    await rm(join(primary, PROJECT_HOME_MARKER_RELATIVE_PATH));
    await expectHomeError(resolveProjectHome({ cwd: linked }), 'PROJECT_HOME_NOT_FOUND');
    expect(await readdir(join(linked, '.nevo'))).toEqual(['config.yaml']);
  });

  it('reports missing home configuration and missing override with structured errors', async () => {
    const primary = await repository();
    await designateHome(primary);
    await expectHomeError(
      resolveProjectHome({ cwd: primary, projectRoot: join(primary, 'not-a-worktree') }),
      'PROJECT_HOME_NOT_FOUND',
    );
    await rm(join(primary, '.nevo/config.yaml'));
    await expectHomeError(resolveProjectHome({ cwd: primary }), 'PROJECT_HOME_INVALID');
  });

  it('rejects bare repositories rather than treating Git metadata as a workspace', async () => {
    const root = await tempRoot();
    git(root, 'init', '-q', '--bare');
    await expect(resolveProjectHome({ cwd: root })).rejects.toThrow(/inside a Git repository/u);
  });
});
