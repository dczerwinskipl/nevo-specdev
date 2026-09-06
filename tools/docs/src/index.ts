// Public surface of nevo-repo-docs — imported by tests. The executable is `./bin.ts`.

export * from './errors.js';
export * from './domain/frontmatter.js';
export * from './domain/adr.js';
export * from './domain/search.js';
export * from './domain/index-file.js';
export { collectCorpusProblems, type ScanResult } from './domain/corpus.js';
export type { DocRepository, Logger } from './ports.js';
export {
  createFileSystemDocRepository,
  findRepoRoot,
  isFrontmatterExempt,
} from './infra/doc-repository.js';
export { loadValidatedCorpus, inspectCorpus } from './app/load-corpus.js';
export { findDocuments, getContext } from './app/find-documents.js';
export { validateDocumentation } from './app/validate-documentation.js';
export { createAdr } from './app/create-adr.js';
export { createProgram } from './cli/program.js';
export type { DocsCliContext } from './cli/context.js';
