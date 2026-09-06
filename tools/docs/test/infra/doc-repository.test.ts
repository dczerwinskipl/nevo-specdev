import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildIndex } from '../../src/domain/index-file.js';
import {
  createFileSystemDocRepository,
  findRepoRoot,
  isFrontmatterExempt,
} from '../../src/infra/doc-repository.js';

let root: string;
let docsDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nevo-docs-repo-'));
  docsDir = join(root, 'docs');
  mkdirSync(join(docsDir, 'development'), { recursive: true });
  mkdirSync(join(docsDir, 'templates'), { recursive: true });
  mkdirSync(join(docsDir, 'architecture', 'decisions'), { recursive: true });
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const fm = (id: string, type = 'development'): string =>
  `---\nid: ${id}\ntype: ${type}\ntitle: T\nstatus: current\nread_when:\n  - x\nsummary: s\n---\n# body\n`;

describe('createFileSystemDocRepository.scan', () => {
  it('parses docs, sorts by id, forward-slashes paths, reports missing frontmatter', () => {
    writeFileSync(join(docsDir, 'development', 'git-workflow.md'), fm('development.git-workflow'));
    writeFileSync(join(docsDir, 'README.md'), fm('docs.readme', 'hub'));
    writeFileSync(join(docsDir, 'random-notes.md'), '# prose only\n');
    writeFileSync(join(docsDir, 'templates', 'adr-template.md'), '# copy me\n');
    writeFileSync(join(docsDir, 'index.generated.md'), 'generated\n');

    const repo = createFileSystemDocRepository({ repoRoot: root, docsDir });
    const { docs, missingFrontmatter } = repo.scan();

    expect(docs.map((d) => d.id)).toEqual(['development.git-workflow', 'docs.readme']);
    expect(docs[0]?.file).toBe('docs/development/git-workflow.md');
    expect(docs[0]?.body).toContain('# body');
    expect(missingFrontmatter).toEqual(['docs/random-notes.md']);
  });
});

describe('index round-trip', () => {
  it('writeIndex then readIndex matches buildIndex bytes', () => {
    writeFileSync(join(docsDir, 'README.md'), fm('docs.readme', 'hub'));
    const repo = createFileSystemDocRepository({ repoRoot: root, docsDir });
    const built = buildIndex(repo.scan().docs);
    repo.writeIndex(built);
    expect(readFileSync(join(docsDir, 'index.generated.md'), 'utf8')).toBe(built.md);
    expect(repo.readIndex()).toEqual({ md: built.md, json: built.json });
  });
});

describe('isFrontmatterExempt / findRepoRoot', () => {
  it('exempts templates + generated only, and finds the workspace root', () => {
    expect(isFrontmatterExempt('templates/adr-template.md')).toBe(true);
    expect(isFrontmatterExempt('index.generated.md')).toBe(true);
    expect(isFrontmatterExempt('development/git-workflow.md')).toBe(false);
    expect(findRepoRoot(join(docsDir, 'development'))).toBe(root);
  });
});
