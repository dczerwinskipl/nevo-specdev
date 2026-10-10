import type {
  ActivityEvent,
  AttentionItem,
  DocumentItem,
  RepoContext,
  SessionSummary,
  SpecificationWorkspaceData,
  TaskGroup,
} from '../../../src/features/specs/workspace/model';

export type SpecificationScenario =
  | 'working'
  | 'empty'
  | 'preparing'
  | 'no-git'
  | 'git-conflict'
  | 'git-unknown'
  | 'git-stale'
  | 'extensions';

export const defaultTaskGroups: readonly TaskGroup[] = [
  {
    id: 'implementation',
    name: 'Implementacja',
    tasks: [
      {
        id: 'TASK-03',
        title: 'Obsługa odświeżania uprawnień w długotrwałej sesji użytkownika',
        status: 'Weryfikacja',
        lifecycle: 'blocked',
        attention: true,
        additionalInfo: 'Wymaga decyzji',
        group: 'implementation',
        purpose:
          'Preserve user context after session refresh and handle permission changes explicitly, without losing initiated operations.',
        acceptanceCriteria: [
          'Form content remains accessible.',
          'Permission change does not automatically approve new operation.',
          'Concurrent requests respect shared refresh result.',
        ],
        workflow:
          'Sample task projection: Weryfikacja. Available actions and requirements originate from backend.',
        evidence: [{ label: 'Review summary →' }, { label: 'Verification result →' }],
        relatedSessions: [{ id: 'review', title: 'Security scenarios review →' }],
        history: ['Scope preparation → execution → review; sample events.'],
      },
      {
        id: 'TASK-04',
        title: 'Komunikat o wygasającym dostępie',
        status: 'Implementacja',
        lifecycle: 'in_progress',
        additionalInfo: 'Agent pracuje',
        group: 'implementation',
        purpose: 'Wyświetlanie użytkownikowi powiadomienia o zbliżającym się wygaśnięciu sesji.',
        acceptanceCriteria: ['Ostrzeżenie pojawia się na 60 sekund przed wygaśnięciem.'],
      },
      {
        id: 'TASK-05',
        title: 'Przywrócenie kontekstu po ponownym zalogowaniu',
        status: 'Gotowe',
        lifecycle: 'pending',
        additionalInfo: 'Czeka na TASK-03',
        group: 'implementation',
        purpose:
          'Automatyczne przywrócenie otwartych formularzy i widoków po ponownym uwierzytelnieniu.',
      },
    ],
  },
  {
    id: 'verification',
    name: 'Weryfikacja i domknięcie',
    tasks: [
      {
        id: 'TASK-06',
        title: 'Scenariusze integracyjne dla równoległych żądań odświeżających token dostępu',
        status: 'Przygotowanie',
        lifecycle: 'pending',
        additionalInfo: 'Draft',
        group: 'verification',
      },
      {
        id: 'TASK-07',
        title: 'Przegląd dokumentacji i uzgodnienie warunków wdrożenia',
        status: 'Review',
        lifecycle: 'pending',
        additionalInfo: 'Gotowe do pracy',
        group: 'verification',
      },
    ],
  },
  {
    id: 'done',
    name: 'Ukończone',
    tasks: [
      {
        id: 'TASK-01',
        title: 'Model uprawnień',
        status: 'Ukończone',
        lifecycle: 'completed',
        additionalInfo: 'Model przyjęty',
        group: 'done',
      },
      {
        id: 'TASK-02',
        title: 'Kontrakt odświeżania sesji',
        status: 'Ukończone',
        lifecycle: 'completed',
        additionalInfo: 'Kontrakt API',
        group: 'done',
      },
    ],
  },
];

