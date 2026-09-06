import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { configureRepository } from '../../src/app/configure-repository.js';
import { parsePolicy, type RepositoryPolicy } from '../../src/domain/policy.js';
import { createFakeAdminClient } from '../support/fake-client.js';

const policy: RepositoryPolicy = parsePolicy(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'repository-policy.json'),
    'utf8',
  ),
);

const prRuleParams = (rs: Record<string, unknown>): Record<string, unknown> => {
  const rules = rs.rules as { type: string; parameters?: Record<string, unknown> }[];
  return rules.find((r) => r.type === 'pull_request')?.parameters ?? {};
};

describe('configureRepository', () => {
  it('a collaborator-API failure aborts without touching anything', () => {
    const client = createFakeAdminClient({ collaborators: new Error('HTTP 403') });
    const result = configureRepository(client, policy, { checkOnly: false });
    expect(result.aborted).toBe(true);
    expect(result.review.kind).toBe('unverifiable');
    expect(client.patched).toEqual([]);
    expect(client.createdRulesets).toEqual([]);
  });

  it('one eligible reviewer -> bootstrap: rulesets created with 0 required approvals', () => {
    const client = createFakeAdminClient({
      collaborators: [{ login: 'owner', permissions: { admin: true } }],
    });
    const result = configureRepository(client, policy, { checkOnly: false });
    expect(result.review.kind).toBe('bootstrap');
    expect(client.createdRulesets).toHaveLength(2);
    expect(prRuleParams(client.createdRulesets[0] as Record<string, unknown>)).toMatchObject({
      required_approving_review_count: 0,
      require_last_push_approval: false,
    });
  });

  it('two eligible reviewers -> target: rulesets carry 1 required approval', () => {
    const client = createFakeAdminClient({
      collaborators: [
        { login: 'a', permissions: { push: true } },
        { login: 'b', permissions: { admin: true } },
      ],
    });
    const result = configureRepository(client, policy, { checkOnly: false });
    expect(result.review.kind).toBe('target');
    expect(prRuleParams(client.createdRulesets[0] as Record<string, unknown>)).toMatchObject({
      required_approving_review_count: 1,
    });
  });

  it('--check reports missing rulesets and merge drift, writes nothing', () => {
    const client = createFakeAdminClient({ repoSettings: { allow_squash_merge: false } });
    const result = configureRepository(client, policy, { checkOnly: true });
    expect(client.patched).toEqual([]);
    expect(client.createdRulesets).toEqual([]);
    expect(result.problems.join('\n')).toMatch(/merge settings drift/);
    expect(result.problems.join('\n')).toMatch(/protected-main: missing/);
  });

  it('a second --check after applying reports in sync', () => {
    const client = createFakeAdminClient({
      collaborators: [
        { login: 'a', permissions: { push: true } },
        { login: 'b', permissions: { admin: true } },
      ],
    });
    // seed merge settings to the target so only rulesets need creating
    Object.assign(client.state.repoSettings, policy.merge);
    configureRepository(client, policy, { checkOnly: false });
    const second = configureRepository(client, policy, { checkOnly: true });
    expect(second.problems).toEqual([]);
    expect(second.changed).toEqual([]);
  });
});
