import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, RawServerBase } from 'fastify';
import { parseEndpointRateLimit, type EndpointRateLimit } from './endpoint-policy-config';

/** Default shared source budget. Feature-owned route limits get independent plugin stores. */
export async function registerEndpointPolicy<RawServer extends RawServerBase>(
  app: FastifyInstance<RawServer>,
  policy?: EndpointRateLimit,
): Promise<void> {
  const limits = parseEndpointRateLimit(policy);
  await app.register(rateLimit, {
    global: true,
    max: limits.max,
    timeWindow: limits.timeWindowMs,
    ipv6Subnet: 64,
    cache: 5000,
    errorResponseBuilder: () => ({ statusCode: 429, error: 'rate_limited' }),
  });
  app.addHook('onSend', (_request, reply, payload, done) => {
    if (reply.statusCode === 429) reply.header('Cache-Control', 'no-store');
    done(null, payload);
  });
}
