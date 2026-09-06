// Use case: cut a maintained release line off the current `origin/main`.
//
// ONE operation with an explicit mutation boundary — `mutate: false`
// (validate-only) runs every read-only check the execute path runs (current
// origin/main, its version.json, an existing release branch's *contents*, an
// existing bump branch / PR's *contents*) and answers "would this succeed right
// now?" without creating a commit / branch / PR / auto-merge.

import { planReleaseCut, validateCutBaseVersion, type CutPlan } from '../domain/cut-plan.js';
import { parseVersionFile, versionFileText, type VersionFile } from '../domain/version.js';
import { InconsistentStateError, UsageError, errorMessage } from '../errors.js';
import type { GitClient, GitHubClient } from '../ports.js';
import { info, type ActionEvent } from './events.js';
import { requestAutoMerge } from './version-pr.js';

type ValidCutPlan = Extract<CutPlan, { ok: true }>;

export interface CutReleaseLineDeps {
  readonly git: GitClient;
  readonly github: GitHubClient;
  /** a token that triggers `pull_request` workflows is available. */
  readonly hasToken: boolean;
}

export interface CutReleaseLineResult {
  readonly events: ActionEvent[];
  readonly plan: ValidCutPlan;
  /** the line is already cut (a prior run completed and its state checks out). */
  readonly alreadyDone: boolean;
  readonly mutated: boolean;
}

