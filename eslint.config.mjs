// Flat ESLint config (ESLint 10). One config for the whole repository.
//
// TypeScript sources get type-aware linting via typescript-eslint's project
// service; plain JS/ESM (tooling scripts, config files) get the non-type-aware
// rules so they don't need to belong to a tsconfig.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.output/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.tsbuild/**',
      '**/node_modules/**',
      '**/*.generated.*',
      'docs/**/*.generated.*',
      '.local/**',
    ],
  },

  js.configs.recommended,

  // TypeScript — type-aware. Dormant until the first .ts source is migrated,
  // but configured so it is correct when that happens.
  {
    files: ['**/*.{ts,mts,cts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Plain JS / ESM — no type-aware rules, no tsconfig membership required.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.recommended, tseslint.configs.disableTypeChecked],
  },

  // Shared language options + rules across both.
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Formatting is Prettier's job — turn off any stylistic conflicts.
  prettier,
);
