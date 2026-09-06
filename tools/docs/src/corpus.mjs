// The one validated corpus-loading path. Every command (list / find / context /
// adr / check) goes through this so discovery never serves a partial or
// inconsistent set of documents to an agent.

import { scanDocs } from './scan.mjs';
import { validateDoc, validateCorpus } from './frontmatter.mjs';
import { validateAdrs } from './adr.mjs';

export class CorpusError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`documentation corpus is invalid:\n  - ${problems.join('\n  - ')}`);
    this.name = 'CorpusError';
    this.problems = problems;
  }
}

/**
 * Scan + fully validate. Returns the deterministic doc array on success;
 * throws `CorpusError` (with `.problems`) on any inconsistency.
 *
 * @param {{ docsDir: string, repoRoot: string }} opts
 * @returns {Array<Record<string, any>>}
 */
export function loadValidatedCorpus(opts) {
  const problems = collectProblems(opts);
  if (problems.length) throw new CorpusError(problems);
  return scanDocs(opts).docs;
}

/**
 * Same scan + validation, but returns the problem list instead of throwing —
 * for the `check` command, which formats them itself.
 *
 * @param {{ docsDir: string, repoRoot: string }} opts
 * @returns {{ docs: Array<Record<string, any>>, problems: string[] }}
 */
export function inspectCorpus(opts) {
  const { docs } = scanDocs(opts);
  return { docs, problems: collectProblems(opts) };
}

/** @param {{ docsDir: string, repoRoot: string }} opts @returns {string[]} */
function collectProblems(opts) {
  const { docs, missingFrontmatter } = scanDocs(opts);
  /** @type {string[]} */
  const problems = [];
  for (const file of missingFrontmatter) {
    problems.push(`${file}: missing frontmatter (every authored docs/**.md file needs it)`);
  }
  for (const doc of docs) problems.push(...validateDoc(doc));
  problems.push(...validateCorpus(docs));
  problems.push(...validateAdrs(docs));
  return problems;
}
