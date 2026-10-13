import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppShell } from '@nevo/ui';
import { appI18n, LocalizationProvider } from '../../../i18n';
import { SpecificationWorkspace } from './SpecificationWorkspace';
import { UiModulesProvider } from '../../../app/ui-modules/UiModulesProvider';
import { builtInUiModuleRegistry } from '../../../app/ui-modules/builtInUiModules';

import { createSpecificationWorkspaceFixture } from '../../../../test-support/specs/workspace/fixtures';

function renderWorkspaceMarkup(
  props: Partial<React.ComponentProps<typeof SpecificationWorkspace>> = {},
) {
  const data = props.data ?? createSpecificationWorkspaceFixture('working', 'UI-1234');
  return renderToStaticMarkup(
    <UiModulesProvider modules={builtInUiModuleRegistry}>
      <LocalizationProvider>
        <AppShell navigation={<div>Nav</div>}>
          <SpecificationWorkspace specId="UI-1234" data={data} {...props} />
        </AppShell>
      </LocalizationProvider>
    </UiModulesProvider>,
  );
}

describe('SpecificationWorkspace', () => {
  beforeEach(async () => {
    await appI18n.changeLanguage('pl');
  });

  it('renders working scenario with title, attention, tasks, and activity history', () => {
    const markup = renderWorkspaceMarkup();

    // Body title and identity
    expect(markup).toContain('Odświeżanie sesji i zachowanie kontekstu użytkownika');
    expect(markup).toContain('ID specyfikacji: UI-1234');

    // Attention section
    expect(markup).toContain('Wymaga Twojej uwagi');
    expect(markup).toContain('TASK-03 · Rozstrzygnij zachowanie po cofnięciu uprawnień');

    // Resume session
    expect(markup).toContain('Implementacja odświeżania sesji');

    // Task groups
    expect(markup).toContain('Implementacja');
    expect(markup).toContain('Weryfikacja i domknięcie');
    expect(markup).toContain('Ukończone');

    // Primary content is rendered in SSR
    expect(markup).toContain('Odświeżanie sesji i zachowanie kontekstu użytkownika');
    expect(markup).toContain('ID specyfikacji: UI-1234');
  });

  it('renders repository context when git is enabled', () => {
    const markup = renderWorkspaceMarkup();

    expect(markup).toContain('Repozytorium');
    expect(markup).toContain('feature/session-refresh');
    expect(markup).toContain('PR #128');
    expect(markup).toContain('Przegląd PR');
    expect(markup).toContain('Wszystkie zmiany');
  });

  it('renders correct heading outline and specification title-lg hierarchy', () => {
    const markup = renderWorkspaceMarkup();

    // h1 page identity
    expect(markup).toContain('<h1');
    expect(markup).toContain('Specyfikacja');

    // h2 concrete specification title with text-title-lg
    expect(markup).toContain(
      '<h2 class="font-sans text-title-lg font-semibold text-content-primary [overflow-wrap:anywhere]">Odświeżanie sesji i zachowanie kontekstu użytkownika</h2>',
    );

    // h3 major workspace sections
    expect(markup).toContain('<h3');
    expect(markup).toContain('text-section-label');
    expect(markup).toContain('Repozytorium');
    expect(markup).toContain('Taski');

    // h4 for task groups
    expect(markup).toContain('<h4');
    expect(markup).toContain('Implementacja');

    // Task items use span, not forced to h5
    expect(markup).not.toContain('<h5');
  });

  it('omits repository context and extra views in no-git scenario', () => {
    const markup = renderWorkspaceMarkup({
      data: createSpecificationWorkspaceFixture('no-git', 'UI-1234'),
    });

    expect(markup).not.toContain('feature/session-refresh');
    expect(markup).not.toContain('PR #128');
  });

  it('renders empty scenario with preparation banner and no task list', () => {
    const markup = renderWorkspaceMarkup({
      data: createSpecificationWorkspaceFixture('empty', 'UI-1234'),
    });

    expect(markup).toContain('Przygotuj specyfikację do realizacji');
    expect(markup).toContain('Rozpocznij rozmowę');
    expect(markup).not.toContain('2 / 7 ukończone');
  });

  it('renders preparing scenario with notice and tasks in preparation', () => {
    const markup = renderWorkspaceMarkup({
      data: createSpecificationWorkspaceFixture('preparing', 'UI-1234'),
    });

    expect(markup).toContain('Taski są jeszcze w przygotowaniu');
    expect(markup).toContain('Przygotowanie do review');
    expect(markup).toContain('w przygotowaniu');
  });

  it('sorts feature-owned Attention by priority without deriving it from the kind', () => {
    const source = createSpecificationWorkspaceFixture('working', 'UI-1234');
    const task = {
      id: 't',
      kind: 'task' as const,
      title: 'Normal task attention',
      reason: 'Review task',
      targetId: 'T1',
      actionLabel: '',
      priority: 'normal' as const,
    };
    const session = {
      id: 's',
      kind: 'session' as const,
      title: 'High priority session attention',
      reason: 'Needs a response',
      targetId: 'S1',
      actionLabel: '',
      priority: 'high' as const,
    };
    const git = {
      id: 'g',
      kind: 'git' as const,
      title: 'Critical Git attention',
      reason: 'Resolve conflicts',
      actionLabel: '',
      priority: 'critical' as const,
    };
    const specification = {
      id: 'c',
      kind: 'specification' as const,
      title: 'Normal specification attention',
      reason: 'Needs preparation',
      actionLabel: '',
      priority: 'normal' as const,
    };
    const markup = renderWorkspaceMarkup({
      data: {
        ...source,
        attentionItems: [specification],
        featureAttention: {
          tasks: { state: 'available', items: [task] },
          sessions: { state: 'available', items: [session] },
          git: { state: 'available', items: [git] },
        },
      },
    });
    const names = [
      'Critical Git attention',
      'High priority session attention',
      'Normal specification attention',
    ];
    const positions = names.map((title) => markup.indexOf(title));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(markup).not.toContain('Normal task attention');
    expect(markup).toContain('aria-expanded="false"');
  });

  it('renders git-conflict scenario with conflict attention item', () => {
    const markup = renderWorkspaceMarkup({
      data: createSpecificationWorkspaceFixture('git-conflict', 'UI-1234'),
    });

    expect(markup).toContain('Worktree ma nierozwiązane konflikty');
    expect(markup).toContain('Sprawdź konflikty');
  });

  it('does not render the legacy list-backed Full Task view inside Specification Work', () => {
    const markup = renderWorkspaceMarkup();

    expect(markup).not.toContain('Task / TASK-03');
    expect(markup).not.toContain('Kryteria akceptacji');
  });

  it('renders Specification Overview independently of the previous tab-view selection model', () => {
    const markup = renderWorkspaceMarkup();
    expect(markup).toContain('Wymaga Twojej uwagi');
    expect(markup).toContain('Taski');
  });

  it('renders Specification header eyebrow with back link and specification identity', () => {
    const markup = renderWorkspaceMarkup();

    expect(markup).toContain('data-spec-back-label');
    expect(markup).toContain('data-spec-identity');
    expect(markup).toContain('ID specyfikacji: UI-1234');
  });

  it('renders honest capabilities: disabled conversation action when onNewConversation is not provided', () => {
    const markup = renderWorkspaceMarkup({
      onNewConversation: undefined,
    });

    // In ResumeSessionSection, button should be disabled and have title "Niezaimplementowane"
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Niezaimplementowane');
  });
});
