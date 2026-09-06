// The installed CLI carries its own version — it does NOT read the repository's
// `version.json` at runtime. `NEVO_SPEC_VERSION_INJECTED` is replaced at bundle
// time by the packaging tool (esbuild `--define`), sourced from
// `nevo-release version`. The `'0.0.0'` fallback is only hit in un-bundled
// workspace runs (the cheap unit tests, `pnpm --filter`), never in a packed
// artifact.

declare const NEVO_SPEC_VERSION_INJECTED: string | undefined;

export const NEVO_SPEC_VERSION: string =
  typeof NEVO_SPEC_VERSION_INJECTED === 'string' ? NEVO_SPEC_VERSION_INJECTED : '0.0.0';
