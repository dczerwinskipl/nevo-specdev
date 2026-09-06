// Frontmatter contract for Nevo SpecDev documentation.
//
// Every authored doc under docs/ starts with a `---`-delimited YAML block. A
// file that has none is a validation FAILURE (`scanDocs` returns it under
// `missingFrontmatter`) unless it is explicitly exempt — see
// `isFrontmatterExempt` in scan.mjs (only `docs/templates/**` and
// `*.generated.*`).

import { parse } from 'yaml';

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Required fields per `type`. `hub` (index/README) docs only need identity;
 * everything a human or agent uses to decide "should I read this" is required
 * on the content types.
 *
 * @type {Record<string, readonly string[]>}
 */
export const REQUIRED_FIELDS = {
  hub: ['id', 'type', 'title', 'status'],
  development: ['id', 'type', 'title', 'status', 'read_when', 'summary'],
  product: ['id', 'type', 'title', 'status', 'read_when', 'summary'],
  architecture: ['id', 'type', 'title', 'status', 'read_when', 'summary'],
  adr: ['id', 'type', 'title', 'status', 'date'],
};

export const KNOWN_TYPES = Object.freeze(Object.keys(REQUIRED_FIELDS));
export const KNOWN_STATUSES = Object.freeze(['current', 'draft', 'deprecated', 'superseded']);

/**
 * YAML folded/literal block scalars keep a trailing newline; the docs only use them
 * for single-line display values, so strip it after parsing.
 *
 * @param {unknown} value
 * @returns {any}
 */
function stripTrailingNewlines(value) {
  if (typeof value === 'string') return value.replace(/\n+$/, '');
  if (Array.isArray(value)) return value.map(stripTrailingNewlines);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripTrailingNewlines(v)]));
  }
  return value;
}

/**
 * Extract and parse the frontmatter block from a Markdown string.
 *
 * @param {string} content
 * @param {string} label - path or identifier used in error messages
 * @returns {Record<string, unknown> | null} parsed object, or null when there is
 *   no frontmatter block at all
 */
export function parseFrontmatter(content, label = 'document') {
  const match = content.match(FRONT_MATTER_RE);
  if (!match) return null;
  try {
    return stripTrailingNewlines(parse(match[1] ?? '') ?? {});
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid YAML frontmatter in ${label}: ${detail}`, { cause: err });
  }
}

/**
 * Validate one parsed doc against the contract. Pure — returns a list of
 * human-readable problems (empty when valid).
 *
 * @param {Record<string, any>} doc - parsed frontmatter plus a `file` field
 * @returns {string[]}
 */
export function validateDoc(doc) {
  const problems = [];
  const loc = doc.file || doc.id || 'document';

  if (!doc.id) problems.push(`${loc}: missing 'id'`);
  if (!doc.type) problems.push(`${loc}: missing 'type'`);
  if (doc.type && !KNOWN_TYPES.includes(doc.type)) {
    problems.push(
      `${loc}: unknown type '${doc.type}' (expected one of: ${KNOWN_TYPES.join(', ')})`,
    );
  }
  if (doc.status && !KNOWN_STATUSES.includes(doc.status)) {
    problems.push(
      `${loc}: unknown status '${doc.status}' (expected one of: ${KNOWN_STATUSES.join(', ')})`,
    );
  }

  const required = REQUIRED_FIELDS[doc.type] || ['id', 'type', 'title', 'status'];
  for (const field of required) {
    if (doc[field] === undefined || doc[field] === null || doc[field] === '') {
      problems.push(`${loc}: missing required field '${field}' for type '${doc.type}'`);
    }
  }

  if (doc.read_when !== undefined) {
    if (!Array.isArray(doc.read_when) || doc.read_when.length === 0) {
      problems.push(`${loc}: 'read_when' must be a non-empty array of strings`);
    } else if (doc.read_when.some((v) => typeof v !== 'string' || !v.trim())) {
      problems.push(`${loc}: 'read_when' entries must be non-empty strings`);
    }
  }

  if (doc.related !== undefined && !Array.isArray(doc.related)) {
    problems.push(`${loc}: 'related' must be an array of doc ids`);
  }

  return problems;
}

/**
 * Cross-document validation: unique ids, resolvable `related` / `superseded_by`.
 *
 * @param {Array<Record<string, any>>} docs
 * @returns {string[]}
 */
export function validateCorpus(docs) {
  const problems = [];
  const byId = new Map();

  for (const doc of docs) {
    if (!doc.id) continue;
    if (byId.has(doc.id)) {
      problems.push(`${doc.file}: duplicate id '${doc.id}' (also in ${byId.get(doc.id)})`);
    } else {
      byId.set(doc.id, doc.file);
    }
  }

  for (const doc of docs) {
    const refs = [
      ...(Array.isArray(doc.related) ? doc.related : []),
      ...(doc.superseded_by ? [doc.superseded_by] : []),
      ...(doc.supersedes ? [doc.supersedes] : []),
    ];
    for (const ref of refs) {
      if (!byId.has(ref)) {
        problems.push(`${doc.file}: unresolved reference '${ref}'`);
      }
    }
  }

  return problems;
}
