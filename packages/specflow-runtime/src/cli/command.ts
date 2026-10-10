// The root-level `start` command is the CLI adapter for the SpecFlow Runtime.
// The `@nevo/specflow` shell composes it; Runtime owns the command semantics.

import { Command } from 'commander';

import type { RuntimeHandle } from '../runtime';

export interface RuntimeCommandContext {
  readonly stdout: (line: string) => void;
  readonly signal?: AbortSignal;
  readonly start: (options: { readonly demo: boolean }) => Promise<RuntimeHandle>;
}

export function createStartCommand(ctx: RuntimeCommandContext): Command {
  return new Command('start')
    .description('Start the Nevo SpecFlow local server')
    .option('--demo', 'Use explicit demonstration data instead of project sources')
    .action(async (options: { demo?: boolean }) => {
      const handle = await ctx.start({ demo: options.demo === true });
      ctx.stdout(`Nevo SpecFlow available at ${handle.address}`);

      if (!ctx.signal) return;
      if (!ctx.signal.aborted) await aborted(ctx.signal);
      await handle.close();
    });
}

function aborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) =>
    signal.addEventListener('abort', () => resolve(), { once: true }),
  );
}

export { createAuthCommand, type AuthCommandContext } from '../features/auth';
