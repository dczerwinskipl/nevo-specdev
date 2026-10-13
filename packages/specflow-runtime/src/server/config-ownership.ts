import { onlyKeys, record } from '../config/parsing/value-parsers';

const PROJECT_SERVER_KEYS = new Set(['host', 'port', 'publicOrigin', 'tls', 'rateLimit']);
const PROJECT_TLS_KEYS = new Set(['enabled']);
const LOCAL_SERVER_KEYS = new Set(['tls']);
const LOCAL_TLS_KEYS = new Set(['certFile', 'keyFile']);

export function assertProjectServerConfigOwnership(value: unknown): void {
  if (value === undefined) return;

  const server = record(value, 'server');
  onlyKeys(server, PROJECT_SERVER_KEYS, 'server');

  if (server.tls === undefined) return;
  const tls = record(server.tls, 'server.tls');
  onlyKeys(tls, PROJECT_TLS_KEYS, 'server.tls');
}

export function assertLocalServerConfigOwnership(value: unknown): void {
  if (value === undefined) return;

  const server = record(value, 'server');
  onlyKeys(server, LOCAL_SERVER_KEYS, 'server');

  if (server.tls === undefined) return;
  const tls = record(server.tls, 'server.tls');
  onlyKeys(tls, LOCAL_TLS_KEYS, 'server.tls');
}
