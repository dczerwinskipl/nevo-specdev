import { planNewAdr, type AdrPlan } from '../domain/adr.js';
import { collectCorpusProblems } from '../domain/corpus.js';
import { buildIndex } from '../domain/index-file.js';
import { CorpusInvalidError } from '../errors.js';
import type { DocRepository } from '../ports.js';

export interface CreateAdrInput {
  readonly title: string;
  readonly date?: string;
  readonly dryRun?: boolean;
}

export interface CreateAdrResult {
  readonly plan: AdrPlan;
  readonly written: boolean;
  readonly indexRegenerated: boolean;
}

/**
 * Create the next-numbered ADR as a `draft`. Transactional:
 *   1. plan + render + validate the file in memory (planNewAdr);
 *   2. refuse if the current corpus is already invalid;
 *   3. write the file;
 *   4. re-validate — on any problem, remove the file and throw (no half-apply);
 *   5. regenerate the deterministic index.
 */
export function createAdr(repo: DocRepository, input: CreateAdrInput): CreateAdrResult {
  const preProblems = collectCorpusProblems(repo.scan());
  if (preProblems.length) throw new CorpusInvalidError(preProblems);

  const plan = planNewAdr({ title: input.title, filenames: repo.adrFilenames(), date: input.date });

  if (input.dryRun) {
    return { plan, written: false, indexRegenerated: false };
  }

  repo.writeDoc(plan.file, plan.content);

  const scan = repo.scan();
  const problems = collectCorpusProblems(scan);
  if (problems.length) {
    repo.removeDoc(plan.file);
    throw new CorpusInvalidError(problems);
  }

  repo.writeIndex(buildIndex(scan.docs));
  return { plan, written: true, indexRegenerated: true };
}
