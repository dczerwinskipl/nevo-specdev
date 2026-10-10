import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from '@nevo/ui';
import { describe, expect, it } from 'vitest';
import { LocalizationProvider } from '../../i18n';
import { createSpecificationWorkspaceFixture } from '../../../test-support/specs/workspace/fixtures';
import { specificationWorkSections } from '../../features/specs/extensions/specificationWorkSections';
import { specificationAttentionItems } from '../../features/specs/extensions/specificationAttentionItems';
import { WorkView } from '../../features/specs/workspace/WorkView';
import {
  WorkspaceProvider,
  createFakeWorkspaceRuntime,
} from '../../features/specs/workspace/WorkspaceContext';
import { builtInUiModuleRegistry } from './builtInUiModules';
import { UiModulesProvider } from './UiModulesProvider';
import {
  contributeTo,
  defineUiExtensionPoint,
  type UiContribution,
  type UiModule,
} from './contracts';
import { createUiRegistry } from './registry';

interface TestPanelContribution extends UiContribution {
  readonly panelKey: string;
  readonly canClose: boolean;
}

const testPanels = defineUiExtensionPoint<TestPanelContribution>('tests.settings.panels');

const moduleWithSection = (id: string, slot: 'main' | 'related'): UiModule => ({
  id: `example.${id}`,
  contributions: [
    contributeTo(specificationWorkSections, {
      id: `example.${id}.section`,
      slot,
      Component: ({ specId }) => <section data-test-module={id}>Added for {specId}</section>,
    }),
  ],
});

describe('typed UI extension registry', () => {
  it('registers Tasks as a built-in feature, not as a WorkView import', () => {
    expect(builtInUiModuleRegistry.get(specificationWorkSections).map((x) => x.id)).toEqual([
      'specflow.git.repository',
      'specflow.sessions.resume',
      'specflow.tasks.task-groups',
      'specflow.documents.summary',
    ]);
  });

  it('registers feature-owned attention contributions without a tab-view registry', () => {
    expect(builtInUiModuleRegistry.get(specificationAttentionItems).map(({ id }) => id)).toEqual([
      'specflow.specifications.attention',
      'specflow.git.attention',
      'specflow.sessions.attention',
      'specflow.tasks.attention',
    ]);
  });

  it('inserts independent sections without altering the Work host', () => {
    const data = createSpecificationWorkspaceFixture('working', 'SPEC-21');
    const registry = createUiRegistry(
      [specificationWorkSections, specificationAttentionItems],
      [moduleWithSection('first', 'related'), moduleWithSection('second', 'related')],
    );
    const markup = renderToStaticMarkup(
      <UiModulesProvider modules={registry}>
        <LocalizationProvider>
          <AppShell navigation={<div>Navigation</div>}>
            <WorkspaceProvider runtime={createFakeWorkspaceRuntime()}>
              <WorkView data={data} />
            </WorkspaceProvider>
          </AppShell>
        </LocalizationProvider>
      </UiModulesProvider>,
    );
    const first = markup.indexOf('data-test-module="first"');
    const second = markup.indexOf('data-test-module="second"');
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
    expect(markup).toContain('Added for SPEC-21');
    expect(markup).not.toContain('feature/session-refresh');
  });

  it('registers one module across two differently typed extension points', () => {
    const registry = createUiRegistry(
      [specificationWorkSections, testPanels],
      [
        {
          id: 'example.combined',
          contributions: [
            contributeTo(specificationWorkSections, {
              id: 'example.combined.work',
              slot: 'main',
              Component: () => <section>Work</section>,
            }),
            contributeTo(testPanels, {
              id: 'example.combined.panel',
              panelKey: 'git',
              canClose: false,
            }),
          ],
        },
        {
          id: 'example.other',
          contributions: [
            contributeTo(testPanels, {
              id: 'example.other.panel',
              panelKey: 'task',
              canClose: true,
            }),
          ],
        },
      ],
    );

    expect(registry.get(specificationWorkSections)[0]?.slot).toBe('main');
    expect(registry.get(testPanels).map(({ panelKey }) => panelKey)).toEqual(['git', 'task']);
    expect(registry.get(testPanels)[0]?.canClose).toBe(false);
    expect(Object.isFrozen(registry.get(testPanels))).toBe(true);
  });

  it('rejects duplicate module IDs and contribution IDs globally', () => {
    const module = moduleWithSection('a', 'main');
    const duplicate = { id: 'example.b', contributions: module.contributions };
    const createDuplicates = (other: UiModule) =>
      createUiRegistry([specificationWorkSections], [module, other]);
    expect(() => createDuplicates(module)).toThrow('module id');
    expect(() => createDuplicates(duplicate)).toThrow('contribution id');
  });

  it('rejects unknown or conflicting extension points', () => {
    const conflict = defineUiExtensionPoint<TestPanelContribution>('specification.work.sections');
    const duplicatePoints = () => createUiRegistry([specificationWorkSections, conflict], []);
    expect(duplicatePoints).toThrow('extension point id');

    const unknownModule: UiModule = {
      id: 'unknown.module',
      contributions: [
        contributeTo(testPanels, {
          id: 'unknown.panel',
          panelKey: 'settings',
          canClose: true,
        }),
      ],
    };
    const registerUnknown = () => createUiRegistry([specificationWorkSections], [unknownModule]);
    expect(registerUnknown).toThrow('Unknown or conflicting');

    const conflictingModule: UiModule = {
      id: 'conflicting.module',
      contributions: [
        contributeTo(conflict, {
          id: 'conflicting.panel',
          panelKey: 'settings',
          canClose: true,
        }),
      ],
    };
    const registerConflict = () =>
      createUiRegistry([specificationWorkSections], [conflictingModule]);
    expect(registerConflict).toThrow('Unknown or conflicting');
    const registry = createUiRegistry([specificationWorkSections], []);
    expect(() => registry.get(conflict)).toThrow('Unknown or conflicting');
  });

  it('preserves registration order and leaves slot filtering to Specification', () => {
    const registry = createUiRegistry(
      [specificationWorkSections],
      [
        moduleWithSection('main-1', 'main'),
        moduleWithSection('related-1', 'related'),
        moduleWithSection('main-2', 'main'),
      ],
    );
    const contributions = registry.get(specificationWorkSections);
    expect(contributions.map((c) => c.id)).toEqual([
      'example.main-1.section',
      'example.related-1.section',
      'example.main-2.section',
    ]);
    expect(contributions.filter((c) => c.slot === 'main').map((c) => c.id)).toEqual([
      'example.main-1.section',
      'example.main-2.section',
    ]);
  });
});
