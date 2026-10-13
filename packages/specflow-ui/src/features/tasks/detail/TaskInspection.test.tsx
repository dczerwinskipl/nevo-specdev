import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { createSpecFlowI18n, LocalizationProvider } from '../../../i18n';
import { mapFullTaskResponse } from '../model';
import { TaskEvidenceInspection, TaskInspection } from './TaskInspection';
import { TaskHints } from './TaskStepInspection';
import { createTaskDetailFixture } from './taskDetail.test-support';

const render = (node: ReactNode) =>
  renderToStaticMarkup(
    <LocalizationProvider instance={createSpecFlowI18n('en')}>{node}</LocalizationProvider>,
  );
describe('Task inspection', () => {
  it('omits the entire hints region for a known empty list, including historical consumers', () => {
    expect(render(<TaskHints hints={[]} />)).toBe('');
    for (const scenario of ['agent', 'not-started'] as const) {
      const { response } = createTaskDetailFixture(scenario);
      const html = render(<TaskInspection task={mapFullTaskResponse(response)} page="work" />);
      expect(html).toContain('Declared work transitions');
      expect(html).not.toContain('Hints');
    }
  });
  it('keeps a readable hint identity and explicit disclosure without inventing resource navigation', () => {
    const ref = `${'src/very-long-path/'.repeat(12)}session.ts`;
    const html = render(<TaskHints hints={[{ kind: 'file', ref }]} />);
    expect(html).not.toContain(ref);
    expect(html).toContain('session.ts');
    expect(html).toContain('Full reference');
    expect(html).toContain('Why unavailable');
    expect(html).toContain('Hints');
    expect(html).toContain('file');
    expect(html).toContain('Reference only — content unavailable');
    expect(html).not.toMatch(/<a\b/);
    expect(html).toContain('aria-expanded="false"');
  });
  it('keeps an unavailable work source distinct from known empty hints', () => {
    const { response } = createTaskDetailFixture('work-unavailable');
    const html = render(<TaskInspection task={mapFullTaskResponse(response)} page="work" />);
    expect(html).toContain('This source is unavailable.');
    expect(html).not.toContain('Hints');
  });
  it('shows all steps, executors, branch targets and the correction loop separately from current position', () => {
    const { response } = createTaskDetailFixture();
    const html = render(<TaskInspection task={mapFullTaskResponse(response)} page="flow" />);
    expect(html).toContain('Implement session behaviour');
    expect(html).toContain('Verify session behaviour');
    expect(html).toContain('Agent');
    expect(html).toContain('Human');
    expect(html).toContain('To: verify');
    expect(html).toContain('To: build');
    expect(html).toContain('To: done');
    expect(html).toContain('Completed successfully');
    expect(html.match(/Current position/g)).toHaveLength(1);
  });
  it('makes available evidence keyboard actionable and keeps forbidden evidence noninteractive', () => {
    const { response } = createTaskDetailFixture();
    const section = response.snapshot!.sections.humanRequirements;
    if (section.state !== 'available') throw new Error('Fixture requires requirements');
    section.data.items[0]!.evidence.push({
      title: 'Private evidence',
      link: { state: 'forbidden' },
    });
    section.data.items[0]!.evidence.push(
      {
        title: 'Session evidence',
        link: { state: 'available', target: { kind: 'session', sessionId: 's1' } },
      },
      { title: 'Missing evidence', link: { state: 'unavailable', reason: 'not_found' } },
    );
    const html = render(
      <TaskInspection
        task={mapFullTaskResponse(response)}
        page="requirement"
        requirementId="human-work"
        onOpenEvidence={vi.fn()}
      />,
    );
    expect(html).toMatch(/<button[^>]*>Verification instructions<\/button>/);
    expect(html).not.toMatch(/<button[^>]*>Private evidence<\/button>/);
    expect(html).not.toMatch(/<button[^>]*>Session evidence<\/button>/);
    expect(html).not.toMatch(/<button[^>]*>Missing evidence<\/button>/);
    expect(html).toContain('No reader is available for this material.');
  });
  it('does not retarget open evidence when the snapshot changes', () => {
    const { response } = createTaskDetailFixture();
    const html = render(
      <TaskEvidenceInspection
        task={mapFullTaskResponse(response)}
        params={{ requirementId: 'human-work', index: 0, revision: 'previous-revision' }}
      />,
    );
    expect(html).toContain('This source is unavailable.');
  });
  it('consolidates rich human work without losing distinct instructions, hints, feedback or either decision owner', () => {
    const { response } = createTaskDetailFixture('rich-human');
    const html = render(
      <TaskInspection
        task={mapFullTaskResponse(response)}
        page="requirement"
        requirementId="human-work"
      />,
    );
    for (const text of [
      'session-return.md',
      'nevo-agents-reviewer',
      'session.ts',
      'Check return navigation',
      'Confirm the browser back button',
      'Feedback from verify, attempt 1',
      'evidence_pending',
      'Declared work transitions',
      'Requirement decisions',
      'To: build',
      'Verification instructions',
    ])
      expect(html).toContain(text);
    expect(html.match(/Verify session behaviour/g)).toHaveLength(1);
  });
  it('keeps independent requirements available without the work source and never borrows mismatched hints', () => {
    for (const scenario of ['work-unavailable', 'mismatch'] as const) {
      const { response } = createTaskDetailFixture(scenario);
      const html = render(
        <TaskInspection
          task={mapFullTaskResponse(response)}
          page="requirement"
          requirementId="human-work"
        />,
      );
      expect(html).toContain('Verification instructions');
      expect(html).toContain('cannot be matched');
      expect(html).not.toContain('Declared work transitions');
    }
  });
  it('does not silently replace a pinned work attempt after refresh', () => {
    const { response } = createTaskDetailFixture('retry');
    const html = render(
      <TaskInspection
        task={mapFullTaskResponse(response)}
        page="work"
        anchor={{ revision: 'previous' }}
      />,
    );
    expect(html).toContain('This context has changed.');
    expect(html).not.toContain('Attempt 2');
  });
  it('does not give next work an active attempt', () => {
    const { response } = createTaskDetailFixture('next-human');
    const html = render(
      <TaskInspection
        task={mapFullTaskResponse(response)}
        page="requirement"
        requirementId="human-work"
      />,
    );
    expect(html).toContain('Next step');
    expect(html).not.toContain('Attempt 1');
  });
  it('keeps next-ready hints reachable through the shared disclosure without inventing an attempt', () => {
    const { response } = createTaskDetailFixture('next-human');
    const work = response.snapshot!.sections.work;
    if (
      work.state !== 'available' ||
      work.data.position.state !== 'not_started' ||
      !work.data.position.next
    )
      throw new Error('Expected an available next step');
    const ref = `${'docs/next-step/'.repeat(12)}guide.md`;
    work.data.position.next.hints = [{ kind: 'doc', ref }];
    const html = render(
      <TaskInspection
        task={mapFullTaskResponse(response)}
        page="requirement"
        requirementId="human-work"
      />,
    );
    expect(html).toContain('Next step');
    expect(html).toContain('guide.md');
    expect(html).toContain('Full reference');
    expect(html).not.toContain(ref);
    expect(html).not.toContain('Attempt 1');
    work.data.position.next.hints = [];
    const emptyHtml = render(
      <TaskInspection
        task={mapFullTaskResponse(response)}
        page="requirement"
        requirementId="human-work"
      />,
    );
    expect(emptyHtml).not.toContain('Hints');
    expect(emptyHtml).toContain('Next step');
  });
});