export const defaultDocuments: readonly DocumentItem[] = [
  {
    id: 'spec',
    title: 'Specyfikacja',
    kind: 'Główny opis zmiany',
    summary: 'Główny dokument specyfikacji opisujący zachowanie i kryteria.',
    sections: [
      {
        heading: 'Cel i zakres',
        content:
          'Utrzymać kontekst pracy po odświeżeniu sesji, bez ponownego logowania i utraty rozpoczętych operacji.',
      },
      {
        heading: 'Kluczowe założenia',
        content: 'Brak utraty wprowadzonych danych formularzy w przypadku utraty połączenia.',
      },
      {
        heading: 'Kryteria akceptacji',
        items: [
          'Sesja odnawia się w tle bez przeładowywania widoku.',
          'Wszystkie aktywne drafty są zachowywane w pamięci podręcznej.',
          'W przypadku unieważnienia uprawnień użytkownik otrzymuje czytelny komunikat.',
        ],
      },
      {
        heading: 'Otwarte decyzje',
        content:
          'Rozstrzygnięcie zachowania równoległych żądań po utracie uprawnień administracyjnych.',
      },
    ],
  },
  {
    id: 'auth',
    title: 'Obszar: uwierzytelnianie',
    kind: 'Kontekst obszaru',
    summary: 'Architektura i wymagania bezpieczeństwa modułu sesji.',
  },
  {
    id: 'api',
    title: 'Obszar: API i kompatybilność klientów',
    kind: 'Kontekst obszaru',
    summary: 'Kontrakty żądań i nagłówków uwierzytelniających.',
  },
  {
    id: 'architecture',
    title: 'Draft architektury odświeżania sesji i rozstrzygania równoległych żądań',
    kind: 'Propozycja architektury',
    summary: 'Szczegółowy model synchronizacji wątków klienta.',
  },
  {
    id: 'requirements',
    title: 'Kryteria akceptacji i scenariusze brzegowe',
    kind: 'Wymagania',
    summary: 'Zestawienie testów i warunków brzegowych.',
  },
];

export const defaultSessions: readonly SessionSummary[] = [
  {
    id: 'recent',
    title: 'Implementacja odświeżania sesji',
    taskCount: '3 taski',
    age: '5 min temu',
    activity: {
      label: 'Agent pracuje',
      tone: 'info',
      icon: 'loader',
      animate: true,
    },
    meta: 'Agent pracuje · 3 taski · 5 min temu',
  },
  {
    id: 'review',
    title: 'Przegląd scenariuszy bezpieczeństwa',
    taskCount: 'review',
    age: '10 min temu',
    activity: {
      label: 'Czeka na Twoją odpowiedź',
      tone: 'attention',
      icon: 'triangle-alert',
    },
    meta: 'Czeka na Twoją odpowiedź · review · 10 min temu',
  },
  {
    id: 'scope',
    title: 'Dopracowanie zakresu i dokumentów',
    taskCount: 'rozmowa o specyfikacji',
    age: '1 godz. temu',
    activity: {
      label: 'Zakończona',
      tone: 'neutral',
      icon: 'circle-check',
    },
    meta: 'Zakończona · rozmowa o specyfikacji · 1 godz. temu',
  },
  {
    id: 'api-compat',
    title: 'Rozszerzenie scenariuszy API o zgodność ze starszym klientem',
    taskCount: 'rozmowa o specyfikacji',
    age: '2 godz. temu',
    activity: {
      label: 'Zakończona',
      tone: 'neutral',
      icon: 'circle-check',
    },
    meta: 'Zakończona · rozmowa o specyfikacji · 2 godz. temu',
  },
];

export const defaultActivityEvents: readonly ActivityEvent[] = [
  {
    id: 'act-1',
    time: '5 min temu',
    title: 'Rozpoczęto wykonanie TASK-04',
    description: 'Implementer · bieżąca sesja',
    kind: 'task',
    targetId: 'TASK-04',
  },
  {
    id: 'act-2',
    time: '10 min temu',
    title: 'Agent poprosił o doprecyzowanie zakresu',
    description: 'Sesja review czeka na odpowiedź',
    kind: 'session',
    targetId: 'review',
  },
  {
    id: 'act-3',
    time: '20 min temu',
    title: 'Zakończono review TASK-03',
    description: 'Pozostała decyzja właściciela',
    kind: 'task',
    targetId: 'TASK-03',
  },
  {
    id: 'act-4',
    time: '35 min temu',
    title: 'Dodano TASK-05 do zakresu',
    description: 'Rozmowa o rozszerzeniu specyfikacji',
    kind: 'task',
    targetId: 'TASK-05',
  },
  {
    id: 'act-5',
    time: '1 godz. temu',
    title: 'Zaktualizowano draft architektury',
    description: 'Dokumenty tej specyfikacji',
    kind: 'doc',
    targetId: 'architecture',
  },
];

