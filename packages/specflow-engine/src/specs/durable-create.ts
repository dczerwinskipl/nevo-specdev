import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { SpecFlowEngine } from '../application';
import { openGitCapability } from '../git/capability';
import { executeGit } from '../git/process';
import { executeGitMutation } from '../git/mutation';
import {
  addWorkspace,
  bindSpecToWorkspace,
  inspectRegisteredWorkspace,
  verifyWorkspaceRoot,
  type WorkspaceRegistration,
} from '../project/workspace-registry';
import {
  WORKSPACE_IDENTITY_RELATIVE_PATH,
  provisionLinkedWorkspaceIdentity,
  verifyLinkedWorkspaceIdentity,
} from '../project/workspace-identity';
import {
  createSpecificationScaffold,
  isValidSpecificationId,
  type SpecificationScaffold,
} from './model';
import { discoverSpecifications } from './discovery';
import { readWorkspaceSpecification } from './repository';
import {
  CreateOperationError,
  listCreateJournals,
  publishCreateJournal,
  readCreateJournal,
  validateOperationId,
  withCreateJournalLock,
  type CreateJournal,
  type CreateStage,
} from './create-journal';

export type CreateSpecificationTarget =
  | { readonly kind: 'existing'; readonly workspaceId: string }
  | {
      readonly kind: 'new-worktree';
      readonly baseRef: string;
      readonly branch?: string;
    };

export interface CreateSpecificationInput {
  readonly operationId: string;
  readonly title: string;
  readonly created: string;
  readonly goal?: string;
  readonly target: CreateSpecificationTarget;
}

export interface CreatedSpecification {
  readonly operationId: string;
  readonly specId: string;
  readonly slug: string;
  readonly workspaceId: string;
  readonly workspaceRoot: string;
  readonly relativeManifestPath: string;
}

export interface CreateSpecificationOptions {
  /**
   * Explicit operator assertion that an interrupted mutating Git process is
   * no longer running. Without this, git-initiated is never replayed.
   * The Engine still verifies exact ref/path/HEAD and fails closed on mismatch.
   */
  readonly confirmInterruptedGitSettled?: boolean;
  /** Internal test hook only; adapters must never expose this to HTTP callers. */
  readonly afterEffect?: (effect: 'reservation' | 'git' | 'manifest' | 'registry') => Promise<void>;
}

export async function inspectCreateSpecification(
  engine: SpecFlowEngine,
  operationId: string,
): Promise<CreateJournal | undefined> {
  await engine.readRegistry();
  return readCreateJournal(engine.context, operationId);
}

/**
 * Offline, idempotent create use case. The Engine alone owns Git/FS/registry
 * mutations: HTTP/CLI will only adapt and authorize this operation in E2.T05.
 */
