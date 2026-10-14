import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { bootstrapProjectHome } from '../src';
import {
  fingerprintCreateClientIntent,
  normalizeCreateClientIntent,
} from '../src/specs/create-intent';
import {
  createJournalPath,
  publishCreateJournal,
  readCreateJournal,
  withCreateJournalLock,
  type CreateJournalV1,
  type CreateJournalV2,
} from '../src/specs/create-journal';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'vc03-journal-Ż ')));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  await mkdir(join(root, '.nevo'));
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\n');
  execFileSync('git', ['add', '.gitignore', '.nevo/config.yaml'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial'], { cwd: root });
  return (await bootstrapProjectHome(root)).context;
}

function legacy(context: Awaited<ReturnType<typeof fixture>>): CreateJournalV1 {
  const slug = 'legacy-journal';
  return {
    version: 1,
    operationId: randomUUID(),
    projectId: context.project.projectId,
    inputFingerprint: 'a'.repeat(64),
    specId: randomUUID(),
    slug,
    title: 'Legacy journal',
    created: '2026-10-13',
    stage: 'reserved',
    target: { kind: 'existing', workspaceId: randomUUID(), workspaceRoot: context.project.homeRoot },
    files: [
      { relativePath: 'specs/active/' + slug + '/change.yaml', sha256: 'b'.repeat(64) },
      { relativePath: 'specs/active/' + slug + '/overview.md', sha256: 'c'.repeat(64) },
    ],
  };
}

describe('VC03 — journal v2 reader without v2 writer activation', () => {
  it('still persists and parses unchanged v1 intent', async () => {
    const context = await fixture();
    const item = legacy(context);
    await withCreateJournalLock(context, () => publishCreateJournal(context, item));
    const raw = await readFile(createJournalPath(context, item.operationId), 'utf8');
    expect(JSON.parse(raw)).toEqual(item);
    expect(await readCreateJournal(context, item.operationId)).toEqual(item);
  });

  it('validates a stored v2 intent independently of Engine-generated created date', async () => {
    const context = await fixture();
    const prior = legacy(context);
    const intent = normalizeCreateClientIntent({
      title: prior.title,
      target: { kind: 'existing', workspaceId: prior.target.workspaceId },
    });
    const next: CreateJournalV2 = {
      ...prior,
      version: 2,
      requestIntent: intent,
      inputFingerprint: fingerprintCreateClientIntent(intent),
      created: '2026-10-14',
    };
    await withCreateJournalLock(context, () => Promise.resolve());
    const file = createJournalPath(context, next.operationId);
    await writeFile(file, JSON.stringify(next) + '\n');
    expect(await readCreateJournal(context, next.operationId)).toEqual(next);
    expect(fingerprintCreateClientIntent(intent)).toBe(next.inputFingerprint);
    await expect(
      withCreateJournalLock(context, () => publishCreateJournal(context, next)),
    ).rejects.toMatchObject({ code: 'CREATE_RECOVERY_REQUIRED' });
    expect(await readFile(file, 'utf8')).toBe(JSON.stringify(next) + '\n');
  });

  it('distinguishes omitted and explicit baseRef even when both would target HEAD', () => {
    const base = { title: 'Same intent' };
    const omitted = normalizeCreateClientIntent({ ...base, target: { kind: 'new-worktree' } });
    const explicit = normalizeCreateClientIntent({
      ...base,
      target: { kind: 'new-worktree', baseRef: 'HEAD' },
    });
    expect(fingerprintCreateClientIntent(omitted)).not.toBe(
      fingerprintCreateClientIntent(explicit),
    );
    expect(fingerprintCreateClientIntent(omitted)).toBe(
      fingerprintCreateClientIntent(normalizeCreateClientIntent({
        ...base,
        target: { kind: 'new-worktree' },
      })),
    );
  });

  it('rejects tampered v2 fingerprint or Git plan identity', async () => {
    const context = await fixture();
    const before = legacy(context);
    const intent = normalizeCreateClientIntent({
      title: before.title,
      target: { kind: 'new-worktree' },
    });
    const next: CreateJournalV2 = {
      ...before,
      version: 2,
      requestIntent: intent,
      inputFingerprint: fingerprintCreateClientIntent(intent),
      target: {
        kind: 'new-worktree',
        workspaceId: before.target.workspaceId,
        workspaceRoot: before.target.workspaceRoot,
        branch: 'feature/legacy-12345678',
        baseCommit: 'a'.repeat(40),
        instanceId: randomUUID(),
      },
      gitPlan: {
        projectRoot: context.project.homeRoot,
        gitInstanceId: context.project.gitInstanceId,
      },
    };
    await withCreateJournalLock(context, () => Promise.resolve());
    const path = createJournalPath(context, next.operationId);
    await writeFile(path, JSON.stringify(next));
    expect(await readCreateJournal(context, next.operationId)).toEqual(next);
    await writeFile(path, JSON.stringify({ ...next, inputFingerprint: 'f'.repeat(64) }));
    await expect(readCreateJournal(context, next.operationId)).rejects.toMatchObject({
      code: 'CREATE_JOURNAL_CORRUPT',
    });
    await writeFile(path, JSON.stringify({ ...next, gitPlan: { ...next.gitPlan, gitInstanceId: randomUUID() } }));
    await expect(readCreateJournal(context, next.operationId)).rejects.toMatchObject({
      code: 'CREATE_JOURNAL_CORRUPT',
    });
  });
});
