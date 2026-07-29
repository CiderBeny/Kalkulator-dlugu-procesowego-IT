import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker,
        PDE: 'writable',
        Chart: 'readonly',
        XLSX: 'readonly',
        html2canvas: 'readonly',
      },
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { args: 'after-used', varsIgnorePattern: '^PDE$' }],
      'eqeqeq': 'error',
      'no-eval': 'error',
    },
  },
  {
    files: ['src/mc-worker.js'],
    languageOptions: {
      globals: {
        ...globals.worker,
        PDE: 'writable',
      },
    },
  },
  {
    files: ['src/gen-og-image.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['src/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'after-used' }],
    },
  },
];
