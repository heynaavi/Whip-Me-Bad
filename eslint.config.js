const globals = require('globals');

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', 'scripts/**', 'bin/**'],
  },
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-console': 'off',
      'no-empty': 'off',
    },
  },
];