// Walk docs/, parse frontmatter, return the doc corpus. I/O lives here; the
// pure contract logic is in frontmatter.mjs.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';

import { parseFrontmatter } from './frontmatter.mjs';

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
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan a docs directory into a deterministic, sorted array of docs. Each doc is
 * its parsed frontmatter plus `file` (repo-relative, forward-slashed). Files
 * with no frontmatter block are skipped.
 *
 * @param {object} opts
 * @param {string} opts.docsDir - absolute path to docs/
 * @param {string} opts.repoRoot - absolute path to the repository root
 * @returns {Array<Record<string, any>>}
 */
export function scanDocs({ docsDir, repoRoot }) {
  /** @type {Array<Record<string, any>>} */
  const docs = [];
  for (const abs of walkMarkdown(docsDir)) {
    const file = relative(repoRoot, abs).split(sep).join('/');
    const fm = parseFrontmatter(readFileSync(abs, 'utf8'), file);
    if (fm === null) continue;
    docs.push({ ...fm, file });
  }
  return docs.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/** @param {string} start @returns {string} nearest ancestor containing package.json */
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
