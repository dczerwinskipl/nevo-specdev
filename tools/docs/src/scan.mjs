// Walk docs/, parse frontmatter, return the corpus. I/O lives here; the pure
// contract logic is in frontmatter.mjs.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';

import { parseFrontmatter } from './frontmatter.mjs';

// Authored Markdown under docs/ must have frontmatter. These narrow, explicit
// exemptions do not:
//   - docs/templates/**   — copy-me starting points, deliberately frontmatter-free
//   - *.generated.*       — owned by the generator (also skipped by the walk)
const EXEMPT_DIR_PREFIXES = ['templates/'];

/** @param {string} fileRelToDocs @returns {boolean} */
export function isFrontmatterExempt(fileRelToDocs) {
  if (fileRelToDocs.includes('.generated.')) return true;
  return EXEMPT_DIR_PREFIXES.some((p) => fileRelToDocs === p || fileRelToDocs.startsWith(p));
}

/** @param {string} dir @returns {string[]} absolute paths of *.md files, sorted */
function walkMarkdown(dir) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(full));
    } else if (extname(entry.name) === '.md' && !entry.name.includes('.generated.')) {
      // Generated files are owned by their generator — never authored, never indexed.
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan docs/ into a deterministic, sorted corpus.
 *
 * @param {object} opts
 * @param {string} opts.docsDir - absolute path to docs/
 * @param {string} opts.repoRoot - absolute path to the repository root
 * @returns {{ docs: Array<Record<string, any>>, missingFrontmatter: string[] }}
 *   `docs` are parsed; `missingFrontmatter` lists authored files (repo-relative)
 *   that have no frontmatter and are not exempt — these are validation errors,
 *   not silent skips.
 */
export function scanDocs({ docsDir, repoRoot }) {
  /** @type {Array<Record<string, any>>} */
  const docs = [];
  /** @type {string[]} */
  const missingFrontmatter = [];

  for (const abs of walkMarkdown(docsDir)) {
    const file = relative(repoRoot, abs).split(sep).join('/');
    const relToDocs = relative(docsDir, abs).split(sep).join('/');
    const fm = parseFrontmatter(readFileSync(abs, 'utf8'), file);

    if (fm === null) {
      if (!isFrontmatterExempt(relToDocs)) missingFrontmatter.push(file);
      continue;
    }
    docs.push({ ...fm, file });
  }

  docs.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  missingFrontmatter.sort();
  return { docs, missingFrontmatter };
}

/** @param {string} start @returns {string} nearest ancestor holding pnpm-workspace.yaml */
export function findRepoRoot(start) {
  let dir = start;
  for (;;) {
    try {
      statSync(join(dir, 'pnpm-workspace.yaml'));
      return dir;
    } catch {
      const parent = join(dir, '..');
      if (parent === dir) return start;
      dir = parent;
    }
  }
}
