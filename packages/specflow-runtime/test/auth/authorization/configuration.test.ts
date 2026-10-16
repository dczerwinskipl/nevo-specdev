import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseAuthorizationConfig } from '../../../src/features/auth/authorization/configuration/parse';
import { loadRuntimeConfig } from '../../../src/config/index';

const MINIMAL_PROJECT = `
runtime:
  server:
    host: 127.0.0.1
    port: 4318
    tls:
      enabled: false
  authentication:
    mode: none
    users:
      demo-user:
        name: Demo User
    providers:
      password:
        enabled: false
      oidc:
        instances: {}
  authorization:
    assignments:
      - userId: demo-user
        role: developer
`;

function loadFrom(cwd: string) {
  return loadRuntimeConfig({
    projectConfigPath: join(cwd, '.nevo/config.yaml'),
    localConfigPath: join(cwd, '.nevo/local/config.yaml'),
  });
}

describe('SpecFlow authorization configuration', () => {
  it('defaults omitted assignment scope to canonical global scope', () => {
    expect(
      parseAuthorizationConfig(
        { assignments: [{ userId: 'u1', role: 'developer' }] },
        new Set(['u1']),
      ).assignments,
    ).toEqual([{ userId: 'u1', role: 'developer', scope: {} }]);
  });

  it('accepts domain-neutral safe scope dimensions', () => {
    const knownUsers = new Set(['u1']);
    for (const scope of [
      {},
      { specId: 'S1' },
      { tenantId: 'T1' },
      { tenantId: 'T1', customerId: 'C1' },
      { futureDimension: 'value' },
    ]) {
      expect(
        parseAuthorizationConfig(
          { assignments: [{ userId: 'u1', role: 'developer', scope }] },
          knownUsers,
        ).assignments,
      ).toHaveLength(1);
    }
  });

  it('rejects empty or unsafe scope keys and empty values', () => {
    const knownUsers = new Set(['u1']);

    expect(() =>
      parseAuthorizationConfig(
        { assignments: [{ userId: 'u1', role: 'developer', scope: { tenantId: '' } }] },
        knownUsers,
      ),
    ).toThrowError(/non-empty string/);

    expect(() =>
      parseAuthorizationConfig(
        { assignments: [{ userId: 'u1', role: 'developer', scope: { '': 'T1' } }] },
        knownUsers,
      ),
    ).toThrowError(/must contain only letters/);

    expect(() =>
      parseAuthorizationConfig(
        { assignments: [{ userId: 'u1', role: 'developer', scope: { ' specId ': 'S1' } }] },
        knownUsers,
      ),
    ).toThrowError(/must contain only letters/);

    const unsafeScope = Object.fromEntries([['__proto__', 'global-by-accident']]);
    expect(() =>
      parseAuthorizationConfig(
        { assignments: [{ userId: 'u1', role: 'developer', scope: unsafeScope }] },
        knownUsers,
      ),
    ).toThrowError(/must contain only letters/);
  });

  it('H10: rejects workstation-local workspaceId in committed authorization grants', async () => {
    const knownUsers = new Set(['u1']);
    expect(() =>
      parseAuthorizationConfig(
        { assignments: [{ userId: 'u1', role: 'viewer', scope: { workspaceId: 'local-only' } }] },
        knownUsers,
      ),
    ).toThrowError(/workspaceId is a local workspace selector/);

    const cwd = await mkdtemp(join(tmpdir(), 'specflow-authz-portability-'));
    await mkdir(join(cwd, '.nevo'), { recursive: true });
    await writeFile(
      join(cwd, '.nevo/config.yaml'),
      MINIMAL_PROJECT.replace(
        'role: developer',
        'role: developer\n        scope:\n          workspaceId: workstation-local-id',
      ),
      'utf8',
    );
    await expect(loadFrom(cwd)).rejects.toThrowError(/workspaceId is a local workspace selector/);
  });

  it('rejects unknown roles and configured auth users', () => {
    expect(() =>
      parseAuthorizationConfig({ assignments: [{ userId: 'u1', role: 'owner' }] }, new Set(['u1'])),
    ).toThrowError(/unknown role 'owner'/);

    expect(() =>
      parseAuthorizationConfig(
        { assignments: [{ userId: 'local-only', role: 'admin' }] },
        new Set(['configured-user']),
      ),
    ).toThrowError(/unknown configured auth user 'local-only'/);
  });

  it('rejects authorization from local config', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'specflow-authz-local-'));
    await mkdir(join(cwd, '.nevo/local'), { recursive: true });
    await writeFile(join(cwd, '.nevo/config.yaml'), MINIMAL_PROJECT, 'utf8');
    await writeFile(
      join(cwd, '.nevo/local/config.yaml'),
      'runtime:\n  authorization:\n    assignments: []\n',
      'utf8',
    );
    await expect(loadFrom(cwd)).rejects.toThrowError(/authorization is project-only/);
  });

  it('does not allow assignments to depend on local-only users', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'specflow-authz-user-'));
    await mkdir(join(cwd, '.nevo/local'), { recursive: true });
    await writeFile(
      join(cwd, '.nevo/config.yaml'),
      MINIMAL_PROJECT.replace(
        'demo-user:\n        name: Demo User',
        'configured-user:\n        name: Configured User',
      ),
      'utf8',
    );
    await writeFile(
      join(cwd, '.nevo/local/config.yaml'),
      'runtime:\n  authentication:\n    users:\n      demo-user:\n        name: Local User\n',
      'utf8',
    );
    await expect(loadFrom(cwd)).rejects.toThrowError(/unknown configured auth user 'demo-user'/);
  });
});
