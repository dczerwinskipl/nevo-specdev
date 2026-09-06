// Use case: cut a maintained release line off the current `origin/main`.
// Orchestration only — all I/O goes through the injected GitClient/GitHubClient.

import type { CutPlan } from '../domain/cut-plan.js';
import { validateCutBaseVersion } from '../domain/cut-plan.js';
import { parseVersionFile, versionFileText } from '../domain/version.js';
import { InconsistentStateError, errorMessage } from '../errors.js';
import type { GitClient, GitHubClient } from '../ports.js';
import { info, type ActionEvent } from './events.js';

type ValidCutPlan = Extract<CutPlan, { ok: true }>;

export interface CutReleaseLineDeps {
  readonly git: GitClient;
  readonly github: GitHubClient;
  /** a token that triggers `pull_request` workflows is available. */
  readonly hasToken: boolean;
}

export interface CutReleaseLineResult {
  readonly events: ActionEvent[];
  readonly performed: boolean;
}

export async function executeReleaseCut(
  plan: ValidCutPlan,
  { git, github, hasToken }: CutReleaseLineDeps,
): Promise<CutReleaseLineResult> {
  const events: ActionEvent[] = [];
  const { releaseBranch, releaseVersion, nextVersion, bumpBranch } = plan;

  await git.fetch();

  const branchExists = await git.remoteBranchExists(releaseBranch);
  const openBumpPr = await github.findOpenPullRequest({ head: bumpBranch, base: 'main' });

  if (branchExists && openBumpPr) {
    events.push(info(`${releaseBranch} already exists and the main-bump PR is open:`));
    events.push(info(`  ${openBumpPr.url}`));
    events.push(info('Nothing to do — merge that PR to finish.'));
    return { events, performed: false };
  }
  if (branchExists) {
    throw new InconsistentStateError(
      `${releaseBranch} already exists but no open main-bump PR was found. The line was cut ` +
        `but main was never moved forward — open the bump PR by hand (set version.json to ` +
        `{ channel: "alpha", version: "${nextVersion}" }) or, with admin rights, delete ` +
        `${releaseBranch} and re-run.`,
    );
  }
  if (openBumpPr) {
    throw new InconsistentStateError(
      `An open PR from ${bumpBranch} already exists (${openBumpPr.url}) but ${releaseBranch} ` +
        `does not. Resolve that PR before cutting the line.`,
    );
  }

  const baseSha = await git.resolveCommit('origin/main');
  if (!baseSha) {
    throw new InconsistentStateError('Cannot resolve origin/main — run `git fetch origin` first.');
  }
  const baseShort = baseSha.slice(0, 7);

  const raw = await git.showFileAtRef(baseSha, 'version.json');
  if (raw === null) {
    throw new InconsistentStateError(
      `origin/main at ${baseShort} has no version.json — refusing to cut a release line from ` +
        `an unversioned main.`,
    );
  }
  let mainVf;
  try {
    mainVf = parseVersionFile(raw, `origin/main@${baseShort}:version.json`);
  } catch (err) {
    throw new InconsistentStateError(
      `origin/main at ${baseShort} has an invalid version.json: ${errorMessage(err)}`,
      { cause: err },
    );
  }
  const baseErrors = validateCutBaseVersion(mainVf, { releaseVersion, nextVersion });
  if (baseErrors.length) {
    throw new InconsistentStateError(
      `Refusing to cut ${releaseBranch} — origin/main is not in the expected state:\n  - ` +
        baseErrors.join('\n  - '),
    );
  }
  events.push(info(`origin/main at ${baseShort} is alpha ${mainVf.version} — cut is consistent.`));

  // 1. release/vX.Y = origin/main + one commit setting its version.json to beta.
  const relSha = await git.commitSingleFileOnto({
    baseRef: baseSha,
    path: 'version.json',
    content: versionFileText({ channel: 'beta', version: releaseVersion }),
    message: `chore(release): start ${releaseVersion} stabilization (beta)`,
  });
  await git.pushCommitToBranch({ sha: relSha, branch: releaseBranch });
  events.push(info(`Created ${releaseBranch} at ${baseShort} + version.json`));

  // 2. chore/bump-main-to-<next> — the SAME origin/main base, moved to the next alpha.
  const bumpSha = await git.commitSingleFileOnto({
    baseRef: baseSha,
    path: 'version.json',
    content: versionFileText({ channel: 'alpha', version: nextVersion }),
    message: `chore(release): begin ${nextVersion} development line`,
  });
  await git.pushCommitToBranch({ sha: bumpSha, branch: bumpBranch });
  events.push(info(`Pushed ${bumpBranch} at ${baseShort}`));

  const title = `chore(release): begin ${nextVersion} development line`;
  const body =
    `Cut \`${releaseBranch}\` from \`origin/main\` (\`${baseShort}\`).\n\n` +
    `Moves \`main\` onto the \`${nextVersion}\` \`alpha\` line. Safe to merge once CI is green.`;

  if (hasToken) {
    const pr = await github.createPullRequest({ head: bumpBranch, base: 'main', title, body });
    events.push(info(`Opened main-bump PR: ${pr.url}`));
    await github.enableAutoMerge(pr.url);
    events.push(info('Auto-merge requested — lands when required checks pass.'));
  } else {
    events.push(info(''));
    events.push(
      info('No RELEASE_TOKEN — the main-bump PR was NOT created (a PR opened by the default'),
    );
    events.push(
      info('token does not trigger CI). Create it yourself so `pull_request` workflows run:'),
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

  return { events, performed: true };
}
