#!/usr/bin/env node
// Apply (and verify) the GitHub repository governance described in
// scripts/github/repository-policy.json, using the authenticated `gh` CLI.
//
//   node scripts/github/configure-repository.mjs           # apply, then verify
//   node scripts/github/configure-repository.mjs --check    # verify only, no writes
//
// Idempotent: rulesets are matched by name and updated in place. Exits non-zero
// when verification finds drift (or, in --check mode, when anything differs).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { detectRepo, diffPartial, ghApi, requireAuth } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const POLICY = JSON.parse(readFileSync(join(HERE, 'repository-policy.json'), 'utf8'));

const { values } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  console.log(
    'Usage: configure-repository.mjs [--check]\n  --check   verify only; make no changes',
  );
  process.exit(0);
}

const CHECK_ONLY = values.check;
const changed = [];
const problems = [];

/**
 * The pull_request rule parameters actually applied. Equals POLICY.pullRequest
 * (the durable target) when >= 2 eligible reviewers exist; a bootstrap exception
 * (0 approvals) with only 1. Computed once in main().
 * @type {{ params: Record<string, unknown>, target: Record<string, unknown>, exception: string | null }}
 */
let EFFECTIVE_PR;

/**
 * Eligible reviewers = collaborators who can submit an approving review that
 * counts toward the gate, i.e. write or admin.
 */
/** Drop `$comment` (and any other `$`-prefixed) keys — they are not GitHub fields. */
function stripMeta(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith('$')));
}

function computeEffectivePrPolicy(repo) {
  const target = stripMeta(POLICY.pullRequest);
  let eligible = [];
  try {
    eligible = ghApi(`repos/${repo}/collaborators`).filter(
      (c) => c.permissions?.push || c.permissions?.admin,
    );
  } catch {
    // If we cannot read collaborators, fail safe: apply the bootstrap exception.
  }
  if (eligible.length >= 2) {
    return { params: { ...target }, target, exception: null };
  }
  const who = eligible.map((c) => c.login).join(', ') || '(none readable)';
  return {
    params: {
      ...target,
      required_approving_review_count: 0,
      require_last_push_approval: false, // moot at 0, and GitHub rejects true+0
    },
    target,
    exception:
      `only ${eligible.length} eligible reviewer${eligible.length === 1 ? '' : 's'} (${who}); ` +
      `an author cannot approve their own PR. Add a second collaborator with write ` +
      `access and re-run — the policy file needs no edit.`,
  };
}

function log(msg) {
  process.stdout.write(`${msg}\n`);
}
function warn(msg) {
  process.stderr.write(`${msg}\n`);
}

// ── merge settings ─────────────────────────────────────────────────────────────

function reconcileMergeSettings(repo) {
  const want = POLICY.merge;
  const current = ghApi(`repos/${repo}`);
  const diffs = diffPartial(want, current);

  if (diffs.length === 0) {
    log('merge settings: already correct');
    return;
  }
  if (CHECK_ONLY) {
    problems.push(`merge settings drift:\n  ${diffs.join('\n  ')}`);
    return;
  }
  ghApi(`repos/${repo}`, { method: 'PATCH', body: want });
  changed.push(`merge settings: ${diffs.map((d) => d.split(':')[0]).join(', ')}`);

  const after = ghApi(`repos/${repo}`);
  const still = diffPartial(want, after);
  if (still.length)
    problems.push(`merge settings still wrong after PATCH:\n  ${still.join('\n  ')}`);
  else log('merge settings: updated');
}

// ── rulesets ─────────────────────────────────────────────────────────────────

/**
 * Build one ruleset's `rules`: the base rules, then the shared `pull_request`
 * rule from the effective PR policy, then `required_status_checks` when configured.
 */
function rulesFor(rulesetSpec) {
  const rules = (rulesetSpec.baseRules ?? []).map((r) => ({ ...r }));

  rules.push({ type: 'pull_request', parameters: { ...EFFECTIVE_PR.params } });

  const rsc = POLICY.requiredStatusChecks;
  if (rsc && Array.isArray(rsc.checks) && rsc.checks.length > 0) {
    rules.push({
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: rsc.strict !== false,
        do_not_enforce_on_create: rsc.doNotEnforceOnCreate === true,
        required_status_checks: rsc.checks.map((context) => ({ context })),
      },
    });
  }
  return rules;
}

