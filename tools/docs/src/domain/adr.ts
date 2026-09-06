// ADR authoring + ADR-specific validation. Pure — no filesystem here.

import { stringify as stringifyYaml } from 'yaml';

import { UsageError } from '../errors.js';
import { asString, parseFrontmatter, validateDoc, type DocRecord } from './frontmatter.js';

const ADR_FILE_RE = /^(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
export const ADR_DIR = 'docs/architecture/decisions';

/** A newly-authored ADR is a `draft` until a human fills it in and promotes it. */
export const NEW_ADR_STATUS = 'draft';
/** Marker left in the generated body/summary; a `current` ADR must carry none. */
export const ADR_PLACEHOLDER_RE = /\bTODO\b/;

/** Deterministic slug (lower-case, non-alphanumerics -> single dashes, trimmed). */
export function slugify(title: string): string {
  const s = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s) throw new UsageError(`Cannot slugify title ${JSON.stringify(title)} — no alphanumerics.`);
  return s;
}

/** Zero-pad to 4 digits (ADRs are NNNN). */
export function padNumber(n: number | string): string {
  return String(n).padStart(4, '0');
}

/** Next ADR number; asserts the existing set is a gap-free `0001..N` sequence. */
export function nextAdrNumber(filenames: readonly string[]): { next: number } {
  const nums: number[] = [];
  for (const f of filenames) {
    if (f === 'README.md') continue;
    const m = ADR_FILE_RE.exec(f);
    if (!m) throw new UsageError(`ADR filename '${f}' does not match NNNN-kebab-title.md`);
    nums.push(Number(m[1]));
  }
  nums.sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i + 1) {
      throw new UsageError(
        `ADR numbering is not a gap-free 0001.. sequence (got [${nums.join(', ')}]). ` +
          `Fix before adding one.`,
      );
    }
  }
  return { next: nums.length + 1 };
}

export function isoDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Render a new ADR file. The frontmatter is serialized with the YAML library —
 * the human title is never string-spliced in, so `:` / `#` / quotes / Unicode
 * in a title cannot corrupt the block.
 */
export function renderAdr({
  number,
  slug,
  title,
  date,
}: {
  number: number;
  slug: string;
  title: string;
  date: string;
}): string {
  const id = `adr.${padNumber(number)}-${slug}`;
  const frontmatter = stringifyYaml(
    {
      id,
      type: 'adr',
      title,
      status: NEW_ADR_STATUS,
      date,
      summary: 'TODO: one or two sentences stating the decision.',
    },
    { lineWidth: 0 },
  ).trimEnd();

  return `---
${frontmatter}
---

# ${padNumber(number)} — ${title}

## Status

Draft — proposed, not yet adopted. Promote to \`current\` once accepted.

## Context

TODO: the forces at play — the requirement, the constraints, and any decision
that settled it. Enough that a future reader understands *why*.

## Decision

TODO: what was decided, stated concretely.

## Consequences

TODO: what this makes easier, what it makes harder, and any follow-up it implies.
`;
}

/**
 * Validate a rendered ADR file in memory, before it is written. Parses the
 * frontmatter (so a serialization bug is caught here, not on disk) and runs the
 * single-document contract + ADR-shape checks. Cross-corpus checks (numbering,
 * references) are left to the post-write `docs:check`.
 */
export function validateRenderedAdr(content: string, file: string): string[] {
  let parsed: ReturnType<typeof parseFrontmatter>;
  try {
    parsed = parseFrontmatter(content, file);
  } catch (err) {
    return [`${file}: ${err instanceof Error ? err.message : String(err)}`];
  }
  if (!parsed) return [`${file}: rendered ADR has no frontmatter block`];

  const doc: DocRecord = { ...parsed.frontmatter, file, body: parsed.body };
  const problems = validateDoc(doc);

  const base = file.split('/').pop() ?? '';
  const m = ADR_FILE_RE.exec(base);
  if (!m) {
    problems.push(`${file}: ADR filename must be NNNN-kebab-title.md`);
  } else if (doc.id !== `adr.${m[1]}-${m[2]}`) {
    problems.push(
      `${file}: id '${String(doc.id)}' must match the filename ('adr.${m[1]}-${m[2]}')`,
    );
  }
  if (!isIsoDate(doc.date)) {
    problems.push(`${file}: 'date' must be ISO YYYY-MM-DD (got ${JSON.stringify(doc.date)})`);
  }
  return problems;
}

