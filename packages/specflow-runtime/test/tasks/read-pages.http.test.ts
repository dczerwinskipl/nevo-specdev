import { describe, expect, it, vi } from 'vitest';
import { createRuntimeApp } from '../../src/server/app';
import { createDemoSpecsRepositories } from '../../src/features/specs';
import { createDemoTaskSources } from '../../src/features/tasks';
import { demoTaskHistory, demoTaskResources } from '../../src/features/tasks/demo/execution';
import { passwordConfig } from '../auth/support/config';
import type {
  TaskHistoryPage,
  TaskResourcePage,
  SpecificationTaskResponse,
} from '@nevo/specflow-contracts/tasks';
import type {
  TaskIdentity,
  ResourceFacts,
  ReferenceVisibility,
} from '../../src/features/tasks/reads/facts';

const config = () => {
  const config = passwordConfig();
  return { ...config, authentication: { ...config.authentication, mode: 'none' as const } };
};
describe('Task source paging and lease HTTP boundary', () => {
  it('keeps frozen workflow, approvals, associations and recovery unchanged across GET reads', async () => {
    const demo = createDemoSpecsRepositories(),
      sources = createDemoTaskSources(demo.catalogue);
    const definition = (await sources.definitions!.resolve('admission', 'TASK-03'))!;
    const execution = (await sources.execution!.inspect(definition.identity, definition.version))!;
    execution.recovery = {
      id: 'recovery',
      state: 'required',
      summary: 'Recovery requires an explicit command',
      link: { state: 'unavailable', reason: 'not_implemented' },
    };
    const freeze = (value: unknown): void => {
      if (value && typeof value === 'object') {
        for (const item of Object.values(value)) freeze(item);
        Object.freeze(value);
      }
    };
    const before = JSON.stringify({ definition, execution });
    freeze(definition);
    freeze(execution);
    const { createDemoDocumentSource } = await import('../../src/features/documents');
    const app = await createRuntimeApp(config(), {
      tasks: {
        ...sources,
        definitions: { resolve: () => Promise.resolve(definition) },
        execution: { inspect: () => Promise.resolve(execution) },
      },
      documents: { source: createDemoDocumentSource(demo.catalogue) },
    });
    try {
      const response = await app.inject('/api/specs/admission/tasks/TASK-03');
      expect(response.statusCode).toBe(200);
      const snapshot = response.json<SpecificationTaskResponse>().snapshot!;
      expect(
        snapshot.sections.recovery.state === 'available' && snapshot.sections.recovery.data?.state,
      ).toBe('required');
      for (const kind of ['history', 'resources'] as const) {
        const section = snapshot.sections[kind];
        const ref =
          section.state === 'available'
            ? kind === 'history' && 'token' in section.data
              ? section.data
              : 'page' in section.data
                ? section.data.page
                : null
            : null;
        if (!ref) throw Error('Expected page');
        expect(
          (
            await app.inject(
              `/api/specs/admission/tasks/TASK-03/${kind}?token=${encodeURIComponent(ref.token)}`,
            )
          ).statusCode,
        ).toBe(200);
      }
      expect(
        (await app.inject('/api/specs/admission/documents/spec?revision=demo-document-1'))
          .statusCode,
      ).toBe(200);
      expect(JSON.stringify({ definition, execution })).toBe(before);
    } finally {
      await app.close();
    }
  });
  it('reads Task and document without Workspace and rejects a mismatched execution basis', async () => {
    const demo = createDemoSpecsRepositories(),
      sources = createDemoTaskSources(demo.catalogue);
    const definition = (await sources.definitions!.resolve('admission', 'TASK-03'))!;
    const execution = (await sources.execution!.inspect(definition.identity, definition.version))!;
    execution.definitionVersion = 'other-definition';
    const { createDemoDocumentSource } = await import('../../src/features/documents');
    const app = await createRuntimeApp(config(), {
      tasks: { ...sources, execution: { inspect: () => Promise.resolve(execution) } },
      documents: { source: createDemoDocumentSource(demo.catalogue) },
    });
    try {
      const response = await app.inject('/api/specs/admission/tasks/TASK-03');
      expect(response.statusCode).toBe(200);
      const sections = response.json<SpecificationTaskResponse>().snapshot!.sections;
      expect(sections.work.state).toBe('unavailable');
      expect(sections.history.state).toBe('unavailable');
      expect(
        (await app.inject('/api/specs/admission/documents/spec?revision=demo-document-1'))
          .statusCode,
      ).toBe(200);
      expect((await app.inject('/api/specs/admission/workspace')).statusCode).toBe(503);
    } finally {
      await app.close();
    }
  });
  it('reads one bounded history interval, preserves pass material and rejects changed basis', async () => {
    const sources = createDemoTaskSources(createDemoSpecsRepositories().catalogue);
    let version = 'history-1';
    const base = demoTaskHistory('admission', 'TASK-03')[0]!;
    const entries = Array.from({ length: 7 }, (_, i) => ({
      ...base,
      id: 'attempt-' + i,
      key: { ...base.key, attempt: i + 1 },
      result: 'pass',
      feedback: null,
      resources: [demoTaskResources('admission', 'TASK-03')[i]!],
    }));
    const read = vi.fn(
      (identity: TaskIdentity, _handle: string, continuation: string | null, limit: number) => {
        expect(limit).toBeLessThanOrEqual(50);
        const offset = continuation === null ? 0 : Number(continuation),
          end = Math.min(offset + limit, entries.length);
        return Promise.resolve({
          identity,
          version,
          items: entries.slice(offset, end),
          next: end < entries.length ? String(end) : null,
          coverage: 'complete' as const,
        });
      },
    );
    const app = await createRuntimeApp(config(), {
      tasks: {
        ...sources,
        history: {
          open: (identity) =>
            Promise.resolve({ identity, version, handle: 'source-handle', coverage: 'complete' }),
          read,
        },
      },
    });
    try {
      const detail = (
        await app.inject('/api/specs/admission/tasks/TASK-03')
      ).json<SpecificationTaskResponse>();
      expect(read).not.toHaveBeenCalled();
      const history = detail.snapshot!.sections.history;
      if (history.state !== 'available') throw Error('Expected history');
      const url =
        '/api/specs/admission/tasks/TASK-03/history?token=' +
        encodeURIComponent(history.data.token);
      const first = (await app.inject(url + '&limit=2')).json<TaskHistoryPage>();
      expect(read).toHaveBeenCalledTimes(1);
      expect(first.items.map((item) => item.id)).toEqual(['attempt-0', 'attempt-1']);
      expect(first.items[0]!.resources).toHaveLength(1);
      expect(first.items[0]!.result).toBe('pass');
      expect(first.items[0]!.feedback).toBeNull();
      const continuation = url + '&cursor=' + encodeURIComponent(first.nextCursor!);
      const next = (await app.inject(continuation)).json<TaskHistoryPage>();
      expect(next.items.map((item) => item.id)).toEqual(['attempt-2', 'attempt-3']);
      expect((await app.inject(continuation + '&limit=3')).statusCode).toBe(409);
      expect((await app.inject(continuation)).json()).toEqual(next);
      version = 'history-2';
      expect((await app.inject(continuation)).statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });
  it('continues after the actual authorized recommendations, without duplication or lost items', async () => {
    const sources = createDemoTaskSources(createDemoSpecsRepositories().catalogue);
    const candidates = demoTaskResources('admission', 'TASK-03').slice(0, 8);
    candidates[0]!.link = { state: 'forbidden' };
    candidates[1]!.link = {
      state: 'available',
      target: { kind: 'session', sessionId: 'unresolved-session' },
    };
    const select = async (visible: ReferenceVisibility) => {
      const result: ResourceFacts[] = [];
      for (const item of candidates) if (await visible(item.link)) result.push(item);
      return result;
    };
    const read = vi.fn(
      async (
        identity: TaskIdentity,
        _handle: string,
        continuation: string | null,
        limit: number,
        visible: ReferenceVisibility,
      ) => {
        const items = await select(visible),
          offset = continuation === null ? 0 : Number(continuation),
          end = Math.min(offset + limit, items.length);
        return {
          identity,
          version: '1',
          items: items.slice(offset, end),
          next: end < items.length ? String(end) : null,
          coverage: 'complete' as const,
        };
      },
    );
    const app = await createRuntimeApp(config(), {
      tasks: {
        ...sources,
        resources: {
          open: async (identity, visible) => ({
            identity,
            version: '1',
            handle: 'resources',
            visibleTotal: (await select(visible)).length,
            coverage: 'complete',
          }),
          read,
        },
      },
    });
    try {
      const detail = (
        await app.inject('/api/specs/admission/tasks/TASK-03')
      ).json<SpecificationTaskResponse>();
      const section = detail.snapshot!.sections.resources;
      if (section.state !== 'available') throw Error('Expected resources');
      expect(section.data.visibleTotal).toBe(6);
      expect(section.data.recommended.map((item) => item.id)).toEqual([
        'document-3',
        'document-4',
        'document-5',
      ]);
      expect(read.mock.calls[0]![3]).toBe(3);
      const page = (
        await app.inject(
          '/api/specs/admission/tasks/TASK-03/resources?token=' +
            encodeURIComponent(section.data.page!.token),
        )
      ).json<TaskResourcePage>();
      expect(read.mock.calls[1]![2]).toBe('3');
      expect(page.items.map((item) => item.id)).toEqual(['document-6', 'document-7', 'document-8']);
      expect(
        new Set([...section.data.recommended, ...page.items].map((item) => item.id)).size,
      ).toBe(6);
    } finally {
      await app.close();
    }
  });
  it('retains continuation for an empty bounded candidate page and expires leases honestly', async () => {
    const sources = createDemoTaskSources(createDemoSpecsRepositories().catalogue);
    let now = 0;
    const app = await createRuntimeApp(config(), {
      tasks: {
        ...sources,
        leaseOptions: { now: () => now, ttlMs: 10 },
        history: {
          open: (identity) =>
            Promise.resolve({ identity, handle: 'h', version: '1', coverage: 'partial' }),
          read: (identity, _handle, continuation) =>
            Promise.resolve({
              identity,
              version: '1',
              items: continuation === null ? [] : demoTaskHistory('admission', 'TASK-03'),
              next: continuation === null ? 'continue' : null,
              coverage: 'partial',
            }),
        },
      },
    });
    try {
      const detail = (
        await app.inject('/api/specs/admission/tasks/TASK-03')
      ).json<SpecificationTaskResponse>();
      const section = detail.snapshot!.sections.history;
      if (section.state !== 'available') throw Error('Expected history');
      const url =
        '/api/specs/admission/tasks/TASK-03/history?token=' +
        encodeURIComponent(section.data.token);
      const page = (await app.inject(url)).json<TaskHistoryPage>();
      expect(page.items).toEqual([]);
      expect(page.nextCursor).not.toBeNull();
      expect(page.coverage).toBe('partial');
      expect(
        (
          await app.inject(url + '&cursor=' + encodeURIComponent(page.nextCursor!))
        ).json<TaskHistoryPage>().items,
      ).toHaveLength(1);
      now = 10;
      expect((await app.inject(url)).statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });
});
