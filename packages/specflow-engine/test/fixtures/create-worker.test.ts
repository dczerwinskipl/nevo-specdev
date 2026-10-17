import { access, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

import { it } from 'vitest';

import {
  createSpecificationForTesting as createSpecification,
  openSpecFlowEngine,
  type CreateSpecificationInput,
} from '../../src/testing';

it.skipIf(!process.env.NEVO_CREATE_WORKER)(
  'independent durable Spec creator',
  async () => {
    const root = process.env.NEVO_CREATE_WORKER_HOME!;
    const ready = process.env.NEVO_CREATE_WORKER_READY!;
    const start = process.env.NEVO_CREATE_WORKER_START!;
    const input = JSON.parse(process.env.NEVO_CREATE_WORKER_INPUT!) as CreateSpecificationInput;
    const engine = await openSpecFlowEngine({ cwd: root });
    await writeFile(ready, 'ready');

    const deadline = Date.now() + 30000;
    while (true) {
      try {
        await access(start);
        break;
      } catch {
        if (Date.now() > deadline) throw new Error('Create worker barrier timed out.');
        await sleep(25);
      }
    }
    const result = await createSpecification(engine, input, {
      confirmInterruptedGitSettled: process.env.NEVO_CREATE_WORKER_GIT_SETTLED === '1',
      afterEffect: async (effect) => {
        if (effect === 'reservation' && process.env.NEVO_CREATE_WORKER_OBSERVED) {
          await writeFile(process.env.NEVO_CREATE_WORKER_OBSERVED, 'reserved');
        }
        if (effect !== process.env.NEVO_CREATE_WORKER_PAUSE_STAGE) return;
        await writeFile(process.env.NEVO_CREATE_WORKER_PAUSED!, effect);
        const release = process.env.NEVO_CREATE_WORKER_RELEASE!;
        const deadline = Date.now() + 30000;
        while (true) {
          try {
            await access(release);
            break;
          } catch {
            if (Date.now() > deadline) throw new Error('Create pause barrier timed out.');
            await sleep(25);
          }
        }
      },
    });
    if (!result.specId)
      throw new Error('Create did not produce a canonical specification identity.');
    if (process.env.NEVO_CREATE_WORKER_RESULT) {
      await writeFile(process.env.NEVO_CREATE_WORKER_RESULT, JSON.stringify(result));
    }
  },
  120000,
);
