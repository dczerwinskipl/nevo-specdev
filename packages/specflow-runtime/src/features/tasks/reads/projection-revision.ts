import { createHash, randomUUID } from 'node:crypto';
import type { TaskIdentity } from './facts';
import type { ReadContext } from './page-leases';
import type { TaskSnapshot } from '@nevo/specflow-contracts/tasks';
const policies = new WeakMap<object, string>();

/** Inspector bindings depend on the actual authorized view, including membership resolution. */
export function projectionRevision(
  identity: TaskIdentity,
  context: ReadContext,
  basis: readonly (string | null)[],
  snapshot: TaskSnapshot,
) {
  let policy = policies.get(context.policy);
  if (!policy) {
    policy = randomUUID();
    policies.set(context.policy, policy);
  }
  const { resources, history } = snapshot.sections;
  // Fresh lease tokens describe temporary transport handles, not a changed inspected object.
  const view = {
    ...snapshot,
    revision: undefined,
    sections: {
      ...snapshot.sections,
      resources:
        resources.state === 'available'
          ? {
              ...resources,
              data: {
                ...resources.data,
                page: resources.data.page
                  ? { initialLimit: resources.data.page.initialLimit }
                  : null,
              },
            }
          : resources,
      history:
        history.state === 'available'
          ? { ...history, data: { initialLimit: history.data.initialLimit } }
          : history,
    },
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical([identity, context.subject, policy, basis, view])))
    .digest('hex');
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonical(record[key])]),
    );
  }
  return value;
}
