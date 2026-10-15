import { setTimeout as sleep } from 'node:timers/promises';

import type { SpecFlowEngine } from '../../application';
import { CreateOperationError, readCreateJournal, type CreateJournal } from '../create-journal';

export async function followExistingCreateOperation(
  engine: SpecFlowEngine,
  operationId: string,
): Promise<CreateJournal> {
  const deadline = Date.now() + 90000;
  let record = await readCreateJournal(engine.context, operationId);
  if (!record) throw recovery('Create journal disappeared during a concurrent operation.');
  while (
    record.stage !== 'completed' &&
    record.stage !== 'recovery-required' &&
    Date.now() < deadline
  ) {
    await sleep(100);
    const current = await readCreateJournal(engine.context, operationId);
    if (!current) throw recovery('Create journal disappeared during a concurrent operation.');
    record = current;
  }
  // Never resume mutable stages after observing a concurrent writer timeout.
  // The original writer may still be running (especially on Windows).
  return record;
}

function recovery(message: string): CreateOperationError {
  return new CreateOperationError('CREATE_RECOVERY_REQUIRED', message);
}
