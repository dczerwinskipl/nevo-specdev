// Pure corpus validation — composes the per-doc, cross-doc and ADR checks over
// an already-scanned document set.

import { validateAdrs } from './adr.js';
import { validateCorpus, validateDoc, type DocRecord } from './frontmatter.js';

export interface ScanResult {
  readonly docs: DocRecord[];
  /** repo-relative paths of authored files that have no frontmatter and are not exempt. */
  readonly missingFrontmatter: string[];
}

export function collectCorpusProblems(scan: ScanResult): string[] {
  const problems: string[] = [];
  for (const file of scan.missingFrontmatter) {
    problems.push(`${file}: missing frontmatter (every authored docs/**.md file needs it)`);
  }
  for (const doc of scan.docs) problems.push(...validateDoc(doc));
  problems.push(...validateCorpus(scan.docs));
  problems.push(...validateAdrs(scan.docs));
  return problems;
}
