import { describe, expect, it } from 'vitest';
import { parseEndpointRateLimit } from './endpoint-policy-config';
import {
  assertLocalServerConfigOwnership,
  assertProjectServerConfigOwnership,
} from './config-ownership';
import { parseRuntimeConfig } from '../config/parse';
import { passwordConfig } from '../../test/auth/support/config';
describe('Endpoint policy configuration', () => {
  it('defaults and merges project tuning, without accepting a local weakening or disable flag', () => {
    expect(parseEndpointRateLimit(undefined)).toEqual({ max: 300, timeWindowMs: 60_000 });
    expect(parseEndpointRateLimit({ max: 60 })).toEqual({ max: 60, timeWindowMs: 60_000 });
    expect(() => assertProjectServerConfigOwnership({ rateLimit: { max: 60 } })).not.toThrow();
    expect(() => assertLocalServerConfigOwnership({ rateLimit: { max: 999999 } })).toThrow();
    const config = passwordConfig();
    expect(
      parseRuntimeConfig({ ...config, server: { ...config.server, rateLimit: { max: 60 } } }).server
        .rateLimit?.max,
    ).toBe(60);
  });
  it.each([
    false,
    { enabled: false },
    { max: 0 },
    { max: -1 },
    { max: 1.2 },
    { max: Infinity },
    { timeWindowMs: 0 },
    { timeWindowMs: 86_400_001 },
  ])('rejects invalid/unbounded policy %j', (value) => {
    expect(() => parseEndpointRateLimit(value)).toThrow();
  });
});
