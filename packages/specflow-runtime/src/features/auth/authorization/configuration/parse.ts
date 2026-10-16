import { IDENTIFIER_SEGMENT_PATTERN, type Scope } from '@nevo/authorization';

import { RuntimeConfigError } from '../../../../config/parsing/runtime-config-error';
import { nonEmptyString, onlyKeys, record } from '../../../../config/parsing/value-parsers';
import { isSpecFlowRoleId } from '../roles';
import type { RuntimeAuthorizationAssignmentConfig, RuntimeAuthorizationConfig } from './model';

const AUTHORIZATION_KEYS = new Set(['assignments']);
const ASSIGNMENT_KEYS = new Set(['userId', 'role', 'scope']);
const SCOPE_KEY = new RegExp(IDENTIFIER_SEGMENT_PATTERN, 'u');

export function parseAuthorizationConfig(
  value: unknown,
  knownUserIds: ReadonlySet<string>,
): RuntimeAuthorizationConfig {
  if (value === undefined) {
    return { assignments: [] };
  }

  const authorization = record(value, 'authorization');
  onlyKeys(authorization, AUTHORIZATION_KEYS, 'authorization');

  const rawAssignments = authorization.assignments ?? [];
  if (!Array.isArray(rawAssignments)) {
    throw new RuntimeConfigError('authorization.assignments must be an array.');
  }

  return {
    assignments: rawAssignments.map((rawAssignment, index) =>
      parseAssignment(rawAssignment, index, knownUserIds),
    ),
  };
}

function parseAssignment(
  value: unknown,
  index: number,
  knownUserIds: ReadonlySet<string>,
): RuntimeAuthorizationAssignmentConfig {
  const path = `authorization.assignments[${index}]`;
  const assignment = record(value, path);
  onlyKeys(assignment, ASSIGNMENT_KEYS, path);

  const userId = nonEmptyString(assignment.userId, `${path}.userId`);
  if (!knownUserIds.has(userId)) {
    throw new RuntimeConfigError(
      `${path}.userId references unknown configured auth user '${userId}'.`,
    );
  }

  const role = nonEmptyString(assignment.role, `${path}.role`);
  if (!isSpecFlowRoleId(role)) {
    throw new RuntimeConfigError(`${path}.role references unknown role '${role}'.`);
  }

  return {
    userId,
    role,
    scope: parseAssignmentScope(assignment.scope, `${path}.scope`),
  };
}

function parseAssignmentScope(value: unknown, path: string): Scope {
  if (value === undefined) {
    return {};
  }

  const scope = record(value, path);
  const entries: [string, string][] = [];

  for (const [key, rawValue] of Object.entries(scope)) {
    // Project authorization is portable. A workspaceId is local to one
    // Project Home registry and must never become a committed access grant.
    if (key === 'workspaceId') {
      throw new RuntimeConfigError(
        `${path}.workspaceId is a local workspace selector, not a portable authorization scope.`,
      );
    }
    if (!SCOPE_KEY.test(key)) {
      throw new RuntimeConfigError(
        `${path} key '${key}' must contain only letters, digits, '_' or '-', and must start with a letter or digit.`,
      );
    }

    entries.push([key, nonEmptyString(rawValue, `${path}.${key}`)]);
  }

  return Object.fromEntries(entries);
}