export interface AdrPlan {
  readonly number: number;
  readonly slug: string;
  readonly file: string;
  readonly id: string;
  readonly content: string;
}

/** Plan a new ADR. Transactional: the rendered file is validated before it can be written. */
export function planNewAdr({
  title,
  filenames,
  date = isoDate(),
}: {
  title: string;
  filenames: readonly string[];
  date?: string;
}): AdrPlan {
  if (!title.trim()) throw new UsageError('An ADR title is required.');
  if (!isIsoDate(date)) {
    throw new UsageError(`date must be ISO YYYY-MM-DD, got ${JSON.stringify(date)}`);
  }
  const { next } = nextAdrNumber(filenames);
  const slug = slugify(title);
  const name = `${padNumber(next)}-${slug}.md`;
  if (filenames.includes(name)) throw new UsageError(`${ADR_DIR}/${name} already exists.`);
  const file = `${ADR_DIR}/${name}`;
  const content = renderAdr({ number: next, slug, title: title.trim(), date });

  const problems = validateRenderedAdr(content, file);
  if (problems.length) {
    throw new UsageError(`refusing to create an invalid ADR:\n  - ${problems.join('\n  - ')}`);
  }
  return { number: next, slug, file, id: `adr.${padNumber(next)}-${slug}`, content };
}

/** ADR-specific validation across the corpus. */
export function validateAdrs(docs: readonly DocRecord[]): string[] {
  const problems: string[] = [];
  const adrIds = new Set(
    docs.filter((d) => d.type === 'adr' && typeof d.id === 'string').map((d) => d.id as string),
  );

  for (const doc of docs) {
    if (doc.type !== 'adr') continue;
    const base = doc.file.split('/').pop() ?? '';
    const m = ADR_FILE_RE.exec(base);
    if (!m) {
      problems.push(`${doc.file}: ADR filename must be NNNN-kebab-title.md`);
      continue;
    }
    const [, num, slug] = m;
    const expectedId = `adr.${num}-${slug}`;
    if (doc.id !== expectedId) {
      problems.push(
        `${doc.file}: id '${String(doc.id)}' must match the filename ('${expectedId}')`,
      );
    }
    if (!isIsoDate(doc.date)) {
      problems.push(`${doc.file}: 'date' must be ISO YYYY-MM-DD (got ${JSON.stringify(doc.date)})`);
    }
    if (doc.status === 'superseded') {
      if (!doc.superseded_by) {
        problems.push(`${doc.file}: status 'superseded' requires a 'superseded_by' ADR id`);
      } else if (typeof doc.superseded_by !== 'string' || !adrIds.has(doc.superseded_by)) {
        problems.push(
          `${doc.file}: 'superseded_by' -> unknown ADR '${asString(doc.superseded_by)}'`,
        );
      } else if (!doc.superseded_by.startsWith('adr.')) {
        problems.push(`${doc.file}: 'superseded_by' must reference an ADR (adr.*)`);
      }
    }
    if (doc.supersedes && (typeof doc.supersedes !== 'string' || !adrIds.has(doc.supersedes))) {
      problems.push(`${doc.file}: 'supersedes' -> unknown ADR '${asString(doc.supersedes)}'`);
    }
    // §17 — a `current` ADR is an adopted decision; it must carry NO generated
    // TODO placeholder, in its summary OR anywhere in its body.
    if (doc.status === 'current') {
      const summary = typeof doc.summary === 'string' ? doc.summary : '';
      if (ADR_PLACEHOLDER_RE.test(summary) || ADR_PLACEHOLDER_RE.test(doc.body)) {
        problems.push(
          `${doc.file}: a 'current' ADR must not contain a generated TODO placeholder ` +
            `(found in ${ADR_PLACEHOLDER_RE.test(summary) ? 'summary' : 'the body'}) — fill it ` +
            `in, or keep status 'draft' until the decision is adopted`,
        );
      }
    }
  }

  // Numbering across the corpus must also be gap-free.
  const nums = docs
    .filter((d) => d.type === 'adr')
    .map((d) => Number(d.file.split('/').pop()?.slice(0, 4)))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);
  nums.forEach((n, i) => {
    if (n !== i + 1) problems.push(`ADR numbering has a gap or duplicate near ${padNumber(n)}`);
  });

  return problems;
}
