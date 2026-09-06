// Use case: validate the working tree's `version.json` change against the branch
// it will land on. Synchronous — a fast gate that runs in `pnpm check` and CI.

import {
  resolveTransitionTarget,
  validateVersionTransition,
  type TransitionKind,
} from '../domain/transitions.js';
import { parseVersionFile, type VersionFile } from '../domain/version.js';
import { UsageError } from '../errors.js';
import type { SyncGitReader } from '../infra/git-sync.js';

export interface CheckTransitionDeps {
  readonly git: SyncGitReader;
  readonly readWorkingVersion: () => VersionFile;
  readonly env: Readonly<Record<string, string | undefined>>;
}

export type TransitionCheckOutcome =
  | { readonly kind: 'skipped'; readonly baseRef: string; readonly source: string }
  | {
      readonly kind: 'ok';
      readonly from: VersionFile;
      readonly to: VersionFile;
      readonly targetBranch: string;
      readonly source: string;
      readonly transition: TransitionKind;
    }
  | {
      readonly kind: 'illegal';
      readonly from: VersionFile;
      readonly to: VersionFile;
      readonly targetBranch: string;
      readonly source: string;
      readonly error: string;
    };

export function checkVersionTransition(deps: CheckTransitionDeps): TransitionCheckOutcome {
  const target = resolveTransitionTarget({
    env: deps.env,
    readWorkingVersion: deps.readWorkingVersion,
    refExists: (ref) => deps.git.refExists(ref),
  });
  if ('error' in target) {
    throw new UsageError(`Cannot check the version.json transition: ${target.error}`);
  }

  const fromRaw = deps.git.readFileAtRef(target.baseRef, 'version.json');
  if (fromRaw === null) {
    return { kind: 'skipped', baseRef: target.baseRef, source: target.source };
  }

  const from = parseVersionFile(fromRaw, `${target.baseRef}:version.json`);
  const to = deps.readWorkingVersion();
  const verdict = validateVersionTransition({ from, to, targetBranch: target.targetBranch });

  if (verdict.ok) {
    return {
      kind: 'ok',
      from,
      to,
      targetBranch: target.targetBranch,
      source: target.source,
      transition: verdict.kind,
    };
  }
  return {
    kind: 'illegal',
    from,
    to,
    targetBranch: target.targetBranch,
    source: target.source,
    error: verdict.error,
  };
}
