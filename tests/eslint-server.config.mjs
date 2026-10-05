// ESLint für den 24/7-Dienst (Node, ES-Modul)
export default [{
  files: ['**/*.mjs'],
  languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { process: 'readonly', console: 'readonly', fetch: 'readonly', AbortSignal: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', URL: 'readonly', Intl: 'readonly' } },
  rules: { 'no-undef': 'error', 'no-unused-vars': 'warn', 'no-unreachable': 'error', 'no-dupe-keys': 'error', 'no-redeclare': 'error', 'no-const-assign': 'error', eqeqeq: ['warn', 'smart'] }
}];
