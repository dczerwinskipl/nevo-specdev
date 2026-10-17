import { lstat, mkdir, readFile, readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';

import { writeJsonAtomically } from '../../project/atomic-json';
import type { ResolvedProjectHome } from '../../project/project-home';
import { CloseOperationError, type CloseJournal } from './model';

const JOURNAL_DIR = 'engine/operations/close';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA = /^[a-f0-9]{64}$/iu;

export function closeJournalPath(context: ResolvedProjectHome, operationId: string): string {
  if (!UUID.test(operationId)) throw invalid();
  return join(context.project.stateRoot, JOURNAL_DIR, operationId + '.json');
}

export async function listCloseJournals(
  context: ResolvedProjectHome,
): Promise<readonly CloseJournal[]> {
  const directory = join(context.project.stateRoot, JOURNAL_DIR);
  try {
    await requireRealDirectory(directory);
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const entries = await readdir(directory, { withFileTypes: true });
  const records: CloseJournal[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.json')) throw invalid();
    const record = await readCloseJournal(context, entry.name.slice(0, -5));
    if (!record) throw invalid();
    records.push(record);
  }
  return records;
}

export async function readCloseJournal(
  context: ResolvedProjectHome,
  operationId: string,
): Promise<CloseJournal | undefined> {
  const path = closeJournalPath(context, operationId);
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw invalid();
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (!isCloseJournal(context, parsed, operationId)) throw invalid();
    return parsed;
  } catch (error) {
    if (isMissing(error)) return undefined;
    if (error instanceof SyntaxError) throw invalid();
    throw error;
  }
}

/** Mutations only while holding the Project Home control lock. */
export async function publishCloseJournal(
  context: ResolvedProjectHome,
  journal: CloseJournal,
): Promise<void> {
  if (!isCloseJournal(context, journal, journal.plan.operationId)) throw invalid();
  const directory = join(context.project.stateRoot, JOURNAL_DIR);
  let ancestor = context.project.stateRoot;
  for (const part of ['engine', 'operations', 'close']) {
    ancestor = join(ancestor, part);
    try {
      await mkdir(ancestor, { mode: 0o700 });
    } catch (error) {
      if (!isExists(error)) throw error;
    }
    await requireRealDirectory(ancestor);
  }
  await requireRealDirectory(directory);
  await writeJsonAtomically(closeJournalPath(context, journal.plan.operationId), journal);
}

function isCloseJournal(
  context: ResolvedProjectHome,
  value: unknown,
  operationId: string,
): value is CloseJournal {
  if (!isRecord(value) || !isRecord(value.plan)) return false;
  const plan = value.plan;
  const stages = new Set([
    'reserved','archive-initiated','archive-committed','integration-preparation-initiated',
    'integration-publish-initiated','integration-verified','binding-rebound',
    'disposal-initiated','completed','archived-linked-awaiting-integration','recovery-required',
  ]);
  const outcomes = new Set([
    'integrated-and-removed','archive-only-closed','archived-linked-awaiting-integration',
    'archived-in-primary','worktree-integrated-and-removed',
  ]);
  return (
    value.version === 1 &&
    value.projectId === context.project.projectId &&
    value.gitInstanceId === context.project.gitInstanceId &&
    stages.has(value.stage) &&
    (value.reason === undefined || typeof value.reason === 'string') &&
    (value.outcome === undefined || outcomes.has(value.outcome)) &&
    plan.operationId === operationId && UUID.test(operationId) &&
    UUID.test(plan.specId) && SHA.test(plan.fingerprint) &&
    (plan.kind === 'worktree-close' || plan.kind === 'specification-close') &&
    typeof plan.slug === 'string' &&
    (plan.location === 'active' || plan.location === 'archive') &&
    Number.isSafeInteger(plan.registryRevision) &&
    (plan.bindingGeneration === undefined || Number.isSafeInteger(plan.bindingGeneration)) &&
    isWorkspace(plan.source) &&
    (plan.target === undefined || isWorkspace(plan.target)) &&
    (plan.targetBranch === undefined || typeof plan.targetBranch === 'string') &&
    (plan.integrateToTargetBranch === undefined || typeof plan.integrateToTargetBranch === 'boolean') &&
    (plan.configRevision === undefined || (typeof plan.configRevision === 'string' && SHA.test(plan.configRevision))) &&
    Array.isArray(plan.resources) && plan.resources.length > 0 &&
    plan.resources.every((resource: unknown) => typeof resource === 'string' && resource.length > 0) &&
    new Set(plan.resources).size === plan.resources.length &&
    plan.resources.every((resource: string, i: number) => i === 0 || plan.resources[i-1] < resource)
  );
}

function isWorkspace(value: unknown): boolean {
  return isRecord(value) &&
    UUID.test(value.workspaceId as string) &&
    typeof value.root === 'string' &&
    typeof value.branch === 'string' &&
    /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/iu.test(value.head as string) &&
    (value.instanceId === undefined || UUID.test(value.instanceId as string));
}

async function requireRealDirectory(path: string): Promise<void> {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(path)) !== path) throw invalid();
}

function invalid(): CloseOperationError {
  return new CloseOperationError('CLOSE_JOURNAL_CORRUPT', 'Close journal is corrupt, redirected or unsupported.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isMissing(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}
function isExists(error: unknown): boolean {
  return isRecord(error) && error.code === 'EEXIST';
}
