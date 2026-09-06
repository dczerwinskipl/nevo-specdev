// Shared, production-grade "change version.json on a protected branch through a
// PR" flow — used by the stable branch-advance and by `promote`. Recovery is
// decided by STRUCTURE, never by a branch/PR name:
//
//   * an existing head branch (whether or not a PR is open) must be a single
//     commit on the CURRENT `origin/<baseBranch>` HEAD, changing ONLY
//     `version.json`, to EXACTLY the expected next state;
//   * an open PR whose head branch is missing or invalid -> fail closed;
//   * `origin/<baseBranch>` already in the expected state -> already satisfied.

import { parseVersionFile, versionFileText, type VersionFile } from '../domain/version.js';
import { InconsistentStateError } from '../errors.js';
import type { GitClient, GitHubClient } from '../ports.js';
import { info, warn, type ActionEvent } from './events.js';

export type StructuralCheck = { ok: true } | { ok: false; reason: string };

/**
 * A single commit on top of `origin/<baseBranch>` HEAD that changes only
 * `version.json`, to exactly `expected`. Read-only Git inspection.
 */
export async function checkSingleVersionFileCommit(
  git: GitClient,
  { headRef, baseBranch, expected }: { headRef: string; baseBranch: string; expected: VersionFile },
): Promise<StructuralCheck> {
  const baseHead = await git.resolveCommit(`origin/${baseBranch}`);
  if (!baseHead) return { ok: false, reason: `origin/${baseBranch} cannot be resolved` };

  const parents = await git.commitParents(headRef);
  if (parents === null) return { ok: false, reason: `${headRef} cannot be resolved` };
  if (parents.length !== 1 || parents[0] !== baseHead) {
    return {
      ok: false,
      reason:
        `it is not a single commit on the current origin/${baseBranch} HEAD ` +
        `(${baseHead.slice(0, 7)}) — parents: [${parents.map((p) => p.slice(0, 7)).join(', ') || 'none'}]`,
    };
  }

  const changed = await git.changedFiles(`origin/${baseBranch}`, headRef);
  if (changed.length !== 1 || changed[0] !== 'version.json') {
    return {
      ok: false,
      reason: `it changes ${changed.length === 0 ? 'nothing' : changed.join(', ')}, not only version.json`,
    };
  }

  const raw = await git.showFileAtRef(headRef, 'version.json');
  const parsed = raw === null ? null : safeParse(raw);
  if (parsed?.channel !== expected.channel || parsed.version !== expected.version) {
    return {
      ok: false,
      reason:
        `its version.json is ${raw === null ? 'missing' : JSON.stringify(parsed)}, not ` +
        `{ channel: "${expected.channel}", version: "${expected.version}" }`,
    };
  }
  return { ok: true };
}

export interface EnsureVersionFilePrDeps {
  readonly git: GitClient;
  readonly github: GitHubClient;
  readonly hasToken: boolean;
}

export interface EnsureVersionFilePrInput {
  /** the protected branch the change lands on; also the PR base and the commit parent. */
  readonly baseBranch: string;
  /** the deterministic head branch name. */
  readonly headBranch: string;
  /** `version.json` at `origin/<baseBranch>` right now. */
  readonly currentBaseVersion: VersionFile;
  /** the state `version.json` must reach. */
  readonly nextState: VersionFile;
  readonly commitMessage: string;
  readonly prTitle: string;
  readonly prBody: string;
  /** e.g. "advanced" / "promoted", for the "already <verb>" messages. */
  readonly verb: string;
}

export interface EnsureVersionFilePrResult {
  /** true when the target state is already in place (nothing more to do). */
  readonly satisfied: boolean;
}

