import globals from 'globals';
export default [
  { files: ['lint-g01.mjs'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser } },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }], 'no-dupe-keys': 'error', 'no-redeclare': 'error', 'no-unreachable': 'error', 'no-const-assign': 'error', 'no-self-assign': 'error', 'no-use-before-define': ['error', { functions: false, classes: false, variables: false }] } },
  { files: ['lint-sw.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.serviceworker } }, rules: { 'no-undef': 'error', 'no-unused-vars': 'warn' } },
];
