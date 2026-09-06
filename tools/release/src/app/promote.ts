// Use case: promote a release line's channel through a PR — `beta -> rc` or
// `rc -> stable`. It NEVER edits `release/vX.Y` directly and never publishes a
// tag; that is `nevo-release create`'s job, after the promoted branch HEAD has
// passed CI.
//
// ONE operation with an explicit mutation boundary. Validate-only runs every
// read-only check the execute path runs (fetch, branch shape, local == remote
// HEAD, `origin/<branch>` version.json, the legal transition, any existing
// promotion branch/PR's contents) and changes nothing.

import {
  lineOfBranch,
  parseVersionFile,
  planPromotion,
  type Channel,
  type VersionFile,
} from '../domain/version.js';
import { InconsistentStateError, UsageError, errorMessage } from '../errors.js';
import type { GitClient, GitHubClient } from '../ports.js';
import { info, type ActionEvent } from './events.js';
import { ensureVersionFileChangePr } from './version-pr.js';

export type PromotionTarget = Extract<Channel, 'rc' | 'stable'>;

/** target channel -> the channel the branch must currently be in. */
const REQUIRED_CURRENT: Record<PromotionTarget, Channel> = { rc: 'beta', stable: 'rc' };

export interface PromoteDeps {
  readonly git: GitClient;
  readonly github: GitHubClient;
  readonly hasToken: boolean;
}

export interface PromoteResult {
  readonly events: ActionEvent[];
  readonly mutated: boolean;
  /** true when the branch is already in the target channel. */
  readonly alreadyPromoted: boolean;
}

/** `chore/promote-<version>-to-<target>` */
export function promotionBranchName(version: string, target: PromotionTarget): string {
  return `chore/promote-${version}-to-${target}`;
}

export async function promoteRelease(
  input: { target: string },
  deps: PromoteDeps,
  { mutate }: { mutate: boolean },
): Promise<PromoteResult> {
  const { git, github } = deps;
  const events: ActionEvent[] = [];

  if (input.target !== 'rc' && input.target !== 'stable') {
    throw new UsageError(
      `--target must be 'rc' or 'stable' (got ${JSON.stringify(input.target)}).`,
    );
  }
  const target: PromotionTarget = input.target;

  await git.fetch();
  const branch = await git.currentBranch();
  const headSha = await git.headSha();

  if (lineOfBranch(branch) === null) {
    throw new UsageError(`Promotions run from a release/vX.Y branch, not '${branch}'.`);
  }

  // local HEAD must be the current remote protected-branch commit.
  const remoteHead = await git.resolveCommit(`origin/${branch}`);
  if (remoteHead === null) {
    throw new InconsistentStateError(`Cannot resolve origin/${branch} after fetch.`);
  }
  if (remoteHead !== headSha) {
    throw new InconsistentStateError(
      `${branch} local HEAD ${headSha.slice(0, 7)} is not origin/${branch} ${remoteHead.slice(0, 7)} ` +
        `(behind or diverged). Update the checkout (\`git pull --ff-only\`) and retry.`,
    );
  }

  const current = await readVersionFileAt(git, `origin/${branch}`, `origin/${branch}`);

  if (current.channel === target) {
    events.push(info(`${branch} is already { ${target}, ${current.version} } — already promoted.`));
    return { events, mutated: false, alreadyPromoted: true };
  }
  const requiredCurrent = REQUIRED_CURRENT[target];
  if (current.channel !== requiredCurrent) {
    throw new UsageError(
      `${branch} is at { ${current.channel}, ${current.version} }. ` +
        `Promotion to '${target}' requires the branch to be '${requiredCurrent}' first ` +
        `(legal steps: beta -> rc -> stable). ` +
        (current.channel === 'stable'
          ? `This line is already stable; run Release stable, which prepares the next patch.`
          : `Promote to '${requiredCurrent}' before '${target}'.`),
    );
  }

  // Derive the next state from the shared domain rule (no duplicated logic).
  const nextState: VersionFile = planPromotion({ current, toChannel: target });

  events.push(info('Plan'));
  events.push(info(`  branch : ${branch}`));
  events.push(
    info(
      `  promote: { ${current.channel}, ${current.version} } -> { ${target}, ${nextState.version} }`,
    ),
  );
  events.push(info(mutate ? '' : '(validate-only — running every check, changing nothing)'));

  const { satisfied } = await ensureVersionFileChangePr(
    { git, github, hasToken: deps.hasToken },
    {
      baseBranch: branch,
      headBranch: promotionBranchName(current.version, target),
      currentBaseVersion: current,
      nextState,
      commitMessage: `chore(release): promote ${current.version} to ${target}`,
      prTitle: `chore(release): promote ${current.version} to ${target}`,
      prBody:
        `Promote \`${branch}\` from \`${current.channel}\` to \`${target}\` ` +
        `(\`${current.version}\`). Merge after normal CI is green; then run **Release** ` +
        `to cut the \`${target}\` tag.`,
      verb: 'promoted',
    },
    { mutate, events },
  );

  return { events, mutated: mutate && !satisfied, alreadyPromoted: satisfied };
}

async function readVersionFileAt(git: GitClient, ref: string, label: string): Promise<VersionFile> {
  const raw = await git.showFileAtRef(ref, 'version.json');
  if (raw === null) {
    throw new InconsistentStateError(`${label} has no version.json — cannot promote.`);
  }
  try {
    return parseVersionFile(raw, `${label}:version.json`);
  } catch (err) {
    throw new InconsistentStateError(`${label} has an invalid version.json: ${errorMessage(err)}`, {
      cause: err,
    });
  }
}