export async function createSpecification(
  engine: SpecFlowEngine,
  input: CreateSpecificationInput,
  options: CreateSpecificationOptions = {},
): Promise<CreatedSpecification> {
  validateOperationId(input.operationId);
  const normalized = normalize(input);
  const fingerprint = digest(JSON.stringify(normalized));
  let record = await reserve(engine, normalized, input.operationId, fingerprint);
  // The journal intent is durable at this point. A test process can now be
  // terminated without any later mutation having started.
  await options.afterEffect?.('reservation');

  // Each transition is CAS under the short Project Home control lock.
  // The Git command itself does not hold that lock. A durable git-initiated
  // stage fences concurrent retries until explicit quiescence reconciliation.
  for (let count = 0; count < 12; count++) {
    if (record.stage === 'completed') {
      // Retrying a completed create must remain idempotent after legitimate
      // human edits: verify canonical identity, not the original scaffold bytes.
      await verifyResult(engine, record);
      return resultOf(record);
    }
    if (record.stage === 'recovery-required') {
      throw recovery('Operation needs explicit repair; inspect the durable journal.');
    }
    if (record.stage === 'git-initiated') {
      if (!options.confirmInterruptedGitSettled) {
        throw recovery('Git effect may still be running; confirm process quiescence before retry.');
      }
      const state = await inspectPlannedGitEffect(engine, record);
      if (state === 'present') {
        record = await transition(engine, record, 'git-provisioned');
      } else if (state === 'absent') {
        record = await transition(engine, record, 'reserved');
      } else {
        throw recovery('Git branch/worktree does not match the intent; manual recovery required.');
      }
      continue;
    }

    if (record.stage === 'reserved') {
      if (record.target.kind === 'new-worktree') {
        await validateNewGitReservation(engine, record);
        record = await transition(engine, record, 'git-initiated');
        // mkdir on the bounded, project-owned sibling directory only.
        // Existing unexpected directories and symlinks fail in revalidation.
        const worktreesParent = dirname(record.target.workspaceRoot);
        await mkdir(worktreesParent, { recursive: true });
        const parentStat = await lstat(worktreesParent);
        if (
          !parentStat.isDirectory() ||
          parentStat.isSymbolicLink() ||
          (await realpath(worktreesParent)) !== worktreesParent
        ) {
          throw recovery('Managed worktree parent was redirected before the Git mutation.');
        }
        const state = await inspectPlannedGitEffect(engine, record);
        if (state !== 'absent') {
          throw recovery('Git state changed between reservation and execution.');
        }
        const completed = await executeGitMutation(engine.context.project.homeRoot, [
          'worktree',
          'add',
          '-b',
          record.target.branch!,
          record.target.workspaceRoot,
          record.target.baseCommit!,
        ]);
        if (completed.exitCode !== 0) {
          throw recovery('Git worktree creation had an uncertain effect; reconcile before retry.');
        }
        await options.afterEffect?.('git');
        if ((await inspectPlannedGitEffect(engine, record)) !== 'present') {
          throw recovery('Created Git worktree does not match the recorded intent.');
        }
        record = await transition(engine, record, 'git-provisioned');
      } else {
        record = await transition(engine, record, 'git-provisioned');
      }
      continue;
    }

    if (record.stage === 'git-provisioned') {
      if (record.target.kind === 'new-worktree') {
        if ((await inspectPlannedGitEffect(engine, record)) !== 'present') {
          throw recovery('Managed Git worktree changed before identity provisioning.');
        }
        record = await ensureLinkedIdentity(engine, record);
      } else {
        await requireRegisteredTarget(engine, record);
      }
      record = await transition(engine, record, 'manifest-writing');
      continue;
    }

    if (record.stage === 'manifest-writing') {
      await requireTargetIdentity(engine, record);
      await writeScaffoldWithEvidence(record);
      await options.afterEffect?.('manifest');
      record = await transition(engine, record, 'manifest-written');
      continue;
    }

    if (record.stage === 'manifest-written') {
      await verifyScaffold(record);
      record = await transition(engine, record, 'registry-writing');
      continue;
    }

    if (record.stage === 'registry-writing') {
      await requireTargetIdentity(engine, record);
      await verifyScaffold(record);
      await commitBinding(engine, record);
      await options.afterEffect?.('registry');
      record = await transition(engine, record, 'registry-linked');
      continue;
    }

    if (record.stage === 'registry-linked') {
      await verifyResult(engine, record);
      record = await transition(engine, record, 'completed');
      continue;
    }
  }
  throw recovery('Create operation exceeded its bounded state transition count.');
}

function normalize(input: CreateSpecificationInput): Omit<CreateSpecificationInput, 'operationId'> {
  const title = input.title.replace(/\s+/gu, ' ').trim();
  const goal = input.goal?.trim();
  // Use T01's canonical validation rather than adding a competing model.
  createSpecificationScaffold({ specId: randomUUID(), title, created: input.created, goal });
  if (input.target.kind === 'existing') {
    if (!isValidSpecificationId(input.target.workspaceId)) {
      throw new CreateOperationError('CREATE_OPERATION_INVALID', 'Invalid target workspaceId.');
    }
    return {
      title,
      created: input.created,
      ...(goal ? { goal } : {}),
      target: { kind: 'existing', workspaceId: input.target.workspaceId },
    };
  }
  if (typeof input.target.baseRef !== 'string' || !input.target.baseRef) {
    throw new CreateOperationError('CREATE_OPERATION_INVALID', 'Git baseRef is required.');
  }
  return {
    title,
    created: input.created,
    ...(goal ? { goal } : {}),
    target: {
      kind: 'new-worktree',
      baseRef: input.target.baseRef,
      ...(input.target.branch ? { branch: input.target.branch } : {}),
    },
  };
}

