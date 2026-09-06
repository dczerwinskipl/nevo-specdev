// Third-party attribution for code that is actually EMBEDDED in the shipped
// bundle (dist/bin.js). Build-only tools (esbuild, tsc) are not included and get
// no notice. The notice is derived from the installed dependency's own
// authoritative LICENSE file so it cannot silently drift.

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Packages whose source is compiled into dist/bin.js and needs its license carried. */
const BUNDLED = ['commander'] as const;

export function buildThirdPartyNotices(fromDir: string): string {
  const require = createRequire(join(fromDir, 'noop.js'));
  const blocks = BUNDLED.map((name) => {
    const pkgDir = resolvePackageDir(require, name);
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as {
      version: string;
      license?: string;
      homepage?: string;
    };
    const license = readLicense(pkgDir);
    return [
      '='.repeat(72),
      `${name} ${pkg.version}${pkg.license ? ` (${pkg.license})` : ''}`,
      pkg.homepage ?? `https://www.npmjs.com/package/${name}`,
      '='.repeat(72),
      '',
      license,
    ].join('\n');
  });

  return [
    'THIRD-PARTY NOTICES',
    '',
    '`@nevo/specdev` is distributed as a single bundled file (`dist/bin.js`). That',
    'bundle embeds the third-party software listed below. Each package is used under',
    'the terms of its own license, reproduced verbatim.',
    '',
    ...blocks,
    '',
  ].join('\n');
}

function resolvePackageDir(require: NodeJS.Require, name: string): string {
  // `require.resolve(name)` lands on the package's main file; walk up to its root.
  let dir = dirname(require.resolve(name));
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`could not locate the package root for ${name}`);
    dir = parent;
  }
  return dir;
}

function readLicense(pkgDir: string): string {
  for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'COPYING']) {
    const p = join(pkgDir, f);
    if (existsSync(p)) return readFileSync(p, 'utf8').trimEnd();
  }
  throw new Error(`no LICENSE file found in ${pkgDir}`);
}
