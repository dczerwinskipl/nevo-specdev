import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { createAuthCommand, createStartCommand } from '../src/cli/command';
import {
  isSupportedPasswordHash,
  verifyPassword,
} from '../src/features/auth/authentication/password-login/hash';
import { PASSWORD_MAX_LENGTH } from '../src/features/auth/authentication/password-login/policy';

const here = dirname(fileURLToPath(import.meta.url));

describe('Runtime CLI adapters', () => {
  it('returns a Commander command named "start"', () => {
    const cmd = createStartCommand({
      stdout: () => undefined,
      start: () => Promise.reject(new Error('not invoked')),
    });
    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.name()).toBe('start');
    expect(cmd.description()).toMatch(/SpecFlow local server/i);
  });

  it('passes the demo option explicitly to Runtime instead of changing project configuration', async () => {
    const received: boolean[] = [];
    const cmd = createStartCommand({
      stdout: () => undefined,
      start: (options) => {
        received.push(options.demo);
        return Promise.resolve({
          address: 'http://127.0.0.1:4318',
          close: () => Promise.resolve(),
        });
      },
    });
    cmd.exitOverride();
    await cmd.parseAsync(['node', 'start', '--demo']);
    expect(received).toEqual([true]);
  });

  it('starts the Runtime and reports its listening address', async () => {
    const out: string[] = [];
    let closed = false;
    const cmd = createStartCommand({
      stdout: (line) => out.push(line),
      start: () =>
        Promise.resolve({
          address: 'http://127.0.0.1:4318',
          close: () =>
            Promise.resolve().then(() => {
              closed = true;
            }),
        }),
    });
    cmd.exitOverride();
    await cmd.parseAsync(['node', 'start']);
    expect(out).toEqual(['Nevo SpecFlow available at http://127.0.0.1:4318']);
    expect(closed).toBe(false);
  });

  it('owns graceful shutdown when an abort signal is supplied', async () => {
    const controller = new AbortController();
    let closed = false;
    const cmd = createStartCommand({
      stdout: () => undefined,
      signal: controller.signal,
      start: () =>
        Promise.resolve({
          address: 'http://127.0.0.1:4318',
          close: () =>
            Promise.resolve().then(() => {
              closed = true;
            }),
        }),
    });
    cmd.exitOverride();
    const running = cmd.parseAsync(['node', 'start']);
    controller.abort();
    await running;
    expect(closed).toBe(true);
  });

  it('generates a supported password hash from stdin through the auth feature command', async () => {
    const out: string[] = [];
    const cmd = createAuthCommand({
      stdout: (line) => out.push(line),
      readPasswordFromStdin: () => Promise.resolve('correct horse battery staple\n'),
    });
    cmd.exitOverride();

    await cmd.parseAsync(['node', 'auth', 'hash-password', '--password-stdin']);

    expect(out).toHaveLength(1);
    expect(isSupportedPasswordHash(out[0] ?? '')).toBe(true);
    await expect(verifyPassword('correct horse battery staple', out[0] ?? '')).resolves.toBe(true);
  });

  it('accepts the maximum password length supported by the login API', async () => {
    const password = 'p'.repeat(PASSWORD_MAX_LENGTH);
    const out: string[] = [];
    const cmd = createAuthCommand({
      stdout: (line) => out.push(line),
      readPasswordFromStdin: () => Promise.resolve(`${password}\n`),
    });
    cmd.exitOverride();

    await cmd.parseAsync(['node', 'auth', 'hash-password', '--password-stdin']);

    expect(out).toHaveLength(1);
    await expect(verifyPassword(password, out[0] ?? '')).resolves.toBe(true);
  });

  it('rejects password provisioning above the login API limit', async () => {
    const cmd = createAuthCommand({
      stdout: () => undefined,
      readPasswordFromStdin: () => Promise.resolve(`${'p'.repeat(PASSWORD_MAX_LENGTH + 1)}\n`),
    });
    cmd.exitOverride();

    await expect(
      cmd.parseAsync(['node', 'auth', 'hash-password', '--password-stdin']),
    ).rejects.toThrowError(new RegExp(`at most ${String(PASSWORD_MAX_LENGTH)} characters`));
  });

  it('rejects multi-line password stdin', async () => {
    const cmd = createAuthCommand({
      stdout: () => undefined,
      readPasswordFromStdin: () => Promise.resolve('first\nsecond\n'),
    });
    cmd.exitOverride();

    await expect(
      cmd.parseAsync(['node', 'auth', 'hash-password', '--password-stdin']),
    ).rejects.toThrowError(/exactly one line/);
  });

  it('keeps Commander out of the Runtime capability module', () => {
    const core = readFileSync(join(here, '..', 'src', 'index.ts'), 'utf8');
    expect(core).not.toMatch(/['"]commander['"]/);
    const adapter = readFileSync(join(here, '..', 'src', 'cli', 'command.ts'), 'utf8');
    const authAdapter = readFileSync(join(here, '..', 'src', 'features', 'auth', 'cli.ts'), 'utf8');
    expect(adapter).toMatch(/from 'commander'/);
    expect(authAdapter).toMatch(/from 'commander'/);
  });

  it('counts CLI password length by Unicode code points', async () => {
    const password = '😀'.repeat(PASSWORD_MAX_LENGTH);
    const out: string[] = [];
    const cmd = createAuthCommand({
      stdout: (line) => out.push(line),
      readPasswordFromStdin: () => Promise.resolve(`${password}\n`),
    });
    cmd.exitOverride();

    await cmd.parseAsync(['node', 'auth', 'hash-password', '--password-stdin']);

    expect(out).toHaveLength(1);
    await expect(verifyPassword(password, out[0] ?? '')).resolves.toBe(true);
  });
});
