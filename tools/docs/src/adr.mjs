// ADR authoring + ADR-specific validation for tools/docs.
//
// This is repository architecture-doc tooling, not a Nevo SpecDev product API.

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

/**
 * Render a new ADR file body from the template contract.
 *
 * @param {{ number: number, slug: string, title: string, date: string }} o
 */
export function renderAdr({ number, slug, title, date }) {
  const id = `adr.${padNumber(number)}-${slug}`;
  return `---
id: ${id}
type: adr
title: ${title}
status: current
date: ${date}
summary: >
  TODO: one or two sentences stating the decision.
---

# ${padNumber(number)} — ${title}

## Status

Current.

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
  return {
    number: next,
    slug,
    file: `${ADR_DIR}/${name}`,
    id: `adr.${padNumber(next)}-${slug}`,
    content: renderAdr({ number: next, slug, title: String(title).trim(), date }),
  };
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