export async function ensureVersionFileChangePr(
  { git, github, hasToken }: EnsureVersionFilePrDeps,
  input: EnsureVersionFilePrInput,
  { mutate, events }: { mutate: boolean; events: ActionEvent[] },
): Promise<EnsureVersionFilePrResult> {
  const { baseBranch, headBranch, currentBaseVersion, nextState } = input;
  const headRef = `origin/${headBranch}`;

  // Already merged / already there.
  if (
    currentBaseVersion.channel === nextState.channel &&
    currentBaseVersion.version === nextState.version
  ) {
    events.push(
      info(
        `origin/${baseBranch} is already { ${nextState.channel}, ${nextState.version} } — ${input.verb}, nothing to do.`,
      ),
    );
    return { satisfied: true };
  }

  const openPr = await github.findOpenPullRequest({ head: headBranch, base: baseBranch });
  const branchExists = await git.remoteBranchExists(headBranch);

  if (openPr) {
    if (!branchExists) {
      throw new InconsistentStateError(
        `PR ${openPr.url} is open for ${headBranch} -> ${baseBranch}, but ${headBranch} does not ` +
          `exist on origin. Fail closed — do not trust the PR alone. Investigate.`,
      );
    }
    const check = await checkSingleVersionFileCommit(git, {
      headRef,
      baseBranch,
      expected: nextState,
    });
    if (!check.ok) {
      throw new InconsistentStateError(
        `PR ${openPr.url} is open for ${headBranch}, but that branch ${check.reason} — refusing ` +
          `to treat the operation as done. Investigate; delete the branch/PR if wrong.`,
      );
    }
    events.push(info(`${headBranch} is verified and its PR is open:\n  ${openPr.url}`));
    events.push(info('Nothing to do — merge that PR to finish.'));
    return { satisfied: true };
  }

  let reuseBranch = false;
  if (branchExists) {
    const check = await checkSingleVersionFileCommit(git, {
      headRef,
      baseBranch,
      expected: nextState,
    });
    if (!check.ok) {
      throw new InconsistentStateError(
        `${headBranch} already exists but ${check.reason} — refusing to reuse it, force-push over ` +
          `it, or open a PR from it. Delete it if it is wrong, then re-run.`,
      );
    }
    reuseBranch = true;
    events.push(info(`Reusing existing ${headBranch} (verified against origin/${baseBranch}).`));
  }

  if (!mutate) {
    if (!reuseBranch) {
      events.push(
        info(
          `Would create ${headBranch} from origin/${baseBranch} with version.json -> ` +
            `{ channel: "${nextState.channel}", version: "${nextState.version}" }.`,
        ),
      );
    }
    events.push(
      info(`Would ${hasToken ? 'open' : 'hand off'} the PR (${headBranch} -> ${baseBranch}).`),
    );
    return { satisfied: false };
  }

  if (!reuseBranch) {
    const baseSha = await git.resolveCommit(`origin/${baseBranch}`);
    if (!baseSha) throw new InconsistentStateError(`Cannot resolve origin/${baseBranch}.`);
    const sha = await git.commitSingleFileOnto({
      baseRef: baseSha,
      path: 'version.json',
      content: versionFileText(nextState),
      message: input.commitMessage,
    });
    await git.pushCommitToBranch({ sha, branch: headBranch });
    events.push(info(`Pushed ${headBranch}.`));
  }

  if (hasToken) {
    const pr = await github.createPullRequest({
      head: headBranch,
      base: baseBranch,
      title: input.prTitle,
      body: input.prBody,
    });
    events.push(info(`Opened PR: ${pr.url}`));
    const am = await github.enableAutoMerge(pr.url);
    if (am.outcome === 'enabled') {
      events.push(info('Auto-merge requested — lands when required checks pass.'));
    } else {
      events.push(
        info(
          `Auto-merge not requested (${am.reason}); the PR stays open for a normal merge after CI.`,
        ),
      );
    }
  } else {
    events.push(
      warn(
        'No CI_GITHUB_RELEASE_TOKEN — the PR was NOT created (a PR opened by the default token does ' +
          'not trigger CI). Create it yourself so `pull_request` workflows run:',
      ),
    );
    events.push(
      warn(
        `  gh pr create --base ${baseBranch} --head ${headBranch} \\\n` +
          `    --title ${JSON.stringify(input.prTitle)} --body ${JSON.stringify(input.prBody)}`,
      ),
    );
  }

  return { satisfied: false };
}

function safeParse(raw: string): VersionFile | null {
  try {
    return parseVersionFile(raw, 'branch version.json');
  } catch {
    return null;
  }
}
