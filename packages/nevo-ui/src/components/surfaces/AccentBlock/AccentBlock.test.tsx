import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccentBlock } from './AccentBlock';

describe('AccentBlock semantics', () => {
  it('leaves region/announcement semantics to its consumer and forwards attributes', () => {
    const html = renderToStaticMarkup(
      <AccentBlock aria-labelledby="heading">
        <h2 id="heading">Requirements</h2>
      </AccentBlock>,
    );
    expect(html).toContain('aria-labelledby="heading"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });
});
