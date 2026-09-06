import { Command } from 'commander';

import { bundleProduct } from './bundle.js';
import { dogfoodInstall } from './dogfood.js';
import { packProduct } from './pack.js';
import { readJson } from './paths.js';

export interface CliIO {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

export function createProgram(io: CliIO): Command {
  const program = new Command('nevo-repo-product')
    .description('Repository packaging tooling for the Nevo SpecDev product (not a product CLI)')
    .configureOutput({
      writeOut: (s) => io.stdout(s.replace(/\n$/, '')),
      writeErr: (s) => io.stderr(s.replace(/\n$/, '')),
    });

  program
    .command('bundle')
    .description('esbuild the self-contained nevo-spec bundle (used by @nevo/specdev build)')
    .option('--entry <path>', 'entry file, relative to cwd', 'src/bin.ts')
    .option('--outfile <path>', 'output file, relative to cwd', 'dist/bin.js')
    .option('--version <version>', 'version to inject (default: this package.json version)')
    .action(async (opts: { entry: string; outfile: string; version?: string }) => {
      const version =
        opts.version ?? readJson<{ version?: string }>('package.json').version ?? '0.0.0';
      const { outfile } = await bundleProduct({
        entry: opts.entry,
        outfile: opts.outfile,
        version,
      });
      io.stdout(`bundled ${outfile}  (version ${version})`);
    });

  program
    .command('pack')
    .description('build + version + esbuild + pnpm pack -> .artifacts/nevo-specdev-<version>.tgz')
    .option('--json', 'print { name, version, tarball } as JSON', false)
    .option('--skip-build', 'assume the product graph is already built', false)
    .action(async (opts: { json: boolean; skipBuild: boolean }) => {
      const result = await packProduct({
        skipBuild: opts.skipBuild,
        log: opts.json ? undefined : (l) => io.stderr(l),
      });
      io.stdout(
        opts.json
          ? JSON.stringify(result)
          : `\n${result.name} ${result.version}\n  ${result.tarball}`,
      );
    });

  program
    .command('dogfood')
    .description(
      'pack the real distributable, install it globally with pnpm, smoke the installed CLI',
    )
    .option('--json', 'print the result as JSON', false)
    .action(async (opts: { json: boolean }) => {
      const result = await dogfoodInstall({ log: opts.json ? undefined : (l) => io.stderr(l) });
      if (opts.json) {
        io.stdout(JSON.stringify(result));
      } else {
        io.stdout(`\ninstalled ${result.name} ${result.version} from ${result.tarball}`);
        for (const c of result.checks) io.stdout(`  ✓ ${c}`);
        io.stdout(`\nnevo-spec is on PATH via ${result.globalBinDir}`);
      }
    });

  program.exitOverride();
  for (const cmd of program.commands) cmd.exitOverride();
  return program;
}
