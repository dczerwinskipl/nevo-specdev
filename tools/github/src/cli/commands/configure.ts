import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { configureRepository } from '../../app/configure-repository.js';
import { parsePolicy } from '../../domain/policy.js';
import { GovernanceError } from '../../errors.js';
import type { GitHubAdminClient, Logger } from '../../ports.js';

const DIVIDER = '────────────────────────────────────────────────────────────────';

/**
 * repository-policy.json lives at the package root. This file runs from either
 * `dist/cli/commands/` or `src/cli/commands/`, so the package root is three
 * levels up in both cases.
 */
function loadPolicyText(): string {
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  try {
    return readFileSync(join(packageRoot, 'repository-policy.json'), 'utf8');
  } catch (err) {
    throw new GovernanceError(
      `cannot read repository-policy.json at ${packageRoot}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err },
    );
  }
}

export function configureCommand(client: GitHubAdminClient, out: Logger, err: Logger): Command {
  return new Command('configure')
    .description('Reconcile GitHub merge settings + branch rulesets against repository-policy.json')
    .option('--check', 'verify only; make no changes', false)
    .action((opts: { check: boolean }) => {
      const policy = parsePolicy(loadPolicyText());
      const result = configureRepository(client, policy, { checkOnly: opts.check });

      for (const line of result.log) out(line);

      if (result.aborted && result.review.kind === 'unverifiable') {
        err('');
        err(DIVIDER);
        err('PR REVIEW POLICY — CANNOT VERIFY REVIEWER ELIGIBILITY');
        err(DIVIDER);
        err(`  ${result.review.reason}`);
        err(DIVIDER);
        err(
          opts.check
            ? 'Reported as drift: the ruleset was NOT inspected against a guessed policy.'
            : 'No ruleset was changed. Nothing was applied.',
        );
        throw new GovernanceError('reviewer eligibility could not be verified');
      }

      if (result.review.kind === 'bootstrap') {
        err('');
        err(DIVIDER);
        err('PR REVIEW POLICY — BOOTSTRAP EXCEPTION IN EFFECT');
        err(DIVIDER);
        err(
          `  target policy    : ${String(result.review.target.required_approving_review_count)} approval`,
        );
        err(
          `  effective policy : ${String(result.review.params.required_approving_review_count)} approvals`,
        );
        err(`  reason           : ${result.review.exception}`);
        err(DIVIDER);
      } else {
        out(
          `\nPR review policy: target applied (${String(
            result.review.target.required_approving_review_count,
          )} approval).`,
        );
      }

      if (result.changed.length) {
        out('\nChanged:');
        for (const c of result.changed) out(`  - ${c}`);
      }

      if (result.problems.length) {
        err(`\n${opts.check ? 'Drift found' : 'Problems'}:`);
        for (const p of result.problems) err(`  - ${p}`);
        throw new GovernanceError(
          `${opts.check ? 'governance drift' : 'reconciliation failed'} (${String(
            result.problems.length,
          )} problem${result.problems.length === 1 ? '' : 's'})`,
        );
      }

      if (!result.changed.length) {
        out(opts.check ? '\nIn sync — no changes needed.' : '\nNothing to change.');
      }
    });
}