function desiredRuleset(spec) {
  return {
    name: spec.name,
    target: spec.target,
    enforcement: spec.enforcement,
    conditions: spec.conditions,
    bypass_actors: spec.bypass_actors ?? [],
    rules: rulesFor(spec),
  };
}

function reconcileRuleset(repo, spec) {
  const want = desiredRuleset(spec);
  const existing = ghApi(`repos/${repo}/rulesets?per_page=100`);
  const match = existing.find((r) => r.name === spec.name);

  const compare = (rs) =>
    diffPartial(
      { enforcement: want.enforcement, conditions: want.conditions, rules: want.rules },
      { enforcement: rs.enforcement, conditions: rs.conditions, rules: normalizeRules(rs.rules) },
    );

  if (match) {
    const full = ghApi(`repos/${repo}/rulesets/${match.id}`);
    const diffs = compare(full);
    if (diffs.length === 0) {
      log(`ruleset ${spec.name}: already correct (id ${match.id})`);
      return;
    }
    if (CHECK_ONLY) {
      problems.push(`ruleset ${spec.name} drift:\n  ${diffs.join('\n  ')}`);
      return;
    }
    ghApi(`repos/${repo}/rulesets/${match.id}`, { method: 'PUT', body: want });
    changed.push(`ruleset ${spec.name}: updated (id ${match.id})`);
    verifyRuleset(repo, match.id, compare);
  } else {
    if (CHECK_ONLY) {
      problems.push(`ruleset ${spec.name}: missing`);
      return;
    }
    const created = ghApi(`repos/${repo}/rulesets`, { method: 'POST', body: want });
    changed.push(`ruleset ${spec.name}: created (id ${created.id})`);
    verifyRuleset(repo, created.id, compare);
  }
}

/** Strip server-added noise so a stored ruleset compares cleanly against the policy. */
function normalizeRules(rules) {
  return (rules ?? []).map((r) =>
    r.parameters ? { type: r.type, parameters: r.parameters } : { type: r.type },
  );
}

function verifyRuleset(repo, id, compare) {
  const after = ghApi(`repos/${repo}/rulesets/${id}`);
  const diffs = compare(after);
  if (diffs.length)
    problems.push(`ruleset ${id} still wrong after write:\n  ${diffs.join('\n  ')}`);
  else log(`ruleset ${id}: verified`);
}

/** Report the bootstrap review-policy exception, if one is in effect. Never silent. */
function reportReviewPolicy() {
  if (!EFFECTIVE_PR.exception) {
    log(
      `\nPR review policy: target applied (${EFFECTIVE_PR.target.required_approving_review_count} approval).`,
    );
    return;
  }
  warn('\n────────────────────────────────────────────────────────────────');
  warn('PR REVIEW POLICY — BOOTSTRAP EXCEPTION IN EFFECT');
  warn('────────────────────────────────────────────────────────────────');
  warn(`  target policy    : ${EFFECTIVE_PR.target.required_approving_review_count} approval`);
  warn(`  effective policy : ${EFFECTIVE_PR.params.required_approving_review_count} approvals`);
  warn(`  reason           : ${EFFECTIVE_PR.exception}`);
  warn('────────────────────────────────────────────────────────────────');
}

// ── run ──────────────────────────────────────────────────────────────────────

function main() {
  requireAuth();
  const repo = detectRepo();
  log(`${CHECK_ONLY ? 'Checking' : 'Configuring'} ${repo}\n`);

  EFFECTIVE_PR = computeEffectivePrPolicy(repo);

  reconcileMergeSettings(repo);
  for (const spec of POLICY.rulesets) reconcileRuleset(repo, spec);
  reportReviewPolicy();

  log('');
  if (changed.length) {
    log('Changed:');
    for (const c of changed) log(`  - ${c}`);
  }

  if (problems.length) {
    warn(`${CHECK_ONLY ? 'Drift found' : 'Problems'}:`);
    for (const p of problems) warn(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  if (!changed.length) log(CHECK_ONLY ? 'In sync — no changes needed.' : 'Nothing to change.');
}

try {
  main();
} catch (err) {
  warn(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
