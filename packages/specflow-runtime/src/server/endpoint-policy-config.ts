import { integer, onlyKeys, record } from '../config/parsing/value-parsers';
import { RuntimeConfigError } from '../config/parsing/runtime-config-error';

export interface EndpointRateLimit {
  readonly max: number;
  readonly timeWindowMs: number;
}
export const DEFAULT_ENDPOINT_RATE_LIMIT: EndpointRateLimit = { max: 300, timeWindowMs: 60_000 };

export function parseEndpointRateLimit(value: unknown): EndpointRateLimit {
  if (value === undefined) return { ...DEFAULT_ENDPOINT_RATE_LIMIT };
  const input = record(value, 'server.rateLimit');
  onlyKeys(input, new Set(['max', 'timeWindowMs']), 'server.rateLimit');
  const max =
    input.max === undefined
      ? DEFAULT_ENDPOINT_RATE_LIMIT.max
      : integer(input.max, 'server.rateLimit.max');
  const timeWindowMs =
    input.timeWindowMs === undefined
      ? DEFAULT_ENDPOINT_RATE_LIMIT.timeWindowMs
      : integer(input.timeWindowMs, 'server.rateLimit.timeWindowMs');
  if (!Number.isSafeInteger(max) || max < 1 || max > 1_000_000)
    throw new RuntimeConfigError('server.rateLimit.max must be between 1 and 1000000.');
  if (!Number.isSafeInteger(timeWindowMs) || timeWindowMs < 1 || timeWindowMs > 86_400_000)
    throw new RuntimeConfigError('server.rateLimit.timeWindowMs must be between 1 and 86400000.');
  return { max, timeWindowMs };
}
