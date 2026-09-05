// Public surface of @nevo-specdev/docs-tools — imported by the CLI and by tests.

export {
  parseFrontmatter,
  validateDoc,
  validateCorpus,
  REQUIRED_FIELDS,
  KNOWN_TYPES,
  KNOWN_STATUSES,
} from './frontmatter.mjs';
export { scanDocs, findRepoRoot } from './scan.mjs';
export { searchDocs, scoreDoc, tokenize, normalizeTerm } from './search.mjs';
export { buildIndex, writeIndex, checkIndex } from './index-file.mjs';