export async function executeReleaseCut(
  input: { releaseVersion: string; nextDevelopmentVersion: string },
  { git, github, hasToken }: CutReleaseLineDeps,
  { mutate }: { mutate: boolean },
): Promise<CutReleaseLineResult> {
  const events: ActionEvent[] = [];

  const plan = planReleaseCut(input);
  if (!plan.ok) {
    throw new UsageError(`Invalid inputs:\n  - ${plan.errors.join('\n  - ')}`);
  }
  const { releaseBranch, releaseVersion, nextVersion, bumpBranch } = plan;

  events.push(info('Plan'));
  events.push(info(`  release branch : ${releaseBranch}  (from origin/main)`));
  events.push(info(`  branch version : { channel: "beta", version: "${releaseVersion}" }`));
  events.push(
    info(
      `  main moves to  : { channel: "alpha", version: "${nextVersion}" }  ` +
        `(${plan.step} step, PR ${bumpBranch})`,
    ),
  );
  events.push(info(mutate ? '' : '(validate-only — running every check, changing nothing)'));

  await git.fetch();

  const baseSha = await git.resolveCommit('origin/main');
  if (!baseSha) {
    throw new InconsistentStateError('Cannot resolve origin/main — run `git fetch origin` first.');
  }
  const baseShort = baseSha.slice(0, 7);
  const mainVf = await readVersionFileAt(git, baseSha, `origin/main@${baseShort}`);

  const branchExists = await git.remoteBranchExists(releaseBranch);
  const openBumpPr = await github.findOpenPullRequest({ head: bumpBranch, base: 'main' });

  // ── recognise a prior run — but only by CONTENT, never by name (§3/§4) ──
  if (branchExists) {
    const relCheck = await validateSingleFileBranch(git, {
      ref: `origin/${releaseBranch}`,
      nextState: { channel: 'beta', version: releaseVersion },
      expectedParentVf: { channel: 'alpha', version: releaseVersion },
      parentAncestorOf: 'origin/main',
    });
    if (!relCheck.ok) {
      throw new InconsistentStateError(
        `${releaseBranch} already exists but ${relCheck.reason} — refusing to touch it. ` +
          `Investigate; delete it only if it is wrong.`,
      );
    }

    if (openBumpPr) {
      // §2 — an open PR and its head branch are one state: the branch MUST exist
      // and MUST validate; do not trust the PR alone.
      if (!(await git.remoteBranchExists(bumpBranch))) {
        throw new InconsistentStateError(
          `An open main-bump PR (${openBumpPr.url}) references ${bumpBranch}, but that branch does ` +
            `not exist on origin. Fail closed — investigate.`,
        );
      }
      const bumpCheck = await validateSingleFileBranch(git, {
        ref: `origin/${bumpBranch}`,
        nextState: { channel: 'alpha', version: nextVersion },
        expectedParentVf: { channel: 'alpha', version: releaseVersion },
        expectedParent: relCheck.parent,
      });
      if (!bumpCheck.ok) {
        throw new InconsistentStateError(
          `${bumpBranch} (open PR ${openBumpPr.url}) exists but ${bumpCheck.reason} — ` +
            `refusing to treat this cut as complete. Investigate.`,
        );
      }
      events.push(
        info(
          `${releaseBranch} is already cut correctly and the main-bump PR is open:\n  ${openBumpPr.url}`,
        ),
      );
      // Converge auto-merge — a re-run repairs a bump PR whose earlier
      // auto-merge request failed transiently.
      if (hasToken && mutate) {
        await requestAutoMerge(github, openBumpPr.url, events);
      }
      events.push(info('Nothing to do — merge that PR to finish.'));
      return { events, plan, alreadyDone: true, mutated: false };
    }

    // No open bump PR. If main has already moved on, the cut is fully complete.
    if (mainVf.channel === 'alpha' && mainVf.version === nextVersion) {
      events.push(
        info(
          `${releaseBranch} is cut and origin/main is already on { alpha, ${nextVersion} } — ` +
            `the line is fully cut. Nothing to do.`,
        ),
      );
      return { events, plan, alreadyDone: true, mutated: false };
    }

    throw new InconsistentStateError(
      `${releaseBranch} already exists and is correctly cut, but no open main-bump PR was found ` +
        `and origin/main is still { ${mainVf.channel}, ${mainVf.version} }. Open the bump PR by ` +
        `hand (set version.json to { channel: "alpha", version: "${nextVersion}" } on ` +
        `${bumpBranch}) or, with admin rights, delete ${releaseBranch} and re-run.`,
    );
  }

  if (openBumpPr) {
    throw new InconsistentStateError(
      `An open PR from ${bumpBranch} already exists (${openBumpPr.url}) but ${releaseBranch} ` +
        `does not. Resolve that PR before cutting the line.`,
    );
  }

  // ── fresh cut — validate origin/main's own state, then plan/perform ─────
  const baseErrors = validateCutBaseVersion(mainVf, { releaseVersion, nextVersion });
  if (baseErrors.length) {
    throw new InconsistentStateError(
      `Refusing to cut ${releaseBranch} — origin/main is not in the expected state:\n  - ` +
        baseErrors.join('\n  - '),
    );
  }
  events.push(info(`origin/main at ${baseShort} is alpha ${mainVf.version} — cut is consistent.`));

  const relContent = versionFileText({ channel: 'beta', version: releaseVersion });
  const bumpContent = versionFileText({ channel: 'alpha', version: nextVersion });
  const relMsg = `chore(release): start ${releaseVersion} stabilization (beta)`;
  const bumpMsg = `chore(release): begin ${nextVersion} development line`;

  if (!mutate) {
    events.push(
      info(
        `Would create ${releaseBranch} at ${baseShort} with version.json -> beta ${releaseVersion}.`,
      ),
    );
    events.push(
      info(`Would push ${bumpBranch} at ${baseShort} with version.json -> alpha ${nextVersion}.`),
    );
    events.push(
      info(`Would ${hasToken ? 'open' : 'hand off'} the main-bump PR (${bumpBranch} -> main).`),
    );
    return { events, plan, alreadyDone: false, mutated: false };
  }

  const relSha = await git.commitSingleFileOnto({
    baseRef: baseSha,
    path: 'version.json',
    content: relContent,
    message: relMsg,
  });
  await git.pushCommitToBranch({ sha: relSha, branch: releaseBranch });
  events.push(info(`Created ${releaseBranch} at ${baseShort} + version.json`));

  const bumpSha = await git.commitSingleFileOnto({
    baseRef: baseSha,
    path: 'version.json',
    content: bumpContent,
    message: bumpMsg,
  });
  await git.pushCommitToBranch({ sha: bumpSha, branch: bumpBranch });
  events.push(info(`Pushed ${bumpBranch} at ${baseShort}`));

  const title = bumpMsg;
  const body =
    `Cut \`${releaseBranch}\` from \`origin/main\` (\`${baseShort}\`).\n\n` +
    `Moves \`main\` onto the \`${nextVersion}\` \`alpha\` line. Safe to merge once CI is green.`;

  if (hasToken) {
    const pr = await github.createPullRequest({ head: bumpBranch, base: 'main', title, body });
    events.push(info(`Opened main-bump PR: ${pr.url}`));
    await requestAutoMerge(github, pr.url, events);
  } else {
    events.push(info(''));
    events.push(
      info('No CI_GITHUB_RELEASE_TOKEN — the main-bump PR was NOT created (a PR opened by the'),
    );
    events.push(
      info(
        'default token does not trigger CI). Create it yourself so `pull_request` workflows run:',
      ),
    );
    events.push(info(''));
    events.push(
      info(
        `  gh pr create --base main --head ${bumpBranch} \\\n` +
          `    --title ${JSON.stringify(title)} \\\n` +
          `    --body ${JSON.stringify(body)}`,
      ),
    );
  }

  return { events, plan, alreadyDone: false, mutated: true };
}

