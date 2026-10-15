import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { bootstrapProjectHome } from '../src/testing';
import {
  fingerprintCreateClientIntent,
  normalizeCreateClientIntent,
} from '../src/specs/create-intent';
import {
  createJournalPath,
  listCreateJournals,
  publishCreateJournal,
  readCreateJournal,
  withCreateJournalLock,
  type CreateJournal,
} from '../src/specs/create-journal';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-journal-Ż ')));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  await mkdir(join(root, '.nevo'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\n');
  execFileSync('git', ['add', '.gitignore', '.nevo/config.yaml'], { cwd: root });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=SpecFlow Test',
      '-c',
      'user.email=specflow@example.invalid',
      'commit',
      '-qm',
      'initial',
    ],
    { cwd: root },
  );
  const engine = await bootstrapProjectHome(root);
  return { root, context: engine.context };
}

function intent(projectId: string, workspaceId: string, root: string): CreateJournal {
  const operationId = randomUUID();
  const title = 'Journal proof';
  const requestIntent = normalizeCreateClientIntent({
    title,
    target: { kind: 'existing', workspaceId },
  });
  return {
    version: 2,
    projectId,
    operationId,
    requestIntent,
    inputFingerprint: fingerprintCreateClientIntent(requestIntent),
    specId: randomUUID(),
    slug: 'journal-proof',
    title: 'Journal proof',
    created: '2026-10-14',
    stage: 'reserved',
    target: { kind: 'existing', workspaceId, workspaceRoot: root },
    files: [
      { relativePath: 'specs/active/journal-proof/change.yaml', sha256: 'b'.repeat(64) },
      { relativePath: 'specs/active/journal-proof/overview.md', sha256: 'c'.repeat(64) },
    ],
  };
}

describe('E2.T04 journal persistence and explicit recovery boundaries', () => {
  it('publishes a complete durable intent without changing the workspace registry', async () => {
    const { root, context } = await fixture();
    const before = await readFile(join(context.project.stateRoot, 'workspaces.json'), 'utf8');
    const entry = intent(context.project.projectId, randomUUID(), root);

    expect(await readCreateJournal(context, entry.operationId)).toBeUndefined();
    await withCreateJournalLock(context, async () => {
      await publishCreateJournal(context, entry);
    });
    expect(await readCreateJournal(context, entry.operationId)).toEqual(entry);
    expect(await listCreateJournals(context)).toEqual([entry]);
    expect(await readFile(join(context.project.stateRoot, 'workspaces.json'), 'utf8')).toBe(before);
  });

  it('fails closed on invalid/mismatched journal instead of rewriting it', async () => {
    const { root, context } = await fixture();
    const entry = intent(context.project.projectId, randomUUID(), root);
    await withCreateJournalLock(context, async () => publishCreateJournal(context, entry));
    const path = createJournalPath(context, entry.operationId);
    const corrupt = (await readFile(path, 'utf8')).replace(entry.projectId, randomUUID());
    await writeFile(path, corrupt);

    await expect(readCreateJournal(context, entry.operationId)).rejects.toMatchObject({
      code: 'CREATE_JOURNAL_CORRUPT',
    });
    await expect(listCreateJournals(context)).rejects.toMatchObject({
      code: 'CREATE_JOURNAL_CORRUPT',
    });
    expect(await readFile(path, 'utf8')).toBe(corrupt);
  });

  it('does not allow a symlinked journal directory as a write destination', async () => {
    const { root, context } = await fixture();
    const outside = await realpath(await mkdtemp(join(tmpdir(), 'specflow-journal-outside-')));
    roots.push(outside);
    const path = join(context.project.stateRoot, 'engine/operations/create');
    await withCreateJournalLock(context, () => Promise.resolve(undefined));
    await rm(path, { recursive: true, force: true });
    const { symlink } = await import('node:fs/promises');
    await symlink(outside, path, process.platform === 'win32' ? 'junction' : 'dir');

    const entry = intent(context.project.projectId, randomUUID(), root);
    await expect(
      withCreateJournalLock(context, async () => publishCreateJournal(context, entry)),
    ).rejects.toMatchObject({ code: 'CREATE_JOURNAL_CORRUPT' });
    await expect(
      readFile(join(outside, entry.operationId + '.json'), 'utf8'),
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
