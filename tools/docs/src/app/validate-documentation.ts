import { buildIndex, diffIndex } from '../domain/index-file.js';
import type { DocRepository } from '../ports.js';
import { inspectCorpus } from './load-corpus.js';

export interface ValidateResult {
  readonly problems: string[];
  readonly wroteIndex: boolean;
  readonly docCount: number;
}

/**
 * `check` / `check --write` — validate the corpus, then either regenerate the
 * index (when `write` and the corpus is clean) or report its staleness.
 */
export function validateDocumentation(
  repo: DocRepository,
  { write = false }: { write?: boolean } = {},
): ValidateResult {
  const { docs, problems: corpusProblems } = inspectCorpus(repo);

  let wroteIndex = false;
  if (write && corpusProblems.length === 0) {
    repo.writeIndex(buildIndex(docs));
    wroteIndex = true;
  }

  const problems = corpusProblems.length
    ? [...corpusProblems]
    : diffIndex(buildIndex(docs), repo.readIndex());

  return { problems, wroteIndex, docCount: docs.length };
}
