import { describe, expect, it } from 'vitest';

import {
  isIsoDate,
  isoDate,
  NEW_ADR_STATUS,
  nextAdrNumber,
  padNumber,
  planNewAdr,
  renderAdr,
  slugify,
  validateAdrs,
  validateRenderedAdr,
} from '../../src/domain/adr.js';
import { parseFrontmatter, type DocRecord } from '../../src/domain/frontmatter.js';
import { UsageError } from '../../src/errors.js';

describe('slugify', () => {
  it('is deterministic and ASCII-kebab', () => {
    expect(slugify('Use X for Y')).toBe('use-x-for-y');
    expect(slugify('  Pin pnpm 10 (single-doc lockfile)!  ')).toBe(
      'pin-pnpm-10-single-doc-lockfile',
    );
    expect(slugify('Adopt Café stratégy')).toBe('adopt-cafe-strategy');
    expect(() => slugify('!!!')).toThrow(/no alphanumerics/);
  });
});

describe('nextAdrNumber', () => {
  it('returns N+1 for a gap-free set and ignores README', () => {
    expect(nextAdrNumber(['0001-a.md', '0002-b.md', '0003-c.md', 'README.md'])).toEqual({
      next: 4,
    });
    expect(nextAdrNumber([])).toEqual({ next: 1 });
  });
  it('rejects gaps, duplicates and malformed names', () => {
    expect(() => nextAdrNumber(['0001-a.md', '0003-c.md'])).toThrow(/gap-free/);
    expect(() => nextAdrNumber(['0001-a.md', '0001-b.md'])).toThrow(/gap-free/);
    expect(() => nextAdrNumber(['1-a.md'])).toThrow(/NNNN-kebab/);
  });
});

describe('planNewAdr', () => {
  it('produces the next draft file, id and template content', () => {
    const plan = planNewAdr({
      title: 'Use X for Y',
      filenames: ['0001-a.md', '0002-b.md', 'README.md'],
      date: '2026-09-06',
    });
    expect(plan.file).toBe('docs/architecture/decisions/0003-use-x-for-y.md');
    expect(plan.id).toBe('adr.0003-use-x-for-y');
    expect(plan.content).toMatch(/status: draft/);
    expect(plan.content).toMatch(/## Status\n\nDraft/);
    expect(plan.content).toMatch(/# 0003 — Use X for Y/);
    expect(validateRenderedAdr(plan.content, plan.file)).toEqual([]);
    expect(parseFrontmatter(plan.content, plan.file)?.frontmatter.status).toBe(NEW_ADR_STATUS);
  });

  it('serializes YAML-hostile titles safely and preserves the human title', () => {
    for (const title of [
      'Adopt X: the sequel',
      'Use #hashtags in logs',
      'Prefer "quoted" names',
      'Café stratégy — final',
      'Colons: everywhere: really',
    ]) {
      const plan = planNewAdr({ title, filenames: ['0001-a.md'], date: '2026-09-06' });
      const fm = parseFrontmatter(plan.content, plan.file)?.frontmatter;
      expect(fm?.title).toBe(title);
      expect(fm?.type).toBe('adr');
      expect(validateRenderedAdr(plan.content, plan.file)).toEqual([]);
      expect(plan.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('refuses inconsistent numbering, an empty title, or a bad date', () => {
    expect(() =>
      planNewAdr({ title: 'A', filenames: ['0001-a.md', '0003-c.md'], date: '2026-09-06' }),
    ).toThrow(/gap-free/);
    expect(() => planNewAdr({ title: '  ', filenames: [] })).toThrow(UsageError);
    expect(() => planNewAdr({ title: 'A', filenames: [], date: '9/9/26' })).toThrow(/ISO/);
  });
});

describe('isIsoDate / isoDate / padNumber', () => {
  it('validates', () => {
    expect(isIsoDate('2026-09-06')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-9-6')).toBe(false);
    expect(isIsoDate(20260906)).toBe(false);
    expect(isIsoDate(isoDate(new Date('2026-01-02T10:00:00Z')))).toBe(true);
    expect(padNumber(7)).toBe('0007');
  });
});

describe('validateAdrs', () => {
  const adr = (over: Partial<DocRecord>): DocRecord => ({
    type: 'adr',
    file: 'docs/architecture/decisions/0001-x.md',
    id: 'adr.0001-x',
    date: '2026-09-06',
    status: 'current',
    body: '',
    ...over,
  });

  it('passes a well-formed ADR set', () => {
    expect(
      validateAdrs([
        adr({}),
        adr({ file: 'docs/architecture/decisions/0002-y.md', id: 'adr.0002-y' }),
      ]),
    ).toEqual([]);
  });

  it('flags id/filename mismatch, bad date, and dangling supersession', () => {
    const joined = validateAdrs([
      adr({ id: 'adr.0001-wrong' }),
      adr({
        file: 'docs/architecture/decisions/0002-y.md',
        id: 'adr.0002-y',
        date: 'nope',
        status: 'superseded',
        superseded_by: 'adr.9999-missing',
      }),
    ]).join('\n');
    expect(joined).toMatch(/must match the filename/);
    expect(joined).toMatch(/'date' must be ISO/);
    expect(joined).toMatch(/unknown ADR 'adr\.9999-missing'/);
  });

  it('requires superseded_by on a superseded ADR and flags a numbering gap', () => {
    expect(validateAdrs([adr({ status: 'superseded' })]).join('\n')).toMatch(
      /requires a 'superseded_by'/,
    );
    expect(
      validateAdrs([
        adr({}),
        adr({ file: 'docs/architecture/decisions/0003-z.md', id: 'adr.0003-z' }),
      ]).join('\n'),
    ).toMatch(/numbering has a gap/);
  });

  it('§17: a current ADR must carry no TODO placeholder in its summary OR its body', () => {
    expect(
      validateAdrs([adr({ status: 'current', summary: 'TODO: state the decision.' })]).join('\n'),
    ).toMatch(/must not contain a generated TODO placeholder \(found in summary\)/);

    expect(
      validateAdrs([
        adr({
          status: 'current',
          summary: 'A real summary.',
          body: '## Decision\n\nTODO: what was decided.\n',
        }),
      ]).join('\n'),
    ).toMatch(/found in the body/);

    // a complete current ADR passes
    expect(
      validateAdrs([
        adr({
          status: 'current',
          summary: 'A real summary.',
          body: '## Decision\n\nWe chose X.\n',
        }),
      ]),
    ).toEqual([]);
  });

  it('allows a draft ADR to keep its TODO placeholders', () => {
    expect(
      validateAdrs([adr({ status: 'draft', summary: 'TODO: x', body: '## Decision\n\nTODO\n' })]),
    ).toEqual([]);
  });
});

describe('validateRenderedAdr / renderAdr', () => {
  it('catches a filename/id mismatch before the file is written', () => {
    const plan = planNewAdr({ title: 'A B', filenames: ['0001-a.md'], date: '2026-09-06' });
    const tampered = plan.content.replace('id: adr.0002-a-b', 'id: adr.0002-wrong');
    expect(validateRenderedAdr(tampered, plan.file).join('\n')).toMatch(/must match the filename/);
  });

  it('matches the frontmatter contract', () => {
    const c = renderAdr({ number: 12, slug: 'a-b', title: 'A B', date: '2026-09-06' });
    expect(c).toContain('id: adr.0012-a-b');
    expect(c).toContain('# 0012 — A B');
    expect(c).toContain('## Consequences');
  });
});
