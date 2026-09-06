// ADR authoring + ADR-specific validation for tools/docs.
//
// This is repository architecture-doc tooling, not a Nevo SpecDev product API.

import { stringify as stringifyYaml } from 'yaml';

import { parseFrontmatter, validateDoc } from './frontmatter.mjs';

const ADR_FILE_RE = /^(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
export const ADR_DIR = 'docs/architecture/decisions';

/** Deterministic slug (lower-case, non-alphanumerics -> single dashes, trimmed). @param {string} title */
export function slugify(title) {
  const s = String(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s) throw new Error(`Cannot slugify title ${JSON.stringify(title)} — no alphanumerics.`);
  return s;
}

/** Zero-pad to 4 digits (ADRs are NNNN). @param {number|string} n */
export function padNumber(n) {
  return String(n).padStart(4, '0');
}

/**
 * Given the ADR directory filenames, return the next number and assert the
 * existing set is a gap-free `0001..N` sequence with no duplicates.
 *
 * @param {string[]} filenames  basenames in docs/architecture/decisions/
 * @returns {{ next: number }}
 */
export function nextAdrNumber(filenames) {
  const nums = [];
  for (const f of filenames) {
    if (f === 'README.md') continue;
    const m = ADR_FILE_RE.exec(f);
    if (!m) throw new Error(`ADR filename '${f}' does not match NNNN-kebab-title.md`);
    nums.push(Number(m[1]));
  }
  nums.sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i + 1) {
      throw new Error(
        `ADR numbering is not a gap-free 0001.. sequence (got [${nums.join(', ')}]). Fix before adding one.`,
      );
    }
  }
  return { next: nums.length + 1 };
}

/** ISO date (YYYY-MM-DD) for `d` (defaults to now, UTC). */
export function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @param {unknown} v */
export function isIsoDate(v) {
  if (typeof v !== 'string' || !ISO_DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** A newly-authored ADR is a `draft` until a human fills it in and promotes it. */
export const NEW_ADR_STATUS = 'draft';
/** Marker left in the generated body/summary; a `current` ADR must carry none. */
export const ADR_PLACEHOLDER_RE = /\bTODO\b/;

/**
 * Render a new ADR file from the template contract. The frontmatter is
 * serialized with the YAML library — the human title is never string-spliced
 * into the block, so `:`/`#`/quotes/Unicode in a title cannot corrupt it.
 *
 * @param {{ number: number, slug: string, title: string, date: string }} o
 */
export function renderAdr({ number, slug, title, date }) {
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
 *
 * @param {string} content
 * @param {string} file  repo-relative path, for messages
 * @returns {string[]} problems (empty ⇒ safe to write)
 */
export function validateRenderedAdr(content, file) {
  let fm;
  try {
    fm = parseFrontmatter(content, file);
  } catch (err) {
    return [`${file}: ${err instanceof Error ? err.message : String(err)}`];
  }
  if (!fm) return [`${file}: rendered ADR has no frontmatter block`];

  /** @type {Record<string, any>} */
  const doc = { ...fm, file };
  const problems = validateDoc(doc);

  const base = file.split('/').pop() ?? '';
  const m = ADR_FILE_RE.exec(base);
  if (!m) {
    problems.push(`${file}: ADR filename must be NNNN-kebab-title.md`);
  } else if (doc.id !== `adr.${m[1]}-${m[2]}`) {
    problems.push(`${file}: id '${doc.id}' must match the filename ('adr.${m[1]}-${m[2]}')`);
  }
  if (!isIsoDate(doc.date)) {
    problems.push(`${file}: 'date' must be ISO YYYY-MM-DD (got ${JSON.stringify(doc.date)})`);
  }
  return problems;
}

/**
 * Plan a new ADR from a title + the current directory listing. Pure.
 *
 * @param {{ title: string, filenames: string[], date?: string }} o
 * @returns {{ number: number, slug: string, file: string, id: string, content: string }}
 */
export function planNewAdr({ title, filenames, date = isoDate() }) {
  if (!title || !String(title).trim()) throw new Error('An ADR title is required.');
  if (!isIsoDate(date)) throw new Error(`date must be ISO YYYY-MM-DD, got ${JSON.stringify(date)}`);
  const { next } = nextAdrNumber(filenames);
  const slug = slugify(title);
  const name = `${padNumber(next)}-${slug}.md`;
  if (filenames.includes(name)) throw new Error(`${ADR_DIR}/${name} already exists.`);
  const file = `${ADR_DIR}/${name}`;
  const content = renderAdr({ number: next, slug, title: String(title).trim(), date });

  // Transactional: the rendered file must parse and satisfy the contract before
  // the caller is allowed to write it — no half-valid ADR ever reaches disk.
  const problems = validateRenderedAdr(content, file);
  if (problems.length) {
    throw new Error(`refusing to create an invalid ADR:\n  - ${problems.join('\n  - ')}`);
  }

  return { number: next, slug, file, id: `adr.${padNumber(next)}-${slug}`, content };
}

/**
 * ADR-specific validation across the corpus (in addition to the generic doc
 * checks). Returns a list of problems.
 *
 * @param {Array<Record<string, any>>} docs
 * @returns {string[]}
 */
export function validateAdrs(docs) {
  const problems = [];
  const adrIds = new Set(docs.filter((d) => d.type === 'adr').map((d) => d.id));

  for (const doc of docs) {
    if (doc.type !== 'adr') continue;
    const base = String(doc.file).split('/').pop() ?? '';
    const m = ADR_FILE_RE.exec(base);
    if (!m) {
      problems.push(`${doc.file}: ADR filename must be NNNN-kebab-title.md`);
      continue;
    }
    const [, num, slug] = m;
    const expectedId = `adr.${num}-${slug}`;
    if (doc.id !== expectedId) {
      problems.push(`${doc.file}: id '${doc.id}' must match the filename ('${expectedId}')`);
    }
    if (!isIsoDate(doc.date)) {
      problems.push(`${doc.file}: 'date' must be ISO YYYY-MM-DD (got ${JSON.stringify(doc.date)})`);
    }
    if (doc.status === 'superseded') {
      if (!doc.superseded_by) {
        problems.push(`${doc.file}: status 'superseded' requires a 'superseded_by' ADR id`);
      } else if (!adrIds.has(doc.superseded_by)) {
        problems.push(`${doc.file}: 'superseded_by' -> unknown ADR '${doc.superseded_by}'`);
      } else if (!/^adr\./.test(doc.superseded_by)) {
        problems.push(`${doc.file}: 'superseded_by' must reference an ADR (adr.*)`);
      }
    }
    if (doc.supersedes && !adrIds.has(doc.supersedes)) {
      problems.push(`${doc.file}: 'supersedes' -> unknown ADR '${doc.supersedes}'`);
    }
    // A `current` ADR is an adopted decision; it must not still carry the
    // generated TODO placeholder in its summary.
    if (doc.status === 'current' && ADR_PLACEHOLDER_RE.test(String(doc.summary ?? ''))) {
      problems.push(
        `${doc.file}: a 'current' ADR must not carry a generated TODO placeholder in ` +
          `'summary' — fill it in, or keep status 'draft' until the decision is adopted`,
      );
    }
  }

  // Numbering across the corpus must also be gap-free.
  const nums = docs
    .filter((d) => d.type === 'adr')
    .map((d) => Number(String(d.file).split('/').pop()?.slice(0, 4)))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);
  nums.forEach((n, i) => {
    if (n !== i + 1) problems.push(`ADR numbering has a gap or duplicate near ${padNumber(n)}`);
  });

  return problems;
}
