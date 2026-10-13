import { describe, expect, it } from 'vitest';
import { markdownIntro } from './markdownIntro';

describe('Markdown description intro', () => {
  it('uses visible text of the first paragraph, skipping frontmatter and title', () => {
    const intro = markdownIntro(
      '---\ntitle: Metadata\n---\n# Task\n\nRead **these** [instructions](https://example.com).\n\n- More work',
      'Task',
    );
    expect(intro.intro).toBe('Read these instructions.');
    expect(intro.hasMore).toBe(true);
    expect(intro.source).not.toContain('# Task');
  });
  it('keeps graphemes intact and bounds long intros', () => {
    const value = markdownIntro('👩‍💻'.repeat(400));
    expect([
      ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value.intro),
    ]).toHaveLength(321);
    expect(value.intro.endsWith('…')).toBe(true);
    expect(value.hasMore).toBe(true);
  });
  it('does not invent a paragraph for a list or toggle a complete short paragraph', () => {
    expect(markdownIntro('- first\n- second')).toMatchObject({ intro: '', hasMore: true });
    expect(markdownIntro('# Task\n\nA short paragraph.', 'Task')).toMatchObject({
      intro: 'A short paragraph.',
      hasMore: false,
    });
  });
});
