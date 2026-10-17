import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { bootstrapProjectHome, createSpecificationScaffold } from '../src/testing';
import { withProjectControlLock } from '../src/project/control-lock';
import { readCloseJournal } from '../src/specs/lifecycle/journal-store';
import { previewCloseOperation } from '../src/specs/lifecycle/preflight';
import { reserveCloseOperation } from '../src/specs/lifecycle/reservation';
import { assertResourcesAvailable } from '../src/specs/lifecycle/resources';
import { createGitTestProject, git } from './support/git-project';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await createGitTestProject('specflow-close-resources-Ż ', 'runtime: {}\n');
  roots.push(root);
  const branch = git(root, 'symbolic-ref', '--short', 'HEAD');
  await writeFile(
    join(root, '.nevo/config.yaml'),
    'runtime: {}\ngit:\n  enabled: false\n  integrationTargetBranch: ' + branch + '\n',
  );
  git(root, 'add', '--', '.nevo/config.yaml');
  git(
    root,
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.invalid',
    'commit',
    '-qm',
    'target',
  );
  const engine = await bootstrapProjectHome(root);
  return { root, engine, branch };
}

async function commitSpecification(root: string, title: string) {
  const scaffold = createSpecificationScaffold({
    specId: randomUUID(),
    title,
    created: '2026-10-17',
  });
  for (const file of scaffold.files) {
    const absolute = join(root, file.relativePath);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, file.content, 'utf8');
  }
  git(root, 'add', '--', 'specs/active');
  git(
    root,
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.invalid',
    'commit',
    '-qm',
    'scaffold ' + title,
  );
  return scaffold;
}

describe('E2.T10 — shared durable resource admission', () => {
  it('read-only previews retain the branch, checkout and fingerprint without side effects', async () => {
    const { root, engine, branch } = await fixture();
    const scaffold = await commitSpecification(root, 'First archived spec');
    const head = git(root, 'rev-parse', 'HEAD');
    const specId = scaffold.files[0]!.content.match(/spec_id: ([^\n]+)/u)?.[1];
    expect(specId).toBeDefined();

    const preview = await previewCloseOperation(engine, {
      kind: 'specification-close',
      specId: specId!,
    });
    expect(preview.source.branch).toBe(branch);
    expect(preview.target?.branch).toBe(branch);
    expect(preview.source.head).toBe(head);
    expect(preview.resources).toContain('checkout:' + engine.workspace.workspaceId);
    expect(git(root, 'status', '--porcelain')).toBe('');
    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(await readCloseJournal(engine.context, preview.operationId)).toBeUndefined();
  });

  it('different Specs in the same primary checkout cannot reserve mutations concurrently', async () => {
    const { root, engine } = await fixture();
    const first = await commitSpecification(root, 'One first spec');
    const second = await commitSpecification(root, 'Two second spec');
    const firstId = first.files[0]!.content.match(/spec_id: ([^\n]+)/u)?.[1]!;
    const secondId = second.files[0]!.content.match(/spec_id: ([^\n]+)/u)?.[1]!;

    const request = {
      kind: 'specification-close' as const,
      operationId: randomUUID(),
      specId: firstId,
    };
    const initial = await reserveCloseOperation(engine, request);
    expect(initial.existing).toBe(false);
    expect(initial.journal.stage).toBe('reserved');
    const repeat = await reserveCloseOperation(engine, request);
    expect(repeat.existing).toBe(true);
    expect(repeat.journal).toEqual(initial.journal);

    await expect(
      reserveCloseOperation(engine, {
        kind: 'specification-close',
        operationId: randomUUID(),
        specId: secondId,
      }),
    ).rejects.toMatchObject({ code: 'CLOSE_CONFLICT' });
    await withProjectControlLock(engine.context, async () => {
      await expect(
        assertResourcesAvailable(engine.context, ['checkout:' + engine.workspace.workspaceId]),
      ).rejects.toMatchObject({ code: 'CLOSE_CONFLICT' });
    });
    expect(git(root, 'status', '--porcelain')).toBe('');
  });

  it('rejects a new Create checkout reservation while Close holds its durable journal', async () => {
    const { root, engine } = await fixture();
    const scaffold = await commitSpecification(root, 'To be closed');
    const specId = scaffold.files[0]!.content.match(/spec_id: ([^\n]+)/u)?.[1]!;
    await reserveCloseOperation(engine, {
      kind: 'specification-close',
      operationId: randomUUID(),
      specId,
    });
    await withProjectControlLock(engine.context, async () => {
      await expect(
        assertResourcesAvailable(engine.context, [
          'checkout:' + engine.workspace.workspaceId,
          'spec:' + randomUUID(),
        ]),
      ).rejects.toMatchObject({ code: 'CLOSE_CONFLICT' });
    });
  });
});
