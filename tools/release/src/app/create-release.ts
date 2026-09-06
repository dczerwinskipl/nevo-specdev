// Use case: create the Git tag + GitHub Release for the current release branch,
// then (for a stable release) ensure the branch advances to the next patch.
//
// Two INDEPENDENT idempotent phases:
//   A. ensure the tag + its GitHub Release exist
//   B. ensure a stable line has advanced to its next stabilization state
// Completing A must never skip B (§9).

import {
  decideReleaseAction,
  evaluateRequiredChecks,
  highestPrereleaseTagFor,
  latestCheckRunsByName,
  pickReleaseCandidate,
  REQUIRED_HEAD_CHECKS,
  type ExistingTag,
  type ReleasePlan,
} from '../domain/release-plan.js';
import { parseVersionFile, versionFileText, type VersionFile } from '../domain/version.js';
import { InconsistentStateError } from '../errors.js';
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
}

export async function executeRelease(
  plan: ValidReleasePlan,
  deps: CreateReleaseDeps,
): Promise<CreateReleaseResult> {
  const { git, github } = deps;
  const events: ActionEvent[] = [];

  await git.fetch();
  const branch = await git.currentBranch();
  const headSha = await git.headSha();
  const headShort = headSha.slice(0, 7);

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
    await git.createAnnotatedTag({ tag, sha: headSha, message: tag });
    await git.pushTag(tag);
  }
  if (decision.action !== 'noop') {
    const { url } = await github.createRelease({ tag, prerelease: plan.prerelease });
    events.push(info(`Published GitHub Release: ${url}`));
    events.push(info('(No npm package is published — out of scope.)'));
  }

  // ── Phase B: for a stable release, ensure the branch advances ───────────
  // Reached even when Phase A was a no-op.
  if (plan.nextBranchState) {
    await ensureBranchAdvanced(deps, {
      branch,
      nextState: plan.nextBranchState,
      events,
    });
  }

  return { events };
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
  const release = await github.releaseExists(tag);
  if (!tagSha) return { state: 'absent', release };
  return { state: tagSha === headSha ? 'ok' : 'mismatch', release };
}

async function ensureBranchAdvanced(
  { git, github, hasToken }: CreateReleaseDeps,
  { branch, nextState, events }: { branch: string; nextState: VersionFile; events: ActionEvent[] },
): Promise<void> {
  const advanceBranch = `chore/advance-${branch.replace(/\//g, '-')}-to-${nextState.version}`;

  const openPr = await github.findOpenPullRequest({ head: advanceBranch, base: branch });
  if (openPr) {
    events.push(info(`Branch-advance PR already open — nothing to do:\n  ${openPr.url}`));
    return;
  }

  if (await git.remoteBranchExists(advanceBranch)) {
    const raw = await git.showFileAtRef(`origin/${advanceBranch}`, 'version.json');
    const current = raw === null ? null : tryParse(raw);
    if (current?.channel !== nextState.channel || current.version !== nextState.version) {
      throw new InconsistentStateError(
        `${advanceBranch} already exists but its version.json is not ` +
          `{ channel: "${nextState.channel}", version: "${nextState.version}" } — refusing to ` +
          `force-push over it. Investigate.`,
      );
    }
    events.push(info(`Reusing existing ${advanceBranch}.`));
  } else {
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
  }

  const title = `chore(release): open ${nextState.version} stabilization (beta)`;
  const body =
    `The previous patch on \`${branch}\` shipped. Move the branch to ` +
    `\`{ channel: "${nextState.channel}", version: "${nextState.version}" }\` so its builds ` +
    `report \`${nextState.version}-beta.<n>\` instead of the already-released version.`;

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
