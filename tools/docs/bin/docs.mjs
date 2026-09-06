#!/usr/bin/env node
// nevo-docs — repository documentation discovery, index and ADR authoring.
//
//   nevo-docs list      [--type T] [--status S] [--json]
//   nevo-docs find   Q  [--type T] [--status S] [--limit N] [--json]
//   nevo-docs context Q [--limit N] [--json]
//   nevo-docs adr new "Title"  [--dry-run] [--json]
//   nevo-docs check     [--write]
//   nevo-docs generate                      (alias for: check --write)
//
// list / find / context / adr load a FULLY VALIDATED corpus — if the docs are
// inconsistent (missing frontmatter, bad id/reference, ADR numbering, ...) the
// command fails loudly instead of serving partial context.
//
// stdout carries results; stderr carries diagnostics. Exit 0 on success, 1 on
// any failure or a stale/invalid index.

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, rmSync, writeFileSync } from 'node:fs';

import { findRepoRoot } from '../src/scan.mjs';
import { searchDocs } from '../src/search.mjs';
import { checkIndex, writeIndex } from '../src/index-file.mjs';
import { INACTIVE_STATUSES } from '../src/frontmatter.mjs';
import { loadValidatedCorpus, inspectCorpus, CorpusError } from '../src/corpus.mjs';
import { planNewAdr } from '../src/adr.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = findRepoRoot(join(HERE, '..', '..', '..'));
const DOCS_DIR = join(REPO_ROOT, 'docs');
const OPTS = { docsDir: DOCS_DIR, repoRoot: REPO_ROOT };

const print = (line = '') => process.stdout.write(`${line}\n`);
/** @param {string} message */
const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
};

/** Load the validated corpus, or print the problems and exit non-zero. */
function corpusOrExit() {
  try {
    return loadValidatedCorpus(OPTS);
  } catch (err) {
    if (err instanceof CorpusError) {
      fail(`nevo-docs: ${err.message}`);
      fail('Fix the documentation before running discovery commands.');
      process.exit(1);
    }
    throw err;
  }
}

// ── commands ────────────────────────────────────────────────────────────────

/** @typedef {{ type?: string, status?: string, limit?: string, json?: boolean, write?: boolean, 'dry-run'?: boolean }} CliValues */

/** @param {CliValues} values */
function cmdList(values) {
  const docs = searchDocs(corpusOrExit(), { type: values.type, status: values.status });
  if (values.json) return print(JSON.stringify(docs, null, 2));
  if (docs.length === 0) return print('(no documents match)');
  for (const d of docs) print(`${d.id.padEnd(40)} ${String(d.status).padEnd(10)} ${d.file}`);
}

/** @param {string} query @param {CliValues} values */
function cmdFind(query, values) {
  if (!query) return fail('find: a query is required, e.g. `nevo-docs find "git workflow"`');
  const limit = values.limit ? Number(values.limit) : 10;
  const results = searchDocs(corpusOrExit(), {
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
  // Context feeds an agent — never recommend deprecated/superseded knowledge.
  // A superseded doc's replacement outranks it naturally once it is excluded.
  const results = searchDocs(corpusOrExit(), {
    query,
    limit,
    excludeStatuses: INACTIVE_STATUSES,
  });
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

/** @param {string[]} positionals @param {CliValues} values */
function cmdAdr(positionals, values) {
  const [sub, ...rest] = positionals;
  if (sub !== 'new')
    return fail('adr: the only subcommand is \'new\'. Usage: nevo-docs adr new "Title"');
  const title = rest.join(' ').trim();
  if (!title) return fail('adr new: a title is required, e.g. `nevo-docs adr new "Use X for Y"`');

  // Validate the corpus first — never add an ADR on top of an inconsistent set.
  corpusOrExit();

  const adrDir = join(DOCS_DIR, 'architecture', 'decisions');
  let filenames;
  try {
    filenames = readdirSync(adrDir).filter((f) => f.endsWith('.md'));
  } catch (err) {
    return fail(
      `adr new: cannot read ${adrDir}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let plan;
  try {
    plan = planNewAdr({ title, filenames });
  } catch (err) {
    return fail(`adr new: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (values['dry-run']) {
    if (values.json) return print(JSON.stringify({ ...plan }, null, 2));
    print(`# would create ${plan.file}\n`);
    return print(plan.content);
  }

  const abs = join(REPO_ROOT, plan.file);
  writeFileSync(abs, plan.content);

  // Regenerate the index so the repository is immediately valid after creation.
  // planNewAdr already validated the new file in memory, so a problem here means
  // a pre-existing corpus issue — back the new file out rather than leave a
  // half-applied change behind.
  const corpus = inspectCorpus(OPTS);
  if (corpus.problems.length) {
    rmSync(abs, { force: true });
    for (const p of corpus.problems) fail(p);
    return fail(`Corpus is invalid — ${plan.file} was not created. Fix the problems above first.`);
  }
  writeIndex(corpus.docs, DOCS_DIR);

  if (values.json) return print(JSON.stringify({ ...plan, indexRegenerated: true }, null, 2));
  print(`Created ${plan.file} (status: draft)`);
  print('Regenerated docs/index.generated.{md,json}');
  print(
    'Fill in the TODO sections, then promote status to `current` when the decision is adopted.',
  );
}

/** @param {CliValues} values */
function cmdCheck(values) {
  const corpus = inspectCorpus(OPTS);
  if (values.write && corpus.problems.length === 0) {
    writeIndex(corpus.docs, DOCS_DIR);
    print('Wrote docs/index.generated.json and docs/index.generated.md');
  }
  const problems = checkIndex(corpus, DOCS_DIR);
  if (problems.length) {
    for (const p of problems) fail(p);
    if (!values.write) fail('Run `pnpm docs:check --write` to regenerate the index.');
    return;
  }
  print(`OK — ${corpus.docs.length} documents, corpus valid, index current.`);
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
        'dry-run': { type: 'boolean', default: false },
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
    case 'adr':
      return cmdAdr(positionals, values);
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
          'nevo-docs — Nevo SpecDev documentation discovery, index and ADR authoring',
          '',
          '  list                 list every indexed document',
          '  find <query>          rank documents by a query',
          '  context <query>       print the files to load for a task, most relevant first',
          '  adr new "Title"       create the next-numbered ADR from the template',
          '  check [--write]       validate the corpus + verify (or regenerate) the index',
          '  generate             alias for: check --write',
          '',
          'Flags: --type --status --limit --json --write --dry-run',
        ].join('\n'),
      );
    default:
      return fail(`Unknown command '${command}'. Try \`nevo-docs help\`.`);
  }
}

main(process.argv.slice(2));
