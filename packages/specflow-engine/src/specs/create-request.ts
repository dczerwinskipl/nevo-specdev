import { randomUUID } from 'node:crypto';

import type { SpecFlowEngine } from '../application';
import { normalizeCreateClientIntent, type CreateClientTargetInput } from './create-intent';
import { createSpecificationWithIntent, type CreatedSpecification } from './durable-create';

/** Transport-neutral request: optional overrides preserve user omission. */
export interface CreateSpecificationRequest {
  readonly operationId?: string;
  readonly title: string;
  readonly goal?: string;
  readonly target: CreateClientTargetInput;
}

export async function createSpecificationFromRequest(
  engine: SpecFlowEngine,
  request: CreateSpecificationRequest,
): Promise<CreatedSpecification> {
  // No date or ref defaults are chosen outside the Project Home lock. An
  // existing journal is inspected before sampling a fresh clock.
  return createSpecificationWithIntent(
    engine,
    request.operationId ?? randomUUID(),
    normalizeCreateClientIntent(request),
    () => new Date().toISOString().slice(0, 10),
  );
}
