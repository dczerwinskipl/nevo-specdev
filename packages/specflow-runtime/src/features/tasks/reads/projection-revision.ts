import { createHash, randomUUID } from 'node:crypto';
import type { TaskIdentity } from './facts';
import type { ReadContext } from './page-leases';
const policies = new WeakMap<object, string>();

/** A filtered evidence index is stable only within the same subject and policy basis. */
export function projectionRevision(
  identity: TaskIdentity,
  context: ReadContext,
  basis: readonly (string | null)[],
) {
  let policy = policies.get(context.policy);
  if (!policy) {
    policy = randomUUID();
    policies.set(context.policy, policy);
  }
  return createHash('sha256')
    .update(JSON.stringify([identity, context.subject, policy, basis]))
    .digest('hex');
}
