import { describe, expect, it } from 'vitest';
import { PageLeases } from './page-leases';
const identity = { projectId: 'p', workspaceId: 'w', specId: 's', taskId: 't' };
const context = { subject: 'alice', policy: {} };
const input = {
  identity,
  context,
  kind: 'history' as const,
  source: { identity, handle: 'owner-read', version: '1', coverage: 'complete' as const },
  start: null,
  initialLimit: 5,
};
describe('Disposable page leases', () => {
  it('binds identity, collection, subject and immutable policy without a bearer grant', () => {
    const leases = new PageLeases(),
      ref = leases.create(input);
    expect(leases.resolve(ref.token, 'history', identity, context)).not.toBeNull();
    for (const key of ['projectId', 'workspaceId', 'specId', 'taskId'] as const)
      expect(
        leases.resolve(ref.token, 'history', { ...identity, [key]: 'other' }, context),
      ).toBeNull();
    expect(leases.resolve(ref.token, 'resources', identity, context)).toBeNull();
    expect(
      leases.resolve(ref.token, 'history', identity, { ...context, subject: 'bob' }),
    ).toBeNull();
    expect(leases.resolve(ref.token, 'history', identity, { ...context, policy: {} })).toBeNull();
    expect(new PageLeases().resolve(ref.token, 'history', identity, context)).toBeNull();
  });
  it('retains replayable continuation and its exact limit, never numeric offsets from the client', () => {
    const leases = new PageLeases(),
      ref = leases.create(input);
    expect(leases.resolve(ref.token, 'history', identity, context, undefined, 2)?.limit).toBe(2);
    const cursor = leases.continue(ref.token, 'owner-continuation', 2)!;
    expect(leases.continue(ref.token, 'owner-continuation', 2)).toBe(cursor);
    expect(leases.resolve(ref.token, 'history', identity, context, cursor)).toMatchObject({
      continuation: 'owner-continuation',
      limit: 2,
    });
    expect(leases.resolve(ref.token, 'history', identity, context, cursor, 3)).toBeNull();
    expect(leases.resolve(ref.token, 'history', identity, context, undefined, 3)).toBeNull();
    for (const malformed of ['0', '-1', 'undefined', '', 'unknown'])
      expect(leases.resolve(ref.token, 'history', identity, context, malformed)).toBeNull();
    const other = leases.create(input);
    expect(leases.resolve(other.token, 'history', identity, context, cursor)).toBeNull();
  });
  it('expires and evicts both leases and continuations with bounded capacity', () => {
    let now = 0;
    const leases = new PageLeases({ capacity: 1, ttlMs: 10, now: () => now }),
      ref = leases.create(input),
      cursor = leases.continue(ref.token, 'c1', 5)!;
    leases.continue(ref.token, 'c2', 5);
    expect(leases.resolve(ref.token, 'history', identity, context, cursor)).toBeNull();
    const next = leases.create(input);
    expect(leases.resolve(ref.token, 'history', identity, context)).toBeNull();
    now = 10;
    expect(leases.resolve(next.token, 'history', identity, context)).toBeNull();
  });
});
