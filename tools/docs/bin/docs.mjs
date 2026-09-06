#!/usr/bin/env node
// nevo-docs — repository-internal documentation discovery for Nevo SpecDev.
//
//   nevo-docs list      [--type T] [--status S] [--json]
//   nevo-docs find   Q  [--type T] [--status S] [--limit N] [--json]
//   nevo-docs context Q [--limit N] [--json]
//   nevo-docs check     [--write]
//   nevo-docs generate                      (alias for: check --write)
//
// stdout carries results (clean text or JSON); stderr carries diagnostics.
// Exit code is 0 on success, 1 on any failure or stale/invalid index.

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { scanDocs, findRepoRoot } from '../src/scan.mjs';
import { searchDocs } from '../src/search.mjs';
import { checkIndex, writeIndex } from '../src/index-file.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = findRepoRoot(join(HERE, '..', '..', '..'));
const DOCS_DIR = join(REPO_ROOT, 'docs');

function loadCorpus() {
  return scanDocs({ docsDir: DOCS_DIR, repoRoot: REPO_ROOT });
}

/** Just the parsed docs — for list / find / context. */
function loadDocs() {
  return loadCorpus().docs;
}

/** @param {string} [line] */
function print(line = '') {
  process.stdout.write(`${line}\n`);
}

/** @param {string} message */
function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

// ── commands ────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CliValues
 * @property {string} [type]
 * @property {string} [status]
 * @property {string} [limit]
 * @property {boolean} [json]
 * @property {boolean} [write]
 */

/** @param {CliValues} values */
function cmdList(values) {
  const docs = searchDocs(loadDocs(), { type: values.type, status: values.status });
  if (values.json) return print(JSON.stringify(docs, null, 2));
  if (docs.length === 0) return print('(no documents match)');
  for (const d of docs) print(`${d.id.padEnd(38)} ${String(d.status).padEnd(10)} ${d.file}`);
}

/** @param {string} query @param {CliValues} values */
function cmdFind(query, values) {
  if (!query) return fail('find: a query is required, e.g. `nevo-docs find "git workflow"`');
  const limit = values.limit ? Number(values.limit) : 10;
  const results = searchDocs(loadDocs(), {
    query,
    type: values.type,
    status: values.status,
    limit,
  });
  if (values.json) return print(JSON.stringify(results, null, 2));
  if (results.length === 0) return print(`(no documents match "${query}")`);
  for (const d of results) {
    print(`${d.id} — "${d.title}"  ${d.file}`);
    const why = [];
    if (d.matchedTerms?.length) why.push(`terms: ${d.matchedTerms.join(', ')}`);
    if (d.matchedFields?.length) why.push(`in: ${d.matchedFields.join(', ')}`);
    if (why.length) print(`    (${why.join('; ')})`);
  }
}

/** @param {string} query @param {CliValues} values */
function cmdContext(query, values) {
  if (!query)
    return fail('context: a query is required, e.g. `nevo-docs context "react tailwind"`');
  const limit = values.limit ? Number(values.limit) : 5;
  const results = searchDocs(loadDocs(), { query, limit });
  if (values.json) {
    return print(
      JSON.stringify(
        results.map((d) => ({
          id: d.id,
          file: d.file,
          title: d.title,
          summary: d.summary || '',
          read_when: Array.isArray(d.read_when) ? d.read_when : [],
        })),
        null,
        2,
      ),
    );
  }
  if (results.length === 0) return print(`(no context found for "${query}")`);
  print(`# Context for: ${query}`);
  print('# Read these files, most relevant first:');
  print();
  for (const d of results) {
    print(d.file);
    if (d.summary) print(`  ${String(d.summary).replace(/\s+/g, ' ').trim()}`);
  }
}

/** @param {CliValues} values */
function cmdCheck(values) {
  const corpus = loadCorpus();
  if (values.write) {
    writeIndex(corpus.docs, DOCS_DIR);
    print('Wrote docs/index.generated.json and docs/index.generated.md');
  }
  const problems = checkIndex(corpus, DOCS_DIR);
  if (problems.length) {
    for (const p of problems) fail(p);
    if (!values.write) fail('Run `pnpm docs:check --write` to regenerate the index.');
    return;
  }
  print(`OK — ${corpus.docs.length} documents, index current.`);
}

// ── entry ───────────────────────────────────────────────────────────────────

/** @param {string[]} argv */
function main(argv) {
  const [command, ...rest] = argv;
  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        type: { type: 'string' },
        status: { type: 'string' },
        limit: { type: 'string' },
        json: { type: 'boolean', default: false },
        write: { type: 'boolean', default: false },
      },
    });
  } catch (err) {
    return fail(`Bad arguments: ${err instanceof Error ? err.message : String(err)}`);
  }
  const { values, positionals } = parsed;
  const query = positionals.join(' ').trim();

  switch (command) {
    case 'list':
      return cmdList(values);
    case 'find':
      return cmdFind(query, values);
    case 'context':
      return cmdContext(query, values);
    case 'check':
      return cmdCheck(values);
    case 'generate':
      return cmdCheck({ ...values, write: true });
    case undefined:
    case '--help':
    case '-h':
    case 'help':
      return print(
        [
          'nevo-docs — Nevo SpecDev documentation discovery',
          '',
          '  list               list every indexed document',
          '  find <query>       rank documents by a query',
          '  context <query>    print the files to load for a task, most relevant first',
          '  check [--write]    validate frontmatter + verify (or regenerate) the index',
          '  generate           alias for: check --write',
          '',
          'Flags: --type --status --limit --json --write',
        ].join('\n'),
      );
    default:
      return fail(`Unknown command '${command}'. Try \`nevo-docs help\`.`);
  }
}

main(process.argv.slice(2));
