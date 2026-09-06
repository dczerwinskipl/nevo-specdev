// Use case: create the Git tag + GitHub Release for the current release branch,
// then (for a stable release) ensure the branch advances to the next patch.
//
// ONE operation with an explicit mutation boundary:
//
//   inspect remote/GitHub state
//     -> validate the complete operation
//     -> produce the plan + the events describing every step
//     -> if mutate: perform the mutations
//
// `mutate: false` (validate-only) performs every read-only check the execute
// path performs — it answers "would this succeed right now?" — and makes NO
// commit / branch / tag / Release / PR / auto-merge.
//
// Two INDEPENDENT idempotent phases:
//   A. ensure the tag + its GitHub Release exist
//   B. ensure a stable line has advanced to its next stabilization state
// Completing A must never skip B.

import {
  decideReleaseAction,
  evaluateRequiredChecks,
  highestPrereleaseTagFor,
  latestCheckRunsByName,
  pickReleaseCandidate,
  planRelease,
  REQUIRED_HEAD_CHECKS,
  type ExistingTag,
  type ReleasePlan,
} from '../domain/release-plan.js';
import { parseVersionFile, versionFileText, type VersionFile } from '../domain/version.js';
import { InconsistentStateError, UsageError, errorMessage } from '../errors.js';
import type { GitClient, GitHubClient } from '../ports.js';
import { info, warn, type ActionEvent } from './events.js';

type ValidReleasePlan = Extract<ReleasePlan, { ok: true }>;

export interface CreateReleaseDeps {
  readonly git: GitClient;
  readonly github: GitHubClient;
  readonly hasToken: boolean;
}

export interface CreateReleaseResult {
  readonly events: ActionEvent[];
  readonly plan: ValidReleasePlan;
  readonly mutated: boolean;
}

export async function executeRelease(
  input: { channel: string },
  deps: CreateReleaseDeps,
  { mutate }: { mutate: boolean },
): Promise<CreateReleaseResult> {
  const { git, github } = deps;
  const events: ActionEvent[] = [];

  await git.fetch();
  const branch = await git.currentBranch();
  const headSha = await git.headSha();
  const headShort = headSha.slice(0, 7);

  // §2 — the release must represent the CURRENT remote protected-branch commit;
  // do this first so everything below reads verified remote state.
  await assertLocalHeadIsRemoteHead(git, branch, headSha);

  // Read version.json from origin/<branch>, not the (possibly dirty) working tree.
  const versionRaw = await git.showFileAtRef(`origin/${branch}`, 'version.json');
  if (versionRaw === null) {
    throw new InconsistentStateError(`origin/${branch} has no version.json — cannot release.`);
  }
  let versionFile: VersionFile;
  try {
    versionFile = parseVersionFile(versionRaw, `origin/${branch}:version.json`);
  } catch (err) {
    throw new InconsistentStateError(
      `origin/${branch} has an invalid version.json: ${errorMessage(err)}`,
      { cause: err },
    );
  }

  const plan = planRelease({
    branch,
    channel: input.channel,
    versionFile,
    existingTags: await git.listTags(),
  });
  if (!plan.ok) {
    throw new UsageError(`Cannot release:\n  - ${plan.errors.join('\n  - ')}`);
  }

  events.push(info('Plan'));
  events.push(info(`  branch  : ${branch}`));
  events.push(info(`  channel : ${plan.channel}`));
  events.push(info(`  tag     : ${plan.tag}${plan.prerelease ? '  (prerelease)' : ''}`));
  if (plan.nextBranchState) {
    events.push(
      info(
        `  then    : advance ${branch} -> { channel: "${plan.nextBranchState.channel}", ` +
          `version: "${plan.nextBranchState.version}" }`,
      ),
    );
  }
  events.push(info(mutate ? '' : '(validate-only — running every check, changing nothing)'));

  // The branch HEAD must have passed CI.
  await ensureHeadChecksPassed(github, headSha);

  // ── Phase A: ensure tag + GitHub Release ────────────────────────────────
  let highestTag: string | null = null;
  let highestTagState: ExistingTag | null = null;
  if (plan.prerelease) {
    highestTag = highestPrereleaseTagFor(plan.version, plan.channel, await git.listTags());
    if (highestTag) highestTagState = await inspectTag(deps, highestTag, headSha);
  }

  const { tag, recovering } = pickReleaseCandidate({
    plannedTag: plan.tag,
    prerelease: plan.prerelease,
    highestTag,
    highestTagState,
  });
  if (recovering && tag !== plan.tag) {
    events.push(
      info(
        `Recovering ${tag}: its tag is on ${headShort} but the GitHub Release is missing. ` +
          `Not cutting ${plan.tag}.`,
      ),
    );
  }

  const existing = await inspectTag(deps, tag, headSha);
  const decision = decideReleaseAction(existing, { tag, headShort, branch });
  if ('error' in decision) throw new InconsistentStateError(decision.error);
  events.push(info(decision.message));

  if (decision.action === 'tag-and-release') {
    if (mutate) {
      await git.createAnnotatedTag({ tag, sha: headSha, message: tag });
      await git.pushTag(tag);
    } else {
      events.push(info(`Would create annotated tag ${tag} at ${headShort} and push it.`));
    }
  }
  if (decision.action !== 'noop') {
    if (mutate) {
      const { url } = await github.createRelease({ tag, prerelease: plan.prerelease });
      events.push(info(`Published GitHub Release: ${url}`));
      events.push(info('(No npm package is published — out of scope.)'));
    } else {
      events.push(
        info(
          `Would create the GitHub Release for ${tag} (${plan.prerelease ? 'prerelease' : 'stable'}).`,
        ),
      );
    }
  }

  // ── Phase B: for a stable release, ensure the branch advances ───────────
  // Reached even when Phase A was a no-op.
  if (plan.nextBranchState) {
    await ensureBranchAdvanced(deps, { branch, nextState: plan.nextBranchState, events, mutate });
  }

  return { events, plan, mutated: mutate };
}