export function createSpecificationWorkspaceFixture(
  scenario: SpecificationScenario = 'working',
  specId = 'UI-1234',
): SpecificationWorkspaceData {
  const isPreparing = scenario === 'preparing';
  const isEmpty = scenario === 'empty';
  const hasGit = scenario !== 'no-git' && !isEmpty;

  const attentionItems: AttentionItem[] = [];

  if (!isEmpty && !isPreparing) {
    attentionItems.push({
      id: 'att-task',
      kind: 'task',
      title: 'TASK-03 · Rozstrzygnij zachowanie po cofnięciu uprawnień',
      reason: 'Review wymaga decyzji właściciela',
      actionLabel: 'Podgląd taska',
      targetId: 'TASK-03',
    });
    attentionItems.push({
      id: 'att-session',
      kind: 'session',
      title: 'Sesja „Przegląd scenariuszy bezpieczeństwa”',
      reason: 'Agent czeka na odpowiedź dotyczącą zakresu',
      actionLabel: 'Otwórz sesję',
      targetId: 'review',
    });

    if (scenario === 'git-conflict') {
      attentionItems.push({
        id: 'att-git',
        kind: 'git',
        title: 'Worktree ma nierozwiązane konflikty',
        reason: '2 pliki · potrzebna reakcja przed dalszą integracją',
        actionLabel: 'Sprawdź konflikty',
      });
    }
  }

  let repoContext: RepoContext | undefined;
  if (hasGit) {
    repoContext = {
      repositoryName: 'crm',
      branch: 'feature/session-refresh',
      baseBranch: 'main',
      uncommittedCount: scenario === 'git-unknown' ? undefined : 4,
      syncStatus:
        scenario === 'git-unknown'
          ? 'Brak danych'
          : scenario === 'git-conflict'
            ? '1 commit przed upstream · 2 za'
            : '1 commit przed upstream',
      conflictStatus:
        scenario === 'git-unknown'
          ? 'nieznane'
          : scenario === 'git-conflict'
            ? '2 pliki z nierozwiązanymi konfliktami'
            : 'Brak konfliktów lokalnych',
      linkedPr: {
        number: 128,
        title: 'Odświeżanie sesji i zachowanie kontekstu',
      },
      otherPrs: [
        {
          number: 119,
          title: 'Model uprawnień',
          status: 'scalony',
        },
      ],
      isDirty: scenario !== 'git-unknown',
      freshness:
        scenario === 'git-unknown' ? 'unknown' : scenario === 'git-stale' ? 'stale' : 'fresh',
    };
  }

  const taskGroups: readonly TaskGroup[] = isEmpty
    ? []
    : isPreparing
      ? [
          {
            id: 'preparation',
            name: 'Przygotowanie do review',
            tasks: defaultTaskGroups.flatMap((g) => g.tasks),
          },
        ]
      : defaultTaskGroups;

  const activityEvents: readonly ActivityEvent[] = isEmpty
    ? [
        {
          id: 'act-init',
          time: 'Teraz',
          title: 'Utworzono specyfikację',
          description: 'Scaffold gotowy do uzupełnienia',
          kind: 'info',
        },
      ]
    : defaultActivityEvents;

  const changes = hasGit
    ? {
        base: [
          'src/auth/refreshSession.ts',
          'src/auth/refreshSession.integration.test.ts',
          'src/ui/SessionExpiredNotice.tsx',
          'docs/areas/authentication.md',
        ],
        uncommitted: ['src/auth/refreshSession.ts', 'src/ui/SessionExpiredNotice.tsx'],
        mr: ['src/auth/refreshSession.ts', 'src/auth/refreshSession.integration.test.ts'],
      }
    : undefined;

  return {
    id: specId,
    title: 'Odświeżanie sesji i zachowanie kontekstu użytkownika',
    intro:
      'Utrzymać kontekst pracy po odświeżeniu sesji, bez ponownego logowania i utraty rozpoczętych operacji.',
    isEmpty,
    isPreparing,
    hasGit,
    attentionItems: attentionItems.filter((item) => item.kind === 'specification'),
    featureAttention: {
      tasks: {
        state: 'available',
        items: attentionItems.filter((item) => item.kind === 'task'),
      },
      sessions: {
        state: 'available',
        items: attentionItems.filter((item) => item.kind === 'session'),
      },
      git: hasGit
        ? { state: 'available', items: attentionItems.filter((item) => item.kind === 'git') }
        : { state: 'unavailable', reason: 'not_implemented' },
    },
    repoContext,
    resumeSession: isEmpty ? undefined : defaultSessions[0],
    taskGroups,
    documents: isEmpty ? [] : defaultDocuments,
    sessions: isEmpty ? [] : defaultSessions,
    activityEvents,
    completedTasksCount: isEmpty ? 0 : 2,
    totalTasksCount: isEmpty ? 0 : 7,
    executionReadiness: {
      canExecute: false,
      blockers: ['TASK-03 · Review wymaga decyzji właściciela'],
      warnings: ['TASK-05 wymaga potwierdzenia architektury'],
    },
    changes,
  };
}
