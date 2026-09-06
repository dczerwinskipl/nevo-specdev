// The product version comes from the repository's canonical release model, not a
// hand-maintained field. We reuse the built `nevo-release version` command (the
// same one `pnpm version:print` runs) rather than re-implementing SemVer/channel
// logic here. The value is injected into the bundle and written into the packed
// `package.json`, so the installed artifact carries its own version and never
// reads the repository's `version.json` at runtime.

import { existsSync } from 'node:fs';

import { run, StepFailedError } from './exec.js';

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export interface ResolveVersionInput {
  readonly repoRoot: string;
  readonly releaseBin: string;
  /** test / CI override — skips the subprocess. */
  readonly override?: string;
  readonly env?: NodeJS.ProcessEnv;
}

export function resolveProductVersion({
  repoRoot,
  releaseBin,
  override,
  env,
}: ResolveVersionInput): string {
  const raw = override ?? readFromReleaseTool(repoRoot, releaseBin, env);
  if (!SEMVER.test(raw)) {
    throw new StepFailedError(
      `resolved product version ${JSON.stringify(raw)} is not a valid npm package version`,
    );
  }
  return raw;
}

function readFromReleaseTool(
  repoRoot: string,
  releaseBin: string,
  env?: NodeJS.ProcessEnv,
): string {
  if (!existsSync(releaseBin)) {
    throw new StepFailedError(
      `the release tool is not built (${releaseBin}). Run \`pnpm --filter nevo-repo-release build\` first ` +
        `(the pack command does this for you).`,
    );
  }
  return run('node', [releaseBin, 'version'], { cwd: repoRoot, env });
}
