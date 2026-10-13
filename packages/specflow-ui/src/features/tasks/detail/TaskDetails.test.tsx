import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createSpecFlowI18n, LocalizationProvider } from '../../../i18n';
import { mapFullTaskResponse } from '../model';
import { TaskDetails, mergeTaskResources, pendingRequirements } from './TaskDetails';
import { createTaskDetailFixture } from './taskDetail.test-support';

describe('Task presentation policy', () => {
  it('keeps the third recommendation ahead of overlapping pages, without duplicate IDs', () => {
    const { resources } = createTaskDetailFixture();
    const result = mergeTaskResources(resources.slice(0, 3), [
      resources.slice(2, 8),
      resources.slice(7),
    ]);
    expect(result.map((ref) => ref.id)).toEqual(resources.map((ref) => ref.id));
  });
  it('counts one human step plus independent pending gates, preserving definition order', () => {
    const { response } = createTaskDetailFixture();
    const requirements = response.snapshot!.sections.humanRequirements;
    if (requirements.state !== 'available') throw new Error('Fixture must have requirements');
    requirements.data.items[3]!.state = 'passed';
    const pending = pendingRequirements(response.snapshot!);
    expect(pending).toHaveLength(20);
    expect(pending[0]!.source.kind).toBe('human-step');
    expect(pending.map((item) => item.id)).not.toContain('gate-2');
  });
  it('uses the same core with two preview resources, three full resources and three requirements', () => {
    const { response } = createTaskDetailFixture();
    const render = (preview: boolean) =>
      renderToStaticMarkup(
        <LocalizationProvider instance={createSpecFlowI18n('en')}>
          <TaskDetails task={mapFullTaskResponse(response)} specKey="admission" preview={preview} />
        </LocalizationProvider>,
      );
    const preview = render(true);
    const full = render(false);
    expect(preview).toContain('Verification material 2');
    expect(preview).not.toContain('Verification material 3');
    expect(full).toContain('Verification material 3');
    expect(full).not.toContain('Verification material 4');
    expect(full).toContain('Independent verification 2');
    expect(full).not.toContain('Independent verification 3');
    expect(full.match(/Verify session behaviour/g)).toHaveLength(1);
    expect(full).not.toContain('Use this flow when');
  });
  it.each([true, false])(
    'uses active workflow status over legacy pending in preview=%s',
    (preview) => {
      const { response } = createTaskDetailFixture('agent');
      response.task.status = { id: 'pending', label: 'Ready', lifecycle: 'pending' };
      const html = renderToStaticMarkup(
        <LocalizationProvider instance={createSpecFlowI18n('en')}>
          <TaskDetails task={mapFullTaskResponse(response)} specKey="admission" preview={preview} />
        </LocalizationProvider>,
      );
      expect(html).toContain('In progress');
      expect(html).not.toContain('Ready');
    },
  );
  it.each(['terminal', 'no-next'] as const)(
    'does not offer a fictional step opener in %s',
    (scenario) => {
      const { response } = createTaskDetailFixture(scenario);
      const html = renderToStaticMarkup(
        <LocalizationProvider instance={createSpecFlowI18n('en')}>
          <TaskDetails
            task={mapFullTaskResponse(response)}
            specKey="admission"
            onInspect={() => undefined}
          />
        </LocalizationProvider>,
      );
      expect(html).not.toContain('Step context');
      expect(html).not.toContain('Step details');
      expect(html).not.toContain('Next step details');
    },
  );
  it('retains independent requirement openers when the work source is unavailable', () => {
    const { response } = createTaskDetailFixture('work-unavailable');
    const html = renderToStaticMarkup(
      <LocalizationProvider instance={createSpecFlowI18n('en')}>
        <TaskDetails
          task={mapFullTaskResponse(response)}
          specKey="admission"
          onInspect={() => undefined}
        />
      </LocalizationProvider>,
    );
    expect(html).toContain('Independent verification 1');
    expect(html).toMatch(/<button[^>]*>Verify session behaviour<\/button>/);
    expect(html).toContain('This source is unavailable.');
  });
  it('keeps legal work separately reachable for a mismatched human requirement', () => {
    const { response } = createTaskDetailFixture('mismatch');
    const html = renderToStaticMarkup(
      <LocalizationProvider instance={createSpecFlowI18n('en')}>
        <TaskDetails
          task={mapFullTaskResponse(response)}
          specKey="admission"
          onInspect={() => undefined}
        />
      </LocalizationProvider>,
    );
    expect(html).toContain('Step details');
    expect(html).toMatch(/<button[^>]*>Verify session behaviour<\/button>/);
  });
});
