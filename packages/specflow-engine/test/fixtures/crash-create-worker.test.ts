import { writeFile } from 'node:fs/promises';

import { it } from 'vitest';

import {
  openSpecFlowEngine,
  createSpecificationForTesting as createSpecification,
  type CreateSpecificationInput,
} from '../../src/testing';
import { writeJsonAtomically } from '../../src/project/atomic-json';
import { withCreateJournalLock, createJournalPath } from '../../src/specs/create-journal';

const enabled = process.env.NEVO_CREATE_CRASH_WORKER === '1';

it.skipIf(!enabled)(
  'create operation interrupted across OS process boundaries',
  async () => {
    const root = process.env.NEVO_CREATE_CRASH_HOME!;
    const signal = process.env.NEVO_CREATE_CRASH_SIGNAL!;
    const mode = process.env.NEVO_CREATE_CRASH_MODE!;
    const input = JSON.parse(process.env.NEVO_CREATE_CRASH_INPUT!) as CreateSpecificationInput;
    const engine = await openSpecFlowEngine({ cwd: root });

    if (mode === 'atomic-write') {
      // Die in a real writeJsonAtomically beforePublish hook, AFTER its
      // temp file is fsynced but BEFORE rename, with the control lock held.
      await withCreateJournalLock(engine.context, () =>
        writeJsonAtomically(
          createJournalPath(engine.context, input.operationId),
          { incomplete: true },
          {
            beforePublish: async () => {
              await writeFile(signal, JSON.stringify({ stage: 'staged', pid: process.pid }));
              return new Promise<void>(() => undefined);
            },
          },
        ),
      );
      throw new Error('Atomic crash barrier unexpectedly returned.');
    }

    if (mode === 'crash') {
      const checkpoint = process.env.NEVO_CREATE_CRASH_STAGE!;
      await createSpecification(engine, input, {
        afterEffect: async (stage) => {
          if (stage !== checkpoint) return;
          await writeFile(signal, JSON.stringify({ stage, pid: process.pid }));
          await new Promise<void>(() => undefined);
        },
      });
      throw new Error('Create crash barrier unexpectedly returned.');
    }

    if (mode !== 'resume') throw new Error('Unexpected crash worker mode.');
    const expectedError = process.env.NEVO_CREATE_CRASH_EXPECT_ERROR;
    try {
      const result = await createSpecification(engine, input, {
        // A fresh, explicitly started crash-recovery process is the operator's
        // evidence that the killed writer is no longer active.
        resumeInterruptedOperation: true,
        confirmInterruptedGitSettled: process.env.NEVO_CREATE_CRASH_GIT_SETTLED === '1',
      });
      if (expectedError) throw new Error('Unexpected successful recovery: ' + result.specId);
      await writeFile(signal, JSON.stringify(result));
    } catch (error) {
      if (
        expectedError &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === expectedError
      ) {
        await writeFile(signal, 'expected:' + expectedError);
        return;
      }
      throw error;
    }
  },
  60000,
);
