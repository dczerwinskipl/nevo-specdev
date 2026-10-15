import type { SpecFlowEngine } from '../application';
import { normalizeCreateClientIntent } from './create-intent';
import {
  createSpecificationWithIntent,
  type CreateEffectHook,
  type CreateSpecificationInput,
  type CreateSpecificationOptions,
  type CreatedSpecification,
} from './durable-create';

export interface TestCreateOptions extends CreateSpecificationOptions {
  readonly afterEffect?: CreateEffectHook;
}

/** Fault injection for real filesystem/process tests, not for Engine consumers. */
export function createSpecificationForTesting(
  engine: SpecFlowEngine,
  input: CreateSpecificationInput,
  options: TestCreateOptions = {},
): Promise<CreatedSpecification> {
  return createSpecificationWithIntent(
    engine,
    input.operationId,
    normalizeCreateClientIntent(input),
    () => input.created,
    options,
    options.afterEffect,
  );
}