async function reserve(
  engine: SpecFlowEngine,
  input: Omit<CreateSpecificationInput, 'operationId'>,
  operationId: string,
  fingerprint: string,
): Promise<CreateJournal> {
  return withCreateJournalLock(engine.context, async () => {
    const operations = await listCreateJournals(engine.context);
    const previous = operations.find((item) => item.operationId === operationId);
    if (previous) {
      if (previous.inputFingerprint !== fingerprint) {
        throw new CreateOperationError(
          'CREATE_CONFLICT',
          'OperationId was already used with different immutable inputs.',
        );
      }
      return previous;
    }

    const canonical = await discoverSpecifications(engine);
    // Explicit fail-closed policy: current registry binds specId to workspaceId,
    // but does not persist the authoritative slug of every bound specification.
    // If one source is unavailable, global slug uniqueness cannot be proven.
    // Do not weaken this gate until slug ownership is durably indexed.
    if (canonical.some((item) => item.status !== 'available')) {
      throw recovery('Cannot reserve new Spec while an existing canonical source is unavailable.');
    }
    const specId = randomUUID();
    const scaffold = createSpecificationScaffold({
      specId,
      title: input.title,
      created: input.created,
      goal: input.goal,
    });
    if (
      canonical.some(
        (item) => item.status === 'available' && item.specification.slug === scaffold.slug,
      ) ||
      operations.some((item) => item.slug === scaffold.slug)
    ) {
      throw new CreateOperationError('CREATE_CONFLICT', 'Specification slug is already reserved.');
    }

    let target: CreateJournal['target'];
    if (input.target.kind === 'existing') {
      const registry = await engine.readRegistry();
      const inspected = await inspectRegisteredWorkspace(
        engine.context,
        registry,
        input.target.workspaceId,
      );
      if (inspected.status !== 'available') {
        throw recovery('Selected existing workspace is unavailable.');
      }
      target = {
        kind: 'existing',
        workspaceId: input.target.workspaceId,
        workspaceRoot: inspected.root,
      };
    } else {
      const plan = await openGitCapability(engine).planNewWorktree({
        specId,
        slug: scaffold.slug,
        baseRef: input.target.baseRef,
        branch: input.target.branch,
      });
      if (
        operations.some(
          (item) =>
            item.target.kind === 'new-worktree' &&
            (branchesOverlap(item.target.branch!, plan.branch) ||
              item.target.workspaceRoot.toLowerCase() === plan.targetPath.toLowerCase()),
        )
      ) {
        throw new CreateOperationError(
          'CREATE_CONFLICT',
          'Git branch or worktree path is reserved.',
        );
      }
      target = {
        kind: 'new-worktree',
        workspaceId: randomUUID(),
        workspaceRoot: plan.targetPath,
        instanceId: randomUUID(),
        branch: plan.branch,
        baseCommit: plan.baseCommit,
      };
    }

    const record: CreateJournal = {
      version: 1,
      projectId: engine.context.project.projectId,
      operationId,
      inputFingerprint: fingerprint,
      specId,
      slug: scaffold.slug,
      title: input.title,
      created: input.created,
      ...(input.goal ? { goal: input.goal } : {}),
      stage: 'reserved',
      target,
      files: scaffold.files.map(({ relativePath, sha256 }) => ({ relativePath, sha256 })),
    };
    await publishCreateJournal(engine.context, record);
    return record;
  });
}

async function transition(
  engine: SpecFlowEngine,
  record: CreateJournal,
  stage: CreateStage,
  target = record.target,
): Promise<CreateJournal> {
  return withCreateJournalLock(engine.context, async () => {
    const current = await readCreateJournal(engine.context, record.operationId);
    if (!current || JSON.stringify(current) !== JSON.stringify(record)) {
      throw new CreateOperationError(
        'CREATE_CONFLICT',
        'Create journal changed concurrently; restart from the latest durable state.',
      );
    }
    const next: CreateJournal = { ...current, target, stage };
    await publishCreateJournal(engine.context, next);
    return next;
  });
}