/** §2 — refuse a stale / diverged local checkout. */
async function assertLocalHeadIsRemoteHead(
  git: GitClient,
  branch: string,
  headSha: string,
): Promise<void> {
  const remote = await git.resolveCommit(`origin/${branch}`);
  if (remote === null) {
    throw new InconsistentStateError(
      `Cannot resolve origin/${branch} after fetch — refusing to release from a branch whose ` +
        `remote state is unknown.`,
    );
  }
  if (remote !== headSha) {
    throw new InconsistentStateError(
      `${branch} local HEAD ${headSha.slice(0, 7)} is not origin/${branch} ${remote.slice(0, 7)} ` +
        `(behind or diverged). A release must tag the current remote protected-branch commit — ` +
        `update the checkout (\`git pull --ff-only\`) and retry.`,
    );
  }
}

async function ensureHeadChecksPassed(github: GitHubClient, sha: string): Promise<void> {
  const byName = latestCheckRunsByName(await github.checkRunsForCommit(sha));
  const { missing, notPassing } = evaluateRequiredChecks(byName, REQUIRED_HEAD_CHECKS);
  if (missing.length || notPassing.length) {
    throw new InconsistentStateError(
      `Release-branch HEAD ${sha.slice(0, 7)} has not passed CI.\n` +
        (missing.length ? `  missing: ${missing.join(', ')}\n` : '') +
        (notPassing.length ? `  not green: ${notPassing.join(', ')}\n` : '') +
        `Wait for the push CI on this commit to finish successfully, then re-run.`,
    );
  }
}

async function inspectTag(
  { git, github }: CreateReleaseDeps,
  tag: string,
  headSha: string,
): Promise<ExistingTag> {
  const tagSha = await git.tagCommit(tag);
  let release: boolean;
  try {
    release = await github.releaseExists(tag);
  } catch (err) {
    throw new InconsistentStateError(
      `Could not determine the GitHub Release state for ${tag}: ${errorMessage(err)}. ` +
        `Refusing to make a release decision without it.`,
      { cause: err },
    );
  }
  if (!tagSha) return { state: 'absent', release };
  return { state: tagSha === headSha ? 'ok' : 'mismatch', release };
}

type AdvanceCheck = { ok: true } | { ok: false; reason: string };

/**
 * §3 — an existing advance branch is only safe to reuse if it is EXACTLY the
 * operation we intended: a single commit on top of the current
 * `origin/<releaseBranch>` HEAD, changing only `version.json`, to exactly the
 * expected next state. Read-only Git inspection; no plumbing writes.
 */
