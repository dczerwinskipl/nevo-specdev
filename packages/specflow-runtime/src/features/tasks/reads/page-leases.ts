import { randomUUID } from 'node:crypto';
import type { SourceRead, TaskIdentity } from './facts';
import { sameTask } from './facts';

export interface ReadContext {
  subject: string;
  policy: object;
}
export interface PageLease {
  identity: TaskIdentity;
  context: ReadContext;
  kind: 'resources' | 'history';
  source: SourceRead;
  start: string | null;
  initialLimit: number;
  firstLimit?: number;
  expires: number;
}
interface Cursor {
  token: string;
  position: string;
  limit: number;
  expires: number;
}
export interface LeaseOptions {
  ttlMs?: number;
  capacity?: number;
  now?: () => number;
  randomId?: () => string;
}

/** Bounded disposable handles only: no collection, Task state or workflow authority is retained. */
export class PageLeases {
  private readonly leases = new Map<string, PageLease>();
  private readonly cursors = new Map<string, Cursor>();
  private readonly now: () => number;
  private readonly randomId: () => string;
  private readonly ttl: number;
  private readonly capacity: number;
  constructor(options: LeaseOptions = {}) {
    this.now = options.now ?? Date.now;
    this.randomId = options.randomId ?? randomUUID;
    this.ttl = options.ttlMs ?? 5 * 60_000;
    this.capacity = options.capacity ?? 1000;
    if (
      !Number.isFinite(this.ttl) ||
      !(this.ttl > 0) ||
      !Number.isSafeInteger(this.capacity) ||
      this.capacity < 1
    )
      throw Error('Invalid read lease limits');
  }
  private prune() {
    for (const [key, lease] of this.leases)
      if (lease.expires <= this.now()) this.leases.delete(key);
    for (const [key, cursor] of this.cursors)
      if (cursor.expires <= this.now() || !this.leases.has(cursor.token)) this.cursors.delete(key);
  }
  create(input: Omit<PageLease, 'expires'>) {
    this.prune();
    while (this.leases.size >= this.capacity) this.leases.delete(this.leases.keys().next().value!);
    const token = this.randomId();
    this.leases.set(token, { ...input, expires: this.now() + this.ttl });
    return { token, initialLimit: input.initialLimit };
  }
  resolve(
    token: string,
    kind: PageLease['kind'],
    identity: TaskIdentity,
    context: ReadContext,
    cursor?: string,
    requestedLimit?: number,
  ) {
    this.prune();
    const lease = this.leases.get(token);
    if (
      lease?.kind !== kind ||
      !sameTask(lease.identity, identity) ||
      lease.context.subject !== context.subject ||
      lease.context.policy !== context.policy
    )
      return null;
    if (cursor !== undefined) {
      const record = this.cursors.get(cursor);
      if (
        record?.token !== token ||
        (requestedLimit !== undefined && requestedLimit !== record.limit)
      )
        return null;
      return { lease, continuation: record.position, limit: record.limit };
    }
    const limit = requestedLimit ?? lease.firstLimit ?? lease.initialLimit;
    if (lease.firstLimit !== undefined && limit !== lease.firstLimit) return null;
    lease.firstLimit = limit;
    return { lease, continuation: lease.start, limit };
  }
  continue(token: string, position: string | null, limit: number) {
    if (position === null) return null;
    this.prune();
    const lease = this.leases.get(token);
    if (!lease) return null;
    // Replaying a page does not consume capacity or change its continuation handle.
    for (const [key, cursor] of this.cursors)
      if (cursor.token === token && cursor.position === position && cursor.limit === limit)
        return key;
    while (this.cursors.size >= this.capacity)
      this.cursors.delete(this.cursors.keys().next().value!);
    const cursor = this.randomId();
    this.cursors.set(cursor, { token, position, limit, expires: lease.expires });
    return cursor;
  }
}
