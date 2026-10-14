import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DesignMetadataProvider } from '@nevo/figma-capture/metadata';
import {
  Progress,
  normalizeProgressValue,
  fitsProgressSegments,
  validProgressCounts,
} from './Progress';
import { designSpec } from './Progress.figma';

describe('Progress', () => {
  it.each([
    [104, 17, true],
    [104, 18, false],
    [112, 19, true],
    [112, 20, false],
    [688, 100, true],
    [51.99, 9, false],
    [52, 9, true],
  ])('uses the actual width boundary: %s px, %s segments', (width, total, fits) => {
    expect(fitsProgressSegments(width, total)).toBe(fits);
  });
  it('rejects inconsistent counts rather than clamping task facts', () => {
    for (const [completed, total] of [
      [1, 0],
      [3, 2],
      [-1, 2],
      [1.5, 2],
      [1, Infinity],
    ])
      expect(validProgressCounts(completed!, total!)).toBe(false);
    expect(
      renderToStaticMarkup(
        <Progress aria-label="Invalid" variant="segmented" completed={3} total={2} />,
      ),
    ).toBe('');
  });
  it('preserves aggregate count accessibility through continuous fallback', () => {
    const html = renderToStaticMarkup(
      <Progress
        aria-label="Tasks"
        variant="segmented"
        completed={5}
        total={9}
        size="compact"
        aria-valuetext="5 of 9 tasks"
      />,
    );
    expect(html).toContain('aria-valuemax="9"');
    expect(html).toContain('aria-valuenow="5"');
    expect(html).toContain('aria-valuetext="5 of 9 tasks"');
  });
  it('clamps values and supports a custom max', () => {
    expect(normalizeProgressValue(150, 100)).toEqual({
      max: 100,
      value: 100,
      percentage: 100,
    });
    expect(normalizeProgressValue(25, 50)).toEqual({
      max: 50,
      value: 25,
      percentage: 50,
    });
  });

  it('renders standard progressbar semantics', () => {
    const html = renderToStaticMarkup(<Progress aria-label="Import progress" max={20} value={5} />);

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="20"');
    expect(html).toContain('aria-valuenow="5"');
    expect(html).toContain('width:25%');
  });

  it('captures fill as nested structure without public slots', () => {
    const html = renderToStaticMarkup(
      <DesignMetadataProvider captureComponents={['Progress']}>
        <Progress aria-label="Import progress" value={67} />
      </DesignMetadataProvider>,
    );

    expect(designSpec.slots).toEqual({});
    expect(html).toContain('data-design-component="Progress"');
    expect(html).toContain('data-design-capture="true"');
    expect(html).toContain('data-design-key="fill"');
    expect(html).toContain('data-design-layer="fill"');
    expect(html).not.toContain('data-design-slot=');
  });
});
