import { randomUUID } from 'node:crypto';

import type { SpecFlowEngine } from '../application';
import {
  createSpecification,
  inspectCreateSpecification,
  type CreatedSpecification,
  type CreateSpecificationTarget,
} from './durable-create';

/**
 * Transport-neutral convenience use case. Engine owns the immutable creation
 * date on retries; adapters own their distinct default workspace selectors.
 */
export interface CreateSpecificationRequest {
  readonly operationId?: string;
  readonly title: string;
  readonly goal?: string;
  readonly target: CreateSpecificationTarget;
}

export async function createSpecificationFromRequest(
  engine: SpecFlowEngine,
  request: CreateSpecificationRequest,
): Promise<CreatedSpecification> {
  const existing = request.operationId
    ? await inspectCreateSpecification(engine, request.operationId)
    : undefined;
  return createSpecification(engine, {
    operationId: request.operationId ?? randomUUID(),
    title: request.title,
    created: existing?.created ?? new Date().toISOString().slice(0, 10),
    ...(request.goal ? { goal: request.goal } : {}),
    target: request.target,
  });
}
