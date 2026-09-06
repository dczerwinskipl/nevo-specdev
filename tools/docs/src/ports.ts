import type { ScanResult } from './domain/corpus.js';
import type { BuiltIndex, OnDiskIndex } from './domain/index-file.js';

/** The filesystem boundary for the docs tooling. Everything the use cases touch. */
export interface DocRepository {
  /** Walk `docs/`, parse frontmatter, return the deterministic corpus. */
  scan(): ScanResult;
  /** Basenames of `docs/architecture/decisions/*.md`. */
  adrFilenames(): string[];
  /** `true` once the file existed and was created. */
  writeDoc(repoRelPath: string, content: string): void;
  removeDoc(repoRelPath: string): void;
  readIndex(): OnDiskIndex;
  writeIndex(index: BuiltIndex): void;
}

export type Logger = (line: string) => void;
