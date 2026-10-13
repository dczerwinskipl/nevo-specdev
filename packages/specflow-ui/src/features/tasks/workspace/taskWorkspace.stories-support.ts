import type { TaskWorkspaceData, WorkspaceHandoff, WorkspaceMaterial } from './taskWorkspaceModel';
import imageUrl from './fixtures/session-return.jpg?url';
import archiveUrl from './fixtures/review-evidence-demo.zip?url';

export type WorkspaceScenario =
  | 'draft'
  | 'ready'
  | 'implementation'
  | 'implementation-waiting'
  | 'review'
  | 'review-waiting'
  | 'human'
  | 'completed';
const names: Record<string, string> = {
  implementation: 'Implementacja',
  review: 'Review',
  human: 'Weryfikacja człowieka',
  completed: 'Zakończone',
};
const instructions: Record<string, string> = {
  implementation: 'Perform the approved implementation work for the task within declared scope.',
  review:
    'Perform an independent quality review of the implementation against task acceptance criteria, applying corrective fixes if gaps are found.',
  human:
    'Explicit owner/user acceptance sign-off after automated implementation and independent review have completed.',
};
export function createWorkspaceFixture(
  scenario: WorkspaceScenario = 'human',
  stress = false,
): TaskWorkspaceData {
  const introduction =
    'Po otwarciu dokumentu użytkownik wraca do tego samego zadania, z zachowanym miejscem, rozwinięciem treści i fokusem.';
  const descriptions = [
    'Zaimplementowano zachowanie miejsca przy powrocie.',
    'Fokus wraca na początek zadania. Przywróć go na linku otwartego materiału.',
    'Poprawiono przywracanie fokusu i dodano test powrotu.',
    'Po ponownym zalogowaniu opis zadania się zwija. Zachowaj rozwinięcie i pozycję przewijania.',
    'Zachowano rozwinięcie i scroll po wygaśnięciu sesji.',
    'Review zakończony pozytywnie. Do odbioru pozostaje zachowanie po ponownym logowaniu i w dwóch kartach.',
    'Potwierdzono zachowanie sesji, powrotu i niezależność dwóch kart.',
  ];
  const eventDefinitions = [
    ['implementation', 'review', 1, '09:10'],
    ['review', 'implementation', 1, '09:35'],
    ['implementation', 'review', 2, '10:05'],
    ['review', 'implementation', 2, '10:30'],
    ['implementation', 'review', 3, '11:00'],
    ['review', 'human', 3, '11:25'],
    ['human', 'completed', 1, '11:50'],
  ] as const;
  const events: WorkspaceHandoff[] = eventDefinitions.map(([from, to, attempt, time], index) => {
    const id = `${from}-${attempt}`;
    const source = `${names[from]} · próba ${attempt}`;
    const materials: WorkspaceMaterial[] =
      from === 'implementation'
        ? []
        : [
            {
              id: `${id}:document`,
              name: `${from === 'human' ? 'acceptance' : 'review'}-${attempt}.md`,
              source,
              reference: stress
                ? `${'docs/history/very-long-path/'.repeat(12)}${id}.md`
                : undefined,
              content: {
                state: 'available',
                kind: 'markdown',
                markdown: `## Rozstrzygnięcie\n\n${descriptions[index]}\n\n## Sprawdzenia\n\n- Powrót z dokumentu do zadania.\n- Zachowanie fokusu i rozwiniętej treści.\n- Ponowne logowanie i niezależna praca w dwóch kartach.\n\nRaport dotyczy **${source}**, a nie najnowszej próby innego wykonania.\n\n${stress ? 'Szczegółowe sprawdzenie nawigacji i zachowania użytkownika.\n\n'.repeat(35) : ''}`,
              },
            },
            {
              id: `${id}:image`,
              name: 'session-return.jpg',
              source,
              content: {
                state: 'available',
                kind: 'image',
                src: imageUrl,
                alt: 'Ekran zadania po powrocie z dokumentu — przykładowy dowód',
              },
            },
            {
              id: `${id}:archive`,
              name: 'review-evidence-demo.zip',
              source,
              content: { state: 'available', kind: 'archive', href: archiveUrl },
            },
          ];
    return {
      id,
      from: names[from]!,
      to: names[to]!,
      attempt,
      time,
      feedback:
        descriptions[index] +
        (stress
          ? ' Zachowaj opis, wybór użytkownika i pozycję czytanego materiału.'.repeat(4)
          : ''),
      result:
        from === 'implementation'
          ? undefined
          : {
              label:
                to === 'implementation'
                  ? 'Wymagane poprawki'
                  : to === 'completed'
                    ? 'Zatwierdzone'
                    : 'Wynik pozytywny',
              tone:
                to === 'implementation' ? 'attention' : to === 'completed' ? 'success' : 'neutral',
            },
      materials,
    };
  });
  const count =
    scenario === 'draft' || scenario === 'ready'
      ? 0
      : scenario.startsWith('implementation')
        ? 4
        : scenario.startsWith('review')
          ? 5
          : scenario === 'human'
            ? 6
            : 7;
  const history = events.slice(0, count).reverse();
  const active = scenario === 'implementation' || scenario === 'review';
  const waiting = scenario.endsWith('waiting');
  const step = scenario.startsWith('review')
    ? 'review'
    : scenario === 'human' || scenario === 'completed'
      ? 'human'
      : 'implementation';
  const sessions: TaskWorkspaceData['sessions'][number][] = history
    .filter((event) => event.from !== names.human)
    .map((event) => ({
      id: `session-${event.id}`,
      title: `${event.from} zachowania sesji`,
      provider: 'Codex',
      role: event.from === 'Review' ? 'reviewer' : event.attempt === 1 ? 'implementer' : 'refiner',
      current: false,
      step: event.from,
      attempt: event.attempt,
      status: 'idle',
    }));
  if (active)
    sessions.unshift({
      id: `session-${step}-3`,
      title: scenario === 'review' ? 'Review zachowania sesji' : 'Poprawki zachowania sesji',
      provider: 'Codex',
      role: scenario === 'review' ? 'reviewer' : 'refiner',
      current: true,
      step: names[step]!,
      attempt: 3,
      status: 'running',
    });
  return {
    id: 'TASK-03',
    specification: 'Admission',
    title:
      'Zachowaj sesję i miejsce pracy po powrocie z dokumentu' +
      (stress
        ? ' — zachowanie po ponownym logowaniu oraz niezależna praca w wielu kartach przeglądarki'
        : ''),
    description: scenario === 'draft' ? undefined : introduction,
    document:
      scenario === 'draft'
        ? undefined
        : introduction +
          '\n\n## Kryteria odbioru\n\n- Powrót zachowuje miejsce i fokus.\n- Ponowne logowanie nie zmienia zadania.\n- Dwie karty zachowują niezależny kontekst.\n\n' +
          (stress
            ? '### Szczegółowy scenariusz\n\nOtwórz materiał, przeczytaj dokument i wróć do poprzedniego miejsca.\n\n'.repeat(
                20,
              )
            : ''),
    phase:
      scenario === 'draft'
        ? 'draft'
        : scenario === 'ready'
          ? 'ready'
          : waiting
            ? 'waiting'
            : active
              ? 'active'
              : scenario === 'human'
                ? 'human'
                : 'completed',
    status: {
      label:
        scenario === 'draft'
          ? 'Draft · treść do przygotowania'
          : scenario === 'ready'
            ? 'Gotowe do rozpoczęcia'
            : scenario === 'human'
              ? 'Wymaga działania człowieka'
              : scenario === 'completed'
                ? 'Zakończone'
                : `${names[step]}${waiting ? ' · czeka na start' : ''}`,
      tone:
        scenario === 'human'
          ? 'attention'
          : scenario === 'completed'
            ? 'success'
            : active
              ? 'info'
              : 'neutral',
      icon:
        scenario === 'draft'
          ? 'file'
          : scenario === 'human'
            ? 'users'
            : scenario === 'completed'
              ? 'circle-check'
              : waiting || scenario === 'ready'
                ? 'clock'
                : step === 'review'
                  ? 'file-search'
                  : 'workflow',
    },
    step:
      scenario === 'draft'
        ? undefined
        : {
            name: names[step]!,
            attempt: active ? 3 : scenario === 'human' || scenario === 'completed' ? 1 : undefined,
            instruction: instructions[step],
          },
    startLabel:
      waiting || scenario === 'ready'
        ? step === 'review'
          ? 'Rozpocznij review'
          : 'Rozpocznij implementację'
        : undefined,
    sessions: sessions.map((session) => ({
      ...session,
      providerId: 'codex',
      // Base fixtures stay destination-free. Storybook composition attaches explicit
      // demo links; a production application must supply a real session owner URL.
    })),
    handoffs: history,
    decisions:
      scenario === 'human'
        ? [
            {
              id: 'pass',
              label: 'Approve',
              feedbackRequired: false,
              consequence: 'Zadanie zostanie zakończone.',
            },
            {
              id: 'fail',
              label: 'Request changes',
              feedbackRequired: true,
              consequence: 'Zadanie wróci do implementacji.',
            },
          ]
        : [],
  };
}
