// Deterministic, dependency-free doc search. Term-coverage first, then a small
// field-weight tie-breaker, then id order. Reads only structured frontmatter.

import { asString, type DocRecord } from './frontmatter.js';

export function normalizeTerm(term: string): string {
  const t = term
    .toLowerCase()
    .trim()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  if (!t) return '';
  if (t.endsWith('ies') && t.length > 4) return `${t.slice(0, -3)}y`;
  if (t.endsWith('sses')) return t.slice(0, -2);
  if (/(shes|ches|xes|zes)$/.test(t)) return t.slice(0, -2);
  if (t.endsWith('s') && !/(ss|us|is)$/.test(t)) return t.slice(0, -1);
  return t;
}

export function tokenize(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map(normalizeTerm)
        .filter(Boolean),
    ),
  ];
}

const FIELD_WEIGHTS: readonly (readonly [field: string, weight: number])[] = [
  ['id', 50],
  ['title', 40],
  ['read_when', 30],
  ['summary', 20],
  ['file', 10],
  ['related', 5],
];

function fieldText(doc: DocRecord, field: string): string {
  const v = doc[field];
  if (Array.isArray(v)) return v.map((x) => asString(x)).join(' ');
  return asString(v);
}

export interface ScoredDoc extends DocRecord {
  readonly score: number;
  readonly matchedTerms: string[];
  readonly matchedFields: string[];
}

export interface ScoreResult {
  readonly score: number;
  readonly matchedTerms: string[];
  readonly matchedFields: string[];
}

export function scoreDoc(doc: DocRecord, query: string): ScoreResult {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return { score: 0, matchedTerms: [], matchedFields: [] };

  const matchedTerms = new Set<string>();
  const matchedFields = new Set<string>();
  let fieldScore = 0;

  for (const [field, weight] of FIELD_WEIGHTS) {
    const fieldTokens = new Set(tokenize(fieldText(doc, field)));
    let hit = false;
    for (const token of queryTokens) {
      if (fieldTokens.has(token)) {
        matchedTerms.add(token);
        fieldScore += weight;
        hit = true;
      }
    }
    if (hit) matchedFields.add(field);
  }

  if (matchedTerms.size === 0) return { score: 0, matchedTerms: [], matchedFields: [] };

  const coverage = matchedTerms.size / queryTokens.length;
  const allTermsBonus = matchedTerms.size === queryTokens.length ? 500 : 0;
  const score = matchedTerms.size * 1000 + allTermsBonus + fieldScore + Math.round(coverage * 100);

  return {
    score,
    matchedTerms: queryTokens.filter((t) => matchedTerms.has(t)),
    matchedFields: [...matchedFields],
  };
}

export interface SearchOptions {
  readonly query?: string;
  readonly type?: string;
  readonly status?: string;
  /** drop these statuses (e.g. deprecated/superseded) */
  readonly excludeStatuses?: readonly string[];
  readonly limit?: number;
}

/** Filter + rank a corpus. */
export function searchDocs(
  docs: readonly DocRecord[],
  { query, type, status, excludeStatuses, limit }: SearchOptions = {},
): (DocRecord | ScoredDoc)[] {
  const excluded = new Set(excludeStatuses ?? []);
  const filtered = docs.filter(
    (d) =>
      (!type || d.type === type) &&
      (!status || d.status === status) &&
      !excluded.has(asString(d.status)),
  );

  let results: (DocRecord | ScoredDoc)[];
  if (query?.trim()) {
    results = filtered
      .map((doc) => ({ doc, ...scoreDoc(doc, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || String(a.doc.id).localeCompare(String(b.doc.id)))
      .map((r): ScoredDoc => ({
        ...r.doc,
        score: r.score,
        matchedTerms: r.matchedTerms,
        matchedFields: r.matchedFields,
      }));
  } else {
    results = [...filtered].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  return typeof limit === 'number' && limit > 0 ? results.slice(0, limit) : results;
}
