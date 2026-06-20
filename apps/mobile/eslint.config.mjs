import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/** Minimal ESLint flat config for the mobile app. */
export default [
  {
    // Global ignores: generated / vendor / native config files
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'mocks/react-slot.tsx',
      'expo-env.d.ts',
      'nativewind-env.d.ts',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // TypeScript knows these; the base `no-undef` rule is redundant for TS files.
      'no-undef': 'off',
    },
  },
  {
    // Node-only config files (metro, babel, tailwind)
    files: ['*.config.js', '*.config.mjs', 'metro.config.js', 'babel.config.js', 'babel.nativewind.js', 'tailwind.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  {
    // Tests use Vitest globals
    files: ['**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
];
