// Public surface of nevo-repo-docs — imported by the CLI and by tests.

export {
  parseFrontmatter,
  validateDoc,
  validateCorpus,
  REQUIRED_FIELDS,
  KNOWN_TYPES,
  KNOWN_STATUSES,
  INACTIVE_STATUSES,
} from './frontmatter.mjs';
export { scanDocs, findRepoRoot, isFrontmatterExempt } from './scan.mjs';
export { searchDocs, scoreDoc, tokenize, normalizeTerm } from './search.mjs';
export { buildIndex, writeIndex, checkIndex } from './index-file.mjs';
export { loadValidatedCorpus, inspectCorpus, CorpusError } from './corpus.mjs';
export {
  slugify,
  padNumber,
  isoDate,
  isIsoDate,
  nextAdrNumber,
  planNewAdr,
  renderAdr,
  validateRenderedAdr,
  validateAdrs,
  ADR_DIR,
  NEW_ADR_STATUS,
} from './adr.mjs';
