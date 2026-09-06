import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scanDocs, findRepoRoot, isFrontmatterExempt } from '../src/scan.mjs';

let root;
let docsDir;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nevo-scan-'));
  docsDir = join(root, 'docs');
  mkdirSync(join(docsDir, 'development'), { recursive: true });
  mkdirSync(join(docsDir, 'templates'), { recursive: true });
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const fm = (id, type = 'development') =>
  `---\nid: ${id}\ntype: ${type}\ntitle: T\nstatus: current\n---\n# body\n`;

describe('scanDocs', () => {
  it('parses frontmatter docs, sorts by id, forward-slashes paths', () => {
    writeFileSync(join(docsDir, 'development', 'git-workflow.md'), fm('development.git-workflow'));
    writeFileSync(join(docsDir, 'README.md'), fm('docs.readme', 'hub'));

    const { docs, missingFrontmatter } = scanDocs({ docsDir, repoRoot: root });

    expect(docs.map((d) => d.id)).toEqual(['development.git-workflow', 'docs.readme']);
    expect(docs[0].file).toBe('docs/development/git-workflow.md');
    expect(missingFrontmatter).toEqual([]);
  });

  it('reports an authored file with no frontmatter — it does not silently disappear', () => {
    writeFileSync(join(docsDir, 'README.md'), fm('docs.readme', 'hub'));
    writeFileSync(join(docsDir, 'random-notes.md'), '# just prose, no frontmatter\n');

    const { docs, missingFrontmatter } = scanDocs({ docsDir, repoRoot: root });

    expect(docs.map((d) => d.id)).toEqual(['docs.readme']);
    expect(missingFrontmatter).toEqual(['docs/random-notes.md']);
  });

  it('exempts templates/** and *.generated.* from the frontmatter requirement', () => {
    writeFileSync(join(docsDir, 'templates', 'adr-template.md'), '# ADR template (copy me)\n');
    writeFileSync(join(docsDir, 'index.generated.md'), 'generated, no frontmatter\n');
    writeFileSync(join(docsDir, 'README.md'), fm('docs.readme', 'hub'));

    const { missingFrontmatter } = scanDocs({ docsDir, repoRoot: root });
    expect(missingFrontmatter).toEqual([]);
  });

  it('does not index generated files even if they look like they have frontmatter', () => {
    writeFileSync(join(docsDir, 'README.md'), fm('docs.readme', 'hub'));
    writeFileSync(join(docsDir, 'routing.generated.md'), fm('should.not.appear'));

    const { docs } = scanDocs({ docsDir, repoRoot: root });
    expect(docs.map((d) => d.id)).toEqual(['docs.readme']);
  });

  it('returns empty when docs/ does not exist', () => {
    expect(scanDocs({ docsDir: join(root, 'missing'), repoRoot: root })).toEqual({
      docs: [],
      missingFrontmatter: [],
    });
  });
});

describe('isFrontmatterExempt', () => {
  it('covers templates and generated files only', () => {
    expect(isFrontmatterExempt('templates/adr-template.md')).toBe(true);
    expect(isFrontmatterExempt('index.generated.md')).toBe(true);
    expect(isFrontmatterExempt('development/x.generated.json')).toBe(true);
    expect(isFrontmatterExempt('development/git-workflow.md')).toBe(false);
    expect(isFrontmatterExempt('random-notes.md')).toBe(false);
  });
});

describe('findRepoRoot', () => {
  it('walks up to the directory holding pnpm-workspace.yaml', () => {
    expect(findRepoRoot(join(docsDir, 'development'))).toBe(root);
  });

  it('falls back to the start dir when no marker is found', () => {
    const orphan = mkdtempSync(join(tmpdir(), 'nevo-orphan-'));
    try {
      expect(findRepoRoot(orphan)).toBe(orphan);
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });
});
