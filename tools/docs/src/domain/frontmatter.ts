// Frontmatter contract for Nevo SpecDev documentation. Pure — parsing helpers +
// per-document and cross-document validation.

import { parse } from 'yaml';

import { DocsToolError } from '../errors.js';

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;

export type DocType = 'hub' | 'development' | 'product' | 'architecture' | 'adr';
export type DocStatus = 'current' | 'draft' | 'deprecated' | 'superseded';

/** Required fields per `type`. */
export const REQUIRED_FIELDS: Record<DocType, readonly string[]> = {
  hub: ['id', 'type', 'title', 'status'],
  development: ['id', 'type', 'title', 'status', 'read_when', 'summary'],
  product: ['id', 'type', 'title', 'status', 'read_when', 'summary'],
  architecture: ['id', 'type', 'title', 'status', 'read_when', 'summary'],
  adr: ['id', 'type', 'title', 'status', 'date'],
};

export const KNOWN_TYPES = Object.keys(REQUIRED_FIELDS) as DocType[];
export const KNOWN_STATUSES: readonly DocStatus[] = [
  'current',
  'draft',
  'deprecated',
  'superseded',
];
/**
 * Statuses that represent superseded or retired knowledge. `nevo-docs context`
 * excludes these so an agent is never handed guidance a newer document replaced.
 */
export const INACTIVE_STATUSES: readonly DocStatus[] = ['deprecated', 'superseded'];

/** A parsed document: open frontmatter + the fields the tooling relies on. */
export interface DocRecord {
  readonly file: string;
  /** Markdown body after the frontmatter block (used for ADR placeholder checks). */
  readonly body: string;
  readonly id?: unknown;
  readonly type?: unknown;
  readonly title?: unknown;
  readonly status?: unknown;
  readonly date?: unknown;
  readonly summary?: unknown;
  readonly read_when?: unknown;
  readonly related?: unknown;
  readonly superseded_by?: unknown;
  readonly supersedes?: unknown;
  readonly [key: string]: unknown;
}

/** Coerce an untrusted frontmatter value to a string without `[object Object]`. */
export function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v == null) return fallback;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

function stripTrailingNewlines(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\n+$/, '');
  if (Array.isArray(value)) return value.map(stripTrailingNewlines);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        stripTrailingNewlines(v),
      ]),
    );
  }
  return value;
}

export interface ParsedMarkdown {
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
}

/** Extract + parse the frontmatter block. `null` when there is no block at all. */
export function parseFrontmatter(content: string, label = 'document'): ParsedMarkdown | null {
  const match = FRONT_MATTER_RE.exec(content);
  if (!match) return null;
  try {
    const parsed = stripTrailingNewlines(parse(match[1] ?? '') ?? {});
    const frontmatter =
      typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    // Drop the single blank line that conventionally separates the block from the body.
    return { frontmatter, body: (match[2] ?? '').replace(/^\r?\n/, '') };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new DocsToolError(`Invalid YAML frontmatter in ${label}: ${detail}`, { cause: err });
  }
}

function isKnownType(v: unknown): v is DocType {
  return typeof v === 'string' && (KNOWN_TYPES as string[]).includes(v);
}

/** Validate one parsed doc against the contract. Returns human-readable problems. */
export function validateDoc(doc: DocRecord): string[] {
  const problems: string[] = [];
  const loc = typeof doc.file === 'string' ? doc.file : asString(doc.id, 'document');

  if (!doc.id) problems.push(`${loc}: missing 'id'`);
  if (!doc.type) problems.push(`${loc}: missing 'type'`);
  if (doc.type !== undefined && !isKnownType(doc.type)) {
    problems.push(
      `${loc}: unknown type '${asString(doc.type)}' (expected one of: ${KNOWN_TYPES.join(', ')})`,
    );
  }
  if (doc.status !== undefined && !(KNOWN_STATUSES as string[]).includes(asString(doc.status))) {
    problems.push(
      `${loc}: unknown status '${asString(doc.status)}' (expected one of: ${KNOWN_STATUSES.join(', ')})`,
    );
  }

  const required = isKnownType(doc.type)
    ? REQUIRED_FIELDS[doc.type]
    : ['id', 'type', 'title', 'status'];
  for (const field of required) {
    const value = doc[field];
    if (value === undefined || value === null || value === '') {
      problems.push(`${loc}: missing required field '${field}' for type '${asString(doc.type)}'`);
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

/** Cross-document validation: unique ids, resolvable `related` / `superseded_by` / `supersedes`. */
export function validateCorpus(docs: readonly DocRecord[]): string[] {
  const problems: string[] = [];
  const byId = new Map<string, string>();

  for (const doc of docs) {
    if (typeof doc.id !== 'string') continue;
    const existing = byId.get(doc.id);
    if (existing) problems.push(`${doc.file}: duplicate id '${doc.id}' (also in ${existing})`);
    else byId.set(doc.id, doc.file);
  }

  for (const doc of docs) {
    const refs = [
      ...(Array.isArray(doc.related) ? (doc.related as unknown[]) : []),
      ...(doc.superseded_by ? [doc.superseded_by] : []),
      ...(doc.supersedes ? [doc.supersedes] : []),
    ];
    for (const ref of refs) {
      if (typeof ref !== 'string' || !byId.has(ref)) {
        problems.push(`${doc.file}: unresolved reference '${String(ref)}'`);
      }
    }
  }

  return problems;
}
