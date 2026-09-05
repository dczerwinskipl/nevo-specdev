// Deterministic, dependency-free doc search. Term-coverage first, then a small
// field-weight tie-breaker, then id order. No product knowledge lives here — it
// only reads the structured frontmatter fields.

/** @param {string} term */
export function normalizeTerm(term) {
  let t = String(term || '')
    .toLowerCase()
    .trim()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  if (!t) return '';
  // Light singularization so "conventions" matches "convention", "guidelines" → "guideline".
  if (t.endsWith('ies') && t.length > 4) return `${t.slice(0, -3)}y`;
  if (t.endsWith('sses')) return t.slice(0, -2);
  if (/(shes|ches|xes|zes)$/.test(t)) return t.slice(0, -2);
  if (t.endsWith('s') && !/(ss|us|is)$/.test(t)) return t.slice(0, -1);
  return t;
}

/** @param {string} text @returns {string[]} normalized, de-duplicated tokens */
export function tokenize(text) {
  return [
    ...new Set(
      String(text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map(normalizeTerm)
        .filter(Boolean),
    ),
  ];
}

/** @type {ReadonlyArray<readonly [field: string, weight: number]>} */
const FIELD_WEIGHTS = [
  ['id', 50],
  ['title', 40],
  ['read_when', 30],
  ['summary', 20],
  ['file', 10],
  ['related', 5],
];

/** @param {Record<string, any>} doc @param {string} field */
function fieldText(doc, field) {
  const v = doc[field];
  if (Array.isArray(v)) return v.join(' ');
  return v == null ? '' : String(v);
}

/**
 * Score one doc against a query. Returns `{ score, matchedTerms, matchedFields }`.
 * A score of 0 means "no match" — the caller drops it.
 *
 * @param {Record<string, any>} doc
 * @param {string} query
 */
export function scoreDoc(doc, query) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return { score: 0, matchedTerms: [], matchedFields: [] };

  const matchedTerms = new Set();
  const matchedFields = new Set();
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

/**
 * Filter + rank a corpus.
 *
 * @param {Array<Record<string, any>>} docs
 * @param {object} opts
 * @param {string} [opts.query]
 * @param {string} [opts.type]
 * @param {string} [opts.status]
 * @param {number} [opts.limit]
 * @returns {Array<Record<string, any>>} docs with `score` / `matchedTerms` / `matchedFields` when a query was given
 */
export function searchDocs(docs, { query, type, status, limit } = {}) {
  let results = docs.filter((d) => (!type || d.type === type) && (!status || d.status === status));

  if (query && query.trim()) {
    results = results
      .map((doc) => ({ doc, ...scoreDoc(doc, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || String(a.doc.id).localeCompare(String(b.doc.id)))
      .map((r) => ({
        ...r.doc,
        score: r.score,
        matchedTerms: r.matchedTerms,
        matchedFields: r.matchedFields,
      }));
  } else {
    results = [...results].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  return typeof limit === 'number' && limit > 0 ? results.slice(0, limit) : results;
}
