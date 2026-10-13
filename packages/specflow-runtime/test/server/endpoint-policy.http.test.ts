import { describe, expect, it, vi } from 'vitest';
import { createRuntimeApp } from '../../src/server/app';
import { passwordConfig } from '../auth/support/config';
describe('Runtime endpoint policy HTTP', () => {
  it('shares the default budget across existing and future routes and blocks before the reader', async () => {
    const config = passwordConfig(),
      read = vi.fn();
    const app = await createRuntimeApp(
      {
        ...config,
        server: { ...config.server, rateLimit: { max: 2, timeWindowMs: 60_000 } },
        authentication: { ...config.authentication, mode: 'none' },
      },
      { dataMode: 'demo', documents: { source: { read } } },
    );
    app.get('/api/future-feature', () => ({ ok: true }));
    try {
      expect((await app.inject('/api/specs/admission/tasks/TASK-03')).statusCode).toBe(200);
      expect((await app.inject('/api/future-feature')).statusCode).toBe(200);
      const denied = await app.inject('/api/specs/admission/documents/spec');
      expect(denied.statusCode).toBe(429);
      expect(denied.json()).toMatchObject({ error: 'rate_limited' });
      expect(denied.headers['retry-after']).toBeDefined();
      expect(denied.headers['cache-control']).toBe('no-store');
      expect(read).not.toHaveBeenCalled();
      expect(
        (
          await app.inject({
            url: '/api/runtime/info',
            headers: { 'x-forwarded-for': '203.0.113.100' },
          })
        ).statusCode,
      ).toBe(429);
      expect(
        (await app.inject({ url: '/api/runtime/info', remoteAddress: '127.0.0.2' })).statusCode,
      ).toBe(200);
    } finally {
      await app.close();
    }
  });
  it('keeps strict password source attempts separate from an exhausted default budget', async () => {
    const config = passwordConfig();
    const app = await createRuntimeApp({
      ...config,
      server: { ...config.server, rateLimit: { max: 2, timeWindowMs: 60_000 } },
    });
    try {
      await app.inject('/api/runtime/info');
      await app.inject('/api/runtime/info');
      expect((await app.inject('/api/runtime/info')).statusCode).toBe(429);
      for (let i = 0; i < 10; i++)
        expect(
          (
            await app.inject({
              method: 'POST',
              url: '/api/auth/password/login',
              payload: { username: 'missing-' + i, password: 'invalid-password' },
            })
          ).statusCode,
        ).toBe(401);
      const denied = await app.inject({
        method: 'POST',
        url: '/api/auth/password/login',
        payload: { username: 'missing-last', password: 'invalid-password' },
      });
      expect(denied.statusCode).toBe(429);
      expect(denied.json()).toEqual({ error: 'rate_limited' });
    } finally {
      await app.close();
    }
  });
  it('renews the default budget after its configured window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const config = passwordConfig();
    const app = await createRuntimeApp({
      ...config,
      server: { ...config.server, rateLimit: { max: 1, timeWindowMs: 1000 } },
      authentication: { ...config.authentication, mode: 'none' },
    });
    try {
      expect((await app.inject('/api/runtime/info')).statusCode).toBe(200);
      expect((await app.inject('/api/runtime/info')).statusCode).toBe(429);
      vi.setSystemTime(Date.now() + 1001);
      expect((await app.inject('/api/runtime/info')).statusCode).toBe(200);
    } finally {
      await app.close();
      vi.useRealTimers();
    }
  });
});