async function validateExistingAdvanceBranch(
  git: GitClient,
  {
    advanceBranch,
    releaseBranch,
    nextState,
  }: { advanceBranch: string; releaseBranch: string; nextState: VersionFile },
): Promise<AdvanceCheck> {
  const releaseHead = await git.resolveCommit(`origin/${releaseBranch}`);
  if (!releaseHead) return { ok: false, reason: `origin/${releaseBranch} cannot be resolved` };

  const parents = await git.commitParents(`origin/${advanceBranch}`);
  if (parents === null) return { ok: false, reason: `origin/${advanceBranch} cannot be resolved` };
  if (parents.length !== 1 || parents[0] !== releaseHead) {
    return {
      ok: false,
      reason:
        `it is not a single commit on top of the current origin/${releaseBranch} HEAD ` +
        `(${releaseHead.slice(0, 7)}) — parents: [${parents.map((p) => p.slice(0, 7)).join(', ') || 'none'}]`,
    };
  }

  const changed = await git.changedFiles(`origin/${releaseBranch}`, `origin/${advanceBranch}`);
  if (changed.length !== 1 || changed[0] !== 'version.json') {
    return {
      ok: false,
      reason: `it changes ${changed.length === 0 ? 'nothing' : changed.join(', ')}, not only version.json`,
    };
  }

  const raw = await git.showFileAtRef(`origin/${advanceBranch}`, 'version.json');
  const parsed = raw === null ? null : tryParse(raw);
  if (parsed?.channel !== nextState.channel || parsed.version !== nextState.version) {
    return {
      ok: false,
      reason:
        `its version.json is ${raw === null ? 'missing' : JSON.stringify(parsed)}, not ` +
        `{ channel: "${nextState.channel}", version: "${nextState.version}" }`,
    };
  }
  return { ok: true };
}

async function ensureBranchAdvanced(
  deps: CreateReleaseDeps,
  {
    branch,
    nextState,
    events,
    mutate,
  }: { branch: string; nextState: VersionFile; events: ActionEvent[]; mutate: boolean },
): Promise<void> {
  const { git, github, hasToken } = deps;
  const advanceBranch = `chore/advance-${branch.replace(/\//g, '-')}-to-${nextState.version}`;

  const openPr = await github.findOpenPullRequest({ head: advanceBranch, base: branch });
  if (openPr) {
    events.push(info(`Branch-advance PR already open — nothing to do:\n  ${openPr.url}`));
    return;
  }

  const branchExists = await git.remoteBranchExists(advanceBranch);
  if (branchExists) {
    const check = await validateExistingAdvanceBranch(git, {
      advanceBranch,
      releaseBranch: branch,
      nextState,
    });
    if (!check.ok) {
      throw new InconsistentStateError(
        `${advanceBranch} already exists but ${check.reason} — refusing to reuse it, ` +
          `force-push over it, or open a PR from it. Delete it if it is wrong, then re-run.`,
      );
    }
    events.push(info(`Reusing existing ${advanceBranch} (verified against origin/${branch}).`));
  } else if (mutate) {
    const baseSha = await git.resolveCommit(`origin/${branch}`);
    if (!baseSha) throw new InconsistentStateError(`Cannot resolve origin/${branch}.`);
    const sha = await git.commitSingleFileOnto({
      baseRef: baseSha,
      path: 'version.json',
      content: versionFileText(nextState),
      message: `chore(release): open ${nextState.version} stabilization (beta)`,
    });
    await git.pushCommitToBranch({ sha, branch: advanceBranch });
    events.push(info(`Pushed ${advanceBranch}.`));
  } else {
    events.push(
      info(
        `Would create ${advanceBranch} from origin/${branch} with version.json -> ` +
          `{ channel: "${nextState.channel}", version: "${nextState.version}" }.`,
      ),
    );
  }

  const title = `chore(release): open ${nextState.version} stabilization (beta)`;
  const body =
    `The previous patch on \`${branch}\` shipped. Move the branch to ` +
    `\`{ channel: "${nextState.channel}", version: "${nextState.version}" }\` so its builds ` +
    `report \`${nextState.version}-beta.<n>\` instead of the already-released version.`;

  if (!mutate) {
    events.push(
      info(
        `Would ${hasToken ? 'open' : 'hand off'} the branch-advance PR (${advanceBranch} -> ${branch}).`,
      ),
    );
    return;
  }

  if (hasToken) {
    const pr = await github.createPullRequest({ head: advanceBranch, base: branch, title, body });
    events.push(info(`Opened branch-advance PR: ${pr.url}`));
    await github.enableAutoMerge(pr.url);
  } else {
    events.push(warn('No RELEASE_TOKEN — the branch-advance PR was NOT created. Run it yourself:'));
    events.push(
      warn(
        `  gh pr create --base ${branch} --head ${advanceBranch} \\\n` +
          `    --title ${JSON.stringify(title)} --body ${JSON.stringify(body)}`,
      ),
    );
  }
}

function tryParse(raw: string): VersionFile | null {
  try {
    return parseVersionFile(raw, 'advance-branch version.json');
  } catch {
    return null;
  }
}
