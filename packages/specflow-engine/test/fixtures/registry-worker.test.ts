import { access, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

import { it } from 'vitest';

import {
  addWorkspace,
  bindSpecToWorkspace,
  resolveProjectHome,
  readWorkspaceRegistry,
  updateWorkspaceRegistry,
  withProjectControlLock,
  workspaceRegistryPath,
} from '../../src/index';
import { writeJsonAtomically } from '../../src/project/atomic-json';

it.skipIf(!process.env.NEVO_REGISTRY_WORKER)('independent registry mutation process', async () => {
  const home = process.env.NEVO_REGISTRY_HOME!;
  const ready = process.env.NEVO_REGISTRY_READY!;
  const go = process.env.NEVO_REGISTRY_GO!;
  const mode = process.env.NEVO_REGISTRY_MODE!;
  const targetId = process.env.NEVO_REGISTRY_TARGET!;
  const context = await resolveProjectHome({ cwd: home });
  await writeFile(ready, 'ready');
  const deadline = Date.now() + 25000;
  while (true) {
    try {
      await access(go);
      break;
    } catch {
      if (Date.now() > deadline) throw new Error('Worker barrier timed out.');
      await sleep(20);
    }
  }

  if (mode === 'bind') {
    await updateWorkspaceRegistry(
      context,
      (current) =>
        bindSpecToWorkspace(
          current,
          targetId,
          process.env.NEVO_REGISTRY_WORKSPACE_ID ?? current.primaryWorkspaceId,
        ),
      { lock: { waitMs: 25000 } },
    );
  } else if (mode === 'register') {
    await updateWorkspaceRegistry(
      context,
      (current) =>
        addWorkspace(current, {
          workspaceId: targetId,
          kind: 'linked',
          root: process.env.NEVO_REGISTRY_LINKED!,
          managed: true,
        }),
      { lock: { waitMs: 25000 } },
    );
  } else if (mode === 'crash-lock') {
    await withProjectControlLock(context, async () => {
      // Exiting without finally intentionally leaves an orphan control lock.
      process.kill(process.pid, 'SIGKILL');
      await sleep(500);
    });
  } else if (mode === 'crash-before-rename') {
    await withProjectControlLock(context, async () => {
      await writeJsonAtomically(
        workspaceRegistryPath(context),
        { version: 1, deliberatelyIncomplete: true },
        {
          beforePublish: async () => {
            process.kill(process.pid, 'SIGKILL');
            await sleep(500);
          },
        },
      );
    });
  } else if (mode === 'crash-after-rename') {
    await withProjectControlLock(context, async () => {
      const current = await readWorkspaceRegistry(context);
      await writeJsonAtomically(workspaceRegistryPath(context), {
        ...current,
        revision: current.revision + 1,
      });
      process.kill(process.pid, 'SIGKILL');
      await sleep(500);
    });
  } else {
    throw new Error('Unknown process test mode.');
  }
});
