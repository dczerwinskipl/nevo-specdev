import { randomUUID } from 'node:crypto';
import { channel } from 'node:diagnostics_channel';
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  bootstrapProjectHome,
  createSpecificationForTesting,
  createSpecificationFromRequest,
  type CreateSpecificationInput,
} from '../src/testing';
import { createGitTestProject, git } from './support/git-project';

/**
 * Run explicitly with NEVO_PROFILE_CREATE_LOCK=1 pnpm --filter @nevo/specflow-engine test.
 * Prints measurements without flaky performance thresholds. Real Git + filesystems,
 * different canonical spec counts, journal counts and Git worktree counts.
 */
describe('Create reservation lock profile (opt-in)', () => {
  // Temporary Linux-only CI measurement. Restore the opt-in gate after recording results.
  it.skipIf(process.env.NEVO_PROFILE_CREATE_LOCK !== '1' && process.platform !== 'linux')(
    'reports lock wait/hold durations and Git subprocess counts',
    async () => {
      for (const size of [0, 5, 20]) {
        const root = await createGitTestProject(
          'specflow-lock-profile-',
          'runtime: {}\ngit:\n  enabled: true\n',
        );
        const worktrees: string[] = [];
        try {
          const engine = await bootstrapProjectHome(root);
          for (let i = 0; i < size; i++) {
            await createSpecificationFromRequest(engine, {
              title: `Profile canonical ${size}-${i}`,
              target: { kind: 'existing', workspaceId: engine.workspace.workspaceId },
            });
          }
          if (size) {
            git(root, 'add', 'specs');
            git(
              root,
              '-c',
              'user.name=SpecFlow Test',
              '-c',
              'user.email=specflow@example.invalid',
              'commit',
              '-qm',
              'profile fixtures',
            );
          }

          for (let i = 0; i < size; i++) {
            const input: CreateSpecificationInput = {
              operationId: randomUUID(),
              title: `Unfinished profile ${size}-${i}`,
              created: '2026-10-15',
              target: { kind: 'existing', workspaceId: engine.workspace.workspaceId },
            };
            await expect(
              createSpecificationForTesting(engine, input, {
                afterEffect: (effect) =>
                  effect === 'reservation'
                    ? Promise.reject(new Error('Profile checkpoint'))
                    : Promise.resolve(),
              }),
            ).rejects.toThrow('Profile checkpoint');
          }

          for (let i = 0; i < Math.ceil(size / 5); i++) {
            const linked = join(dirname(root), `profile-linked-${randomUUID()}`);
            git(root, 'worktree', 'add', '-q', '-b', `profile-${randomUUID()}`, linked, 'HEAD');
            worktrees.push(linked);
          }

          const locks: unknown[] = [];
          let gitCalls = 0;
          const lockChannel = channel('nevo.specflow.engine.control-lock');
          const gitChannel = channel('nevo.specflow.engine.git-process');
          const onLock = (value: unknown): void => {
            locks.push(value);
          };
          const onGit = (): void => {
            gitCalls++;
          };
          lockChannel.subscribe(onLock);
          gitChannel.subscribe(onGit);
          try {
            const input: CreateSpecificationInput = {
              operationId: randomUUID(),
              title: `Measured reservation ${size}`,
              created: '2026-10-15',
              target: { kind: 'new-worktree', baseRef: 'HEAD' },
            };
            await expect(
              createSpecificationForTesting(engine, input, {
                afterEffect: (effect) =>
                  effect === 'reservation'
                    ? Promise.reject(new Error('Profile checkpoint'))
                    : Promise.resolve(),
              }),
            ).rejects.toThrow('Profile checkpoint');
          } finally {
            lockChannel.unsubscribe(onLock);
            gitChannel.unsubscribe(onGit);
          }
          expect(locks).toHaveLength(1);
          expect(locks[0]).toMatchObject({
            projectId: engine.context.project.projectId,
            released: true,
          });
          console.info(
            'CREATE_LOCK_PROFILE ' +
              JSON.stringify({
                specs: size,
                journals: size,
                linkedWorktrees: worktrees.length,
                lock: locks[0],
                gitSubprocesses: gitCalls,
              }),
          );
        } finally {
          for (const linked of worktrees) {
            try {
              git(root, 'worktree', 'remove', '--force', linked);
            } catch {
              // The disposable fixture directory is removed below either way.
            }
            await rm(linked, { recursive: true, force: true });
          }
          await rm(root, { recursive: true, force: true });
        }
      }
    },
    300_000,
  );
});