async function readVersionFileAt(git: GitClient, ref: string, label: string): Promise<VersionFile> {
  const raw = await git.showFileAtRef(ref, 'version.json');
  if (raw === null) {
    throw new InconsistentStateError(`${label} has no version.json — refusing to proceed.`);
  }
  try {
    return parseVersionFile(raw, `${label}:version.json`);
  } catch (err) {
    throw new InconsistentStateError(`${label} has an invalid version.json: ${errorMessage(err)}`, {
      cause: err,
    });
  }
}

type BranchCheck = { ok: true; parent: string } | { ok: false; reason: string };

/**
 * §4 — a single commit on top of some parent, changing only `version.json` to
 * exactly `nextState`. When `expectedParentVf` is given the parent's
 * `version.json` must match it; when `expectedParent` is given the parent SHA
 * must equal it; when `parentAncestorOf` is given the parent must be reachable
 * from that ref (§3 — the base is real main-line history, not an unrelated
 * commit that merely happens to carry the right version.json). Read-only.
 */
async function validateSingleFileBranch(
  git: GitClient,
  {
    ref,
    nextState,
    expectedParentVf,
    expectedParent,
    parentAncestorOf,
  }: {
    ref: string;
    nextState: VersionFile;
    expectedParentVf?: VersionFile;
    expectedParent?: string;
    parentAncestorOf?: string;
  },
): Promise<BranchCheck> {
  const parents = await git.commitParents(ref);
  if (parents === null) return { ok: false, reason: `${ref} cannot be resolved` };
  if (parents.length !== 1) {
    return { ok: false, reason: `it has ${String(parents.length)} parents, not 1` };
  }
  const parent = parents[0];
  if (parent === undefined) return { ok: false, reason: `${ref} has no parent` };
  if (expectedParent && parent !== expectedParent) {
    return {
      ok: false,
      reason: `its base ${parent.slice(0, 7)} is not the expected ${expectedParent.slice(0, 7)}`,
    };
  }
  if (parentAncestorOf && !(await git.isAncestor(parent, parentAncestorOf))) {
    return {
      ok: false,
      reason:
        `its base ${parent.slice(0, 7)} is not in ${parentAncestorOf} history — the branch was ` +
        `not cut from real main-line history`,
    };
  }

  const changed = await git.changedFiles(parent, ref);
  if (changed.length !== 1 || changed[0] !== 'version.json') {
    return {
      ok: false,
      reason: `it changes ${changed.length === 0 ? 'nothing' : changed.join(', ')}, not only version.json`,
    };
  }

  const raw = await git.showFileAtRef(ref, 'version.json');
  const parsed = raw === null ? null : tryParse(raw);
  if (parsed?.channel !== nextState.channel || parsed.version !== nextState.version) {
    return {
      ok: false,
      reason:
        `its version.json is ${raw === null ? 'missing' : JSON.stringify(parsed)}, not ` +
        `{ channel: "${nextState.channel}", version: "${nextState.version}" }`,
    };
  }

  if (expectedParentVf) {
    const praw = await git.showFileAtRef(parent, 'version.json');
    const pparsed = praw === null ? null : tryParse(praw);
    if (
      pparsed?.channel !== expectedParentVf.channel ||
      pparsed.version !== expectedParentVf.version
    ) {
      return {
        ok: false,
        reason:
          `its base version.json is ${praw === null ? 'missing' : JSON.stringify(pparsed)}, not ` +
          `{ channel: "${expectedParentVf.channel}", version: "${expectedParentVf.version}" }`,
      };
    }
  }

  return { ok: true, parent };
}

function tryParse(raw: string): VersionFile | null {
  try {
    return parseVersionFile(raw, 'branch version.json');
  } catch {
    return null;
  }
}