async function validateNewGitReservation(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<void> {
  const plan = await openGitCapability(engine).planNewWorktree({
    specId: record.specId,
    slug: record.slug,
    baseRef: record.target.baseCommit!,
    branch: record.target.branch,
    targetPath: record.target.workspaceRoot,
  });
  if (
    plan.baseCommit !== record.target.baseCommit ||
    plan.targetPath !== record.target.workspaceRoot
  ) {
    throw recovery('Planned Git repository or base identity has changed.');
  }
}

async function inspectPlannedGitEffect(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<'absent' | 'present' | 'conflict'> {
  const git = openGitCapability(engine);
  const items = await git.listWorktrees();
  const target = record.target;
  const present = items.find(
    (item) => item.root.toLowerCase() === target.workspaceRoot.toLowerCase(),
  );
  if (present) {
    return !present.prunable &&
      present.branch === 'refs/heads/' + target.branch &&
      present.head === target.baseCommit
      ? 'present'
      : 'conflict';
  }
  const branchExists = items.some((item) => item.branch === 'refs/heads/' + target.branch);
  if (branchExists) return 'conflict';
  // Git can create a ref and then fail before publishing worktree metadata.
  // A detached ref is NOT proof that the planned effect is absent.
  const refs = await executeGit(engine.context.project.homeRoot, [
    'for-each-ref',
    '--format=%(refname)',
    'refs/heads',
  ]);
  if (refs.exitCode !== 0) return 'conflict';
  const plannedRef = ('refs/heads/' + target.branch).toLowerCase();
  if (
    refs.stdout.split('\n').some((value) => {
      const ref = value.toLowerCase();
      return (
        ref === plannedRef || ref.startsWith(plannedRef + '/') || plannedRef.startsWith(ref + '/')
      );
    })
  )
    return 'conflict';
  const stat = await lstat(target.workspaceRoot).catch((error: unknown) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (stat !== undefined) return 'conflict';
  return 'absent';
}

async function ensureLinkedIdentity(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<CreateJournal> {
  if (!record.target.instanceId) {
    throw recovery('Managed checkout has no reserved physical identity.');
  }
  const path = join(record.target.workspaceRoot, WORKSPACE_IDENTITY_RELATIVE_PATH);
  let registration: WorkspaceRegistration;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw recovery('Identity marker redirected.');
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      parsed.projectId !== record.projectId ||
      parsed.workspaceId !== record.target.workspaceId ||
      typeof parsed.instanceId !== 'string' ||
      parsed.instanceId !== record.target.instanceId
    ) {
      throw recovery('Identity marker belongs to a different worktree; manual repair required.');
    }
    registration = {
      kind: 'linked',
      managed: true,
      workspaceId: record.target.workspaceId,
      root: record.target.workspaceRoot,
      instanceId: parsed.instanceId,
    };
  } catch (error) {
    if (!isMissing(error)) {
      if (error instanceof SyntaxError) throw recovery('Identity marker is corrupt.');
      throw error;
    }
    registration = await provisionLinkedWorkspaceIdentity(
      engine.context,
      record.target.workspaceRoot,
      record.target.workspaceId,
      true,
      record.target.instanceId,
    );
  }
  await verifyLinkedWorkspaceIdentity(engine.context, registration);
  return record;
}

async function requireRegisteredTarget(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<void> {
  const registry = await engine.readRegistry();
  const inspected = await inspectRegisteredWorkspace(
    engine.context,
    registry,
    record.target.workspaceId,
  );
  if (inspected.status !== 'available' || inspected.root !== record.target.workspaceRoot) {
    throw recovery('Existing target checkout moved or became unavailable.');
  }
}

async function requireTargetIdentity(engine: SpecFlowEngine, record: CreateJournal): Promise<void> {
  if (record.target.kind === 'existing') {
    await requireRegisteredTarget(engine, record);
  } else {
    if (record.stage === 'completed') {
      // After successful create, legitimate agents may advance HEAD. Validate
      // membership and the original branch, but not the provisioning commit.
      // Physical checkout incarnation remains verified below.
      const worktrees = await openGitCapability(engine).listWorktrees();
      const matching = worktrees.filter(
        (item) => item.root.toLowerCase() === record.target.workspaceRoot.toLowerCase(),
      );
      if (
        matching.length !== 1 ||
        matching[0]!.prunable ||
        matching[0]!.branch !== 'refs/heads/' + record.target.branch
      ) {
        throw recovery('Completed Git worktree changed its path or branch.');
      }
    } else if ((await inspectPlannedGitEffect(engine, record)) !== 'present') {
      // Before terminal completion, exact base HEAD is still critical evidence
      // that this is the worktree produced by the planned Git mutation.
      throw recovery('Git worktree or branch changed since creation.');
    }
    const registration = registrationOf(record);
    await verifyWorkspaceRoot(engine.context, registration.root, registration);
  }
}

function registrationOf(record: CreateJournal): WorkspaceRegistration {
  if (!record.target.instanceId)
    throw recovery('Linked worktree has no durable identity evidence.');
  return {
    kind: 'linked',
    managed: true,
    workspaceId: record.target.workspaceId,
    root: record.target.workspaceRoot,
    instanceId: record.target.instanceId,
  };
}

function expectedScaffold(record: CreateJournal): SpecificationScaffold {
  const scaffold = createSpecificationScaffold({
    specId: record.specId,
    title: record.title,
    created: record.created,
    goal: record.goal,
  });
  if (
    scaffold.slug !== record.slug ||
    JSON.stringify(
      scaffold.files.map((f) => ({ relativePath: f.relativePath, sha256: f.sha256 })),
    ) !== JSON.stringify(record.files)
  ) {
    throw recovery('Scaffold evidence differs from immutable creation intent.');
  }
  return scaffold;
}

async function writeScaffoldWithEvidence(record: CreateJournal): Promise<void> {
  const scaffold = expectedScaffold(record);
  for (const file of scaffold.files) {
    const absolute = join(record.target.workspaceRoot, file.relativePath);
    const parent = dirname(absolute);
    // No symlink or path redirection may alter the target after validation.
    for (const directory of [
      join(record.target.workspaceRoot, 'specs'),
      join(record.target.workspaceRoot, 'specs/active'),
      parent,
    ]) {
      try {
        await mkdir(directory);
      } catch (error) {
        if (!isExists(error)) throw error;
      }
      const stat = await lstat(directory);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        (await realpath(directory)) !== directory
      ) {
        throw recovery('Specification directory has been redirected.');
      }
    }
    try {
      const handle = await open(absolute, 'wx', 0o600);
      try {
        await handle.writeFile(file.content, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (!isExists(error)) throw error;
    }
    await verifyFile(absolute, file.sha256);
  }
}

async function verifyScaffold(record: CreateJournal): Promise<void> {
  expectedScaffold(record);
  for (const file of record.files) {
    await verifyFile(join(record.target.workspaceRoot, file.relativePath), file.sha256);
  }
}

async function verifyFile(path: string, expectedHash: string): Promise<void> {
  let content: string;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw recovery('Scaffold file was redirected.');
    content = await readFile(path, 'utf8');
  } catch {
    throw recovery('Scaffold evidence is missing or unreadable.');
  }
  if (digest(content) !== expectedHash) {
    throw recovery('Scaffold was modified since the recorded creation intent.');
  }
}

async function commitBinding(engine: SpecFlowEngine, record: CreateJournal): Promise<void> {
  const registry = await engine.readRegistry();
  const existingBinding = registry.specBindings.find((item) => item.specId === record.specId);
  const existingWorkspace = registry.workspaces.find(
    (item) => item.workspaceId === record.target.workspaceId,
  );
  if (existingBinding && existingBinding.workspaceId !== record.target.workspaceId) {
    throw recovery('Specification is bound to another workspace.');
  }
  if (record.target.kind === 'new-worktree' && existingWorkspace) {
    const expected = registrationOf(record);
    if (
      existingWorkspace.root !== expected.root ||
      existingWorkspace.instanceId !== expected.instanceId ||
      existingWorkspace.kind !== 'linked'
    ) {
      throw recovery('Workspace registry identity differs from durable intent.');
    }
  }
  if (existingBinding && (record.target.kind === 'existing' || existingWorkspace)) return;

  await engine.updateRegistry((current) => {
    let updated = current;
    if (record.target.kind === 'new-worktree') {
      const workspace = current.workspaces.find(
        (item) => item.workspaceId === record.target.workspaceId,
      );
      if (!workspace) updated = addWorkspace(updated, registrationOf(record));
      else if (
        workspace.root !== record.target.workspaceRoot ||
        workspace.instanceId !== record.target.instanceId
      ) {
        throw recovery('Concurrent workspace registration disagrees with creation intent.');
      }
    }
    const binding = updated.specBindings.find((item) => item.specId === record.specId);
    if (!binding) updated = bindSpecToWorkspace(updated, record.specId, record.target.workspaceId);
    else if (binding.workspaceId !== record.target.workspaceId) {
      throw recovery('Concurrent Spec binding differs from creation intent.');
    }
    return updated;
  });
}

async function verifyResult(engine: SpecFlowEngine, record: CreateJournal): Promise<void> {
  await requireTargetIdentity(engine, record);
  if (record.stage === 'completed') {
    // Once creation is terminal, subsequent Spec Writer changes are legitimate.
    // The immutable scaffold hash only fences unfinished creation stages.
    const current = await readWorkspaceSpecification(record.target.workspaceRoot, record.specId);
    if (current.slug !== record.slug) throw recovery('Completed Spec identity changed.');
  } else {
    await verifyScaffold(record);
  }
  const registry = await engine.readRegistry();
  if (
    !registry.specBindings.some(
      (item) => item.specId === record.specId && item.workspaceId === record.target.workspaceId,
    )
  ) {
    throw recovery('Registry does not contain the expected canonical specification binding.');
  }
}

function resultOf(record: CreateJournal): CreatedSpecification {
  return {
    operationId: record.operationId,
    specId: record.specId,
    slug: record.slug,
    workspaceId: record.target.workspaceId,
    workspaceRoot: record.target.workspaceRoot,
    relativeManifestPath: record.files[0]!.relativePath,
  };
}

function branchesOverlap(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

function digest(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function recovery(message: string): CreateOperationError {
  return new CreateOperationError('CREATE_RECOVERY_REQUIRED', message);
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
