import { collectCorpusProblems } from '../domain/corpus.js';
import type { DocRecord } from '../domain/frontmatter.js';
import { CorpusInvalidError } from '../errors.js';
import type { DocRepository } from '../ports.js';

/** Scan + fully validate. Throws `CorpusInvalidError` on any inconsistency. */
export function loadValidatedCorpus(repo: DocRepository): DocRecord[] {
  const scan = repo.scan();
  const problems = collectCorpusProblems(scan);
  if (problems.length) throw new CorpusInvalidError(problems);
  return scan.docs;
}

/** Scan + validate, returning the problem list instead of throwing. */
export function inspectCorpus(repo: DocRepository): { docs: DocRecord[]; problems: string[] } {
  const scan = repo.scan();
  return { docs: scan.docs, problems: collectCorpusProblems(scan) };
}
