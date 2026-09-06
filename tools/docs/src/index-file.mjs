// Build / write / check the generated documentation index.
//
// The generated files are fully deterministic — no timestamp — so
// `pnpm docs:check --write` run twice with no source change leaves the working
// tree clean.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { validateDoc, validateCorpus } from './frontmatter.mjs';

const GENERATED_NOTICE = '<!-- GENERATED FILE — do not edit. Run: pnpm docs:check --write -->\n\n';

const TYPE_ORDER = ['hub', 'architecture', 'adr', 'development', 'product'];

/** @param {string} type */
function typeRank(type) {
  const i = TYPE_ORDER.indexOf(type);
  return i === -1 ? TYPE_ORDER.length : i;
}

/** docs/index.generated.md links are relative to docs/ @param {string} file */
function relLink(file) {
  return file.replace(/^docs\//, '');
}

/**
 * Deterministic index content.
 *
 * @param {Array<Record<string, any>>} docs
 * @returns {{ json: object, md: string }}
 */
export function buildIndex(docs) {
  const sorted = [...docs].sort(
    (a, b) => typeRank(a.type) - typeRank(b.type) || String(a.id).localeCompare(String(b.id)),
  );

  /** @type {Record<string, Array<Record<string, any>>>} */
  const byType = {};
  for (const doc of sorted) (byType[doc.type] ||= []).push(doc);

  let md = `${GENERATED_NOTICE}# Documentation index\n\n`;
  md +=
    'Regenerate with `pnpm docs:check --write`. Human-authored navigation lives in ' +
    '[`docs/README.md`](README.md).\n\n';

  for (const [type, group] of Object.entries(byType)) {
    md += `## ${type.charAt(0).toUpperCase()}${type.slice(1)}\n\n`;
    md += '| ID | Title | Status | Summary |\n|---|---|---|---|\n';
    for (const doc of group) {
      const summary = String(doc.summary || '')
        .replace(/\r?\n/g, ' ')
        .replace(/\|/g, '\\|')
        .trim();
      md += `| \`${doc.id}\` | [${doc.title}](${relLink(doc.file)}) | ${doc.status} | ${summary} |\n`;
    }
    md += '\n';
  }

  return {
    json: {
      docs: sorted.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        status: d.status,
        file: d.file,
        read_when: Array.isArray(d.read_when) ? d.read_when : [],
        summary: d.summary || '',
        related: Array.isArray(d.related) ? d.related : [],
      })),
    },
    md,
  };
}

/** @param {unknown} json */
const jsonText = (json) => `${JSON.stringify(json, null, 2)}\n`;

/**
 * @param {Array<Record<string, any>>} docs
 * @param {string} docsDir absolute path to docs/
 */
export function writeIndex(docs, docsDir) {
  const built = buildIndex(docs);
  writeFileSync(join(docsDir, 'index.generated.json'), jsonText(built.json));
  writeFileSync(join(docsDir, 'index.generated.md'), built.md);
}

/**
 * Validate the corpus and confirm the on-disk index matches a fresh build.
 *
 * @param {{ docs: Array<Record<string, any>>, missingFrontmatter?: string[] }} corpus
 * @param {string} docsDir absolute path to docs/
 * @returns {string[]} problems (empty ⇒ valid and current)
 */
export function checkIndex(corpus, docsDir) {
  const { docs, missingFrontmatter = [] } = corpus;
  /** @type {string[]} */
  const problems = [];

  for (const file of missingFrontmatter) {
    problems.push(`${file}: missing frontmatter (every authored docs/**.md file needs it)`);
  }
  for (const doc of docs) problems.push(...validateDoc(doc));
  problems.push(...validateCorpus(docs));
  if (problems.length) return problems;

  const built = buildIndex(docs);

  const jsonPath = join(docsDir, 'index.generated.json');
  if (!existsSync(jsonPath)) {
    problems.push('missing: docs/index.generated.json — run `pnpm docs:check --write`');
  } else if (readFileSync(jsonPath, 'utf8').replace(/\r\n/g, '\n') !== jsonText(built.json)) {
    problems.push('stale: docs/index.generated.json — run `pnpm docs:check --write`');
  }

  const mdPath = join(docsDir, 'index.generated.md');
  if (!existsSync(mdPath)) {
    problems.push('missing: docs/index.generated.md — run `pnpm docs:check --write`');
  } else if (readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n') !== built.md) {
    problems.push('stale: docs/index.generated.md — run `pnpm docs:check --write`');
  }

  return problems;
}
