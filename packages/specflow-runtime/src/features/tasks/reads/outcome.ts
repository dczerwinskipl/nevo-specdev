export type ReadFailure = { kind: 'unavailable' } | { kind: 'not_found' } | { kind: 'expired' };
export type ReadOutcome<T> = { kind: 'ok'; value: T } | ReadFailure;
